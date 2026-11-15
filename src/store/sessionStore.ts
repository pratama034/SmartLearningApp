import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import { useGroupStore } from './groupStore'
import { useStudyStore } from './studyStore'
import type { StudyBlock } from '../types'

export type FocusStatus = 'idle' | 'running' | 'paused'
export type FocusModeKind = 'scheduled' | 'timer' | 'stopwatch'
export type SessionCompletionStatus = 'completed' | 'ended_early'

export interface HeldNotification {
  id: string
  title?: string
  text: string
  appName?: string
  packageName?: string
  receivedAt: string
}

export interface SessionSummary {
  sessionId?: string | null
  block: StudyBlock
  modeKind?: FocusModeKind
  targetDurationSeconds: number
  durationSeconds: number
  completionStatus: SessionCompletionStatus
  startedAt: string
  endedAt: string
  heldNotifications: HeldNotification[]
  timerCompletedNotification?: boolean
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
  modeKind: FocusModeKind
  status: FocusStatus
  remainingTime: number
  elapsedSeconds: number
  targetDurationSeconds: number
  startedAt: string | null
  heldNotifications: HeldNotification[]
  lastSessionSummary: SessionSummary | null
  lastSavedSessionId: string | null
  isSaving: boolean
  error: string | null
  clearError: () => void
  startSession: (block: StudyBlock) => void
  startSpontaneousTimer: (durationMinutes: number, title?: string) => void
  startSpontaneousStopwatch: (title?: string) => void
  startFocus: (block: StudyBlock) => void
  pauseSession: () => void
  resumeSession: () => void
  stopFocus: (completedByTimer?: boolean) => Promise<string | null>
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

async function syncMemberFocusState(status: 'fokus' | 'istirahat', courseTitle?: string) {
  try {
    let currentUserId = useAuthStore.getState().user?.id
    if (!currentUserId) {
      const { data } = await supabase.auth.getUser()
      currentUserId = data.user?.id
    }
    if (!currentUserId) return

    useGroupStore.getState().syncUserStatus(currentUserId, status)
    const nowIso = new Date().toISOString()

    // Coba update dengan focus_started_at terlebih dahulu, fallback jika kolom belum ada
    const payloadWithTimestamp: Record<string, unknown> = {
      status,
      focus_started_at: status === 'fokus' ? nowIso : null,
    }
    if (courseTitle) {
      payloadWithTimestamp.course = courseTitle
    }

    const { error } = await supabase
      .from('study_group_members')
      .update(payloadWithTimestamp)
      .eq('user_id', currentUserId)

    if (error) {
      await supabase
        .from('study_group_members')
        .update({ status })
        .eq('user_id', currentUserId)
    }
  } catch (err) {
    console.warn('[syncMemberFocusState] Error update study_group_members:', err)
  }
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeBlock: null,
  modeKind: 'scheduled',
  status: 'idle',
  remainingTime: 0,
  elapsedSeconds: 0,
  targetDurationSeconds: 0,
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
    const duration = Math.max(60, timeToSeconds(endVal) - timeToSeconds(startVal))

    set({
      activeBlock: block,
      modeKind: 'scheduled',
      status: 'running',
      remainingTime: duration,
      elapsedSeconds: 0,
      targetDurationSeconds: duration,
      startedAt: new Date().toISOString(),
      heldNotifications: [],
      lastSavedSessionId: null,
      error: null,
    })

    void syncMemberFocusState('fokus', block.title)
  },

  startSpontaneousTimer: (durationMinutes: number, customTitle?: string) => {
    const safeMinutes = Math.max(1, Math.min(360, Math.round(durationMinutes || 25)))
    const durationSeconds = safeMinutes * 60
    const now = new Date()
    const end = new Date(now.getTime() + durationSeconds * 1000)
    const fmt = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

    const spontaneousBlock: StudyBlock = {
      id: `spontaneous-timer-${Date.now()}`,
      user_id: useAuthStore.getState().user?.id || 'local',
      title: customTitle?.trim() || `Timer Fokus Spontan (${safeMinutes} Menit)`,
      type: 'Belajar mandiri',
      description: 'Sesi Timer Fokus Spontan tanpa jadwal',
      date: now.toISOString().slice(0, 10),
      start_time: fmt(now),
      startTime: fmt(now),
      end_time: fmt(end),
      endTime: fmt(end),
      recurrence_rule: 'once',
      auto_focus: false,
      co_focus_enabled: true,
      status: 'active',
      subTasks: [],
    }

    set({
      activeBlock: spontaneousBlock,
      modeKind: 'timer',
      status: 'running',
      remainingTime: durationSeconds,
      elapsedSeconds: 0,
      targetDurationSeconds: durationSeconds,
      startedAt: now.toISOString(),
      heldNotifications: [],
      lastSavedSessionId: null,
      error: null,
    })

    void syncMemberFocusState('fokus', spontaneousBlock.title)
  },

  startSpontaneousStopwatch: (customTitle?: string) => {
    const now = new Date()
    const fmt = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

    const spontaneousBlock: StudyBlock = {
      id: `spontaneous-stopwatch-${Date.now()}`,
      user_id: useAuthStore.getState().user?.id || 'local',
      title: customTitle?.trim() || 'Stopwatch Fokus Spontan',
      type: 'Belajar mandiri',
      description: 'Sesi Stopwatch Fokus Spontan (Hitung Maju)',
      date: now.toISOString().slice(0, 10),
      start_time: fmt(now),
      startTime: fmt(now),
      end_time: fmt(now),
      endTime: fmt(now),
      recurrence_rule: 'once',
      auto_focus: false,
      co_focus_enabled: true,
      status: 'active',
      subTasks: [],
    }

    set({
      activeBlock: spontaneousBlock,
      modeKind: 'stopwatch',
      status: 'running',
      remainingTime: 0,
      elapsedSeconds: 0,
      targetDurationSeconds: 0,
      startedAt: now.toISOString(),
      heldNotifications: [],
      lastSavedSessionId: null,
      error: null,
    })

    void syncMemberFocusState('fokus', spontaneousBlock.title)
  },

  startFocus: (block) => {
    get().startSession(block)
  },

  pauseSession: () =>
    set((state) => (state.status === 'running' ? { status: 'paused' } : state)),

  resumeSession: () =>
    set((state) => (state.status === 'paused' ? { status: 'running' } : state)),

  stopFocus: async (completedByTimer = false) => {
    const state = get()

    let currentUserId = useAuthStore.getState().user?.id
    if (!currentUserId) {
      try {
        const { data } = await supabase.auth.getUser()
        currentUserId = data.user?.id
      } catch {
        // ignore
      }
    }

    await syncMemberFocusState('istirahat')

    if (!state.activeBlock) {
      return state.lastSavedSessionId
    }

    const isSpontaneous = state.activeBlock.id.startsWith('spontaneous-')
    const isStopwatch = state.modeKind === 'stopwatch'

    let plannedDuration = state.targetDurationSeconds
    if (!plannedDuration && !isStopwatch) {
      const startVal = state.activeBlock.startTime ?? state.activeBlock.start_time ?? '00:00'
      const endVal = state.activeBlock.endTime ?? state.activeBlock.end_time ?? '00:00'
      plannedDuration = Math.max(0, timeToSeconds(endVal) - timeToSeconds(startVal))
    }

    const actualDuration = isStopwatch
      ? Math.max(1, state.elapsedSeconds)
      : Math.max(1, state.elapsedSeconds || plannedDuration - state.remainingTime)

    const effectiveTarget = isStopwatch ? actualDuration : Math.max(actualDuration, plannedDuration)
    const completionStatus: SessionCompletionStatus =
      isStopwatch || completedByTimer || state.remainingTime <= 0 ? 'completed' : 'ended_early'

    const startedAtIso = state.startedAt ?? new Date().toISOString()
    const endedAtIso = new Date().toISOString()

    const summarySnapshot: SessionSummary = {
      sessionId: null,
      block: state.activeBlock,
      modeKind: state.modeKind,
      targetDurationSeconds: effectiveTarget,
      durationSeconds: actualDuration,
      completionStatus,
      startedAt: startedAtIso,
      endedAt: endedAtIso,
      heldNotifications: state.heldNotifications,
      timerCompletedNotification: completedByTimer || (!isStopwatch && state.remainingTime <= 0),
    }

    set({
      activeBlock: null,
      status: 'idle',
      remainingTime: 0,
      elapsedSeconds: 0,
      targetDurationSeconds: 0,
      startedAt: null,
      heldNotifications: [],
      lastSessionSummary: summarySnapshot,
      lastSavedSessionId: null,
    })

    if (!currentUserId) {
      return null
    }

    try {
      await useAuthStore.getState().recordSessionCompletionForStreak()
    } catch (streakErr) {
      console.warn('[stopFocus] Gagal memperbarui streak:', streakErr)
    }

    if (!isSpontaneous && summarySnapshot.block?.id) {
      try {
        void useStudyStore.getState().updateStudyBlock(summarySnapshot.block.id, {
          status: 'completed',
        })
      } catch (blockErr) {
        console.warn('[stopFocus] Gagal memperbarui status study_block:', blockErr)
      }
    }

    const dbBlockId = isSpontaneous ? null : summarySnapshot.block.id ?? null

    try {
      const dbPayload = {
        user_id: currentUserId,
        study_block_id: dbBlockId,
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
    } catch (err) {
      console.error('[stopFocus] Gagal menyimpan laporan sesi awal:', err)
    }

    return null
  },

  endSession: () => {
    void get().stopFocus(false)
  },

  resetSession: () => {
    void syncMemberFocusState('istirahat')
    set({
      activeBlock: null,
      modeKind: 'scheduled',
      status: 'idle',
      remainingTime: 0,
      elapsedSeconds: 0,
      targetDurationSeconds: 0,
      startedAt: null,
      heldNotifications: [],
      lastSessionSummary: null,
      lastSavedSessionId: null,
      isSaving: false,
      error: null,
    })
  },

  addHeldNotification: (notification) =>
    set((state) => {
      if (state.heldNotifications.some((n) => n.id === notification.id)) {
        return state
      }
      return {
        heldNotifications: [...state.heldNotifications, notification],
      }
    }),

  tick: () =>
    set((state) => {
      if (state.status !== 'running') return state
      if (state.modeKind === 'stopwatch') {
        const nextElapsed = state.elapsedSeconds + 1
        return {
          elapsedSeconds: nextElapsed,
          remainingTime: nextElapsed,
        }
      }
      if (state.remainingTime <= 0) return state
      return {
        remainingTime: state.remainingTime - 1,
        elapsedSeconds: state.elapsedSeconds + 1,
      }
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
      if (existingSessionId) {
        const { error: updateError } = await supabase
          .from('focus_sessions')
          .update({
            reflection_note: sessionData.reflectionNote.trim(),
          })
          .eq('id', existingSessionId)
          .eq('user_id', resolvedUserId)

        if (updateError) {
          throw new Error(updateError.message)
        }

        get().resetSession()
        return
      }

      const rawBlockId = sessionData.studyBlockId
      const safeBlockId =
        rawBlockId && !rawBlockId.startsWith('spontaneous-') ? rawBlockId : null

      const dbPayload = {
        user_id: resolvedUserId,
        study_block_id: safeBlockId,
        target_duration: sessionData.targetDuration,
        actual_duration: sessionData.actualDuration,
        completion_status: sessionData.completionStatus,
        reflection_note: sessionData.reflectionNote.trim(),
      }

      const { error: insertError } = await supabase.from('focus_sessions').insert(dbPayload)
      if (insertError) {
        throw new Error(insertError.message)
      }

      get().resetSession()
    } catch (error) {
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
