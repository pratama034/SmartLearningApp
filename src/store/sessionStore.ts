import { create } from 'zustand'
import type { StudyBlock } from '../types'

export type FocusStatus = 'idle' | 'running' | 'paused'

export interface HeldNotification {
  id: string
  text: string
  receivedAt: string
}

export interface SessionSummary {
  block: StudyBlock
  durationSeconds: number
  heldNotifications: HeldNotification[]
}

interface SessionState {
  activeBlock: StudyBlock | null
  status: FocusStatus
  remainingTime: number
  heldNotifications: HeldNotification[]
  lastSessionSummary: SessionSummary | null
  startSession: (block: StudyBlock) => void
  pauseSession: () => void
  resumeSession: () => void
  endSession: () => void
  addHeldNotification: (notification: HeldNotification) => void
  tick: () => void
}

function timeToSeconds(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return (hours * 60 + minutes) * 60
}

export const useSessionStore = create<SessionState>((set) => ({
  activeBlock: null,
  status: 'idle',
  remainingTime: 0,
  heldNotifications: [],
  lastSessionSummary: null,

  startSession: (block) => {
    const duration = Math.max(0, timeToSeconds(block.end_time) - timeToSeconds(block.start_time))
    set({ activeBlock: block, status: 'running', remainingTime: duration, heldNotifications: [] })
  },
  pauseSession: () => set((state) => state.status === 'running' ? { status: 'paused' } : state),
  resumeSession: () => set((state) => state.status === 'paused' ? { status: 'running' } : state),
  endSession: () => set((state) => {
    const plannedDuration = state.activeBlock
      ? Math.max(0, timeToSeconds(state.activeBlock.end_time) - timeToSeconds(state.activeBlock.start_time))
      : 0

    return {
      activeBlock: null,
      status: 'idle',
      remainingTime: 0,
      heldNotifications: [],
      lastSessionSummary: state.activeBlock
        ? {
            block: state.activeBlock,
            durationSeconds: Math.max(0, plannedDuration - state.remainingTime),
            heldNotifications: state.heldNotifications,
          }
        : state.lastSessionSummary,
    }
  }),
  addHeldNotification: (notification) => set((state) => ({
    heldNotifications: [...state.heldNotifications, notification],
  })),
  tick: () => set((state) => {
    if (state.status !== 'running' || state.remainingTime <= 0) return state
    return { remainingTime: state.remainingTime - 1 }
  }),
}))
