import { create } from 'zustand'
import { mockStudyBlocks, type MockStudyBlock, type StudyBlockType } from '../data/mockData'

export type StudyBlock = MockStudyBlock
export type NewStudyBlock = Omit<StudyBlock, 'id'>

type StudyStore = {
  blocks: StudyBlock[]
  isLoading: boolean
  error: string | null
  fetchBlocks: (userId?: string) => Promise<void>
  addBlock: (block: NewStudyBlock) => Promise<StudyBlock>
  updateBlock: (id: string, changes: Partial<StudyBlock>) => Promise<void>
  deleteBlock: (id: string) => Promise<void>
}

const cloneMockBlocks = (): StudyBlock[] => mockStudyBlocks.map((block) => ({ ...block }))

function createBlockId() {
  return globalThis.crypto?.randomUUID?.() ?? `mock-block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useStudyStore = create<StudyStore>((set, get) => ({
  blocks: cloneMockBlocks(),
  isLoading: false,
  error: null,

  // Frontend-first mock mode: userId is retained for call-site compatibility.
  fetchBlocks: async (_userId?: string) => {
    set({ isLoading: true, error: null })
    // No supabase.from(...) query is performed in mock mode.
    set({ blocks: get().blocks.length ? get().blocks : cloneMockBlocks(), isLoading: false })
  },

  addBlock: async (block: NewStudyBlock) => {
    const created: StudyBlock = { ...block, id: createBlockId() }
    set((state) => ({ blocks: [...state.blocks, created], error: null }))
    return created
  },

  updateBlock: async (id: string, changes: Partial<StudyBlock>) => {
    set((state) => ({
      blocks: state.blocks.map((block) => block.id === id ? { ...block, ...changes, id: block.id } : block),
      error: null,
    }))
  },

  deleteBlock: async (id: string) => {
    set((state) => ({ blocks: state.blocks.filter((block) => block.id !== id), error: null }))
  },
}))

export type { StudyBlockType }
