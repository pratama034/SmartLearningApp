import { create } from 'zustand'
import type { Session, Subscription, User as SupabaseAuthUser } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { evaluateStreak, calculateNewStreakOnSessionComplete } from '../lib/streak'

export interface User {
  id: string
  name: string
  email: string
  nim: string
  major: string
  university: string
  streak: number
  lastStudyDate?: string | null
  badges: string[]
  isPrivateProfile: boolean
  role?: 'mahasiswa' | 'dosen' | 'admin'
  program_studi?: string
  timezone?: string
  tenant_id?: string
}

interface ProfileRow {
  id: string
  name: string | null
  email: string | null
  nim: string | null
  major: string | null
  university: string | null
  streak: number | null
  last_study_date?: string | null
  badges: string[] | null
  is_private_profile: boolean | null
  has_seen_onboarding?: boolean | null
  role?: 'mahasiswa' | 'dosen' | 'admin' | null
  timezone?: string | null
  tenant_id?: string | null
}

const STORAGE_KEY = 'smartlearning-user'
const ONBOARDING_KEY = 'smartlearning-onboarding-seen'

function getStoredOnboardingFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === 'true'
  } catch {
    return false
  }
}

function mapProfileToUser(authUser: SupabaseAuthUser, profile?: ProfileRow | null): User {
  const fallbackName =
    (authUser.user_metadata?.name as string | undefined) ||
    authUser.email?.split('@')[0] ||
    'Mahasiswa'
  const major = profile?.major ?? (authUser.user_metadata?.major as string | undefined) ?? ''

  const rawStreak = typeof profile?.streak === 'number' ? profile.streak : 0
  const rawLastDate = profile?.last_study_date ?? null
  const evaluation = evaluateStreak(rawStreak, rawLastDate)

  // Jika streak bolong kemarin (needsReset), sinkronkan reset streak ke 0 di database
  if (evaluation.needsReset && profile?.id) {
    void supabase
      .from('profiles')
      .update({ streak: 0, updated_at: new Date().toISOString() })
      .eq('id', profile.id)
      .then(({ error }) => {
        if (error) {
          console.warn('[Streak Sync] Gagal reset streak ke Supabase:', error.message)
        }
      })
  }

  return {
    id: profile?.id || authUser.id,
    name: profile?.name || fallbackName,
    email: profile?.email || authUser.email || '',
    nim: profile?.nim ?? (authUser.user_metadata?.nim as string | undefined) ?? '',
    major,
    university:
      profile?.university ??
      (authUser.user_metadata?.university as string | undefined) ??
      'Universitas Indonesia',
    streak: evaluation.currentStreak,
    lastStudyDate: rawLastDate,
    badges:
      Array.isArray(profile?.badges) && profile.badges.length > 0
        ? profile.badges
        : ['Fokus Master', 'Awal yang Baik'],
    isPrivateProfile: Boolean(profile?.is_private_profile),
    program_studi: major,
    role: profile?.role ?? 'mahasiswa',
    timezone: profile?.timezone ?? 'Asia/Jakarta',
    tenant_id: profile?.tenant_id ?? 'default',
  }
}

async function fetchProfileByUser(
  authUser: SupabaseAuthUser
): Promise<{ user: User; hasSeenOnboarding?: boolean }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle<ProfileRow>()

    if (error) {
      console.warn(
        '[Supabase Profiles] Tabel profiles belum ada atau terjadi kendala query (404/Not Found). Menggunakan metadata sesi auth:',
        error.message
      )
      return {
        user: mapProfileToUser(authUser, null),
        hasSeenOnboarding: false,
      }
    }

    // Jika tabel profiles ada tetapi baris data user belum ada
    // (misalnya akun dibuat sebelum trigger database diaktifkan)
    if (!data) {
      try {
        const fallbackName =
          (authUser.user_metadata?.name as string | undefined) ||
          authUser.email?.split('@')[0] ||
          'Mahasiswa'

        const newProfilePayload = {
          id: authUser.id,
          email: authUser.email || '',
          name: fallbackName,
          nim: (authUser.user_metadata?.nim as string | undefined) || '',
          major: (authUser.user_metadata?.major as string | undefined) || 'Teknik Informatika',
          university:
            (authUser.user_metadata?.university as string | undefined) || 'Universitas Indonesia',
          streak: 3,
          badges: ['Fokus Master', 'Awal yang Baik'],
          is_private_profile: false,
          has_seen_onboarding: false,
          role: 'mahasiswa',
          timezone: 'Asia/Jakarta',
          tenant_id: 'default',
        }

        const { data: insertedData, error: insertError } = await supabase
          .from('profiles')
          .insert(newProfilePayload)
          .select('*')
          .single<ProfileRow>()

        if (!insertError && insertedData) {
          return {
            user: mapProfileToUser(authUser, insertedData),
            hasSeenOnboarding: false,
          }
        }
      } catch {
        // Abaikan error pembuatan baris otomatis
      }

      return {
        user: mapProfileToUser(authUser, null),
        hasSeenOnboarding: false,
      }
    }

    return {
      user: mapProfileToUser(authUser, data),
      hasSeenOnboarding:
        typeof data.has_seen_onboarding === 'boolean' ? data.has_seen_onboarding : undefined,
    }
  } catch (err) {
    console.warn('[Supabase Profiles] Terjadi error tak terduga, menggunakan fallback auth:', err)
    return {
      user: mapProfileToUser(authUser, null),
      hasSeenOnboarding: false,
    }
  }
}

let authSubscription: Subscription | null = null

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
  hasSeenOnboarding: boolean
  authError: string | null
  clearAuthError: () => void
  initializeAuth: () => Promise<void>
  setHasSeenOnboarding: () => void
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<string>
  updateProfile: (updatedData: Partial<User>) => Promise<void>
  recordSessionCompletionForStreak: () => Promise<{ newStreak: number; isFirstToday: boolean; todayStr: string }>
  togglePrivacy: (isPrivate: boolean) => Promise<void>
  logout: () => Promise<void>
  setSession: (session: Session | null) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,
  hasSeenOnboarding: getStoredOnboardingFlag(),
  authError: null,

  clearAuthError: () => set({ authError: null }),

  initializeAuth: async () => {
    set({ isLoading: true, authError: null })

    try {
      // a. Cek sesi aktif saat web dimuat
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw new Error(sessionError.message)
      }

      // c. Jika ada sesi, ambil data profil dari tabel profiles
      if (session?.user) {
        const { user: profileUser, hasSeenOnboarding } = await fetchProfileByUser(session.user)
        set((state) => ({
          user: profileUser,
          isAuthenticated: true,
          hasSeenOnboarding: hasSeenOnboarding ?? state.hasSeenOnboarding,
        }))
      } else {
        set({ user: null, isAuthenticated: false })
      }

      // b. Daftarkan listener onAuthStateChange
      if (authSubscription) {
        authSubscription.unsubscribe()
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        if (nextSession?.user) {
          try {
            const { user: profileUser, hasSeenOnboarding } = await fetchProfileByUser(
              nextSession.user
            )
            set((state) => ({
              user: profileUser,
              isAuthenticated: true,
              isLoading: false,
              isInitialized: true,
              hasSeenOnboarding: hasSeenOnboarding ?? state.hasSeenOnboarding,
            }))
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'Gagal memuat profil pengguna dari Supabase.'
            set({
              user: mapProfileToUser(nextSession.user, null),
              isAuthenticated: true,
              isLoading: false,
              isInitialized: true,
              authError: message,
            })
          }
        } else {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            isInitialized: true,
          })
        }
      })

      authSubscription = subscription
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal menginisialisasi sesi autentikasi.'
      set({
        user: null,
        isAuthenticated: false,
        authError: message,
      })
    } finally {
      // d. Set isLoading: false di akhir proses
      set({ isLoading: false, isInitialized: true })
    }
  },

  setHasSeenOnboarding: () => {
    try {
      window.localStorage.setItem(ONBOARDING_KEY, 'true')
    } catch {
      // Abaikan error localStorage
    }
    set({ hasSeenOnboarding: true })

    const currentUser = get().user
    if (currentUser) {
      void supabase
        .from('profiles')
        .update({ has_seen_onboarding: true, updated_at: new Date().toISOString() })
        .eq('id', currentUser.id)
    }
  },

  login: async (email, password) => {
    set({ authError: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (
          error.message?.toLowerCase().includes('email not confirmed') ||
          (error as { code?: string }).code === 'email_not_confirmed'
        ) {
          throw new Error('Email belum diverifikasi. Silakan periksa kotak masuk atau spam di Gmail Anda untuk klik tautan konfirmasi.')
        }
        if (error.message?.toLowerCase().includes('invalid login credentials')) {
          throw new Error('Email atau sandi salah. Silakan periksa kembali.')
        }
        throw new Error(error.message)
      }

      if (data.user) {
        const { user: profileUser, hasSeenOnboarding } = await fetchProfileByUser(data.user)
        set((state) => ({
          user: profileUser,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
          hasSeenOnboarding: hasSeenOnboarding ?? state.hasSeenOnboarding,
        }))
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Login gagal. Periksa kembali email dan sandi.'
      set({ authError: message })
      throw new Error(message)
    }
  },

  register: async (email, password, name) => {
    set({ authError: null })

    const cleanEmail = email.trim()
    if (!cleanEmail.endsWith('@gmail.com')) {
      const errorMsg = 'Harap gunakan akun @gmail.com yang aktif'
      set({ authError: errorMsg })
      throw new Error(errorMsg)
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { name },
        },
      })

      if (error) {
        throw new Error(error.message)
      }

      // Supabase sekarang mewajibkan konfirmasi email: JANGAN set isAuthenticated: true
      set({ isAuthenticated: false, isLoading: false })

      // Kembalikan status sukses agar UI dapat menampilkan instruksi verifikasi email
      return 'check_email'
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Pendaftaran gagal. Silakan coba lagi.'
      set({ authError: message, isLoading: false })
      throw new Error(message)
    }
  },

  updateProfile: async (updatedData: Partial<User>) => {
    set({ authError: null })
    const currentUser = get().user
    if (!currentUser) {
      const msg = 'Sesi pengguna tidak ditemukan. Silakan masuk kembali.'
      set({ authError: msg })
      throw new Error(msg)
    }

    try {
      const dbUpdatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (updatedData.name !== undefined) dbUpdatePayload.name = updatedData.name
      if (updatedData.nim !== undefined) dbUpdatePayload.nim = updatedData.nim
      if (updatedData.major !== undefined) dbUpdatePayload.major = updatedData.major
      if (updatedData.university !== undefined) dbUpdatePayload.university = updatedData.university
      if (updatedData.streak !== undefined) dbUpdatePayload.streak = updatedData.streak
      if (updatedData.lastStudyDate !== undefined) dbUpdatePayload.last_study_date = updatedData.lastStudyDate
      if (updatedData.badges !== undefined) dbUpdatePayload.badges = updatedData.badges
      if (updatedData.isPrivateProfile !== undefined) {
        dbUpdatePayload.is_private_profile = updatedData.isPrivateProfile
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(dbUpdatePayload)
        .eq('id', currentUser.id)
        .select('*')
        .single<ProfileRow>()

      if (error) {
        if (
          error.code === '42P01' ||
          error.code === 'PGRST204' ||
          error.message?.includes('not found') ||
          error.message?.includes('relation')
        ) {
          throw new Error(
            'Tabel public.profiles belum dibuat di Supabase. Silakan jalankan script supabase/schema.sql di SQL Editor Supabase.'
          )
        }
        throw new Error(error.message)
      }

      const nextMajor = data?.major ?? updatedData.major ?? currentUser.major
      const updatedUser: User = {
        ...currentUser,
        ...updatedData,
        name: data?.name ?? updatedData.name ?? currentUser.name,
        nim: data?.nim ?? updatedData.nim ?? currentUser.nim,
        major: nextMajor,
        program_studi: nextMajor,
        university: data?.university ?? updatedData.university ?? currentUser.university,
        streak: typeof data?.streak === 'number' ? data.streak : currentUser.streak,
        lastStudyDate: data?.last_study_date ?? updatedData.lastStudyDate ?? currentUser.lastStudyDate ?? null,
        badges: Array.isArray(data?.badges) ? data.badges : currentUser.badges,
        isPrivateProfile:
          typeof data?.is_private_profile === 'boolean'
            ? data.is_private_profile
            : (updatedData.isPrivateProfile ?? currentUser.isPrivateProfile),
      }

      set({ user: updatedUser })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal memperbarui profil di Supabase.'
      set({ authError: message })
      throw new Error(message)
    }
  },

  recordSessionCompletionForStreak: async () => {
    const currentUser = get().user
    if (!currentUser?.id) {
      return {
        newStreak: 1,
        isFirstToday: true,
        todayStr: new Date().toISOString().split('T')[0],
      }
    }

    const { newStreak, isFirstToday, todayStr } = calculateNewStreakOnSessionComplete(
      currentUser.streak || 0,
      currentUser.lastStudyDate
    )

    // Update state user lokal secara instan
    const updatedUser: User = {
      ...currentUser,
      streak: newStreak,
      lastStudyDate: todayStr,
    }
    set({ user: updatedUser })

    // Sinkronkan ke Supabase
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          streak: newStreak,
          last_study_date: todayStr,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id)

      if (error) {
        console.warn(
          '[Streak Sync] Mencoba fallback update streak jika kolom last_study_date belum tersedia di remote DB:',
          error.message
        )
        await supabase
          .from('profiles')
          .update({
            streak: newStreak,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentUser.id)
      }
    } catch (err) {
      console.warn('[Streak Sync] Kendala saat menyimpan streak ke database:', err)
    }

    return { newStreak, isFirstToday, todayStr }
  },

  togglePrivacy: async (isPrivate: boolean) => {
    set({ authError: null })
    const currentUser = get().user
    if (!currentUser) {
      const msg = 'Sesi pengguna tidak ditemukan. Silakan masuk kembali.'
      set({ authError: msg })
      throw new Error(msg)
    }

    const previousValue = currentUser.isPrivateProfile
    // Optimistic UI update
    set({ user: { ...currentUser, isPrivateProfile: isPrivate } })

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_private_profile: isPrivate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id)

      if (error) {
        if (
          error.code === '42P01' ||
          error.code === 'PGRST204' ||
          error.message?.includes('not found') ||
          error.message?.includes('relation')
        ) {
          throw new Error(
            'Tabel public.profiles belum dibuat di Supabase. Silakan jalankan script supabase/schema.sql di SQL Editor Supabase.'
          )
        }
        throw new Error(error.message)
      }
    } catch (error) {
      // Revert optimistic state if update fails
      set({ user: { ...currentUser, isPrivateProfile: previousValue } })
      const message =
        error instanceof Error ? error.message : 'Gagal mengubah pengaturan privasi di Supabase.'
      set({ authError: message })
      throw new Error(message)
    }
  },

  logout: async () => {
    set({ authError: null })
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        throw new Error(error.message)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal keluar dari sesi Supabase.'
      set({ authError: message })
      throw new Error(message)
    } finally {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
        window.localStorage.removeItem('smartlearning-session')
        window.localStorage.removeItem('smartlearning-cofocus-sharing')
        window.localStorage.removeItem('smartlearning-cofocus-auto-reply')
        window.localStorage.removeItem(ONBOARDING_KEY)
      } catch {
        // Abaikan error penghapusan localStorage
      }
      set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true })
    }
  },

  setSession: (session) => {
    if (session?.user) {
      void fetchProfileByUser(session.user)
        .then(({ user: profileUser, hasSeenOnboarding }) => {
          set((state) => ({
            user: profileUser,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
            hasSeenOnboarding: hasSeenOnboarding ?? state.hasSeenOnboarding,
          }))
        })
        .catch(() => {
          set({
            user: mapProfileToUser(session.user, null),
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          })
        })
    } else {
      set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true })
    }
  },
}))
