import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { mockStudyBlocks } from '../lib/mockData'
import type { StudyBlock } from '../types'

interface StudyState {
  blocks: StudyBlock[]
  addBlock: (block: StudyBlock) => void
  deleteBlock: (id: string) => void
  updateBlock: (id: string, updatedData: Partial<Omit<StudyBlock, 'id'>>) => void
}

export const useStudyStore = create<StudyState>()(
  persist(
    (set) => ({
      blocks: mockStudyBlocks.map((block) => ({ ...block })),
      addBlock: (block) => set((state) => ({ blocks: [...state.blocks, block] })),
      deleteBlock: (id) => set((state) => ({ blocks: state.blocks.filter((block) => block.id !== id) })),
      updateBlock: (id, updatedData) => set((state) => ({
        blocks: state.blocks.map((block) => block.id === id ? { ...block, ...updatedData } : block),
      })),
    }),
    {
      name: 'smart-focus-study-blocks',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
