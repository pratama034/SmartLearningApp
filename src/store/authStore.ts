import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface User {
  id: string
  name: string
  email: string
  nim: string
  major: string
  university: string
  role?: 'mahasiswa' | 'dosen' | 'admin'
  program_studi?: string
  timezone?: string
  tenant_id?: string
}

export const initialMockUser: User = {
  id: 'mhs-2201082001',
  name: 'Budi Santoso',
  email: 'budi.santoso@mahasiswa.ac.id',
  nim: '2201082001',
  major: 'Teknik Informatika',
  university: 'Universitas Indonesia',
  program_studi: 'Teknik Informatika',
  role: 'mahasiswa',
  timezone: 'Asia/Jakarta',
  tenant_id: 'ui-depok',
}

const STORAGE_KEY = 'smartlearning-user'

function getStoredUser(): User | null {
  if (typeof window === 'undefined') return initialMockUser
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as User
    }
  } catch {
    // Ignore JSON parse errors and return default mock
  }
  return initialMockUser
}

const initialUser = getStoredUser()

interface AuthState {
  isAuthenticated: boolean
  isInitialized: boolean
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  updateProfile: (updatedData: Partial<User>) => void
  logout: () => Promise<void> | void
  setSession: (session: Session | null) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: Boolean(initialUser),
  isInitialized: true,
  user: initialUser,

  login: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error && data?.user) {
        const loggedInUser: User = {
          id: data.user.id,
          name: (data.user.user_metadata?.name as string) || email.split('@')[0] || 'Mahasiswa',
          email: data.user.email || email,
          nim: (data.user.user_metadata?.nim as string) || '2201082001',
          major: (data.user.user_metadata?.major as string) || 'Teknik Informatika',
          university: (data.user.user_metadata?.university as string) || 'Universitas Indonesia',
          program_studi: (data.user.user_metadata?.major as string) || 'Teknik Informatika',
          role: 'mahasiswa',
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedInUser))
        set({ isAuthenticated: true, user: loggedInUser, isInitialized: true })
        return
      }
    } catch {
      // In mock environment / offline, proceed with mock user login
    }

    // Mock login fallback
    const mockUser: User = {
      ...initialMockUser,
      email,
      name: email.split('@')[0] || initialMockUser.name,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser))
    set({ isAuthenticated: true, user: mockUser, isInitialized: true })
  },

  register: async (email, password, name) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (!error && data.user) {
        await supabase.from('users').insert({ id: data.user.id, email, name })
      }
    } catch {
      // Allow mock registration fallback
    }

    const newUser: User = {
      ...initialMockUser,
      id: `mhs-${Date.now()}`,
      name,
      email,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
    set({ isAuthenticated: true, user: newUser, isInitialized: true })
  },

  updateProfile: (updatedData: Partial<User>) => {
    set((state) => {
      if (!state.user) return state
      const updatedUser: User = {
        ...state.user,
        ...updatedData,
        program_studi: updatedData.major ?? state.user.program_studi ?? updatedData.program_studi,
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser))
      } catch {
        // Ignore storage errors
      }
      return { user: updatedUser }
    })
  },

  logout: async () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.removeItem('smartlearning-session')
      window.localStorage.removeItem('smartlearning-cofocus-sharing')
      window.localStorage.removeItem('smartlearning-cofocus-auto-reply')
    } catch {
      // Ignore removal error
    }

    try {
      await supabase.auth.signOut()
    } catch {
      // Ignore supabase signout error in mock environment
    }

    set({ isAuthenticated: false, user: null, isInitialized: true })
  },

  setSession: (session) => {
    if (session?.user) {
      const sessionUser: User = {
        id: session.user.id,
        name: (session.user.user_metadata?.name as string) || session.user.email?.split('@')[0] || 'Mahasiswa',
        email: session.user.email || '',
        nim: (session.user.user_metadata?.nim as string) || '2201082001',
        major: (session.user.user_metadata?.major as string) || 'Teknik Informatika',
        university: (session.user.user_metadata?.university as string) || 'Universitas Indonesia',
        program_studi: (session.user.user_metadata?.major as string) || 'Teknik Informatika',
        role: 'mahasiswa',
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser))
      } catch {}
      set({ isAuthenticated: true, user: sessionUser, isInitialized: true })
    } else {
      // If no remote session, keep local mock user if exists, or maintain state
      const existing = get().user
      if (existing) {
        set({ isAuthenticated: true, isInitialized: true })
      } else {
        set({ isAuthenticated: false, user: null, isInitialized: true })
      }
    }
  },
}))
