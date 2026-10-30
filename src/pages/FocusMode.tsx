import { AlertCircle, CheckSquare, Clock3, Pause, Play, Square, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStudyDate } from '../data/mockData'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { useStudyStore } from '../store/studyStore'

const mockIncomingNotifications = [
  'Pesan WhatsApp dari Budi',
  'Email Kampus: Pengumuman',
  'Notifikasi Instagram',
] as const

function todayDate() {
  return getStudyDate()
}

function formatRemainingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export default function FocusMode() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const blocks = useStudyStore((state) => state.studyBlocks)
  const fetchStudyBlocks = useStudyStore((state) => state.fetchStudyBlocks)
  const toggleSubTask = useStudyStore((state) => state.toggleSubTask)
  const studyError = useStudyStore((state) => state.error)
  const clearStudyError = useStudyStore((state) => state.clearError)
  const activeBlock = useSessionStore((state) => state.activeBlock)
  const status = useSessionStore((state) => state.status)
  const remainingTime = useSessionStore((state) => state.remainingTime)
  const startSession = useSessionStore((state) => state.startSession)
  const pauseSession = useSessionStore((state) => state.pauseSession)
  const resumeSession = useSessionStore((state) => state.resumeSession)
  const endSession = useSessionStore((state) => state.endSession)
  const heldNotifications = useSessionStore((state) => state.heldNotifications)
  const addHeldNotification = useSessionStore((state) => state.addHeldNotification)
  const tick = useSessionStore((state) => state.tick)
  const notificationCursor = useRef(0)

  useEffect(() => {
    if (user?.id) {
      void fetchStudyBlocks(user.id)
    }
  }, [fetchStudyBlocks, user?.id])

  useEffect(() => {
    if (status !== 'running') return

    const intervalId = window.setInterval(tick, 1000)
    return () => window.clearInterval(intervalId)
  }, [status, tick])

  useEffect(() => {
    if (status === 'running' && remainingTime === 0) {
      endSession()
      navigate('/summary', { replace: true })
    }
  }, [endSession, navigate, remainingTime, status])

  function finishSession() {
    endSession()
    navigate('/summary')
  }

  useEffect(() => {
    if (status !== 'running') return

    const intervalId = window.setInterval(() => {
      const text = mockIncomingNotifications[notificationCursor.current % mockIncomingNotifications.length]
      notificationCursor.current += 1
      if (!text.includes('Email')) {
        addHeldNotification({
          id: globalThis.crypto?.randomUUID?.() ?? `held-${Date.now()}-${notificationCursor.current}`,
          text,
          receivedAt: new Date().toISOString(),
        })
      }
    }, 15_000)

    return () => window.clearInterval(intervalId)
  }, [addHeldNotification, status])

  const todayBlocks = blocks
    .filter((block) => block.date === todayDate())
    .sort((first, second) => first.start_time.localeCompare(second.start_time))

  if (status === 'idle') {
    return (
      <div className="space-y-5 sm:space-y-6">
        <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Mode Fokus</p>
          <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">Tidak ada sesi fokus yang aktif.</h1>
          <p className="mt-2 text-[13px] leading-[19px] text-[#56638A]">Pilih salah satu jadwal hari ini untuk memulai sesi fokus.</p>
        </section>

        <section aria-labelledby="available-blocks-title">
          <div className="mb-3 flex items-center justify-between px-0.5">
            <h2 id="available-blocks-title" className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Jadwal hari ini</h2>
            <span className="rounded-full bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]">{todayBlocks.length} jadwal</span>
          </div>

          {todayBlocks.length ? (
            <div className="grid gap-3.5 md:grid-cols-2">
              {todayBlocks.map((block) => (
                <article key={block.id} className="flex flex-col rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#1D3668]">{block.type}</span>
                  <h3 className="mt-2 text-[18px] font-bold leading-6 text-[#1F2C4F]">{block.title}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#56638A]"><Clock3 size={15} aria-hidden="true" /> {block.start_time.replace(':', '.')} - {block.end_time.replace(':', '.')}</p>
                  <button
                    type="button"
                    onClick={() => startSession(block)}
                    className="mt-5 flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white transition hover:bg-[#A11B48] focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2"
                  >
                    <Play size={17} fill="currentColor" aria-hidden="true" /> Mulai Fokus
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#C4C6D0] bg-white p-8 text-center text-sm leading-5 text-[#56638A]">
              Belum ada Study Block untuk hari ini. Tambahkan jadwal dari menu Study terlebih dahulu.
            </div>
          )}
        </section>
      </div>
    )
  }

  const isPaused = status === 'paused'
  const currentBlock = blocks.find((b) => b.id === activeBlock?.id) ?? activeBlock
  const subTasks = currentBlock?.subTasks ?? []
  const completedSubTasksCount = subTasks.filter((t) => t.isCompleted).length

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(290px,0.75fr)] xl:items-start">
      <div className="space-y-5">
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
              aria-label="Tutup peringatan"
              className="rounded-lg p-1 text-red-600 transition hover:bg-red-100"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-[18px] bg-[#1D3668] p-6 text-white shadow-[0_8px_16px_rgba(29,54,104,0.14)] sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CC3FF]">{isPaused ? 'Sesi dijeda' : 'Sesi fokus berjalan'}</p>
          <h1 className="mt-2 text-[24px] font-extrabold leading-8 tracking-tight sm:text-[30px]">{currentBlock?.title ?? 'Sesi fokus'}</h1>
          <p className="mt-2 text-sm leading-5 text-[#D9E2FF]">{currentBlock?.type}</p>
          <div className="my-8 flex justify-center">
            <div className="flex h-52 w-52 items-center justify-center rounded-full border-4 border-white/20 bg-white/5 shadow-inner sm:h-60 sm:w-60">
              <div
                className="text-center font-mono text-[48px] font-extrabold leading-none tracking-[-0.05em] tabular-nums sm:text-[64px]"
                aria-label={`Sisa waktu ${formatRemainingTime(remainingTime)}`}
              >
                {formatRemainingTime(remainingTime)}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={isPaused ? resumeSession : pauseSession}
              className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-white px-4 text-sm font-bold text-[#1D3668] transition hover:bg-[#E1EAF8] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#1D3668]"
            >
              {isPaused ? <Play size={18} fill="currentColor" aria-hidden="true" /> : <Pause size={18} fill="currentColor" aria-hidden="true" />}
              {isPaused ? 'Lanjutkan' : 'Jeda'}
            </button>
            <button
              type="button"
              onClick={finishSession}
              className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-[#FFB1C0] px-4 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#1D3668]"
            >
              <Square size={17} fill="currentColor" aria-hidden="true" /> Akhiri Sesi
            </button>
          </div>
        </section>

        {/* Sub-Tasks Checklist */}
        {currentBlock && subTasks.length > 0 && (
          <section
            aria-labelledby="focus-subtasks-title"
            className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
                  <CheckSquare size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2 id="focus-subtasks-title" className="text-[16px] font-bold leading-5 text-[#1F2C4F]">
                    Checklist Target Sesi
                  </h2>
                  <p className="mt-0.5 text-xs text-[#56638A]">
                    Centang sub-tugas yang sudah kamu selesaikan selama sesi ini.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-[#E1EAF8] px-2.5 py-1 text-xs font-bold text-[#1D3668]">
                {completedSubTasksCount}/{subTasks.length} Selesai
              </span>
            </div>

            <ul className="space-y-2.5">
              {subTasks.map((task) => (
                <li key={task.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-3.5 transition hover:border-[#1D3668]/30 hover:bg-[#EEF2FA]">
                    <input
                      type="checkbox"
                      checked={task.isCompleted}
                      onChange={() =>
                        void toggleSubTask(currentBlock.id, task.id, !task.isCompleted).catch(
                          () => undefined
                        )
                      }
                      className="h-4 w-4 shrink-0 cursor-pointer rounded border-[#C4C6D0] text-[#1D3668] accent-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                    />
                    <span
                      className={`text-sm font-semibold transition ${
                        task.isCompleted ? 'line-through text-gray-400' : 'text-[#1F2C4F]'
                      }`}
                    >
                      {task.title}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Notifikasi yang Ditunda</h2>
          <span className="rounded-full bg-[#FCDDE6] px-2.5 py-1 text-[11px] font-semibold text-[#8E1744]">{heldNotifications.length} held</span>
        </div>
        <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">Notifikasi non-penting akan muncul di sini selama sesi fokus berjalan.</p>
        <div className="mt-5 space-y-2.5">
          {heldNotifications.length ? heldNotifications.map((notification) => (
            <article key={notification.id} className="rounded-xl border border-[#FCDDE6] bg-[#FFF7F8] p-3">
              <p className="text-[13px] font-semibold leading-[18px] text-[#1F2C4F]">{notification.text}</p>
              <time className="mt-1 block text-[11px] text-[#8E1744]" dateTime={notification.receivedAt}>
                Ditunda pada {new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(notification.receivedAt))}
              </time>
            </article>
          )) : (
            <div className="rounded-xl bg-[#F6F7FC] p-4 text-sm leading-5 text-[#56638A]">Belum ada notifikasi yang ditunda.</div>
          )}
        </div>
      </aside>
    </div>
  )
}
