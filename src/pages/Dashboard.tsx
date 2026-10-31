import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  Lightbulb,
  Loader2,
  Medal,
  Play,
  ShieldCheck,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  mockGroupMembers,
  mockNotifications,
  mockSessions,
  mockUsers,
} from '../lib/mockData'
import { evaluateStreak, formatLastStudyDateLabel } from '../lib/streak'
import { useAuthStore } from '../store/authStore'
import WelcomeModal from '../components/WelcomeModal'
import { useSessionStore, type FocusStatus } from '../store/sessionStore'
import { useStudyStore } from '../store/studyStore'
import type { StudyBlock } from '../types'

const currentUser = mockUsers[0]
const timeZone = currentUser.timezone || 'Asia/Jakarta'

function getTodayDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getGreeting() {
  const hour = Number(
    new Intl.DateTimeFormat('id-ID', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()),
  )

  if (hour >= 4 && hour < 11) return 'Selamat pagi'
  if (hour >= 11 && hour < 15) return 'Selamat siang'
  if (hour >= 15 && hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

function getDisplayDate() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

function formatTime(time: string) {
  return time.replace(':', '.')
}

type BlockStatus = 'active' | 'paused' | 'scheduled' | 'completed'

function getBlockStatus(block: StudyBlock, activeBlock: StudyBlock | null, focusStatus: FocusStatus): BlockStatus {
  if (activeBlock?.id === block.id) return focusStatus === 'paused' ? 'paused' : 'active'
  if (block.status === 'completed') return 'completed'
  return 'scheduled'
}

function StatTile({
  icon: Icon,
  tone,
  eyebrow,
  label,
  value,
  detail,
}: {
  icon: LucideIcon
  tone: 'blue' | 'rose' | 'green' | 'navy'
  eyebrow: string
  label: string
  value: number
  detail: string
}) {
  const tones = {
    blue: 'bg-[#E1EAF8] text-[#1D3668]',
    rose: 'bg-[#FCDDE6] text-[#8E1744]',
    green: 'bg-[#D6F0DE] text-[#17623A]',
    navy: 'bg-[#E2E7FF] text-[#1D3668]',
  }
  const eyebrowTone = {
    blue: 'text-[#757780]',
    rose: 'text-[#8E1744]',
    green: 'text-[#17623A]',
    navy: 'text-[#1D3668]',
  }

  return (
    <article className="flex min-h-[124px] flex-col justify-between rounded-2xl bg-white p-4 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
      <div className="mb-2 flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon size={19} strokeWidth={1.8} />
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${eyebrowTone[tone]}`}>
          {eyebrow}
        </span>
      </div>
      <div>
        <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#757780]">{label}</span>
        <div className="mt-0.5 text-2xl font-extrabold leading-[30px] tabular-nums tracking-tight text-[#1F2C4F]">
          {value}
        </div>
        <span className="mt-0.5 block truncate text-[12px] leading-[18px] text-[#56638A]">{detail}</span>
      </div>
    </article>
  )
}

function StudyBlockCard({
  block,
  status,
  anotherSessionActive,
  onStart,
  onOpen,
}: {
  block: StudyBlock
  status: BlockStatus
  anotherSessionActive: boolean
  onStart: (block: StudyBlock) => void
  onOpen: () => void
}) {
  const isActive = status === 'active'
  const isPaused = status === 'paused'
  const isCompleted = status === 'completed'
  const statusText = isActive
    ? 'Aktif Sekarang'
    : isPaused
      ? 'Dijeda'
      : isCompleted
        ? 'Selesai'
        : 'Terjadwal'
  const statusStyle = isActive
    ? 'bg-[#D6F0DE] text-[#17623A]'
    : isPaused
      ? 'bg-[#FDEBC8] text-[#7A4B00]'
      : isCompleted
        ? 'bg-[#F6F7FC] text-[#56638A]'
        : 'bg-[#E1EAF8] text-[#1D3668]'

  return (
    <article className="relative flex flex-col space-y-2.5 overflow-hidden rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
      {isActive && <span className="absolute bottom-0 left-0 top-0 w-1.5 bg-[#1D3668]" />}
      <div className={`flex items-center justify-between gap-3 ${isActive ? 'pl-1' : ''}`}>
        <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${isActive ? 'text-[#1D3668]' : 'text-[#757780]'}`}>
          {block.type}
        </span>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle}`}>
          {(isActive || isPaused) && <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'animate-pulse bg-[#17623A]' : 'bg-[#7A4B00]'}`} />}
          {statusText}
        </span>
      </div>

      <div className={isActive ? 'pl-1' : ''}>
        <h3 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">{block.title}</h3>
        <div className="mt-1 flex items-start gap-1.5 text-[13px] leading-[18px] text-[#56638A]">
          <Clock3 size={15} className="mt-0.5 shrink-0 text-[#757780]" />
          <span className="min-w-0">{formatTime(block.start_time)} – {formatTime(block.end_time)} · {block.description}</span>
        </div>
        {block.co_focus_enabled && (
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]">
            <UsersRound size={14} /> Co-focus aktif
          </span>
        )}
      </div>

      <div className={isActive ? 'pl-1 pt-1' : 'pt-1'}>
        {isActive || isPaused ? (
          <button
            type="button"
            onClick={onOpen}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-4 text-sm font-bold text-white transition-transform active:scale-[0.98]"
          >
            {isPaused ? 'Lanjutkan Sesi Fokus' : 'Buka Sesi Fokus Aktif'}
            <ArrowRight size={17} />
          </button>
        ) : isCompleted ? (
          <button
            type="button"
            disabled
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#F6F7FC] px-4 text-sm font-semibold text-[#56638A] disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={16} /> Sesi selesai
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStart(block)}
            disabled={anotherSessionActive}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition-transform hover:bg-[#A11B48] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mulai Mode Fokus <Play size={16} fill="currentColor" />
          </button>
        )}
      </div>
    </article>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const authUser = useAuthStore((state) => state.user)
  const hasSeenOnboarding = useAuthStore((state) => state.hasSeenOnboarding)
  const setHasSeenOnboarding = useAuthStore((state) => state.setHasSeenOnboarding)
  const currentUser = authUser ?? mockUsers[0]
  const [isStreakBannerDismissed, setIsStreakBannerDismissed] = useState(false)
  const streakEvaluation = evaluateStreak(currentUser.streak ?? 0, currentUser.lastStudyDate)
  const blocks = useStudyStore((state) => state.studyBlocks)
  const fetchStudyBlocks = useStudyStore((state) => state.fetchStudyBlocks)
  const isLoadingBlocks = useStudyStore((state) => state.isLoading)
  const studyError = useStudyStore((state) => state.error)
  const clearStudyError = useStudyStore((state) => state.clearError)
  const activeBlock = useSessionStore((state) => state.activeBlock)
  const focusStatus = useSessionStore((state) => state.status)
  const startSession = useSessionStore((state) => state.startSession)
  const today = getTodayDate()

  useEffect(() => {
    if (authUser?.id) {
      void fetchStudyBlocks(authUser.id)
    }
  }, [authUser?.id, fetchStudyBlocks])

  const todayBlocks = blocks
    .filter((block) => block.date === today)
    .sort((a, b) => (a.startTime ?? a.start_time).localeCompare(b.startTime ?? b.start_time))
  const userSessions = mockSessions
    .filter((session) => session.user_id === currentUser.id && session.status !== 'active')
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
  const relevantSession = userSessions[0]
  const relevantNotifications = relevantSession
    ? mockNotifications.filter((notification) => notification.session_id === relevantSession.id)
    : []
  const userGroupIds = new Set(
    mockGroupMembers.filter((member) => member.user_id === currentUser.id).map((member) => member.group_id),
  )
  const coFocusFriendIds = new Set(
    mockGroupMembers
      .filter((member) => userGroupIds.has(member.group_id) && member.user_id !== currentUser.id)
      .map((member) => member.user_id),
  )
  const focusedFriends = mockSessions
    .filter((session) => session.status === 'active' && coFocusFriendIds.has(session.user_id))
    .map((session) => mockUsers.find((user) => user.id === session.user_id))
    .filter((user): user is (typeof mockUsers)[number] => Boolean(user))
  const activeCount = todayBlocks.filter((block) => {
    const status = getBlockStatus(block, activeBlock, focusStatus)
    return status === 'active' || status === 'paused'
  }).length
  const scheduledCount = todayBlocks.filter((block) => getBlockStatus(block, activeBlock, focusStatus) === 'scheduled').length
  const focusTarget = activeBlock
    ? todayBlocks.find((block) => block.id === activeBlock.id)
    : todayBlocks.find((block) => getBlockStatus(block, activeBlock, focusStatus) === 'scheduled')

  function openFocus() {
    navigate('/focus')
  }

  function beginFocus(block: StudyBlock) {
    if (activeBlock) {
      if (activeBlock.id === block.id) openFocus()
      return
    }
    startSession(block)
    openFocus()
  }

  function handleMainAction() {
    if (activeBlock) {
      openFocus()
      return
    }
    if (focusTarget) {
      beginFocus(focusTarget)
      return
    }
    navigate('/study-blocks')
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {!hasSeenOnboarding && (
        <WelcomeModal userName={currentUser.name} onClose={setHasSeenOnboarding} />
      )}
      {studyError && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <AlertCircle size={19} className="shrink-0 text-red-600" aria-hidden="true" />
            <p className="text-xs font-bold sm:text-sm">{studyError}</p>
          </div>
          <button
            type="button"
            onClick={clearStudyError}
            aria-label="Tutup peringatan jadwal"
            className="rounded-lg p-1 text-red-600 transition hover:bg-red-100"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Notifikasi Status Streak Belajar */}
      {!isStreakBannerDismissed && streakEvaluation.status === 'pending_today' && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-600">
              <Flame size={20} className="fill-amber-500 text-amber-500" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-extrabold sm:text-sm">{streakEvaluation.title}</p>
              <p className="mt-0.5 text-xs text-amber-800">{streakEvaluation.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsStreakBannerDismissed(true)}
            aria-label="Tutup notifikasi streak"
            className="rounded-lg p-1 text-amber-700 transition hover:bg-amber-200/60 shrink-0"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {!isStreakBannerDismissed && streakEvaluation.status === 'broken' && (streakEvaluation.diffDays ?? 0) > 1 && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/90 p-4 text-blue-900 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-600">
              <AlertCircle size={20} className="text-blue-600" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-extrabold sm:text-sm">{streakEvaluation.title}</p>
              <p className="mt-0.5 text-xs text-blue-800">{streakEvaluation.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsStreakBannerDismissed(true)}
            aria-label="Tutup notifikasi streak"
            className="rounded-lg p-1 text-blue-700 transition hover:bg-blue-100 shrink-0"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {!isStreakBannerDismissed && streakEvaluation.status === 'active_today' && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-emerald-900 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-extrabold sm:text-sm">{streakEvaluation.title}</p>
              <p className="text-xs text-emerald-800">{streakEvaluation.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsStreakBannerDismissed(true)}
            aria-label="Tutup notifikasi streak"
            className="rounded-lg p-1 text-emerald-700 transition hover:bg-emerald-100 shrink-0"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <section className="relative overflow-hidden rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-36 w-36 rounded-full bg-[#E1EAF8]/70 blur-xl" />
        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
              {getDisplayDate()}
            </span>
            {/* Widget Streak Api Realtime */}
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold shadow-2xs transition-all ${
                streakEvaluation.status === 'active_today'
                  ? 'border border-orange-300 bg-orange-50 text-orange-700'
                  : streakEvaluation.status === 'pending_today'
                    ? 'border border-amber-300 bg-amber-50 text-amber-800 animate-pulse'
                    : 'border border-slate-200 bg-slate-100 text-slate-600'
              }`}
              title={`Terakhir belajar: ${formatLastStudyDateLabel(currentUser.lastStudyDate)}`}
            >
              <Flame
                size={15}
                className={
                  streakEvaluation.status === 'active_today'
                    ? 'fill-orange-500 text-orange-500'
                    : streakEvaluation.status === 'pending_today'
                      ? 'fill-amber-500 text-amber-500'
                      : 'text-slate-400'
                }
                aria-hidden="true"
              />
              <span>
                {streakEvaluation.status === 'active_today'
                  ? `${streakEvaluation.currentStreak} Hari Beruntun! (Selesai)`
                  : streakEvaluation.status === 'pending_today'
                    ? `${streakEvaluation.currentStreak} Hari (Perlu Sesi)`
                    : '0 Hari (Mulai Hari Ini)'}
              </span>
            </div>
          </div>
          <h1 className="text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">
            {getGreeting()}, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="text-[13px] leading-[19px] text-[#44464F]">
            Pantau fokus belajarmu dan kelola study block hari ini.
          </p>

          {/* Baris Badge Medali */}
          {(currentUser.badges?.length ?? 0) > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {currentUser.badges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/90 px-3 py-1 text-xs font-bold text-amber-800"
                >
                  <Medal size={14} className="text-amber-500" aria-hidden="true" />
                  <span>{badge}</span>
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleMainAction}
            className="mt-2 flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition-transform hover:bg-[#A11B48] active:scale-[0.98]"
          >
            <span>{activeBlock ? 'Buka Sesi Fokus Aktif' : 'Mulai Mode Fokus Sekarang'}</span>
            {activeBlock ? <ArrowRight size={17} /> : <Play size={16} fill="currentColor" />}
          </button>
        </div>
      </section>

      <section aria-label="Ringkasan hari ini" className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatTile
          icon={CalendarDays}
          tone="blue"
          eyebrow="Blok"
          label="Study Block"
          value={todayBlocks.length}
          detail={`${activeCount} aktif, ${scheduledCount} terjadwal`}
        />
        <StatTile
          icon={Bell}
          tone="rose"
          eyebrow="Notif"
          label="Ditunda"
          value={relevantNotifications.filter((notification) => !notification.passed).length}
          detail={activeBlock ? 'Sesi yang berjalan' : 'Sesi terakhir'}
        />
        <StatTile
          icon={ShieldCheck}
          tone="green"
          eyebrow="Lolos"
          label="Penting"
          value={relevantNotifications.filter((notification) => notification.passed).length}
          detail="Tetap masuk"
        />
        <StatTile
          icon={UsersRound}
          tone="navy"
          eyebrow="Live"
          label="Co-focus"
          value={coFocusFriendIds.size}
          detail={`${focusedFriends.length} sedang fokus`}
        />
      </section>

      <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)] lg:items-start lg:gap-5 lg:space-y-0">
        <section className="space-y-4">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Study Block Hari Ini</h2>
            <button
              type="button"
              onClick={() => navigate('/study-blocks')}
              className="text-xs font-semibold text-[#1D3668] transition-colors hover:text-[#BE2257]"
            >
              Lihat semua
            </button>
          </div>

          {isLoadingBlocks ? (
            <div role="status" aria-live="polite" className="space-y-3.5">
              <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[#DFE4F1] bg-white px-5 py-5 text-xs font-semibold text-[#1D3668] shadow-[0_2px_4px_rgba(29,54,104,0.03)] sm:text-sm">
                <Loader2 size={18} className="animate-spin text-[#BE2257]" aria-hidden="true" />
                <span>Mengambil jadwal hari ini dari Supabase Cloud...</span>
              </div>
              {[1, 2].map((skeletonId) => (
                <div
                  key={skeletonId}
                  className="animate-pulse space-y-3 rounded-2xl border border-[#DFE4F1] bg-white p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-24 rounded bg-[#E1EAF8]" />
                    <div className="h-5 w-20 rounded-full bg-[#EEF1F8]" />
                  </div>
                  <div className="h-6 w-3/4 rounded-lg bg-[#EEF1F8]" />
                  <div className="h-4 w-1/2 rounded-lg bg-[#F6F7FC]" />
                  <div className="h-11 w-full rounded-[10px] bg-[#EEF1F8]" />
                </div>
              ))}
            </div>
          ) : todayBlocks.length ? (
            <div className="space-y-3.5">
              {todayBlocks.map((block) => (
                <StudyBlockCard
                  key={block.id}
                  block={block}
                  status={getBlockStatus(block, activeBlock, focusStatus)}
                  anotherSessionActive={Boolean(activeBlock && activeBlock.id !== block.id)}
                  onStart={beginFocus}
                  onOpen={openFocus}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#C4C6D0] bg-white px-5 py-8 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
                <CalendarDays size={19} />
              </span>
              <h3 className="mt-3 text-sm font-bold text-[#1F2C4F]">Belum ada study block hari ini</h3>
              <p className="mt-1 text-xs leading-[18px] text-[#56638A]">Jadwal belajar untuk {getDisplayDate()} akan muncul di sini.</p>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="space-y-4 rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {focusedFriends.length > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#17623A] opacity-70" />}
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${focusedFriends.length ? 'bg-[#17623A]' : 'bg-[#C4C6D0]'}`} />
                </span>
                <h2 className="text-base font-bold leading-[22px] text-[#1F2C4F]">Rekan Sedang Fokus</h2>
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-[#757780]">
                {focusedFriends.length} aktif
              </span>
            </div>

            {focusedFriends.length ? (
              focusedFriends.map((friend, index) => {
                const initials = friend.name.split(' ').map((part) => part[0]).slice(0, 2).join('')
                const session = mockSessions.find((item) => item.user_id === friend.id && item.status === 'active')
                const block = session ? blocks.find((item) => item.id === session.block_id) : undefined

                return (
                  <div key={friend.id} className="flex items-start gap-3 rounded-xl bg-[#F6F7FC] p-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white ${index % 2 ? 'bg-[#BE2257]' : 'bg-[#1D3668]'}`}>
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-[18px] text-[#1F2C4F]">
                        <strong className="font-semibold">{friend.name}</strong> sedang fokus{block ? ` pada ${block.title}` : ''}.
                      </p>
                      <span className="mt-1 block text-xs font-semibold text-[#BE2257]">Mode Fokus aktif</span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-xl bg-[#F6F7FC] p-3 text-[13px] leading-[19px] text-[#56638A]">
                Belum ada rekan di kelompokmu yang sedang fokus.
              </div>
            )}

            <button
              type="button"
              disabled={focusedFriends.length === 0}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#E1EAF8] text-sm font-bold text-[#1D3668] transition-colors hover:bg-[#D7E4F6] active:bg-[#1D3668] active:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UsersRound size={17} />
              {focusedFriends.length ? 'Kirim Sapaan Hening' : 'Belum ada rekan aktif'}
            </button>
          </section>

          <section className="space-y-2.5 rounded-2xl border border-[#5E3F0C]/10 bg-[#FBEFD9] p-5 text-[#5E3F0C] shadow-[0_2px_6px_rgba(94,63,12,0.06)]">
            <div className="flex items-center gap-2">
              <Lightbulb size={19} />
              <h2 className="text-base font-bold leading-[22px]">Prinsip Smart Focus</h2>
            </div>
            <ul className="space-y-2 pt-1 text-[13px] leading-[18px] text-[#5E3F0C]/95">
              <li className="flex items-start gap-2"><Check size={17} className="mt-0.5 shrink-0" /><span>Notifikasi disaring otomatis saat jadwal belajar tiba</span></li>
              <li className="flex items-start gap-2"><Check size={17} className="mt-0.5 shrink-0" /><span>Teman tahu kamu sedang fokus tanpa merasa diabaikan</span></li>
              <li className="flex items-start gap-2"><Check size={17} className="mt-0.5 shrink-0" /><span>Kontak darurat dan akademik selalu bisa menghubungimu</span></li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
