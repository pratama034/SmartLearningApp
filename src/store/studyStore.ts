import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { mockStudyBlocks } from '../lib/mockData'
import { createStudyBlock, deleteStudyBlock, listStudyBlocks, updateStudyBlock } from '../lib/studyBlocksApi'
import type { StudyBlock } from '../types'

interface StudyState {
  blocks: StudyBlock[]
  isLoading: boolean
  syncError: string | null
  loadBlocks: (userId: string) => Promise<void>
  addBlock: (block: StudyBlock) => Promise<void>
  deleteBlock: (id: string) => Promise<void>
  updateBlock: (id: string, updatedData: Partial<Omit<StudyBlock, 'id'>>) => Promise<void>
}

export const useStudyStore = create<StudyState>()(
  persist(
    (set) => ({
      blocks: mockStudyBlocks.map((block) => ({ ...block })),
      isLoading: false,
      syncError: null,
      loadBlocks: async (userId) => {
        set({ isLoading: true, syncError: null })
        try {
          const blocks = await listStudyBlocks(userId)
          set({ blocks, syncError: null })
        } catch {
          set({ syncError: 'Backend belum terhubung; perubahan disimpan di perangkat ini.' })
        } finally {
          set({ isLoading: false })
        }
      },
      addBlock: async (block) => {
        try {
          const createdBlock = await createStudyBlock(block)
          set((state) => ({ blocks: [...state.blocks, createdBlock], syncError: null }))
        } catch {
          set((state) => ({
            blocks: [...state.blocks, block],
            syncError: 'Backend belum terhubung; perubahan disimpan di perangkat ini.',
          }))
        }
      },
      deleteBlock: async (id) => {
        try {
          await deleteStudyBlock(id)
          set({ syncError: null })
        } catch {
          set({ syncError: 'Backend belum terhubung; perubahan dihapus dari perangkat ini.' })
        }
        set((state) => ({ blocks: state.blocks.filter((block) => block.id !== id) }))
      },
      updateBlock: async (id, updatedData) => {
        try {
          const updatedBlock = await updateStudyBlock(id, updatedData)
          set((state) => ({
            blocks: state.blocks.map((block) => block.id === id ? updatedBlock : block),
            syncError: null,
          }))
        } catch {
          set((state) => ({
            blocks: state.blocks.map((block) => block.id === id ? { ...block, ...updatedData } : block),
            syncError: 'Backend belum terhubung; perubahan disimpan di perangkat ini.',
          }))
        }
      },
    }),
    {
      name: 'smart-focus-study-blocks',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
