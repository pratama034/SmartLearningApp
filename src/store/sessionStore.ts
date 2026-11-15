import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { syncUserMemberMetaToSupabase } from '../lib/stufoSync'
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

async function syncMemberFocusState(
  status: 'fokus' | 'istirahat',
  startedAtIso?: string | null
) {
  try {
    let currentUserId = useAuthStore.getState().user?.id
    if (!currentUserId) {
      const { data } = await supabase.auth.getUser()
      currentUserId = data.user?.id
    }
    if (!currentUserId) return

    useGroupStore.getState().syncUserStatus(currentUserId, status)

    const userMajor = useAuthStore.getState().user?.major
    await syncUserMemberMetaToSupabase({
      userId: currentUserId,
      status,
      startedAtIso: status === 'fokus' ? startedAtIso || new Date().toISOString() : null,
      courseOverride: userMajor,
    })
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
    const nowIso = new Date().toISOString()

    set({
      activeBlock: block,
      modeKind: 'scheduled',
      status: 'running',
      remainingTime: duration,
      elapsedSeconds: 0,
      targetDurationSeconds: duration,
      startedAt: nowIso,
      heldNotifications: [],
      lastSavedSessionId: null,
      error: null,
    })

    void syncMemberFocusState('fokus', nowIso)
  },

  startSpontaneousTimer: (durationMinutes: number, customTitle?: string) => {
    const safeMinutes = Math.max(1, Math.min(360, Math.round(durationMinutes || 25)))
    const durationSeconds = safeMinutes * 60
    const now = new Date()
    const nowIso = now.toISOString()
    const end = new Date(now.getTime() + durationSeconds * 1000)
    const fmt = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

    const spontaneousBlock: StudyBlock = {
      id: `spontaneous-timer-${Date.now()}`,
      user_id: useAuthStore.getState().user?.id || 'local',
      title: customTitle?.trim() || `Timer Fokus Spontan (${safeMinutes} Menit)`,
      type: 'Belajar mandiri',
      description: 'Sesi Timer Fokus Spontan tanpa jadwal',
      date: nowIso.slice(0, 10),
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
      startedAt: nowIso,
      heldNotifications: [],
      lastSavedSessionId: null,
      error: null,
    })

    void syncMemberFocusState('fokus', nowIso)
  },

  startSpontaneousStopwatch: (customTitle?: string) => {
    const now = new Date()
    const nowIso = now.toISOString()
    const fmt = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

    const spontaneousBlock: StudyBlock = {
      id: `spontaneous-stopwatch-${Date.now()}`,
      user_id: useAuthStore.getState().user?.id || 'local',
      title: customTitle?.trim() || 'Stopwatch Fokus Spontan',
      type: 'Belajar mandiri',
      description: 'Sesi Stopwatch Fokus Spontan (Hitung Maju)',
      date: nowIso.slice(0, 10),
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
      startedAt: nowIso,
      heldNotifications: [],
      lastSavedSessionId: null,
      error: null,
    })

    void syncMemberFocusState('fokus', nowIso)
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

    if (!state.activeBlock) {
      await syncMemberFocusState('istirahat', null)
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
      isSaving: true,
    })

    if (!currentUserId) {
      set({ isSaving: false })
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
    let savedId: string | null = null

    try {
      // 1. Coba insert lengkap dengan started_at & ended_at
      const fullPayload = {
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
        .insert(fullPayload)
        .select('id')
        .single<{ id: string }>()

      if (!insertError && insertedRow?.id) {
        savedId = insertedRow.id
      } else {
        // 2. Fallback tanpa started_at / ended_at jika skema tabel lama belum memiliki kolom tersebut
        const fallbackPayload = {
          user_id: currentUserId,
          study_block_id: dbBlockId,
          target_duration: summarySnapshot.targetDurationSeconds,
          actual_duration: summarySnapshot.durationSeconds,
          completion_status: summarySnapshot.completionStatus,
          reflection_note: '',
        }
        const { data: fallbackRow, error: fallbackError } = await supabase
          .from('focus_sessions')
          .insert(fallbackPayload)
          .select('id')
          .single<{ id: string }>()

        if (!fallbackError && fallbackRow?.id) {
          savedId = fallbackRow.id
        }
      }

      if (savedId) {
        set((prev) => ({
          lastSavedSessionId: savedId,
          lastSessionSummary: prev.lastSessionSummary
            ? { ...prev.lastSessionSummary, sessionId: savedId }
            : null,
        }))
      }
    } catch (err) {
      console.error('[stopFocus] Gagal menyimpan sesi fokus otomatis:', err)
    } finally {
      set({ isSaving: false })
    }

    // 3. Sinkronkan status 'istirahat' + total durasi terbaru ke study_group_members & broadcast realtime
    await syncUserMemberMetaToSupabase({
      userId: currentUserId,
      status: 'istirahat',
      startedAtIso: null,
      courseOverride: useAuthStore.getState().user?.major,
      extraSeconds: savedId ? 0 : summarySnapshot.durationSeconds,
      extraSessions: savedId ? 0 : 1,
    })
    useGroupStore.getState().syncUserStatus(currentUserId, 'istirahat')

    return savedId
  },

  endSession: () => {
    void get().stopFocus(false)
  },

  resetSession: () => {
    void syncMemberFocusState('istirahat', null)
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

  tick: () => {
    const prevState = get()
    if (prevState.status !== 'running') return

    const nextElapsed = prevState.elapsedSeconds + 1

    if (prevState.modeKind === 'stopwatch') {
      set({
        elapsedSeconds: nextElapsed,
        remainingTime: nextElapsed,
      })
    } else if (prevState.remainingTime > 0) {
      set({
        remainingTime: prevState.remainingTime - 1,
        elapsedSeconds: nextElapsed,
      })
    }

    // Setiap 15 detik saat sedang fokus, sinkronkan detak fokus ke study_group_members & broadcast
    if (nextElapsed > 0 && nextElapsed % 15 === 0) {
      const uid = useAuthStore.getState().user?.id
      if (uid) {
        void syncUserMemberMetaToSupabase({
          userId: uid,
          status: 'fokus',
          startedAtIso: prevState.startedAt,
          courseOverride: useAuthStore.getState().user?.major,
        })
      }
    }
  },

  saveSessionToDatabase: async () => {
    // Sesi kini sudah otomatis tersimpan saat stopFocus dipanggil (tanpa jurnal refleksi)
    get().resetSession()
  },
}))
