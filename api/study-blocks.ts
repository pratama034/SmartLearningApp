import { createClient } from '@supabase/supabase-js'

const allowedFields = [
  'type',
  'title',
  'description',
  'start_time',
  'end_time',
  'recurrence_rule',
  'date',
  'auto_focus',
  'co_focus_enabled',
] as const

type StudyBlockPayload = Record<(typeof allowedFields)[number], unknown>

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

function getEnvironment() {
  return {
    url: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
}

function sanitizePayload(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const payload: Partial<StudyBlockPayload> = {}
  for (const field of allowedFields) {
    if (field in input) payload[field] = (input as Record<string, unknown>)[field]
  }
  return payload
}

export default {
  async fetch(request: Request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 })

    const environment = getEnvironment()
    if (!environment.url || !environment.anonKey || !environment.serviceRoleKey) {
      return json({ message: 'Konfigurasi API belum lengkap.' }, 503)
    }

    const token = getBearerToken(request)
    if (!token) return json({ message: 'Autentikasi diperlukan.' }, 401)

    const authClient = createClient(environment.url, environment.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    if (userError || !userData.user) return json({ message: 'Sesi tidak valid.' }, 401)

    const database = createClient(environment.url, environment.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const requestUrl = new URL(request.url)
    const id = requestUrl.searchParams.get('id')

    if (request.method === 'GET') {
      const { data, error } = await database
        .from('study_blocks')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
      return error ? json({ message: error.message }, 500) : json(data)
    }

    if (request.method === 'POST') {
      const payload = sanitizePayload(await request.json().catch(() => null))
      if (!payload || !payload.type || !payload.title || !payload.start_time || !payload.end_time || !payload.date) {
        return json({ message: 'Data study block belum lengkap.' }, 400)
      }
      const { data, error } = await database
        .from('study_blocks')
        .insert({ ...payload, user_id: userData.user.id })
        .select()
        .single()
      return error ? json({ message: error.message }, 500) : json(data, 201)
    }

    if (request.method === 'PATCH') {
      if (!id) return json({ message: 'ID study block diperlukan.' }, 400)
      const payload = sanitizePayload(await request.json().catch(() => null))
      if (!payload || Object.keys(payload).length === 0) return json({ message: 'Tidak ada perubahan untuk disimpan.' }, 400)
      const { data, error } = await database
        .from('study_blocks')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userData.user.id)
        .select()
        .single()
      return error ? json({ message: error.message }, 500) : json(data)
    }

    if (request.method === 'DELETE') {
      if (!id) return json({ message: 'ID study block diperlukan.' }, 400)
      const { error } = await database
        .from('study_blocks')
        .delete()
        .eq('id', id)
        .eq('user_id', userData.user.id)
      return error ? json({ message: error.message }, 500) : new Response(null, { status: 204 })
    }

    return json({ message: 'Method tidak didukung.' }, 405)
  },
}
