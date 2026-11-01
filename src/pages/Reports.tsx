import {
  ArrowRight,
  BarChart2,
  BarChart3,
  Building2,
  Clock3,
  Loader2,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

type ReportTab = 'personal' | 'campus'

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

interface CampusProfileRow {
  id: string
  name: string | null
  university: string | null
  major: string | null
  is_private_profile: boolean | null
}

interface CampusRpcRow {
  campus_name: string
  total_focus_seconds: number
  total_sessions: number
  student_count: number
}

interface DailyFocusPoint {
  day: string
  focusMinutes: number
}

interface CampusComparisonPoint {
  campus: string
  shortName: string
  totalMinutes: number
  avgMinutesPerStudent: number
  studentCount: number
  sessionCount: number
}

const DAYS_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

function shortenCampusName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length <= 18) return trimmed
  const words = trimmed.split(/\s+/)
  if (words.length >= 2) {
    const acronym = words.map((w) => w[0]?.toUpperCase() || '').join('')
    return `${acronym} (${words[words.length - 1].slice(0, 10)})`
  }
  return `${trimmed.slice(0, 15)}...`
}

function FocusChart({ data, color }: { data: DailyFocusPoint[]; color: string }) {
  return (
    <div className="h-72 min-w-0" aria-label="Grafik batang durasi fokus per hari">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#56638A', fontSize: 12, fontWeight: 600 }}
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

function CampusComparisonChart({ data }: { data: CampusComparisonPoint[] }) {
  return (
    <div className="h-72 min-w-0" aria-label="Grafik komparasi total fokus per entitas kampus">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
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
              const payload = item?.payload as CampusComparisonPoint | undefined
              const label = payload ? `${payload.campus} (${payload.studentCount} mhs)` : 'Total fokus kampus'
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
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Clock3
  label: string
  value: string
  detail: string
  tone: 'blue' | 'green' | 'rose'
}) {
  const tones = {
    blue: 'bg-[#E1EAF8] text-[#1D3668]',
    green: 'bg-[#D6F0DE] text-[#17623A]',
    rose: 'bg-[#FCDDE6] text-[#8E1744]',
  }

  return (
    <article className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#757780]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-[#1F2C4F]">{value}</p>
      <p className="mt-1 text-[12px] leading-[18px] text-[#56638A]">{detail}</p>
    </article>
  )
}

export default function Reports() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const [activeTab, setActiveTab] = useState<ReportTab>('personal')
  const [sessions, setSessions] = useState<FocusSessionRow[]>([])
  const [campusData, setCampusData] = useState<CampusComparisonPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingCampus, setIsLoadingCampus] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadUserSessions() {
      if (!user?.id) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const { data, error: fetchError } = await supabase
          .from('focus_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })

        if (fetchError) {
          throw fetchError
        }

        setSessions((data as FocusSessionRow[] | null) ?? [])
      } catch (err) {
        console.error('SUPABASE ERROR (fetch focus_sessions):', err)
        setError(err instanceof Error ? err.message : 'Gagal memuat riwayat fokus.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadUserSessions()
  }, [user?.id])

  // Agregasi Komparasi Kampus (SUM durasi_fokus di-group berdasarkan entitas kampus)
  useEffect(() => {
    async function loadCampusComparison() {
      setIsLoadingCampus(true)
      try {
        // 1. Coba panggil Supabase RPC agregasi kampus terlebih dahulu
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_campus_focus_stats')

        if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
          const mappedRpc: CampusComparisonPoint[] = (rpcData as CampusRpcRow[]).map((row) => {
            const totalMins = Math.max(1, Math.round(Number(row.total_focus_seconds || 0) / 60))
            const students = Math.max(1, Number(row.student_count || 1))
            const campusName = row.campus_name || 'Kampus Umum'
            return {
              campus: campusName,
              shortName: shortenCampusName(campusName),
              totalMinutes: totalMins,
              avgMinutesPerStudent: Math.round(totalMins / students),
              studentCount: students,
              sessionCount: Number(row.total_sessions || 1),
            }
          })
          setCampusData(mappedRpc.sort((a, b) => b.totalMinutes - a.totalMinutes))
          return
        }

        // 2. Fallback Query Agregasi langsung: SUM(actual_duration) di-group berdasarkan university dari profiles
        const [{ data: profilesRows }, { data: allSessionRows }] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, name, university, major, is_private_profile'),
          supabase
            .from('focus_sessions')
            .select('id, user_id, actual_duration, duration_seconds, started_at, created_at'),
        ])

        const profileList = (profilesRows as CampusProfileRow[] | null) ?? []
        const sessionList = (allSessionRows as FocusSessionRow[] | null) ?? []

        // Petakan user_id -> university (hanya profil publik atau user sendiri)
        const userCampusMap = new Map<string, string>()
        const campusStudentSet = new Map<string, Set<string>>()

        for (const p of profileList) {
          if (p.is_private_profile && p.id !== user?.id) continue
          const uni = (p.university || 'Universitas Indonesia').trim()
          userCampusMap.set(p.id, uni)
          if (!campusStudentSet.has(uni)) {
            campusStudentSet.set(uni, new Set())
          }
          campusStudentSet.get(uni)?.add(p.id)
        }

        // Pastikan kampus user saat ini terdaftar
        const currentUserUni = (user?.university || 'Universitas Indonesia').trim()
        if (user?.id) {
          userCampusMap.set(user.id, currentUserUni)
          if (!campusStudentSet.has(currentUserUni)) {
            campusStudentSet.set(currentUserUni, new Set())
          }
          campusStudentSet.get(currentUserUni)?.add(user.id)
        }

        // Gabungkan sesi yang terambil dengan sesi pribadi jika RLS membatasi pembacaan sesi user lain
        const combinedSessions =
          sessionList.length > 0
            ? sessionList
            : sessions

        const campusTotals = new Map<
          string,
          { totalSeconds: number; sessionCount: number; activeUsers: Set<string> }
        >()

        for (const s of combinedSessions) {
          const campusName = userCampusMap.get(s.user_id) || currentUserUni
          const durationSec = Number(s.actual_duration ?? s.duration_seconds ?? 0)
          const existing = campusTotals.get(campusName) ?? {
            totalSeconds: 0,
            sessionCount: 0,
            activeUsers: new Set<string>(),
          }
          existing.totalSeconds += durationSec
          existing.sessionCount += 1
          existing.activeUsers.add(s.user_id)
          campusTotals.set(campusName, existing)
        }

        // Masukkan semua kampus yang ada di profiles meskipun belum ada sesi (atau baseline agregat)
        for (const [uni, studentIds] of campusStudentSet.entries()) {
          if (!campusTotals.has(uni)) {
            campusTotals.set(uni, {
              totalSeconds: 0,
              sessionCount: 0,
              activeUsers: studentIds,
            })
          }
        }

        const aggregated: CampusComparisonPoint[] = Array.from(campusTotals.entries()).map(
          ([campusName, stats]) => {
            const totalMins = Math.round(stats.totalSeconds / 60)
            const registeredCount = campusStudentSet.get(campusName)?.size ?? 0
            const studentCount = Math.max(registeredCount, stats.activeUsers.size, 1)
            return {
              campus: campusName,
              shortName: shortenCampusName(campusName),
              totalMinutes: totalMins,
              avgMinutesPerStudent: Math.round(totalMins / studentCount),
              studentCount,
              sessionCount: stats.sessionCount,
            }
          }
        )

        aggregated.sort((a, b) => b.totalMinutes - a.totalMinutes)
        setCampusData(aggregated)
      } catch (err) {
        console.error('SUPABASE ERROR (loadCampusComparison):', err)
      } finally {
        setIsLoadingCampus(false)
      }
    }

    void loadCampusComparison()
  }, [user?.id, user?.university, sessions])

  // Logika Agregasi Data Pribadi
  const { totalMinutes, totalSessions, averageMinutes, dailyChartData } = useMemo(() => {
    let totalSecs = 0
    const dayTotals: Record<string, number> = {
      Senin: 0,
      Selasa: 0,
      Rabu: 0,
      Kamis: 0,
      Jumat: 0,
      Sabtu: 0,
      Minggu: 0,
    }

    for (const session of sessions) {
      const durationSeconds = Number(session.actual_duration ?? session.duration_seconds ?? 0)
      totalSecs += durationSeconds

      const dateStr = session.started_at || session.created_at
      if (!dateStr) continue

      const sessionDate = new Date(dateStr)
      if (Number.isNaN(sessionDate.getTime())) continue
      // Dapatkan nama hari dalam format bahasa Indonesia
      const dayName = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
      }).format(sessionDate)

      if (Object.prototype.hasOwnProperty.call(dayTotals, dayName)) {
        dayTotals[dayName] += Math.round(durationSeconds / 60)
      }
    }

    const calculatedTotalMinutes = Math.round(totalSecs / 60)
    const activeDaysCount = Object.values(dayTotals).filter((m) => m > 0).length
    const calculatedAvgMinutes =
      activeDaysCount > 0 ? Math.round(calculatedTotalMinutes / activeDaysCount) : 0

    const chartPoints: DailyFocusPoint[] = DAYS_ORDER.map((day) => ({
      day,
      focusMinutes: dayTotals[day] || 0,
    }))

    return {
      totalMinutes: calculatedTotalMinutes,
      totalSessions: sessions.length,
      averageMinutes: calculatedAvgMinutes,
      dailyChartData: chartPoints,
    }
  }, [sessions])

  const campusSummaryStats = useMemo(() => {
    const totalCampusMinutes = campusData.reduce((acc, item) => acc + item.totalMinutes, 0)
    const totalStudents = campusData.reduce((acc, item) => acc + item.studentCount, 0)
    const topCampus = campusData[0]?.campus || user?.university || 'Universitas Indonesia'
    return {
      totalCampusMinutes,
      totalCampuses: campusData.length,
      totalStudents,
      topCampus,
    }
  }, [campusData, user?.university])

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header Halaman */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
          Analitik belajar
        </p>
        <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">
          Laporan Pola Fokus
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-[19px] text-[#56638A]">
          Kenali kebiasaan belajarmu dan evaluasi perkembangan fokus terstruktur yang tersimpan di
          cloud.
        </p>

        {/* Tab Switcher */}
        <div
          className="mt-6 inline-flex rounded-xl bg-[#EAEDFF] p-1"
          role="tablist"
          aria-label="Jenis laporan"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'personal'}
            onClick={() => setActiveTab('personal')}
            className={`h-10 rounded-lg px-4 text-sm font-bold transition ${
              activeTab === 'personal'
                ? 'bg-[#1D3668] text-white shadow-sm'
                : 'text-[#56638A] hover:text-[#1F2C4F]'
            }`}
          >
            Tab Pribadi
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'campus'}
            onClick={() => setActiveTab('campus')}
            className={`h-10 rounded-lg px-4 text-sm font-bold transition ${
              activeTab === 'campus'
                ? 'bg-[#1D3668] text-white shadow-sm'
                : 'text-[#56638A] hover:text-[#1F2C4F]'
            }`}
          >
            Tab Kampus
          </button>
        </div>
      </section>

      {/* Kartu Statistik */}
      {activeTab === 'personal' ? (
        <section
          aria-label="Statistik fokus pribadi"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <StatCard
            icon={Trophy}
            label="Total selesai"
            value={`${totalSessions} blok`}
            detail={totalSessions > 0 ? 'Akumulasi sesi selesai' : 'Belum ada sesi selesai'}
            tone="green"
          />
          <StatCard
            icon={Clock3}
            label="Total fokus"
            value={`${totalMinutes} menit`}
            detail="Akumulasi waktu fokus riil"
            tone="blue"
          />
          <StatCard
            icon={BarChart3}
            label="Rata rata fokus"
            value={`${averageMinutes} menit`}
            detail="Per hari aktif belajar"
            tone="rose"
          />
        </section>
      ) : (
        <div className="space-y-4">
          <section className="flex items-start gap-3 rounded-2xl border border-[#5E3F0C]/10 bg-[#FBEFD9] p-5 text-[#5E3F0C] shadow-[0_2px_6px_rgba(94,63,12,0.06)]">
            <ShieldCheck className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold">Data bersifat agregat dan menghormati privasi</h2>
              <p className="mt-1 text-[13px] leading-[19px]">
                Data komparasi ini menghimpun total waktu fokus berdasarkan entitas kampus dari
                profil mahasiswa yang bersifat publik.
              </p>
            </div>
          </section>

          <section
            aria-label="Statistik komparasi kampus"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <StatCard
              icon={Building2}
              label="Entitas Kampus"
              value={`${campusSummaryStats.totalCampuses} Kampus`}
              detail={`Teratas: ${campusSummaryStats.topCampus}`}
              tone="blue"
            />
            <StatCard
              icon={Clock3}
              label="Total Fokus Kampus"
              value={`${campusSummaryStats.totalCampusMinutes} menit`}
              detail="Akumulasi SUM durasi fokus"
              tone="rose"
            />
            <StatCard
              icon={Users}
              label="Partisipan Publik"
              value={`${campusSummaryStats.totalStudents} Mahasiswa`}
              detail="Kontributor fokus terdata"
              tone="green"
            />
          </section>
        </div>
      )}

      {/* Bagian Grafik atau Empty State */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">
              {activeTab === 'personal'
                ? 'Durasi Fokus per Hari'
                : 'Komparasi Durasi Fokus Berdasarkan Entitas Kampus'}
            </h2>
            <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">
              {activeTab === 'personal'
                ? 'Capaian waktu fokusmu dalam sepekan terakhir.'
                : 'Agregasi total menit fokus (SUM durasi_fokus) yang dikelompokkan berdasarkan universitas/kampus.'}
            </p>
          </div>
          {activeTab === 'personal' && sessions.length > 0 && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]">
              <span className="h-2 w-2 rounded-sm bg-[#1D3668]" /> Menit fokus
            </span>
          )}
          {activeTab === 'campus' && campusData.length > 0 && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#FCDDE6] px-2.5 py-1 text-[11px] font-semibold text-[#8E1744]">
              <span className="h-2 w-2 rounded-sm bg-[#BE2257]" /> Total menit kampus
            </span>
          )}
        </div>

        {/* Konten Tab Pribadi */}
        {activeTab === 'personal' && (
          <div className="mt-5 min-w-0">
            {isLoading ? (
              <div
                role="status"
                aria-live="polite"
                className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#DFE4F1] bg-[#F6F7FC] text-[#56638A]"
              >
                <Loader2 size={24} className="animate-spin text-[#BE2257]" aria-hidden="true" />
                <span className="text-sm font-medium">Memuat data analitik dari Supabase...</span>
              </div>
            ) : error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-900"
              >
                <p className="text-sm font-bold">Gagal memuat analitik</p>
                <p className="mt-1 text-xs text-red-700">{error}</p>
              </div>
            ) : sessions.length === 0 ? (
              /* Empty State Tab Pribadi */
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DFE4F1] bg-[#F8F9FD] px-6 py-12 text-center sm:py-16">
                <span className="grid h-20 w-20 place-items-center rounded-full bg-white shadow-xs">
                  <BarChart2 size={40} className="text-[#1D3668]/30" strokeWidth={1.5} />
                </span>
                <h3 className="mt-4 text-[18px] font-extrabold text-[#1F2C4F]">
                  Belum ada riwayat belajar
                </h3>
                <p className="mt-1.5 max-w-md text-[13px] leading-[20px] text-[#56638A]">
                  Selesaikan sesi fokus pertamamu minggu ini untuk mulai melihat analitik dan progres
                  belajarmu di sini!
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/focus')}
                  className="mt-6 flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-5 text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#152A55] active:scale-[0.98]"
                >
                  <span>Mulai Mode Fokus</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <FocusChart data={dailyChartData} color="#1D3668" />
            )}
          </div>
        )}

        {/* Konten Tab Kampus */}
        {activeTab === 'campus' && (
          <div className="mt-5 min-w-0 space-y-6">
            {isLoadingCampus ? (
              <div
                role="status"
                aria-live="polite"
                className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#DFE4F1] bg-[#F6F7FC] text-[#56638A]"
              >
                <Loader2 size={24} className="animate-spin text-[#BE2257]" aria-hidden="true" />
                <span className="text-sm font-medium">Mengagregasi data komparasi kampus...</span>
              </div>
            ) : campusData.length > 0 ? (
              <>
                <CampusComparisonChart data={campusData} />

                {/* Rincian Peringkat Kampus */}
                <div className="border-t border-[#DFE4F1] pt-5">
                  <h3 className="text-sm font-bold text-[#1F2C4F]">
                    Peringkat Agregasi Fokus Entitas Kampus
                  </h3>
                  <div className="mt-3 space-y-2.5">
                    {campusData.map((item, idx) => (
                      <div
                        key={item.campus}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] px-4 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white ${
                              idx === 0
                                ? 'bg-[#BE2257]'
                                : idx === 1
                                  ? 'bg-[#1D3668]'
                                  : 'bg-[#56638A]'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#1F2C4F]">
                              {item.campus}
                            </p>
                            <p className="text-xs text-[#56638A]">
                              {item.studentCount} mahasiswa · {item.sessionCount} sesi tercatat
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-extrabold text-[#1D3668]">
                            {item.totalMinutes} menit
                          </p>
                          <p className="text-[11px] text-[#757780]">
                            Rata-rata {item.avgMinutesPerStudent} mnt/mhs
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DFE4F1] bg-[#F8F9FD] px-6 py-12 text-center sm:py-16">
                <span className="grid h-20 w-20 place-items-center rounded-full bg-white shadow-xs">
                  <BarChart2 size={36} className="text-[#BE2257]/40" strokeWidth={1.5} />
                </span>
                <h3 className="mt-4 text-[18px] font-extrabold text-[#1F2C4F]">
                  Belum ada data sesi fokus kampus
                </h3>
                <p className="mt-1.5 max-w-md text-[13px] leading-[20px] text-[#56638A]">
                  Mulai sesi fokus pertamamu untuk menyumbangkan menit fokus bagi almamater kampusmu!
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
