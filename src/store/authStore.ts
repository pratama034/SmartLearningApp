import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  isAuthenticated: boolean
  isInitialized: boolean
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  setSession: (session: Session | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isInitialized: false,
  user: null,

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    set({ isAuthenticated: Boolean(data.user), user: data.user, isInitialized: true })
  },

  register: async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (!data.user) throw new Error('Pendaftaran tidak menghasilkan data pengguna.')

    const { error: profileError } = await supabase
      .from('users')
      .insert({ id: data.user.id, email, name })
    if (profileError) throw profileError

    set({ isAuthenticated: Boolean(data.session), user: data.user, isInitialized: true })
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    set({ isAuthenticated: false, user: null, isInitialized: true })
  },

  setSession: (session) => set({
    isAuthenticated: Boolean(session?.user),
    user: session?.user ?? null,
    isInitialized: true,
  }),
}))
