import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'

export interface GroupMemberItem {
  id: string
  name: string
  avatar: string
  status: 'fokus' | 'istirahat'
  course: string
  isHost?: boolean
  userId?: string
}

export interface StudyGroupItem {
  id: string
  name: string
  description?: string
  joinCode: string
  maxMembers: number
  hostId: string
  members: GroupMemberItem[]
  createdAt: string
}

interface SupabaseGroupRow {
  id: string
  name: string
  description: string | null
  join_code: string
  max_members: number | null
  host_id: string
  created_at: string
}

interface SupabaseGroupMemberRow {
  id: string
  group_id: string
  user_id: string
  role: 'owner' | 'member'
  status: 'fokus' | 'istirahat' | 'tersedia'
  course: string | null
  joined_at: string
}

function generateUniqueCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

interface GroupState {
  groups: StudyGroupItem[]
  activeGroupId: string
  activeGroup: StudyGroupItem | null
  isLoading: boolean
  error: string | null
  clearError: () => void
  fetchMyGroups: (userId?: string) => Promise<void>
  createGroup: (name: string) => Promise<{ success: boolean; group?: StudyGroupItem; error?: string }>
  joinGroup: (code: string) => Promise<{ success: boolean; group?: StudyGroupItem; error?: string }>
  setActiveGroup: (groupId: string) => void
  leaveGroup: (groupId: string) => Promise<{ success: boolean; error?: string }>
  kickMember: (groupId: string, targetUserId: string) => Promise<{ success: boolean; error?: string }>
  deleteGroup: (groupId: string) => Promise<{ success: boolean; error?: string }>
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  activeGroupId: '',
  activeGroup: null,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchMyGroups: async (userId?: string) => {
    const currentUserId = userId || useAuthStore.getState().user?.id
    if (!currentUserId) {
      set({ groups: [], activeGroup: null, activeGroupId: '', isLoading: false })
      return
    }

    set({ isLoading: true, error: null })

    try {
      // 1. Ambil membership user saat ini
      const { data: memberRows, error: memberErr } = await supabase
        .from('study_group_members')
        .select('group_id')
        .eq('user_id', currentUserId)

      if (memberErr) throw memberErr

      if (!memberRows || memberRows.length === 0) {
        set({ groups: [], activeGroup: null, activeGroupId: '', isLoading: false, error: null })
        return
      }

      const groupIds = memberRows.map((m) => m.group_id)

      // 2. Ambil data study_groups
      const { data: groupsData, error: groupsErr } = await supabase
        .from('study_groups')
        .select('*')
        .in('id', groupIds)
        .order('created_at', { ascending: false })

      if (groupsErr) throw groupsErr

      // 3. Ambil data seluruh anggota di grup-grup tersebut
      const { data: allMembers, error: allMembersErr } = await supabase
        .from('study_group_members')
        .select('*')
        .in('group_id', groupIds)

      if (allMembersErr) throw allMembersErr

      // 4. Ambil profil para anggota untuk nama & jurusan
      const memberUserIds = Array.from(new Set((allMembers || []).map((m: SupabaseGroupMemberRow) => m.user_id)))
      let profileMap = new Map<string, { name: string; major?: string }>()

      if (memberUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, major')
          .in('id', memberUserIds)

        if (profilesData) {
          profileMap = new Map(profilesData.map((p) => [p.id, p]))
        }
      }

      const currentUser = useAuthStore.getState().user

      // 5. Susun StudyGroupItem[]
      const formattedGroups: StudyGroupItem[] = ((groupsData as SupabaseGroupRow[] | null) || []).map((g) => {
        const groupMemberList: GroupMemberItem[] = ((allMembers as SupabaseGroupMemberRow[] | null) || [])
          .filter((m) => m.group_id === g.id)
          .map((m) => {
            const profile = profileMap.get(m.user_id)
            const isCurrentUser = m.user_id === currentUserId
            const name = profile?.name || (isCurrentUser ? currentUser?.name || 'Anda' : 'Mahasiswa')
            const initials =
              name
                .split(' ')
                .map((p: string) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'M'

            return {
              id: m.id,
              userId: m.user_id,
              name: isCurrentUser ? `${name} (Anda)` : name,
              avatar: initials,
              status: m.status === 'istirahat' ? 'istirahat' : 'fokus',
              course: m.course || profile?.major || 'Mahasiswa',
              isHost: m.role === 'owner',
            }
          })

        const effectiveMaxMembers = g.max_members && g.max_members >= 10 ? g.max_members : 10
        if (g.max_members && g.max_members < 10) {
          void supabase.from('study_groups').update({ max_members: 10 }).eq('id', g.id)
        }

        return {
          id: g.id,
          name: g.name,
          description: g.description || '',
          joinCode: g.join_code,
          maxMembers: effectiveMaxMembers,
          hostId: g.host_id,
          members: groupMemberList,
          createdAt: g.created_at,
        }
      })

      const prevActiveId = get().activeGroupId
      const resolvedActive =
        formattedGroups.find((g) => g.id === prevActiveId) || formattedGroups[0] || null

      set({
        groups: formattedGroups,
        activeGroup: resolvedActive,
        activeGroupId: resolvedActive?.id || '',
        isLoading: false,
        error: null,
      })
    } catch (err) {
      console.error('SUPABASE ERROR (fetchMyGroups):', err)
      const message = err instanceof Error ? err.message : 'Gagal memuat ruang belajar dari Supabase.'
      set({ isLoading: false, error: message })
    }
  },

  createGroup: async (name: string) => {
    set({ error: null })
    const currentUser = useAuthStore.getState().user
    if (!currentUser?.id) {
      const errorMsg = 'Silakan masuk terlebih dahulu untuk membuat ruang belajar.'
      set({ error: errorMsg })
      return { success: false, error: errorMsg }
    }

    const trimmedName = name.trim() || 'Ruang Belajar Bersama'
    const newJoinCode = generateUniqueCode()

    try {
      // 1. Insert ke study_groups (kapasitas 10 anggota)
      const { data: newGroupRow, error: groupErr } = await supabase
        .from('study_groups')
        .insert({
          name: trimmedName,
          description: `Dibuat oleh ${currentUser.name || 'Anda'}`,
          join_code: newJoinCode,
          max_members: 10,
          host_id: currentUser.id,
        })
        .select('*')
        .single<SupabaseGroupRow>()

      if (groupErr || !newGroupRow) {
        console.error('SUPABASE ERROR (createGroup):', groupErr)
        throw new Error(groupErr?.message || 'Gagal membuat ruang belajar di Supabase.')
      }

      // 2. Insert host ke study_group_members dengan role 'owner'
      const { data: hostMemberRow, error: memberErr } = await supabase
        .from('study_group_members')
        .insert({
          group_id: newGroupRow.id,
          user_id: currentUser.id,
          role: 'owner',
          status: 'fokus',
          course: currentUser.major || 'Mahasiswa',
        })
        .select('*')
        .single<SupabaseGroupMemberRow>()

      if (memberErr) {
        console.error('SUPABASE ERROR (insert host member):', memberErr)
      }

      const userInitials =
        (currentUser.name || 'Anda')
          .split(' ')
          .map((p) => p[0])
          .slice(0, 2)
          .join('')
          .toUpperCase() || 'M'

      const hostItem: GroupMemberItem = {
        id: hostMemberRow?.id || `member-${Date.now()}`,
        userId: currentUser.id,
        name: `${currentUser.name || 'Anda'} (Host)`,
        avatar: userInitials,
        status: 'fokus',
        course: currentUser.major || 'Mahasiswa',
        isHost: true,
      }

      const createdItem: StudyGroupItem = {
        id: newGroupRow.id,
        name: newGroupRow.name,
        description: newGroupRow.description || '',
        joinCode: newGroupRow.join_code,
        maxMembers: newGroupRow.max_members || 10,
        hostId: currentUser.id,
        members: [hostItem],
        createdAt: newGroupRow.created_at,
      }

      set((state) => ({
        groups: [createdItem, ...state.groups],
        activeGroup: createdItem,
        activeGroupId: createdItem.id,
        error: null,
      }))

      return { success: true, group: createdItem }
    } catch (err) {
      console.error('SUPABASE ERROR (createGroup):', err)
      const message = err instanceof Error ? err.message : 'Gagal membuat ruang belajar.'
      set({ error: message })
      return { success: false, error: message }
    }
  },

  joinGroup: async (code: string) => {
    set({ error: null })
    const currentUser = useAuthStore.getState().user
    if (!currentUser?.id) {
      return { success: false, error: 'Silakan masuk terlebih dahulu untuk bergabung.' }
    }

    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) {
      return { success: false, error: 'Silakan masukkan kode ruangan.' }
    }

    try {
      // a. Cari grup berdasarkan join_code
      const { data: targetGroupRow, error: groupErr } = await supabase
        .from('study_groups')
        .select('*')
        .eq('join_code', cleanCode)
        .maybeSingle<SupabaseGroupRow>()

      if (groupErr) throw groupErr

      if (!targetGroupRow) {
        return { success: false, error: 'Kode ruangan tidak valid' }
      }

      // b. Lakukan insert ke study_group_members.
      // Database trigger check_max_group_members akan menangani jika grup sudah penuh (>= 6)
      const { error: insertMemberErr } = await supabase
        .from('study_group_members')
        .insert({
          group_id: targetGroupRow.id,
          user_id: currentUser.id,
          role: 'member',
          status: 'fokus',
          course: currentUser.major || 'Mahasiswa',
        })

      if (insertMemberErr) {
        const errLower = insertMemberErr.message.toLowerCase()
        if (errLower.includes('penuh') || errLower.includes('maks') || insertMemberErr.code === 'P0001') {
          return { success: false, error: 'Maaf, ruang belajar sudah penuh (Maks 10 orang)' }
        }
        // Jika user sudah terdaftar di grup ini (unique constraint uq_group_user)
        if (
          insertMemberErr.code === '23505' ||
          errLower.includes('duplicate') ||
          errLower.includes('unique')
        ) {
          await get().fetchMyGroups(currentUser.id)
          get().setActiveGroup(targetGroupRow.id)
          const currentGroup = get().groups.find((g) => g.id === targetGroupRow.id)
          return { success: true, group: currentGroup }
        }
        throw insertMemberErr
      }

      // Berhasil gabung, refresh groups
      await get().fetchMyGroups(currentUser.id)
      get().setActiveGroup(targetGroupRow.id)
      const joinedGroup = get().groups.find((g) => g.id === targetGroupRow.id)

      return { success: true, group: joinedGroup }
    } catch (err) {
      console.error('SUPABASE ERROR (joinGroup):', err)
      const message = err instanceof Error ? err.message : 'Gagal bergabung ke ruang belajar.'
      set({ error: message })
      return { success: false, error: message }
    }
  },

  setActiveGroup: (groupId: string) => {
    const target = get().groups.find((g) => g.id === groupId)
    if (target) {
      set({ activeGroupId: target.id, activeGroup: target })
    }
  },

  leaveGroup: async (groupId: string) => {
    const currentUser = useAuthStore.getState().user
    if (!currentUser?.id) {
      return { success: false, error: 'Silakan masuk terlebih dahulu.' }
    }

    try {
      const { error } = await supabase
        .from('study_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUser.id)

      if (error) throw error

      await get().fetchMyGroups(currentUser.id)
      return { success: true }
    } catch (err) {
      console.error('SUPABASE ERROR (leaveGroup):', err)
      const message = err instanceof Error ? err.message : 'Gagal keluar dari ruang belajar.'
      return { success: false, error: message }
    }
  },

  kickMember: async (groupId: string, targetUserId: string) => {
    const currentUser = useAuthStore.getState().user
    if (!currentUser?.id) {
      return { success: false, error: 'Silakan masuk terlebih dahulu.' }
    }

    try {
      const { error } = await supabase
        .from('study_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', targetUserId)

      if (error) throw error

      await get().fetchMyGroups(currentUser.id)
      return { success: true }
    } catch (err) {
      console.error('SUPABASE ERROR (kickMember):', err)
      const message = err instanceof Error ? err.message : 'Gagal mengeluarkan anggota dari ruang belajar.'
      return { success: false, error: message }
    }
  },

  deleteGroup: async (groupId: string) => {
    const currentUser = useAuthStore.getState().user
    if (!currentUser?.id) {
      return { success: false, error: 'Silakan masuk terlebih dahulu.' }
    }

    try {
      const { error } = await supabase
        .from('study_groups')
        .delete()
        .eq('id', groupId)
        .eq('host_id', currentUser.id)

      if (error) throw error

      await get().fetchMyGroups(currentUser.id)
      return { success: true }
    } catch (err) {
      console.error('SUPABASE ERROR (deleteGroup):', err)
      const message = err instanceof Error ? err.message : 'Gagal menghapus ruang belajar.'
      return { success: false, error: message }
    }
  },
}))
