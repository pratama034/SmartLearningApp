/** Main application user and scheduling contract types. */
export type UserRole = 'mahasiswa' | 'dosen' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  program_studi: string
  timezone: string
  tenant_id: string
}

export type StudyBlockType =
  | 'Jadwal kuliah'
  | 'Belajar mandiri'
  | 'Kerja kelompok'
  | 'Persiapan ujian'

export interface StudyBlock {
  id: string
  user_id: string
  type: StudyBlockType
  title: string
  description: string
  start_time: string
  end_time: string
  recurrence_rule: string | null
  date: string
  auto_focus: boolean
  co_focus_enabled: boolean
  status?: 'scheduled' | 'active' | 'completed'
}

export type FocusSessionStatus = 'active' | 'paused' | 'completed'
export type FocusSessionEndedBy = 'user' | 'system' | null

export interface FocusSession {
  id: string
  block_id: string
  user_id: string
  started_at: string
  ended_at: string | null
  status: FocusSessionStatus
  ended_by: FocusSessionEndedBy
}

export interface NotificationEvent {
  id: string
  session_id: string
  source_id: string
  text: string
  received_at: string
  passed: boolean
  handled: boolean
}

export interface StudyGroup {
  id: string
  name: string
  description: string
  owner_id: string
  created_at: string
}

export type GroupMemberRole = 'owner' | 'member'

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  role: GroupMemberRole
  joined_at: string
}
