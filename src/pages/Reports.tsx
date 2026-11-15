import {
  ArrowRight,
  BarChart2,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  Loader2,
  Medal,
  Trophy,
  UsersRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

type ReportTab = 'personal' | 'friends'
type PeriodRange = 'weekly' | 'monthly' | 'yearly'

interface FocusSessionRow {
  id: string
  user_id: string
  actual_duration?: number | null
  duration_seconds?: number | null
  target_duration?: number | null
  completion_status?: string | null
  status?: string | null
  started_at?: string | null
  created_at?: string | null
}

interface FriendLeaderboardRpcRow {
  user_id: string
  full_name: string
  major: string
  university: string
  streak: number
  total_focus_seconds: number
  total_sessions: number
  is_group_peer: boolean
}

interface ChartPoint {
  label: string
  focusMinutes: number
  subtitle?: string
}

interface FriendLeaderboardItem {
  userId: string
  name: string
  shortName: string
  major: string
  university: string
  streak: number
  totalMinutes: number
  totalSeconds: number
  sessionCount: number
  isCurrentUser: boolean
  isGroupPeer: boolean
}

const DAYS_SHORT = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function formatMinutesReadable(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0 menit'
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hours > 0) {
    return mins > 0 ? `${hours} jam ${mins} menit` : `${hours} jam`
  }
  return `${mins} menit`
}

function getMondayOfWeek(offsetWeeks: number): Date {
  const now = new Date()
  const day = now.getDay() // 0 = Minggu, 1 = Senin
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday + offsetWeeks * 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function FocusChart({ data, color }: { data: ChartPoint[]; color: string }) {
  return (
    <div className="h-72 min-w-0" aria-label="Grafik batang durasi fokus">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#56638A', fontSize: 11, fontWeight: 600 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#757780', fontSize: 12 }}
            unit="m"
          />
          <Tooltip
            cursor={{ fill: '#F6F7FC' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #DFE4F1',
              boxShadow: '0 8px 16px rgba(29,54,104,0.08)',
            }}
            formatter={(value) => [`${value} menit`, 'Waktu fokus']}
          />
          <Bar dataKey="focusMinutes" fill={color} radius={[8, 8, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function FriendsComparisonChart({ data }: { data: FriendLeaderboardItem[] }) {
  return (
    <div className="h-72 min-w-0" aria-label="Grafik perbandingan total fokus teman">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0, 8)} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
          <XAxis
            dataKey="shortName"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#56638A', fontSize: 11, fontWeight: 600 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#757780', fontSize: 12 }}
            unit="m"
          />
          <Tooltip
            cursor={{ fill: '#F6F7FC' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #DFE4F1',
              boxShadow: '0 8px 16px rgba(29,54,104,0.08)',
            }}
            formatter={(value, _name, item) => {
              const payload = item?.payload as FriendLeaderboardItem | undefined
              const label = payload ? `${payload.name} (${payload.sessionCount} sesi)` : 'Total fokus'
              return [`${value} menit`, label]
            }}
          />
          <Bar dataKey="totalMinutes" fill="#BE2257" radius={[8, 8, 0, 0]} maxBarSize={52} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  detail,
}: {
  icon: typeof Trophy
  tone: 'blue' | 'rose'
  label: string
  value: string
  detail: string
}) {
  const tones = {
    blue: 'bg-[#E1EAF8] text-[#1D3668]',
    rose: 'bg-[#FCDDE6] text-[#8E1744]',
  }

  return (
    <article className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#757780]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold leading-8 tabular-nums text-[#1F2C4F]">{value}</p>
      <p className="mt-1 text-xs leading-4 text-[#56638A]">{detail}</p>
    </article>
  )
}

export default function Reports() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const [activeTab, setActiveTab] = useState<ReportTab>('personal')
  const [periodRange, setPeriodRange] = useState<PeriodRange>('weekly')
  const [periodOffset, setPeriodOffset] = useState<number>(0) // 0 = minggu/bulan/tahun ini, -1 = kemarin

  const [personalSessions, setPersonalSessions] = useState<FocusSessionRow[]>([])
  const [friendsList, setFriendsList] = useState<FriendLeaderboardItem[]>([])
  const [peerScope, setPeerScope] = useState<'group' | 'all'>('group')
  const [isLoadingPersonal, setIsLoadingPersonal] = useState(true)
  const [isLoadingFriends, setIsLoadingFriends] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch data sesi pribadi
  useEffect(() => {
    let isMounted = true

    async function fetchPersonalReport() {
      if (!user?.id) {
        if (isMounted) setIsLoadingPersonal(false)
        return
      }

      setIsLoadingPersonal(true)
      setError(null)

      try {
        const { data, error: fetchError } = await supabase
          .from('focus_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (fetchError) {
          throw new Error(fetchError.message)
        }

        if (isMounted) {
          setPersonalSessions((data as FocusSessionRow[] | null) ?? [])
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Gagal memuat laporan fokus.')
        }
      } finally {
        if (isMounted) setIsLoadingPersonal(false)
      }
    }

    void fetchPersonalReport()
    return () => {
      isMounted = false
    }
  }, [user?.id])

  // Fetch data Leaderboard / Peringkat Teman
  useEffect(() => {
    let isMounted = true

    async function fetchFriendsLeaderboard() {
      setIsLoadingFriends(true)
      try {
        const currentUid = user?.id

        // 1. Coba panggil RPC get_friends_leaderboard terlebih dahulu
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_friends_leaderboard')

        if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
          if (isMounted) {
            const mapped: FriendLeaderboardItem[] = (rpcData as FriendLeaderboardRpcRow[]).map((row) => {
              const isMe = Boolean(currentUid && row.user_id === currentUid)
              const cleanName = row.full_name || 'Mahasiswa StuFo'
              const firstName = cleanName.split(' ')[0] || cleanName
              const totalSec = Number(row.total_focus_seconds ?? 0)
              return {
                userId: row.user_id,
                name: isMe ? `${cleanName} (Anda)` : cleanName,
                shortName: isMe ? `${firstName} (Anda)` : firstName.slice(0, 12),
                major: row.major || 'Mahasiswa',
                university: row.university || 'Kampus',
                streak: Number(row.streak ?? 0),
                totalSeconds: totalSec,
                totalMinutes: Math.max(0, Math.round(totalSec / 60)),
                sessionCount: Number(row.total_sessions ?? 0),
                isCurrentUser: isMe,
                isGroupPeer: Boolean(row.is_group_peer),
              }
            })
            mapped.sort((a, b) => b.totalSeconds - a.totalSeconds)
            setFriendsList(mapped)
            setIsLoadingFriends(false)
          }
          return
        }

        // 2. Fallback langsung dari tabel study_group_members + profiles + focus_sessions
        let groupPeerIds = new Set<string>()
        if (currentUid) {
          groupPeerIds.add(currentUid)
          const { data: myGroups } = await supabase
            .from('study_group_members')
            .select('group_id')
            .eq('user_id', currentUid)

          const gIds = (myGroups || []).map((g: { group_id: string }) => g.group_id)
          if (gIds.length > 0) {
            const { data: peerMembers } = await supabase
              .from('study_group_members')
              .select('user_id')
              .in('group_id', gIds)

            for (const pm of (peerMembers as Array<{ user_id: string }>) || []) {
              groupPeerIds.add(pm.user_id)
            }
          }
        }

        const [{ data: profilesData }, { data: sessionsData }] = await Promise.all([
          supabase.from('profiles').select('id, name, major, university, streak, is_private_profile'),
          supabase.from('focus_sessions').select('user_id, actual_duration, duration_seconds'),
        ])

        const durationByUser = new Map<string, { seconds: number; count: number }>()
        for (const s of (sessionsData as FocusSessionRow[] | null) || []) {
          const sec = Number(s.actual_duration ?? s.duration_seconds ?? 0)
          const cur = durationByUser.get(s.user_id) || { seconds: 0, count: 0 }
          cur.seconds += Math.max(0, sec)
          cur.count += 1
          durationByUser.set(s.user_id, cur)
        }

        const fallbackItems: FriendLeaderboardItem[] = (
          (profilesData as Array<{
            id: string
            name: string | null
            major: string | null
            university: string | null
            streak: number | null
          }>) || []
        ).map((p) => {
          const isMe = Boolean(currentUid && p.id === currentUid)
          const cleanName = p.name?.trim() || 'Mahasiswa StuFo'
          const firstName = cleanName.split(' ')[0] || cleanName
          const stat = durationByUser.get(p.id) || { seconds: 0, count: 0 }
          return {
            userId: p.id,
            name: isMe ? `${cleanName} (Anda)` : cleanName,
            shortName: isMe ? `${firstName} (Anda)` : firstName.slice(0, 12),
            major: p.major || 'Mahasiswa',
            university: p.university || 'Kampus',
            streak: Number(p.streak ?? 0),
            totalSeconds: stat.seconds,
            totalMinutes: Math.max(0, Math.round(stat.seconds / 60)),
            sessionCount: stat.count,
            isCurrentUser: isMe,
            isGroupPeer: isMe || groupPeerIds.has(p.id),
          }
        })

        fallbackItems.sort((a, b) => b.totalSeconds - a.totalSeconds)
        if (isMounted) {
          setFriendsList(fallbackItems)
        }
      } catch (err) {
        console.warn('Gagal memuat leaderboard teman:', err)
      } finally {
        if (isMounted) setIsLoadingFriends(false)
      }
    }

    void fetchFriendsLeaderboard()
    return () => {
      isMounted = false
    }
  }, [user?.id])

  // Kalkulasi metrik pribadi (Tanpa kartu "Total Selesai" sesuai revisi halaman 6 PDF)
  const personalStats = useMemo(() => {
    let totalFocusSeconds = 0
    const activeDates = new Set<string>()

    for (const session of personalSessions) {
      const durationSec = Number(session.actual_duration ?? session.duration_seconds ?? 0)
      totalFocusSeconds += Math.max(0, durationSec)
      const rawDate = session.started_at ?? session.created_at
      if (rawDate) {
        activeDates.add(rawDate.slice(0, 10))
      }
    }

    const totalFocusMinutes = Math.round(totalFocusSeconds / 60)
    const activeDaysCount = Math.max(1, activeDates.size)
    const avgMinutesPerDay = personalSessions.length > 0 ? Math.round(totalFocusMinutes / activeDaysCount) : 0

    return {
      totalFocusMinutes,
      avgMinutesPerDay,
    }
  }, [personalSessions])

  // Kalkulasi data grafik sesuai periode (Mingguan / Bulanan / Tahunan) + Offset
  const periodChartInfo = useMemo(() => {
    const now = new Date()

    if (periodRange === 'weekly') {
      const monday = getMondayOfWeek(periodOffset)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      sunday.setHours(23, 59, 59, 999)

      const bucketSeconds = [0, 0, 0, 0, 0, 0, 0] // Senin..Minggu
      for (const s of personalSessions) {
        const raw = s.started_at ?? s.created_at
        if (!raw) continue
        const d = new Date(raw)
        if (d >= monday && d <= sunday) {
          const jsDay = d.getDay() // 0=Minggu, 1=Senin..
          const idx = jsDay === 0 ? 6 : jsDay - 1
          const sec = Number(s.actual_duration ?? s.duration_seconds ?? 0)
          bucketSeconds[idx] += Math.max(0, sec)
        }
      }

      const fmtShort = (d: Date) =>
        d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      const periodLabel =
        periodOffset === 0
          ? `Minggu Ini (${fmtShort(monday)} – ${fmtShort(sunday)})`
          : periodOffset === -1
            ? `Minggu Kemarin (${fmtShort(monday)} – ${fmtShort(sunday)})`
            : `${fmtShort(monday)} – ${fmtShort(sunday)}`

      const points: ChartPoint[] = DAYS_SHORT.map((dayName, i) => ({
        label: dayName,
        focusMinutes: Math.round(bucketSeconds[i] / 60),
      }))
      const periodTotalMinutes = points.reduce((acc, p) => acc + p.focusMinutes, 0)

      return {
        title: 'Durasi Fokus Mingguan',
        periodLabel,
        points,
        periodTotalMinutes,
      }
    }

    if (periodRange === 'monthly') {
      const targetMonthDate = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1)
      const targetYear = targetMonthDate.getFullYear()
      const targetMonth = targetMonthDate.getMonth()

      const weekBuckets = [0, 0, 0, 0, 0] // Minggu 1..5 dalam bulan tersebut
      for (const s of personalSessions) {
        const raw = s.started_at ?? s.created_at
        if (!raw) continue
        const d = new Date(raw)
        if (d.getFullYear() === targetYear && d.getMonth() === targetMonth) {
          const weekIdx = Math.min(4, Math.floor((d.getDate() - 1) / 7))
          const sec = Number(s.actual_duration ?? s.duration_seconds ?? 0)
          weekBuckets[weekIdx] += Math.max(0, sec)
        }
      }

      const monthName = targetMonthDate.toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      })
      const periodLabel =
        periodOffset === 0
          ? `Bulan Ini (${monthName})`
          : periodOffset === -1
            ? `Bulan Kemarin (${monthName})`
            : monthName

      const points: ChartPoint[] = weekBuckets.map((sec, idx) => ({
        label: `Mgg ${idx + 1}`,
        focusMinutes: Math.round(sec / 60),
      }))
      const periodTotalMinutes = points.reduce((acc, p) => acc + p.focusMinutes, 0)

      return {
        title: 'Ringkasan Fokus Bulanan',
        periodLabel,
        points,
        periodTotalMinutes,
      }
    }

    // Yearly (Tahunan)
    const targetYear = now.getFullYear() + periodOffset
    const monthBuckets = Array.from({ length: 12 }, () => 0)

    for (const s of personalSessions) {
      const raw = s.started_at ?? s.created_at
      if (!raw) continue
      const d = new Date(raw)
      if (d.getFullYear() === targetYear) {
        const mIdx = d.getMonth()
        const sec = Number(s.actual_duration ?? s.duration_seconds ?? 0)
        monthBuckets[mIdx] += Math.max(0, sec)
      }
    }

    const periodLabel =
      periodOffset === 0
        ? `Tahun Ini (${targetYear})`
        : periodOffset === -1
          ? `Tahun Kemarin (${targetYear})`
          : `Tahun ${targetYear}`

    const points: ChartPoint[] = MONTHS_SHORT.map((mName, idx) => ({
      label: mName,
      focusMinutes: Math.round(monthBuckets[idx] / 60),
    }))
    const periodTotalMinutes = points.reduce((acc, p) => acc + p.focusMinutes, 0)

    return {
      title: 'Ringkasan Fokus Tahunan',
      periodLabel,
      points,
      periodTotalMinutes,
    }
  }, [periodOffset, periodRange, personalSessions])

  const displayedFriends = useMemo(() => {
    const groupOnly = friendsList.filter((f) => f.isGroupPeer)
    if (peerScope === 'group' && groupOnly.length > 1) {
      return groupOnly
    }
    return friendsList
  }, [friendsList, peerScope])

  const maxFriendMinutes = useMemo(() => {
    return Math.max(1, ...displayedFriends.map((f) => f.totalMinutes))
  }, [displayedFriends])

  const hasPersonalSessions = personalSessions.length > 0

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
          Analitik Belajar StuFo
        </p>
        <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">
          Laporan Fokus &amp; Leaderboard Teman
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-[19px] text-[#56638A]">
          Pantau durasi fokusmu dari minggu kemarin, bulan kemarin, hingga tahunan, dan lihat
          peringkat total waktu belajar teman-temanmu agar makin termotivasi!
        </p>

        <div
          role="tablist"
          aria-label="Pilih cakupan laporan"
          className="mt-4 inline-flex rounded-full bg-[#F6F7FC] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'personal'}
            onClick={() => setActiveTab('personal')}
            className={`h-10 rounded-full px-4 text-xs font-bold transition ${
              activeTab === 'personal'
                ? 'bg-[#1D3668] text-white shadow-xs'
                : 'text-[#56638A] hover:text-[#1F2C4F]'
            }`}
          >
            Tab Pribadi
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'friends'}
            onClick={() => setActiveTab('friends')}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition ${
              activeTab === 'friends'
                ? 'bg-[#1D3668] text-white shadow-xs'
                : 'text-[#56638A] hover:text-[#1F2C4F]'
            }`}
          >
            <Trophy size={13} />
            <span>Leaderboard Teman</span>
          </button>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
        >
          {error}
        </div>
      )}

      {activeTab === 'personal' ? (
        isLoadingPersonal ? (
          <div
            role="status"
            aria-live="polite"
            className="space-y-4 rounded-2xl border border-[#DFE4F1] bg-white p-6"
          >
            <div className="flex items-center justify-center gap-2.5 py-4 text-sm font-semibold text-[#1D3668]">
              <Loader2 size={20} className="animate-spin text-[#BE2257]" aria-hidden="true" />
              <span>Memuat analitik sesi fokus dari Supabase...</span>
            </div>
          </div>
        ) : hasPersonalSessions ? (
          <>
            {/* Langsung ke Total Fokus & Rata-rata Fokus (Tanpa Kartu "Total Selesai") */}
            <section aria-label="Metrik laporan pribadi" className="grid gap-3 sm:grid-cols-2">
              <StatCard
                icon={Clock3}
                tone="blue"
                label="Total Fokus"
                value={formatMinutesReadable(personalStats.totalFocusMinutes)}
                detail="Akumulasi waktu fokus riil keseluruhan"
              />
              <StatCard
                icon={BarChart3}
                tone="rose"
                label="Rata-rata Fokus"
                value={`${personalStats.avgMinutesPerDay} menit`}
                detail="Per hari aktif belajar"
              />
            </section>

            {/* Grafik dengan Opsi Mingguan, Bulanan, & Tahunan + Navigasi Kemarin */}
            <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">
                    {periodChartInfo.title}
                  </h2>
                  <p className="mt-1 text-xs text-[#56638A]">
                    Periode: <strong className="text-[#1D3668]">{periodChartInfo.periodLabel}</strong>{' '}
                    · Total periode ini:{' '}
                    <strong className="text-[#BE2257]">
                      {formatMinutesReadable(periodChartInfo.periodTotalMinutes)}
                    </strong>
                  </p>
                </div>

                {/* Filter Periode: Mingguan | Bulanan | Tahunan */}
                <div className="inline-flex rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-1">
                  {(
                    [
                      { key: 'weekly', label: 'Mingguan' },
                      { key: 'monthly', label: 'Bulanan' },
                      { key: 'yearly', label: 'Tahunan' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setPeriodRange(item.key)
                        setPeriodOffset(0)
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                        periodRange === item.key
                          ? 'bg-[#1D3668] text-white shadow-2xs'
                          : 'text-[#56638A] hover:text-[#1F2C4F]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tombol Navigasi Cek Minggu Kemarin / Bulan Kemarin / Tahun Kemarin */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F6F7FC] px-3 py-2">
                <button
                  type="button"
                  onClick={() => setPeriodOffset((prev) => prev - 1)}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#1D3668] shadow-2xs transition hover:bg-[#E1EAF8]"
                >
                  <ChevronLeft size={14} />
                  <span>
                    {periodRange === 'weekly'
                      ? 'Minggu Sebelumnya'
                      : periodRange === 'monthly'
                        ? 'Bulan Sebelumnya'
                        : 'Tahun Sebelumnya'}
                  </span>
                </button>

                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1F2C4F]">
                  <Calendar size={14} className="text-[#BE2257]" />
                  <span>{periodChartInfo.periodLabel}</span>
                </span>

                <div className="flex items-center gap-1.5">
                  {periodOffset !== 0 && (
                    <button
                      type="button"
                      onClick={() => setPeriodOffset(0)}
                      className="rounded-lg bg-[#E1EAF8] px-2.5 py-1 text-xs font-bold text-[#1D3668] hover:bg-[#1D3668] hover:text-white"
                    >
                      Sekarang
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={periodOffset >= 0}
                    onClick={() => setPeriodOffset((prev) => Math.min(0, prev + 1))}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#1D3668] shadow-2xs transition hover:bg-[#E1EAF8] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <FocusChart data={periodChartInfo.points} color="#1D3668" />
              </div>
            </section>
          </>
        ) : (
          <section className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DFE4F1] bg-white px-6 py-14 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-[#E1EAF8] text-[#1D3668]">
              <BarChart2 size={36} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-[20px] font-extrabold text-[#1F2C4F]">
              Belum ada riwayat sesi fokus
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[#56638A]">
              Selesaikan minimal satu sesi fokus (Timer atau Stopwatch) untuk melihat grafik
              perkembangan Mingguan, Bulanan, dan Tahunanmu di sini.
            </p>
            <button
              type="button"
              onClick={() => navigate('/focus')}
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-5 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition hover:bg-[#A11B48]"
            >
              <span>Mulai Sesi Fokus Pertama</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>
        )
      ) : (
        /* TAB 2: LEADERBOARD / PERINGKAT TEMAN (Pengganti Tab Kampus sesuai Halaman 8 PDF) */
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DFE4F1] bg-white p-4 shadow-2xs sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FDEBC8] text-[#7A4B00]">
                <Trophy size={20} />
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-[#1F2C4F] sm:text-base">
                  Peringkat Total Durasi Belajar Teman
                </h2>
                <p className="text-xs text-[#56638A]">
                  Lihat sudah berapa lama teman-temanmu fokus belajar dan kejar peringkat mereka!
                </p>
              </div>
            </div>

            <div className="inline-flex rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-1">
              <button
                type="button"
                onClick={() => setPeerScope('group')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  peerScope === 'group'
                    ? 'bg-[#1D3668] text-white'
                    : 'text-[#56638A] hover:text-[#1F2C4F]'
                }`}
              >
                Teman Grup Co-Focus
              </button>
              <button
                type="button"
                onClick={() => setPeerScope('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  peerScope === 'all'
                    ? 'bg-[#1D3668] text-white'
                    : 'text-[#56638A] hover:text-[#1F2C4F]'
                }`}
              >
                Semua Teman StuFo
              </button>
            </div>
          </section>

          {isLoadingFriends ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl border border-[#DFE4F1] bg-white p-8 text-center"
            >
              <div className="flex items-center justify-center gap-2.5 text-sm font-semibold text-[#1D3668]">
                <Loader2 size={20} className="animate-spin text-[#BE2257]" aria-hidden="true" />
                <span>Menghitung peringkat durasi fokus teman...</span>
              </div>
            </div>
          ) : displayedFriends.length > 0 ? (
            <>
              {/* Daftar Peringkat Teman */}
              <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Medal size={19} className="text-[#BE2257]" />
                    <h3 className="text-base font-extrabold text-[#1F2C4F]">
                      Leaderboard Durasi Fokus Teman
                    </h3>
                  </div>
                  <span className="rounded-full bg-[#E1EAF8] px-2.5 py-0.5 text-xs font-bold text-[#1D3668]">
                    {displayedFriends.length} teman
                  </span>
                </div>

                <div className="space-y-3">
                  {displayedFriends.map((friend, index) => {
                    const rank = index + 1
                    const widthPct = Math.max(
                      6,
                      Math.min(100, Math.round((friend.totalMinutes / maxFriendMinutes) * 100))
                    )
                    const medalBadge =
                      rank === 1
                        ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-200'
                        : rank === 2
                          ? 'bg-slate-300 text-slate-900'
                          : rank === 3
                            ? 'bg-amber-700/80 text-white'
                            : 'bg-[#E1EAF8] text-[#1D3668]'

                    return (
                      <div
                        key={friend.userId}
                        className={`rounded-2xl border p-4 transition ${
                          friend.isCurrentUser
                            ? 'border-[#1D3668] bg-[#E1EAF8]/35 shadow-xs'
                            : 'border-[#DFE4F1] bg-[#F6F7FC]/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-extrabold ${medalBadge}`}
                            >
                              #{rank}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate text-sm font-extrabold text-[#1F2C4F]">
                                  {friend.name}
                                </p>
                                {friend.streak > 0 && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-2 py-0.2 text-[10px] font-bold text-orange-700">
                                    <Flame size={11} className="fill-orange-500 text-orange-500" />
                                    {friend.streak} hr
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-xs text-[#56638A]">
                                {friend.major} · {friend.sessionCount} sesi selesai
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs sm:text-sm font-extrabold text-[#BE2257] shadow-2xs border border-[#DFE4F1]">
                              <Clock3 size={13} className="text-[#1D3668]" />
                              {formatMinutesReadable(friend.totalMinutes)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar Perbandingan Durasi */}
                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#DFE4F1]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              friend.isCurrentUser ? 'bg-[#1D3668]' : 'bg-[#BE2257]'
                            }`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* Grafik Batang Perbandingan Teman */}
              <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">
                      Grafik Perbandingan Waktu Fokus Teman
                    </h2>
                    <p className="mt-1 text-xs leading-4 text-[#56638A]">
                      Total menit fokus belajar masing-masing teman di StuFo.
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <FriendsComparisonChart data={displayedFriends} />
                </div>
              </section>
            </>
          ) : (
            <section className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DFE4F1] bg-white px-6 py-14 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-[#FCDDE6] text-[#8E1744]">
                <UsersRound size={30} />
              </span>
              <h2 className="mt-4 text-lg font-extrabold text-[#1F2C4F]">
                Belum Ada Data Teman Fokus
              </h2>
              <p className="mt-1.5 max-w-md text-xs text-[#56638A]">
                Gabung ke grup Co-Focus bersama teman-temanmu untuk melihat perbandingan durasi
                belajar mereka di Leaderboard ini!
              </p>
              <button
                type="button"
                onClick={() => navigate('/cofocus')}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#1D3668] px-4 text-xs font-bold text-white"
              >
                <UsersRound size={15} />
                <span>Ke Menu Co-Focus</span>
              </button>
            </section>
          )}
        </>
      )}
    </div>
  )
}
