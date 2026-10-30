import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import type { StudyBlock, StudyBlockSubTask, StudyBlockType } from '../types'

export type { StudyBlock, StudyBlockSubTask, StudyBlockType }

export interface NewStudyBlockInput {
  user_id?: string
  userId?: string
  title: string
  type: StudyBlockType
  description?: string
  date: string
  start_time?: string
  startTime?: string
  end_time?: string
  endTime?: string
  recurrence_rule?: string | null
  recurrenceRule?: string | null
  auto_focus?: boolean
  autoFocus?: boolean
  co_focus_enabled?: boolean
  coFocusEnabled?: boolean
  status?: 'scheduled' | 'active' | 'completed'
  subTasks?: { id?: string; title: string; isCompleted?: boolean }[]
}

export type NewStudyBlock = NewStudyBlockInput

interface SupabaseSubTaskRow {
  id: string
  block_id: string
  title: string
  is_completed?: boolean | null
  isCompleted?: boolean | null
  sort_order?: number | null
  created_at?: string
}

interface SupabaseStudyBlockRow {
  id: string
  user_id: string
  type: StudyBlockType
  title: string
  description?: string | null
  date?: string | null
  start_time?: string | null
  startTime?: string | null
  end_time?: string | null
  endTime?: string | null
  recurrence_rule?: string | null
  recurrenceRule?: string | null
  auto_focus?: boolean | null
  autoFocus?: boolean | null
  co_focus_enabled?: boolean | null
  coFocusEnabled?: boolean | null
  status?: 'scheduled' | 'active' | 'completed' | null
  subTasks?: SupabaseSubTaskRow[] | null
  study_block_sub_tasks?: SupabaseSubTaskRow[] | null
}

function normalizeTimeString(value: string | null | undefined): string {
  if (!value) return '00:00'
  // PostgreSQL TIME mengembalikan 'HH:MM:SS', kita ambil 'HH:MM' untuk UI
  return value.slice(0, 5)
}

function getTodayFallbackDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function mapSupabaseBlockToStudyBlock(row: SupabaseStudyBlockRow): StudyBlock {
  const startTime = normalizeTimeString(row.start_time ?? row.startTime)
  const endTime = normalizeTimeString(row.end_time ?? row.endTime)
  const autoFocus = Boolean(row.auto_focus ?? row.autoFocus)
  const coFocusEnabled = Boolean(row.co_focus_enabled ?? row.coFocusEnabled)
  const recurrenceRule = row.recurrence_rule ?? row.recurrenceRule ?? null
  const dateValue = row.date || getTodayFallbackDate()

  const rawTasks = row.subTasks ?? row.study_block_sub_tasks ?? []
  const sortedSubTasks = [...rawTasks].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  )

  const subTasks: StudyBlockSubTask[] = sortedSubTasks.map((task) => ({
    id: task.id,
    title: task.title,
    isCompleted: Boolean(task.isCompleted ?? task.is_completed),
  }))

  return {
    id: row.id,
    user_id: row.user_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    description: row.description ?? '',
    date: dateValue,
    start_time: startTime,
    startTime,
    end_time: endTime,
    endTime,
    recurrence_rule: recurrenceRule,
    recurrenceRule,
    auto_focus: autoFocus,
    autoFocus,
    co_focus_enabled: coFocusEnabled,
    coFocusEnabled,
    status: row.status ?? 'scheduled',
    subTasks,
  }
}

function sortStudyBlocks(blocks: StudyBlock[]): StudyBlock[] {
  return [...blocks].sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '')
    if (dateCompare !== 0) return dateCompare
    const timeA = a.startTime ?? a.start_time ?? ''
    const timeB = b.startTime ?? b.start_time ?? ''
    return timeA.localeCompare(timeB)
  })
}

export interface StudyStore {
  studyBlocks: StudyBlock[]
  blocks: StudyBlock[]
  isLoading: boolean
  error: string | null
  clearError: () => void
  fetchStudyBlocks: (userId: string) => Promise<void>
  fetchBlocks: (userId?: string) => Promise<void>
  addStudyBlock: (data: NewStudyBlockInput) => Promise<StudyBlock>
  addBlock: (data: NewStudyBlockInput) => Promise<StudyBlock>
  updateStudyBlock: (id: string, data: Partial<StudyBlock>) => Promise<void>
  updateBlock: (id: string, data: Partial<StudyBlock>) => Promise<void>
  deleteStudyBlock: (id: string) => Promise<void>
  deleteBlock: (id: string) => Promise<void>
  toggleSubTask: (blockId: string, taskId: string, isCompleted?: boolean) => Promise<void>
}

export const useStudyStore = create<StudyStore>((set, get) => ({
  studyBlocks: [],
  blocks: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchStudyBlocks: async (userId: string) => {
    if (!userId) return
    set({ isLoading: true, error: null })
    try {
      // 1. Ambil data Study Blocks
      const { data: blocksData, error: blocksError } = await supabase
        .from('study_blocks')
        .select('*')
        .eq('user_id', userId)

      if (blocksError) throw blocksError

      // 2. Ambil data Sub-Tasks yang terkait dengan user ini
      // (Ambil semua sub-tasks, nanti kita filter di frontend)
      const { data: tasksData, error: tasksError } = await supabase
        .from('study_block_sub_tasks')
        .select('*')

      if (tasksError) throw tasksError

      // 3. Gabungkan Data (Mapping snake_case ke camelCase)
      const formattedBlocks: StudyBlock[] = ((blocksData as SupabaseStudyBlockRow[] | null) || []).map(
        (block) => {
          // Cari sub-tasks milik block ini
          const blockTasks = ((tasksData as SupabaseSubTaskRow[] | null) || [])
            .filter((task) => task.block_id === block.id)
            .map((task) => ({
              id: task.id,
              title: task.title,
              isCompleted: Boolean(task.is_completed ?? task.isCompleted),
            }))

          const startTime = normalizeTimeString(block.start_time ?? block.startTime)
          const endTime = normalizeTimeString(block.end_time ?? block.endTime)
          const autoFocus = Boolean(block.auto_focus ?? block.autoFocus)
          const coFocusEnabled = Boolean(block.co_focus_enabled ?? block.coFocusEnabled)
          const recurrenceRule = block.recurrence_rule ?? block.recurrenceRule ?? null

          return {
            id: block.id,
            user_id: block.user_id,
            userId: block.user_id,
            title: block.title,
            type: block.type,
            description: block.description ?? '',
            startTime, // Konversi snake_case ke camelCase
            endTime,
            start_time: startTime,
            end_time: endTime,
            date: block.date || getTodayFallbackDate(),
            recurrenceRule,
            recurrence_rule: recurrenceRule,
            autoFocus,
            auto_focus: autoFocus,
            coFocusEnabled,
            co_focus_enabled: coFocusEnabled,
            status: block.status ?? 'scheduled',
            subTasks: blockTasks,
          }
        }
      )

      const sortedBlocks = sortStudyBlocks(formattedBlocks)
      set({ studyBlocks: sortedBlocks, blocks: sortedBlocks, isLoading: false, error: null })
    } catch (error) {
      console.error('SUPABASE ERROR (Two-Step Fetch):', error)
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Gagal mengambil jadwal belajar dari Supabase.'
      set({ error: message, isLoading: false })
    }
  },

  fetchBlocks: async (userId?: string) => {
    const resolvedUserId = userId || useAuthStore.getState().user?.id
    if (!resolvedUserId) return
    await get().fetchStudyBlocks(resolvedUserId)
  },

  addStudyBlock: async (data: NewStudyBlockInput) => {
    set({ error: null })
    const resolvedUserId = data.userId || data.user_id || useAuthStore.getState().user?.id

    if (!resolvedUserId) {
      const msg = 'Sesi pengguna tidak ditemukan. Silakan masuk terlebih dahulu.'
      set({ error: msg })
      throw new Error(msg)
    }

    const startTime = data.startTime || data.start_time || '09:00'
    const endTime = data.endTime || data.end_time || '10:00'

    try {
      const insertPayload = {
        user_id: resolvedUserId,
        title: data.title.trim(),
        type: data.type,
        description: data.description?.trim() ?? '',
        date: data.date,
        start_time: startTime,
        end_time: endTime,
        recurrence_rule: data.recurrenceRule ?? data.recurrence_rule ?? null,
        auto_focus: data.autoFocus ?? data.auto_focus ?? false,
        co_focus_enabled: data.coFocusEnabled ?? data.co_focus_enabled ?? false,
      }

      const { data: createdRow, error: blockError } = await supabase
        .from('study_blocks')
        .insert(insertPayload)
        .select('*')
        .single<SupabaseStudyBlockRow>()

      if (blockError || !createdRow) {
        console.error('SUPABASE ERROR (insert study_blocks):', blockError)
        throw new Error(blockError?.message || 'Gagal menambahkan jadwal ke database.')
      }

      let insertedSubTasks: SupabaseSubTaskRow[] = []
      const inputSubTasks = (data.subTasks ?? []).filter((t) => t.title.trim().length > 0)

      if (inputSubTasks.length > 0) {
        const subTaskRows = inputSubTasks.map((task, index) => ({
          block_id: createdRow.id,
          title: task.title.trim(),
          is_completed: Boolean(task.isCompleted),
          sort_order: index,
        }))

        const { data: createdTasks, error: subTaskError } = await supabase
          .from('study_block_sub_tasks')
          .insert(subTaskRows)
          .select('*')

        if (subTaskError) {
          console.error('SUPABASE ERROR (insert study_block_sub_tasks):', subTaskError)
        } else {
          insertedSubTasks = (createdTasks as SupabaseSubTaskRow[] | null) ?? []
        }
      }

      const mappedBlock = mapSupabaseBlockToStudyBlock({
        ...createdRow,
        subTasks: insertedSubTasks,
      })

      set((state) => {
        const nextList = sortStudyBlocks([...state.studyBlocks, mappedBlock])
        return { studyBlocks: nextList, blocks: nextList, error: null }
      })

      return mappedBlock
    } catch (error) {
      console.error('SUPABASE ERROR:', error)
      const message =
        error instanceof Error ? error.message : 'Gagal menyimpan jadwal belajar ke Supabase.'
      set({ error: message })
      throw new Error(message)
    }
  },

  addBlock: async (data: NewStudyBlockInput) => {
    return get().addStudyBlock(data)
  },

  updateStudyBlock: async (id: string, changes: Partial<StudyBlock>) => {
    set({ error: null })
    try {
      const updatePayload: Record<string, unknown> = {}
      if (changes.title !== undefined) updatePayload.title = changes.title
      if (changes.type !== undefined) updatePayload.type = changes.type
      if (changes.description !== undefined) updatePayload.description = changes.description
      if (changes.date !== undefined) updatePayload.date = changes.date
      if (changes.startTime !== undefined || changes.start_time !== undefined) {
        updatePayload.start_time = changes.startTime ?? changes.start_time
      }
      if (changes.endTime !== undefined || changes.end_time !== undefined) {
        updatePayload.end_time = changes.endTime ?? changes.end_time
      }
      if (changes.recurrenceRule !== undefined || changes.recurrence_rule !== undefined) {
        updatePayload.recurrence_rule = changes.recurrenceRule ?? changes.recurrence_rule
      }
      if (changes.autoFocus !== undefined || changes.auto_focus !== undefined) {
        updatePayload.auto_focus = changes.autoFocus ?? changes.auto_focus
      }
      if (changes.coFocusEnabled !== undefined || changes.co_focus_enabled !== undefined) {
        updatePayload.co_focus_enabled = changes.coFocusEnabled ?? changes.co_focus_enabled
      }
      if (changes.status !== undefined) updatePayload.status = changes.status

      const { data: updatedRow, error } = await supabase
        .from('study_blocks')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single<SupabaseStudyBlockRow>()

      if (error || !updatedRow) {
        console.error('SUPABASE ERROR (update study_blocks):', error)
        throw new Error(error?.message || 'Gagal memperbarui jadwal belajar.')
      }

      const existingBlock = get().studyBlocks.find((b) => b.id === id)
      const mapped = {
        ...mapSupabaseBlockToStudyBlock(updatedRow),
        subTasks: changes.subTasks ?? existingBlock?.subTasks ?? [],
      }

      set((state) => {
        const nextList = sortStudyBlocks(
          state.studyBlocks.map((block) => (block.id === id ? mapped : block))
        )
        return { studyBlocks: nextList, blocks: nextList, error: null }
      })
    } catch (error) {
      console.error('SUPABASE ERROR:', error)
      const message =
        error instanceof Error ? error.message : 'Gagal memperbarui jadwal belajar di Supabase.'
      set({ error: message })
      throw new Error(message)
    }
  },

  updateBlock: async (id: string, changes: Partial<StudyBlock>) => {
    return get().updateStudyBlock(id, changes)
  },

  deleteStudyBlock: async (id: string) => {
    set({ error: null })
    try {
      const { error } = await supabase.from('study_blocks').delete().eq('id', id)
      if (error) {
        console.error('SUPABASE ERROR (delete study_blocks):', error)
        throw new Error(error.message)
      }

      set((state) => {
        const nextList = state.studyBlocks.filter((block) => block.id !== id)
        return { studyBlocks: nextList, blocks: nextList, error: null }
      })
    } catch (error) {
      console.error('SUPABASE ERROR:', error)
      const message =
        error instanceof Error ? error.message : 'Gagal menghapus jadwal belajar dari Supabase.'
      set({ error: message })
      throw new Error(message)
    }
  },

  deleteBlock: async (id: string) => {
    return get().deleteStudyBlock(id)
  },

  toggleSubTask: async (blockId: string, taskId: string, isCompleted?: boolean) => {
    set({ error: null })
    const previousBlocks = get().studyBlocks
    const targetBlock = previousBlocks.find((b) => b.id === blockId)
    const targetTask = targetBlock?.subTasks?.find((t) => t.id === taskId)
    const nextCompleted =
      typeof isCompleted === 'boolean' ? isCompleted : !targetTask?.isCompleted

    // Optimistic update di state lokal
    set((state) => {
      const nextList = state.studyBlocks.map((block) => {
        if (block.id !== blockId || !block.subTasks) return block
        return {
          ...block,
          subTasks: block.subTasks.map((task) =>
            task.id === taskId ? { ...task, isCompleted: nextCompleted } : task
          ),
        }
      })
      return { studyBlocks: nextList, blocks: nextList }
    })

    try {
      const { error } = await supabase
        .from('study_block_sub_tasks')
        .update({ is_completed: nextCompleted })
        .eq('id', taskId)
        .eq('block_id', blockId)

      if (error) {
        console.error('SUPABASE ERROR (toggleSubTask):', error)
        throw new Error(error.message)
      }
    } catch (error) {
      console.error('SUPABASE ERROR:', error)
      // Rollback jika gagal
      const message =
        error instanceof Error ? error.message : 'Gagal memperbarui status sub-tugas di Supabase.'
      set({ studyBlocks: previousBlocks, blocks: previousBlocks, error: message })
      throw new Error(message)
    }
  },
}))
