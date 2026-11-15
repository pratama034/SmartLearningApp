import {
  AlertCircle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Pause,
  Play,
  Sparkles,
  Square,
  Timer,
  Watch,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStudyDate } from '../data/mockData'
import { startTimerAlarm } from '../lib/stufoSync'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { useStudyStore } from '../store/studyStore'

function todayDate() {
  return getStudyDate()
}

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remainder = safe % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function triggerTimerFinishedAlert(sessionTitle: string) {
  // 1. Bunyi alarm panjang berulang (12 detik seperti jam beker) + getar
  startTimerAlarm(12000)

  // 2. Browser / Web Notification
  try {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('⏰ Waktu Fokus Selesai! — StuFo', {
          body: `Sesi "${sessionTitle}" telah selesai. Durasi fokusmu sudah otomatis tercatat!`,
          icon: '/logo.jpg',
        })
      }
    }
  } catch {
    // ignore
  }

  // 3. Sinyal ke React Native WebView (jika berjalan di aplikasi Android)
  try {
    const rnWebView = (
      window as unknown as {
        ReactNativeWebView?: { postMessage: (message: string) => void }
      }
    ).ReactNativeWebView
    if (typeof window !== 'undefined' && rnWebView?.postMessage) {
      rnWebView.postMessage(
        JSON.stringify({
          type: 'TIMER_COMPLETED_NOTIFICATION',
          data: {
            title: 'Waktu Fokus Selesai! 🎉',
            body: `Sesi "${sessionTitle}" telah selesai dan durasi otomatis tercatat.`,
          },
        })
      )
    }
  } catch {
    // ignore
  }
}

const TIMER_PRESETS = [15, 25, 45, 60]

export default function FocusMode() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const blocks = useStudyStore((state) => state.studyBlocks)
  const fetchStudyBlocks = useStudyStore((state) => state.fetchStudyBlocks)
  const toggleSubTask = useStudyStore((state) => state.toggleSubTask)
  const studyError = useStudyStore((state) => state.error)
  const clearStudyError = useStudyStore((state) => state.clearError)

  const activeBlock = useSessionStore((state) => state.activeBlock)
  const modeKind = useSessionStore((state) => state.modeKind)
  const status = useSessionStore((state) => state.status)
  const remainingTime = useSessionStore((state) => state.remainingTime)
  const elapsedSeconds = useSessionStore((state) => state.elapsedSeconds)
  const startSession = useSessionStore((state) => state.startSession)
  const startSpontaneousTimer = useSessionStore((state) => state.startSpontaneousTimer)
  const startSpontaneousStopwatch = useSessionStore((state) => state.startSpontaneousStopwatch)
  const pauseSession = useSessionStore((state) => state.pauseSession)
  const resumeSession = useSessionStore((state) => state.resumeSession)
  const stopFocus = useSessionStore((state) => state.stopFocus)
  const tick = useSessionStore((state) => state.tick)

  // State untuk Fokus Spontan (tanpa jadwal)
  const [spontaneousTab, setSpontaneousTab] = useState<'stopwatch' | 'timer'>('stopwatch')
  const [spontaneousTitle, setSpontaneousTitle] = useState('')
  const [selectedMinutes, setSelectedMinutes] = useState<number>(25)
  const [customMinutes, setCustomMinutes] = useState<string>('')

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

  // Deteksi ketika mode Timer / Terjadwal selesai (mencapai 00:00)
  useEffect(() => {
    if (status === 'running' && modeKind !== 'stopwatch' && remainingTime === 0) {
      triggerTimerFinishedAlert(activeBlock?.title || 'Sesi Fokus')
      void stopFocus(true)
      navigate('/summary', { replace: true })
    }
  }, [activeBlock?.title, modeKind, navigate, remainingTime, status, stopFocus])

  function requestWebNotificationPermission() {
    try {
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'default'
      ) {
        void Notification.requestPermission()
      }
    } catch {
      // ignore
    }
  }

  function handleStartSpontaneous() {
    requestWebNotificationPermission()
    const cleanTitle = spontaneousTitle.trim()
    if (spontaneousTab === 'stopwatch') {
      startSpontaneousStopwatch(cleanTitle || 'Fokus Spontan (Stopwatch)')
    } else {
      const parsedCustom = Number(customMinutes)
      const finalMinutes =
        !Number.isNaN(parsedCustom) && parsedCustom >= 1 ? parsedCustom : selectedMinutes
      startSpontaneousTimer(
        finalMinutes,
        cleanTitle || `Fokus Spontan (${finalMinutes} Menit)`
      )
    }
  }

  function finishSession() {
    void stopFocus(false)
    navigate('/summary')
  }

  const todayBlocks = blocks
    .filter((block) => block.date === todayDate())
    .sort((first, second) => first.start_time.localeCompare(second.start_time))

  if (status === 'idle') {
    return (
      <div className="space-y-5 sm:space-y-6">
        {/* Header Mode Fokus */}
        <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
            Mode Fokus StuFo
          </p>
          <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">
            Mulai Fokus Spontan atau dari Jadwal
          </h1>
          <p className="mt-1.5 text-[13px] leading-[19px] text-[#56638A]">
            Kamu bisa langsung mulai belajar secara spontan menggunakan <strong>Stopwatch</strong>{' '}
            atau <strong>Timer (lengkap dengan notifikasi saat selesai)</strong> tanpa harus membuat
            jadwal terlebih dahulu.
          </p>
        </section>

        {/* KARTU FOKUS SPONTAN (STOPWATCH & TIMER TANPA JADWAL) */}
        <section className="overflow-hidden rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DFE4F1] pb-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FCDDE6] text-[#BE2257]">
                {spontaneousTab === 'stopwatch' ? <Watch size={20} /> : <Timer size={20} />}
              </span>
              <div>
                <h2 className="text-[17px] font-extrabold text-[#1F2C4F]">
                  Fokus Spontan (Tanpa Jadwal)
                </h2>
                <p className="text-xs text-[#56638A]">
                  Langsung mulai sesi belajar kapan saja, durasi tetap tercatat otomatis di Laporan.
                </p>
              </div>
            </div>

            {/* Tab Pilihan: Stopwatch vs Timer */}
            <div className="inline-flex rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-1">
              <button
                type="button"
                onClick={() => setSpontaneousTab('stopwatch')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-extrabold transition ${
                  spontaneousTab === 'stopwatch'
                    ? 'bg-[#1D3668] text-white shadow-xs'
                    : 'text-[#56638A] hover:text-[#1F2C4F]'
                }`}
              >
                <Watch size={14} />
                <span>Stopwatch (Hitung Maju)</span>
              </button>
              <button
                type="button"
                onClick={() => setSpontaneousTab('timer')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-extrabold transition ${
                  spontaneousTab === 'timer'
                    ? 'bg-[#1D3668] text-white shadow-xs'
                    : 'text-[#56638A] hover:text-[#1F2C4F]'
                }`}
              >
                <Timer size={14} />
                <span>Timer (Hitung Mundur)</span>
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="spontaneous-title"
                className="mb-1.5 block text-xs font-bold text-[#1F2C4F]"
              >
                Apa yang sedang ingin kamu pelajari? (Opsional)
              </label>
              <input
                id="spontaneous-title"
                type="text"
                value={spontaneousTitle}
                onChange={(e) => setSpontaneousTitle(e.target.value)}
                placeholder="Contoh: Review Materi UTS / Latihan Coding / Baca Jurnal..."
                className="h-11 w-full rounded-xl border border-[#DFE4F1] bg-[#F9FAFE] px-3.5 text-sm text-[#1F2C4F] outline-none placeholder:text-[#757780] focus:border-[#1D3668] focus:bg-white focus:ring-2 focus:ring-[#1D3668]"
              />
            </div>

            {spontaneousTab === 'timer' ? (
              <div className="space-y-3 rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#1F2C4F]">
                    Pilih Durasi Timer Fokus:
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E1EAF8] px-2.5 py-0.5 text-[11px] font-bold text-[#1D3668]">
                    <BellRing size={12} />
                    <span>Notifikasi &amp; Alarm aktif saat selesai</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                  {TIMER_PRESETS.map((mins) => {
                    const isSelected = customMinutes === '' && selectedMinutes === mins
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          setSelectedMinutes(mins)
                          setCustomMinutes('')
                        }}
                        className={`flex h-11 items-center justify-center rounded-xl border text-xs font-extrabold transition ${
                          isSelected
                            ? 'border-[#1D3668] bg-[#1D3668] text-white shadow-sm'
                            : 'border-[#DFE4F1] bg-white text-[#1F2C4F] hover:border-[#1D3668]/40'
                        }`}
                      >
                        {mins} Menit
                      </button>
                    )
                  })}
                  <div className="col-span-2 sm:col-span-1">
                    <input
                      type="number"
                      min={1}
                      max={360}
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      placeholder="Kustom (mnt)"
                      className="h-11 w-full rounded-xl border border-[#DFE4F1] bg-white px-3 text-center text-xs font-bold text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-4 text-xs text-[#56638A]">
                <Sparkles size={18} className="shrink-0 text-[#1D3668]" />
                <span>
                  <strong>Mode Stopwatch:</strong> Waktu akan menghitung maju mulai dari{' '}
                  <code className="font-bold text-[#1D3668]">00:00</code> sampai kamu menekan tombol{' '}
                  <strong>Akhiri Sesi</strong>. Cocok untuk belajar spontan tanpa target waktu kaku!
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleStartSpontaneous}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#BE2257] px-5 text-sm font-extrabold text-white shadow-md shadow-[#BE2257]/25 transition hover:bg-[#A11B48] active:scale-[0.99]"
            >
              <Play size={17} fill="currentColor" aria-hidden="true" />
              <span>
                {spontaneousTab === 'stopwatch'
                  ? 'Mulai Stopwatch Fokus Sekarang'
                  : `Mulai Timer Fokus (${
                      customMinutes && Number(customMinutes) > 0 ? customMinutes : selectedMinutes
                    } Menit)`}
              </span>
            </button>
          </div>
        </section>

        {/* DAFTAR JADWAL HARI INI (OPSIONAL) */}
        <section aria-labelledby="available-blocks-title">
          <div className="mb-3 flex items-center justify-between px-0.5">
            <h2
              id="available-blocks-title"
              className="text-[18px] font-bold leading-6 text-[#1F2C4F]"
            >
              Atau Mulai dari Jadwal Hari Ini
            </h2>
            <span className="rounded-full bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]">
              {todayBlocks.length} jadwal
            </span>
          </div>

          {todayBlocks.length ? (
            <div className="grid gap-3.5 md:grid-cols-2">
              {todayBlocks.map((block) => {
                const isCompleted = block.status === 'completed'
                return (
                  <article
                    key={block.id}
                    className="flex flex-col rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#1D3668]">
                        {block.type}
                      </span>
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D6F0DE] px-2.5 py-0.5 text-[11px] font-semibold text-[#17623A]">
                          <CheckCircle2 size={12} /> Selesai
                        </span>
                      )}
                    </div>
                    <h3
                      className={`mt-2 text-[18px] font-bold leading-6 ${
                        isCompleted ? 'line-through text-gray-400' : 'text-[#1F2C4F]'
                      }`}
                    >
                      {block.title}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#56638A]">
                      <Clock3 size={15} aria-hidden="true" /> {block.start_time.replace(':', '.')} -{' '}
                      {block.end_time.replace(':', '.')}
                    </p>
                    {isCompleted ? (
                      <button
                        type="button"
                        disabled
                        className="mt-5 flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] px-4 text-sm font-semibold text-[#56638A]"
                      >
                        <CheckCircle2 size={16} /> Sesi Telah Selesai
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          requestWebNotificationPermission()
                          startSession(block)
                        }}
                        className="mt-5 flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-4 text-sm font-bold text-white transition hover:bg-[#162B54]"
                      >
                        <Play size={17} fill="currentColor" aria-hidden="true" /> Mulai Fokus Jadwal
                        Ini
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#C4C6D0] bg-white p-6 text-center text-sm leading-5 text-[#56638A]">
              <p>Belum ada jadwal di Kalender untuk hari ini.</p>
              <button
                type="button"
                onClick={() => navigate('/study-blocks')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#E1EAF8] px-3.5 py-2 text-xs font-bold text-[#1D3668] transition hover:bg-[#1D3668] hover:text-white"
              >
                <CalendarDays size={14} />
                <span>Buka Kalender Schedule</span>
              </button>
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
  const displayClockSeconds = modeKind === 'stopwatch' ? elapsedSeconds : remainingTime

  return (
    <div className="mx-auto max-w-3xl space-y-5">
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

      <section className="overflow-hidden rounded-[22px] bg-[#1D3668] p-6 text-white shadow-[0_8px_24px_rgba(29,54,104,0.18)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CC3FF]">
            {modeKind === 'stopwatch' ? (
              <>
                <Watch size={13} />
                <span>Mode Stopwatch (Hitung Maju)</span>
              </>
            ) : modeKind === 'timer' ? (
              <>
                <Timer size={13} />
                <span>Mode Timer Spontan (Notif Aktif)</span>
              </>
            ) : (
              <>
                <Clock3 size={13} />
                <span>Mode Jadwal Terstruktur</span>
              </>
            )}
          </span>

          <span className="text-xs font-semibold text-white/80">
            {isPaused ? '⏸ Sesi Dijeda' : '🟢 Sedang Fokus (Terlihat oleh Teman Grup)'}
          </span>
        </div>

        <h1 className="mt-3 text-[24px] font-extrabold leading-8 tracking-tight sm:text-[30px]">
          {currentBlock?.title ?? 'Sesi Fokus'}
        </h1>
        <p className="mt-1 text-sm leading-5 text-[#D9E2FF]">{currentBlock?.type}</p>

        <div className="my-8 flex justify-center">
          <div className="flex h-56 w-56 flex-col items-center justify-center rounded-full border-4 border-white/20 bg-white/5 shadow-inner sm:h-64 sm:w-64">
            <span className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#9CC3FF]">
              {modeKind === 'stopwatch' ? 'Durasi Berjalan' : 'Sisa Waktu'}
            </span>
            <div
              className="text-center font-mono text-[46px] font-extrabold leading-none tracking-[-0.04em] tabular-nums sm:text-[58px]"
              aria-label={`Waktu ${formatClock(displayClockSeconds)}`}
            >
              {formatClock(displayClockSeconds)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={isPaused ? resumeSession : pauseSession}
            className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-white px-4 text-sm font-bold text-[#1D3668] transition hover:bg-[#E1EAF8]"
          >
            {isPaused ? (
              <Play size={18} fill="currentColor" aria-hidden="true" />
            ) : (
              <Pause size={18} fill="currentColor" aria-hidden="true" />
            )}
            {isPaused ? 'Lanjutkan' : 'Jeda'}
          </button>
          <button
            type="button"
            onClick={finishSession}
            className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-[#FFB1C0] bg-[#BE2257] px-4 text-sm font-bold text-white transition hover:bg-[#A11B48]"
          >
            <Square size={17} fill="currentColor" aria-hidden="true" /> Simpan &amp; Akhiri Sesi
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
                <h2
                  id="focus-subtasks-title"
                  className="text-[16px] font-bold leading-5 text-[#1F2C4F]"
                >
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
                    className="h-4 w-4 shrink-0 cursor-pointer rounded border-[#C4C6D0] text-[#1D3668] accent-[#1D3668]"
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
  )
}
