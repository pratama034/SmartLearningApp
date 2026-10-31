import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import type { StudyBlock } from '../types'

export type FocusStatus = 'idle' | 'running' | 'paused'
export type SessionCompletionStatus = 'completed' | 'ended_early'

export interface HeldNotification {
  id: string
  text: string
  receivedAt: string
}

export interface SessionSummary {
  block: StudyBlock
  targetDurationSeconds: number
  durationSeconds: number
  completionStatus: SessionCompletionStatus
  startedAt: string
  endedAt: string
  heldNotifications: HeldNotification[]
}

export interface SaveSessionPayload {
  userId?: string
  studyBlockId?: string | null
  targetDuration: number
  actualDuration: number
  completionStatus: SessionCompletionStatus | string
  reflectionNote: string
  startedAt?: string
  endedAt?: string
}

interface SessionState {
  activeBlock: StudyBlock | null
  status: FocusStatus
  remainingTime: number
  startedAt: string | null
  heldNotifications: HeldNotification[]
  lastSessionSummary: SessionSummary | null
  isSaving: boolean
  error: string | null
  clearError: () => void
  startSession: (block: StudyBlock) => void
  pauseSession: () => void
  resumeSession: () => void
  endSession: () => void
  resetSession: () => void
  addHeldNotification: (notification: HeldNotification) => void
  tick: () => void
  saveSessionToDatabase: (sessionData: SaveSessionPayload) => Promise<void>
}

function timeToSeconds(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
  return (hours * 60 + minutes) * 60
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeBlock: null,
  status: 'idle',
  remainingTime: 0,
  startedAt: null,
  heldNotifications: [],
  lastSessionSummary: null,
  isSaving: false,
  error: null,

  clearError: () => set({ error: null }),

  startSession: (block) => {
    const startVal = block.startTime ?? block.start_time
    const endVal = block.endTime ?? block.end_time
    const duration = Math.max(0, timeToSeconds(endVal) - timeToSeconds(startVal))

    set({
      activeBlock: block,
      status: 'running',
      remainingTime: duration,
      startedAt: new Date().toISOString(),
      heldNotifications: [],
      error: null,
    })
  },

  pauseSession: () =>
    set((state) => (state.status === 'running' ? { status: 'paused' } : state)),

  resumeSession: () =>
    set((state) => (state.status === 'paused' ? { status: 'running' } : state)),

  endSession: () =>
    set((state) => {
      const startVal = state.activeBlock?.startTime ?? state.activeBlock?.start_time ?? '00:00'
      const endVal = state.activeBlock?.endTime ?? state.activeBlock?.end_time ?? '00:00'
      const plannedDuration = state.activeBlock
        ? Math.max(0, timeToSeconds(endVal) - timeToSeconds(startVal))
        : 0
      const actualDuration = Math.max(0, plannedDuration - state.remainingTime)
      const completionStatus: SessionCompletionStatus =
        state.remainingTime <= 0 ? 'completed' : 'ended_early'

      return {
        activeBlock: null,
        status: 'idle',
        remainingTime: 0,
        startedAt: null,
        heldNotifications: [],
        lastSessionSummary: state.activeBlock
          ? {
              block: state.activeBlock,
              targetDurationSeconds: plannedDuration,
              durationSeconds: actualDuration,
              completionStatus,
              startedAt: state.startedAt ?? new Date().toISOString(),
              endedAt: new Date().toISOString(),
              heldNotifications: state.heldNotifications,
            }
          : state.lastSessionSummary,
      }
    }),

  resetSession: () =>
    set({
      activeBlock: null,
      status: 'idle',
      remainingTime: 0,
      startedAt: null,
      heldNotifications: [],
      lastSessionSummary: null,
      isSaving: false,
      error: null,
    }),

  addHeldNotification: (notification) =>
    set((state) => ({
      heldNotifications: [...state.heldNotifications, notification],
    })),

  tick: () =>
    set((state) => {
      if (state.status !== 'running' || state.remainingTime <= 0) return state
      return { remainingTime: state.remainingTime - 1 }
    }),

  saveSessionToDatabase: async (sessionData: SaveSessionPayload) => {
    set({ isSaving: true, error: null })

    const resolvedUserId = sessionData.userId || useAuthStore.getState().user?.id
    if (!resolvedUserId) {
      const msg = 'Sesi pengguna tidak ditemukan. Silakan masuk terlebih dahulu.'
      set({ isSaving: false, error: msg })
      throw new Error(msg)
    }

    try {
      // Pemetaan dari camelCase (Frontend) ke snake_case (Supabase)
      const dbPayload = {
        user_id: resolvedUserId,
        study_block_id: sessionData.studyBlockId ?? null,
        target_duration: sessionData.targetDuration,
        actual_duration: sessionData.actualDuration,
        completion_status: sessionData.completionStatus,
        reflection_note: sessionData.reflectionNote.trim(),
      }

      const { error: insertError } = await supabase.from('focus_sessions').insert(dbPayload)

      if (insertError) {
        console.error('SUPABASE ERROR (focus_sessions insert):', insertError)

        // Fallback jika tabel focus_sessions di database menggunakan nama kolom alternatif dari schema.sql awal
        const fallbackPayload = {
          user_id: resolvedUserId,
          block_id: sessionData.studyBlockId ?? null,
          started_at: sessionData.startedAt ?? new Date().toISOString(),
          ended_at: sessionData.endedAt ?? new Date().toISOString(),
          duration_seconds: sessionData.actualDuration,
          status: 'completed',
          ended_by: sessionData.completionStatus === 'completed' ? 'system' : 'user',
          reflection_notes: sessionData.reflectionNote.trim(),
        }

        const { error: fallbackError } = await supabase
          .from('focus_sessions')
          .insert(fallbackPayload)

        if (fallbackError) {
          console.error('SUPABASE ERROR (focus_sessions fallback insert):', fallbackError)
          throw new Error(insertError.message)
        }
      }

      // Update streak belajar di profil pengguna
      try {
        await useAuthStore.getState().recordSessionCompletionForStreak()
      } catch (streakErr) {
        console.warn('Gagal memperbarui streak belajar:', streakErr)
      }

      // Jika berhasil disimpan, pastikan status timer kembali ke idle
      get().resetSession()
    } catch (error) {
      console.error('SUPABASE ERROR:', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan sesi fokus dan jurnal refleksi ke Supabase.'
      set({ isSaving: false, error: message })
      throw new Error(message)
    } finally {
      set({ isSaving: false })
    }
  },
}))
