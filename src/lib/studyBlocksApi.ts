import type { StudyBlock } from '../types'
import { supabase } from './supabase'

const apiBaseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) throw new Error(`Backend API gagal (${response.status})`)
  return response.json() as Promise<T>
}

export function listStudyBlocks(userId: string) {
  return request<StudyBlock[]>(`/study-blocks?user_id=${encodeURIComponent(userId)}`)
}

export function createStudyBlock(block: StudyBlock) {
  const { id: _id, status: _status, ...payload } = block
  return request<StudyBlock>('/study-blocks', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateStudyBlock(id: string, data: Partial<Omit<StudyBlock, 'id' | 'user_id'>>) {
  return request<StudyBlock>(`/study-blocks?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteStudyBlock(id: string) {
  return request<StudyBlock>(`/study-blocks?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}
