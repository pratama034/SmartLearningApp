import { supabase } from './supabase'

const STUFO_META_DELIMITER = ' ##stufo##'
const GROUP_LAST_READ_STORAGE_KEY = 'stufo_group_last_read_map_v1'

export interface MemberCourseMeta {
  /** Timestamp ms saat mulai fokus aktif (null/0 jika sedang istirahat) */
  s?: number | null
  /** Total akumulasi durasi fokus yang sudah selesai (dalam detik) */
  t?: number
  /** Total jumlah sesi fokus yang sudah diselesaikan */
  n?: number
  /** Map groupId -> timestamp ms terakhir kali user membaca chat grup tersebut */
  r?: Record<string, number>
}

export interface ParsedMemberCourse {
  cleanCourse: string
  startedAtIso: string | null
  totalFocusSeconds: number
  totalSessions: number
  lastReadByGroup: Record<string, number>
}

export function parseMemberCourseMeta(rawCourse?: string | null): ParsedMemberCourse {
  if (!rawCourse) {
    return {
      cleanCourse: 'Mahasiswa',
      startedAtIso: null,
      totalFocusSeconds: 0,
      totalSessions: 0,
      lastReadByGroup: {},
    }
  }

  const idx = rawCourse.indexOf(STUFO_META_DELIMITER)
  if (idx === -1) {
    return {
      cleanCourse: rawCourse.trim() || 'Mahasiswa',
      startedAtIso: null,
      totalFocusSeconds: 0,
      totalSessions: 0,
      lastReadByGroup: {},
    }
  }

  const cleanCourse = rawCourse.slice(0, idx).trim() || 'Mahasiswa'
  const jsonPart = rawCourse.slice(idx + STUFO_META_DELIMITER.length).trim()

  try {
    const parsed = JSON.parse(jsonPart) as MemberCourseMeta
    const startedAtIso =
      parsed.s && parsed.s > 0 ? new Date(parsed.s).toISOString() : null
    return {
      cleanCourse,
      startedAtIso,
      totalFocusSeconds: Math.max(0, Number(parsed.t ?? 0)),
      totalSessions: Math.max(0, Number(parsed.n ?? 0)),
      lastReadByGroup: parsed.r && typeof parsed.r === 'object' ? parsed.r : {},
    }
  } catch {
    return {
      cleanCourse,
      startedAtIso: null,
      totalFocusSeconds: 0,
      totalSessions: 0,
      lastReadByGroup: {},
    }
  }
}

export function encodeMemberCourseMeta(
  cleanCourse: string,
  meta: MemberCourseMeta
): string {
  const safeCourse = parseMemberCourseMeta(cleanCourse).cleanCourse
  const compactMeta: MemberCourseMeta = {
    s: meta.s ?? null,
    t: Math.max(0, Math.round(meta.t ?? 0)),
    n: Math.max(0, Math.round(meta.n ?? 0)),
    r: meta.r ?? {},
  }
  return `${safeCourse}${STUFO_META_DELIMITER}${JSON.stringify(compactMeta)}`
}

export function getLocalGroupLastReadMap(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(GROUP_LAST_READ_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

export function setLocalGroupLastRead(groupId: string, timestampMs: number = Date.now()): void {
  if (typeof window === 'undefined' || !groupId) return
  try {
    const map = getLocalGroupLastReadMap()
    map[groupId] = timestampMs
    window.localStorage.setItem(GROUP_LAST_READ_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore storage errors
  }
}

/**
 * Hitung total detik fokus dan jumlah sesi seorang user dari tabel focus_sessions,
 * lalu sinkronkan ke baris study_group_members milik user tersebut agar teman satu grup
 * selalu bisa melihat total durasi fokus, status fokus realtime, dan status baca grup.
 */
export async function syncUserMemberMetaToSupabase(options: {
  userId: string
  status?: 'fokus' | 'istirahat'
  startedAtIso?: string | null
  courseOverride?: string
  extraSeconds?: number
  extraSessions?: number
  groupReadId?: string
}): Promise<void> {
  const { userId, status, startedAtIso, courseOverride, extraSeconds = 0, extraSessions = 0, groupReadId } = options
  if (!userId) return

  try {
    // 1. Ambil baris study_group_members milik user saat ini untuk membaca metadata yang sudah ada
    const { data: myRows } = await supabase
      .from('study_group_members')
      .select('id, status, course, focus_started_at')
      .eq('user_id', userId)

    const firstRow = (myRows as Array<{
      id: string
      status: string
      course: string | null
      focus_started_at?: string | null
    }> | null)?.[0]

    const prevParsed = parseMemberCourseMeta(firstRow?.course)
    const cleanCourse = courseOverride
      ? parseMemberCourseMeta(courseOverride).cleanCourse
      : prevParsed.cleanCourse

    // 2. Hitung total durasi fokus user dari tabel focus_sessions
    const { data: sessionRows } = await supabase
      .from('focus_sessions')
      .select('actual_duration')
      .eq('user_id', userId)

    let dbTotalSeconds = 0
    let dbSessionCount = 0
    if (Array.isArray(sessionRows)) {
      for (const s of sessionRows as Array<{ actual_duration?: number | null }>) {
        const sec = Number(s.actual_duration ?? 0)
        if (sec > 0) {
          dbTotalSeconds += sec
          dbSessionCount += 1
        }
      }
    }

    const finalTotalSeconds = Math.max(dbTotalSeconds, prevParsed.totalFocusSeconds) + extraSeconds
    const finalSessionCount = Math.max(dbSessionCount, prevParsed.totalSessions) + extraSessions

    const resolvedStatus: 'fokus' | 'istirahat' =
      status ?? (firstRow?.status === 'fokus' ? 'fokus' : 'istirahat')

    const resolvedStartedAtIso =
      resolvedStatus === 'fokus'
        ? startedAtIso ?? prevParsed.startedAtIso ?? firstRow?.focus_started_at ?? new Date().toISOString()
        : null

    const nextReadMap: Record<string, number> = {
      ...getLocalGroupLastReadMap(),
      ...prevParsed.lastReadByGroup,
    }
    if (groupReadId) {
      const nowMs = Date.now()
      nextReadMap[groupReadId] = nowMs
      setLocalGroupLastRead(groupReadId, nowMs)
    }

    const encodedCourse = encodeMemberCourseMeta(cleanCourse, {
      s: resolvedStartedAtIso ? new Date(resolvedStartedAtIso).getTime() : null,
      t: finalTotalSeconds,
      n: finalSessionCount,
      r: nextReadMap,
    })

    // 3. Update ke study_group_members (coba dengan focus_started_at, fallback ke status + course)
    const { error } = await supabase
      .from('study_group_members')
      .update({
        status: resolvedStatus,
        course: encodedCourse,
        focus_started_at: resolvedStartedAtIso,
      })
      .eq('user_id', userId)

    if (error) {
      await supabase
        .from('study_group_members')
        .update({
          status: resolvedStatus,
          course: encodedCourse,
        })
        .eq('user_id', userId)
    }

    // 4. Broadcast via Supabase Realtime agar Dashboard & Leaderboard teman langsung sinkron instan
    try {
      const broadcastPayload = {
        userId,
        status: resolvedStatus,
        startedAtIso: resolvedStartedAtIso,
        totalFocusSeconds: finalTotalSeconds,
        totalSessions: finalSessionCount,
        cleanCourse,
        updatedAt: Date.now(),
      }
      const existingChannel = supabase
        .getChannels()
        .find((c) => c.topic === 'realtime:stufo-realtime-sync')

      if (existingChannel) {
        if (existingChannel.state === 'joined') {
          void existingChannel.send({
            type: 'broadcast',
            event: 'focus_or_leaderboard_updated',
            payload: broadcastPayload,
          })
        }
      } else {
        const ch = supabase.channel('stufo-realtime-sync')
        ch.subscribe((subStatus) => {
          if (subStatus === 'SUBSCRIBED') {
            void ch
              .send({
                type: 'broadcast',
                event: 'focus_or_leaderboard_updated',
                payload: broadcastPayload,
              })
              .finally(() => {
                window.setTimeout(() => {
                  void supabase.removeChannel(ch)
                }, 1500)
              })
          }
        })
      }
    } catch {
      // ignore broadcast errors
    }
  } catch (err) {
    console.warn('[stufoSync] Gagal menyinkronkan metadata member:', err)
  }
}

// ============================================================================
// ALARM PANJANG SAAT TIMER FOKUS SELESAI (12 DETIK BERULANG SEPERTI ALARM ASLI)
// ============================================================================

let activeAlarmInterval: number | null = null
let activeAlarmTimeout: number | null = null
let activeAudioCtx: AudioContext | null = null
let alarmPlayingState = false
const alarmListeners = new Set<(playing: boolean) => void>()

function notifyAlarmListeners() {
  for (const listener of alarmListeners) {
    listener(alarmPlayingState)
  }
}

export function subscribeAlarmState(listener: (playing: boolean) => void): () => void {
  alarmListeners.add(listener)
  listener(alarmPlayingState)
  return () => {
    alarmListeners.delete(listener)
  }
}

export function isTimerAlarmPlaying(): boolean {
  return alarmPlayingState
}

export function stopTimerAlarm(): void {
  if (activeAlarmInterval !== null) {
    window.clearInterval(activeAlarmInterval)
    activeAlarmInterval = null
  }
  if (activeAlarmTimeout !== null) {
    window.clearTimeout(activeAlarmTimeout)
    activeAlarmTimeout = null
  }
  if (activeAudioCtx) {
    try {
      void activeAudioCtx.close()
    } catch {
      // ignore
    }
    activeAudioCtx = null
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(0)
    }
  } catch {
    // ignore
  }
  if (alarmPlayingState) {
    alarmPlayingState = false
    notifyAlarmListeners()
  }
}

function playSingleAlarmCycle(ctx: AudioContext) {
  // Pola dering alarm digital klasik: Beep-Beep-Beep-Beep (C6 - E6 - G6 - C6)
  const pattern = [
    { freq: 1046.5, delay: 0.0, duration: 0.14 },
    { freq: 1318.5, delay: 0.18, duration: 0.14 },
    { freq: 1567.98, delay: 0.36, duration: 0.14 },
    { freq: 1046.5, delay: 0.54, duration: 0.22 },
    { freq: 1318.5, delay: 0.82, duration: 0.14 },
    { freq: 1567.98, delay: 1.0, duration: 0.25 },
  ]

  for (const step of pattern) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(step.freq, ctx.currentTime + step.delay)
    gain.gain.setValueAtTime(0.32, ctx.currentTime + step.delay)
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + step.delay + step.duration
    )
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime + step.delay)
    osc.stop(ctx.currentTime + step.delay + step.duration)
  }
}

/**
 * Bunyikan alarm panjang (selama durationMs, default 12 detik) ketika Timer Fokus habis.
 */
export function startTimerAlarm(durationMs: number = 12000): void {
  stopTimerAlarm()

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (AudioCtx) {
      const ctx = new AudioCtx()
      activeAudioCtx = ctx
      alarmPlayingState = true
      notifyAlarmListeners()

      // Siklus pertama langsung berbunyi
      playSingleAlarmCycle(ctx)

      // Ulangi setiap 1.4 detik seperti dering alarm jam beker
      activeAlarmInterval = window.setInterval(() => {
        if (!activeAudioCtx || activeAudioCtx.state === 'closed') return
        try {
          playSingleAlarmCycle(activeAudioCtx)
        } catch {
          // ignore
        }
      }, 1400)

      // Berhenti otomatis setelah durationMs (12 detik)
      activeAlarmTimeout = window.setTimeout(() => {
        stopTimerAlarm()
      }, durationMs)
    }
  } catch {
    // ignore audio errors
  }

  // Getar berulang untuk perangkat mobile
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([
        400, 200, 400, 200, 500, 500,
        400, 200, 400, 200, 500, 500,
        400, 200, 400, 200, 500,
      ])
    }
  } catch {
    // ignore
  }
}
