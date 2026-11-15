import {
  AlertCircle,
  BarChart3,
  BellOff,
  BellRing,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  Loader2,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { stopTimerAlarm, subscribeAlarmState } from '../lib/stufoSync'
import { useSessionStore } from '../store/sessionStore'

function formatDuration(seconds: number) {
  const safe = Math.max(1, seconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remainder = safe % 60
  if (hours > 0) {
    return `${hours}j ${String(minutes).padStart(2, '0')}m`
  }
  if (minutes > 0) {
    return remainder > 0 ? `${minutes}m ${String(remainder).padStart(2, '0')}d` : `${minutes} menit`
  }
  return `${remainder} detik`
}

export default function SessionSummary() {
  const navigate = useNavigate()
  const summary = useSessionStore((state) => state.lastSessionSummary)
  const isSaving = useSessionStore((state) => state.isSaving)
  const storeError = useSessionStore((state) => state.error)
  const clearError = useSessionStore((state) => state.clearError)
  const resetSession = useSessionStore((state) => state.resetSession)

  const [isAlarmRinging, setIsAlarmRinging] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeAlarmState((playing) => {
      setIsAlarmRinging(playing)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  function handleGoToDashboard() {
    stopTimerAlarm()
    resetSession()
    navigate('/dashboard', { replace: true })
  }

  function handleGoToReports() {
    stopTimerAlarm()
    resetSession()
    navigate('/reports', { replace: true })
  }

  if (!summary) {
    return (
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-6 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
        <h1 className="text-[22px] font-extrabold text-[#1F2C4F]">Belum ada ringkasan sesi</h1>
        <p className="mt-2 text-sm leading-5 text-[#56638A]">
          Mulai dan akhiri sesi fokus untuk melihat hasil pencatatan durasimu di sini.
        </p>
        <button
          type="button"
          onClick={() => navigate('/focus')}
          className="mt-5 h-11 rounded-[10px] bg-[#1D3668] px-4 text-sm font-bold text-white"
        >
          Ke Mode Fokus
        </button>
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      {/* Banner Alarm Berbunyi (Bisa dimatikan kapan saja atau berhenti sendiri setelah 12 detik) */}
      {(isAlarmRinging || summary.timerCompletedNotification) && (
        <div
          role="status"
          aria-live="assertive"
          className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
            isAlarmRinging
              ? 'border-[#BE2257]/30 bg-[#FFF0F5] text-[#8E1744]'
              : 'border-[#1D3668]/20 bg-[#E1EAF8] text-[#1D3668]'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${
                isAlarmRinging ? 'bg-[#BE2257]' : 'bg-[#1D3668]'
              }`}
            >
              <BellRing size={20} className={isAlarmRinging ? 'animate-bounce' : ''} />
            </span>
            <div>
              <p className="text-sm font-extrabold">
                {isAlarmRinging
                  ? '🔔 Alarm Timer Fokus Sedang Berbunyi!'
                  : '⏰ Waktu Timer Fokus Telah Selesai! 🎉'}
              </p>
              <p className="mt-0.5 text-xs opacity-90">
                Durasi belajarmu untuk <strong>{summary.block.title}</strong> sudah langsung otomatis
                disimpan ke Laporan &amp; Leaderboard Teman.
              </p>
            </div>
          </div>

          {isAlarmRinging && (
            <button
              type="button"
              onClick={() => stopTimerAlarm()}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#BE2257] px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#A11B48] active:scale-[0.98]"
            >
              <BellOff size={15} />
              <span>Matikan Alarm</span>
            </button>
          )}
        </div>
      )}

      {/* Banner Konfirmasi Otomatis Tersimpan (Tanpa Refleksi) */}
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-between gap-3 rounded-2xl border border-[#17623A]/20 bg-[#D6F0DE] p-4 text-[#17623A] shadow-xs"
      >
        <div className="flex items-center gap-3">
          {isSaving ? (
            <Loader2 size={22} className="shrink-0 animate-spin text-[#17623A]" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={22} className="shrink-0 text-[#17623A]" aria-hidden="true" />
          )}
          <div>
            <p className="text-sm font-extrabold">
              {isSaving
                ? 'Menyimpan durasi fokus secara otomatis ke Cloud...'
                : 'Durasi fokus berhasil tercatat secara otomatis!'}
            </p>
            <p className="text-xs font-medium text-[#17623A]/90">
              Tanpa perlu mengisi form refleksi, waktu belajarmu langsung masuk ke grafik Laporan dan
              Leaderboard Teman.
            </p>
          </div>
        </div>
      </div>

      {storeError && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-md"
        >
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0 text-red-600" aria-hidden="true" />
            <p className="text-sm font-bold">{storeError}</p>
          </div>
          <button
            type="button"
            onClick={clearError}
            aria-label="Tutup peringatan"
            className="rounded-lg p-1 text-red-600 transition hover:bg-red-100"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Ringkasan Sesi */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
          Sesi Fokus Selesai
        </p>
        <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">
          Kerja Bagus! Fokusmu Hari Ini Tercatat
        </h1>
        <p className="mt-2 text-[13px] leading-[19px] text-[#56638A]">
          Sesi <strong>{summary.block.title}</strong> telah diselesaikan dan disinkronkan secara
          otomatis ke akun StuFo milikmu.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-[#DFE4F1] bg-[#F9FAFE] p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
              <Clock3 size={20} aria-hidden="true" />
            </span>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#757780]">
              Durasi Fokus Tercatat
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#1F2C4F]">
              {formatDuration(summary.durationSeconds)}
            </p>
            <p className="mt-1 text-xs text-[#56638A]">
              {summary.modeKind === 'stopwatch'
                ? 'Mode Stopwatch (Hitung Maju)'
                : `Target: ${formatDuration(summary.targetDurationSeconds)}`}
            </p>
          </article>

          <article className="rounded-2xl border border-[#DFE4F1] bg-[#F9FAFE] p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#D6F0DE] text-[#17623A]">
              <Sparkles size={20} aria-hidden="true" />
            </span>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#757780]">
              Status Pencatatan
            </p>
            <p className="mt-1 text-2xl font-extrabold text-[#17623A]">
              {summary.completionStatus === 'completed' ? 'Tuntas 100%' : 'Tersimpan Otomatis'}
            </p>
            <p className="mt-1 text-xs text-[#56638A]">
              Langsung tersinkron ke Grafik Laporan &amp; Leaderboard Teman
            </p>
          </article>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleGoToReports}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#BE2257] px-5 text-sm font-extrabold text-white shadow-md shadow-[#BE2257]/20 transition hover:bg-[#A11B48] active:scale-[0.99]"
          >
            <Trophy size={17} />
            <BarChart3 size={17} />
            <span>Lihat Laporan &amp; Leaderboard Teman</span>
          </button>
          <button
            type="button"
            onClick={handleGoToDashboard}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1D3668] px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#162B54] active:scale-[0.99]"
          >
            <LayoutDashboard size={17} />
            <span>Kembali ke Dashboard</span>
          </button>
        </div>
      </section>
    </div>
  )
}
