import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import { useGroupStore } from './groupStore'
import type { StudyBlock } from '../types'

export type FocusStatus = 'idle' | 'running' | 'paused'
export type SessionCompletionStatus = 'completed' | 'ended_early'

export interface HeldNotification {
  id: string
  text: string
  receivedAt: string
}

export interface SessionSummary {
  sessionId?: string | null
  block: StudyBlock
  targetDurationSeconds: number
  durationSeconds: number
  completionStatus: SessionCompletionStatus
  startedAt: string
  endedAt: string
  heldNotifications: HeldNotification[]
}

export interface SaveSessionPayload {
  sessionId?: string | null
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
  lastSavedSessionId: string | null
  isSaving: boolean
  error: string | null
  clearError: () => void
  startSession: (block: StudyBlock) => void
  pauseSession: () => void
  resumeSession: () => void
  stopFocus: () => Promise<string | null>
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
  lastSavedSessionId: null,
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
      lastSavedSessionId: null,
      error: null,
    })

    // Update status anggota di ruang Co-Focus menjadi 'fokus'
    const currentUserId = useAuthStore.getState().user?.id
    if (currentUserId) {
      useGroupStore.getState().syncUserStatus(currentUserId, 'fokus')
      void supabase
        .from('study_group_members')
        .update({ status: 'fokus' })
        .eq('user_id', currentUserId)
    }
  },

  pauseSession: () =>
    set((state) => (state.status === 'running' ? { status: 'paused' } : state)),

  resumeSession: () =>
    set((state) => (state.status === 'paused' ? { status: 'running' } : state)),

  stopFocus: async () => {
    const state = get()
    if (!state.activeBlock) {
      return state.lastSavedSessionId
    }

    const startVal = state.activeBlock.startTime ?? state.activeBlock.start_time ?? '00:00'
    const endVal = state.activeBlock.endTime ?? state.activeBlock.end_time ?? '00:00'
    const plannedDuration = Math.max(0, timeToSeconds(endVal) - timeToSeconds(startVal))
    const actualDuration = Math.max(1, plannedDuration - state.remainingTime)
    const completionStatus: SessionCompletionStatus =
      state.remainingTime <= 0 ? 'completed' : 'ended_early'
    const startedAtIso = state.startedAt ?? new Date().toISOString()
    const endedAtIso = new Date().toISOString()

    const summarySnapshot: SessionSummary = {
      sessionId: null,
      block: state.activeBlock,
      targetDurationSeconds: plannedDuration,
      durationSeconds: actualDuration,
      completionStatus,
      startedAt: startedAtIso,
      endedAt: endedAtIso,
      heldNotifications: state.heldNotifications,
    }

    // 1. Hentikan timer secara instan di state lokal
    set({
      activeBlock: null,
      status: 'idle',
      remainingTime: 0,
      startedAt: null,
      heldNotifications: [],
      lastSessionSummary: summarySnapshot,
      lastSavedSessionId: null,
    })

    const currentUserId = useAuthStore.getState().user?.id
    if (!currentUserId) {
      return null
    }

    // 2. Kembalikan status user di study_group_members agar tidak nyangkut "Sedang Fokus"
    useGroupStore.getState().syncUserStatus(currentUserId, 'istirahat')
    void supabase
      .from('study_group_members')
      .update({ status: 'istirahat' })
      .eq('user_id', currentUserId)

    // 3. Tambahkan poin streak langsung saat stopFocus (tanpa menunggu form refleksi)
    try {
      await useAuthStore.getState().recordSessionCompletionForStreak()
    } catch (streakErr) {
      console.warn('[stopFocus] Gagal memperbarui streak:', streakErr)
    }

    // 4. Langsung INSERT laporan sesi ke tabel focus_sessions
    try {
      const dbPayload = {
        user_id: currentUserId,
        study_block_id: summarySnapshot.block.id ?? null,
        target_duration: summarySnapshot.targetDurationSeconds,
        actual_duration: summarySnapshot.durationSeconds,
        completion_status: summarySnapshot.completionStatus,
        reflection_note: '',
        started_at: startedAtIso,
        ended_at: endedAtIso,
      }

      const { data: insertedRow, error: insertError } = await supabase
        .from('focus_sessions')
        .insert(dbPayload)
        .select('id')
        .single<{ id: string }>()

      if (!insertError && insertedRow?.id) {
        set((prev) => ({
          lastSavedSessionId: insertedRow.id,
          lastSessionSummary: prev.lastSessionSummary
            ? { ...prev.lastSessionSummary, sessionId: insertedRow.id }
            : null,
        }))
        return insertedRow.id
      }

      if (insertError) {
        console.warn('[stopFocus] Mencoba fallback insert focus_sessions:', insertError.message)
        const fallbackPayload = {
          user_id: currentUserId,
          block_id: summarySnapshot.block.id ?? null,
          started_at: startedAtIso,
          ended_at: endedAtIso,
          duration_seconds: summarySnapshot.durationSeconds,
          status: 'completed',
          ended_by: summarySnapshot.completionStatus === 'completed' ? 'system' : 'user',
          reflection_notes: '',
        }

        const { data: fallbackRow, error: fallbackError } = await supabase
          .from('focus_sessions')
          .insert(fallbackPayload)
          .select('id')
          .single<{ id: string }>()

        if (!fallbackError && fallbackRow?.id) {
          set((prev) => ({
            lastSavedSessionId: fallbackRow.id,
            lastSessionSummary: prev.lastSessionSummary
              ? { ...prev.lastSessionSummary, sessionId: fallbackRow.id }
              : null,
          }))
          return fallbackRow.id
        }
      }
    } catch (err) {
      console.error('[stopFocus] Gagal menyimpan laporan sesi awal:', err)
    }

    return null
  },

  endSession: () => {
    void get().stopFocus()
  },

  resetSession: () =>
    set({
      activeBlock: null,
      status: 'idle',
      remainingTime: 0,
      startedAt: null,
      heldNotifications: [],
      lastSessionSummary: null,
      lastSavedSessionId: null,
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

    const existingSessionId =
      sessionData.sessionId ||
      get().lastSavedSessionId ||
      get().lastSessionSummary?.sessionId ||
      null

    try {
      // Jika sesi sudah di-INSERT saat stopFocus, cukup lakukan UPDATE pada reflection_note
      if (existingSessionId) {
        const { error: updateError } = await supabase
          .from('focus_sessions')
          .update({
            reflection_note: sessionData.reflectionNote.trim(),
          })
          .eq('id', existingSessionId)
          .eq('user_id', resolvedUserId)

        if (updateError) {
          // Fallback nama kolom alternatif
          const { error: fallbackUpdateErr } = await supabase
            .from('focus_sessions')
            .update({
              reflection_notes: sessionData.reflectionNote.trim(),
            })
            .eq('id', existingSessionId)
            .eq('user_id', resolvedUserId)

          if (fallbackUpdateErr) {
            throw new Error(updateError.message)
          }
        }

        get().resetSession()
        return
      }

      // Fallback INSERT jika karena kendala jaringan belum tersimpan saat stopFocus
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

      // Pastikan status timer di-reset ke idle
      get().resetSession()
    } catch (error) {
      console.error('SUPABASE ERROR:', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan jurnal refleksi ke Supabase.'
      set({ isSaving: false, error: message })
      throw new Error(message)
    } finally {
      set({ isSaving: false })
    }
  },
}))
