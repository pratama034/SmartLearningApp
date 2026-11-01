import {
  AlertCircle,
  BellOff,
  CheckCircle2,
  Clock3,
  Flame,
  Loader2,
  NotebookPen,
  X,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuthStore } from '../store/authStore'
import { useSessionStore, type SessionSummary as SessionSummaryData } from '../store/sessionStore'

const reflectionSchema = z.object({
  reflection: z.string().trim().min(1, 'Refleksi tidak boleh kosong.'),
})

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return hours
    ? `${hours}j ${String(minutes).padStart(2, '0')}m`
    : `${minutes}m ${String(remainder).padStart(2, '0')}d`
}

export default function SessionSummary() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const storeSummary = useSessionStore((state) => state.lastSessionSummary)
  const lastSavedSessionId = useSessionStore((state) => state.lastSavedSessionId)
  const isSaving = useSessionStore((state) => state.isSaving)
  const storeError = useSessionStore((state) => state.error)
  const clearError = useSessionStore((state) => state.clearError)
  const saveSessionToDatabase = useSessionStore((state) => state.saveSessionToDatabase)
  const resetSession = useSessionStore((state) => state.resetSession)

  const [completedSnapshot, setCompletedSnapshot] = useState<SessionSummaryData | null>(null)
  const [reflection, setReflection] = useState('')
  const [formError, setFormError] = useState('')
  const [showSuccessToast, setShowSuccessToast] = useState(false)

  const summary = storeSummary ?? completedSnapshot

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    clearError()

    const validation = reflectionSchema.safeParse({ reflection })
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message ?? 'Refleksi tidak boleh kosong.')
      return
    }

    if (!summary) return

    // Simpan snapshot lokal agar UI tidak berkedip saat state di-reset ke idle
    setCompletedSnapshot(summary)

    try {
      await saveSessionToDatabase({
        sessionId: summary.sessionId ?? lastSavedSessionId,
        userId: user?.id,
        studyBlockId: summary.block?.id ?? null,
        targetDuration: summary.targetDurationSeconds,
        actualDuration: summary.durationSeconds,
        completionStatus: summary.completionStatus,
        reflectionNote: validation.data.reflection,
        startedAt: summary.startedAt,
        endedAt: summary.endedAt,
      })

      resetSession()
      setShowSuccessToast(true)

      window.setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 1400)
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Gagal memperbarui catatan refleksi di Supabase.'
      setFormError(msg)
    }
  }

  function handleSkipReflection() {
    resetSession()
    navigate('/dashboard', { replace: true })
  }

  if (!summary) {
    return (
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-6 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
        <h1 className="text-[22px] font-extrabold text-[#1F2C4F]">Belum ada ringkasan sesi</h1>
        <p className="mt-2 text-sm leading-5 text-[#56638A]">
          Mulai dan akhiri sesi fokus untuk melihat refleksimu di sini.
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
      {/* Toast/Alert Hijau Sukses */}
      {showSuccessToast && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#17623A]/20 bg-[#D6F0DE] p-4 text-[#17623A] shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="shrink-0 text-[#17623A]" aria-hidden="true" />
            <div>
              <p className="text-sm font-extrabold">Sesi berhasil disimpan!</p>
              <p className="text-xs font-medium text-[#17623A]/90">
                Mengarahkan kembali ke Dashboard...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast/Alert Merah Error */}
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

      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
          Sesi selesai
        </p>
        <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">
          Bagaimana fokusmu hari ini?
        </h1>
        <p className="mt-2 text-[13px] leading-[19px] text-[#56638A]">
          Ringkasan untuk {summary.block.title} sudah siap untuk direfleksikan.
        </p>
      </section>

      <section aria-label="Statistik sesi" className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
            <Clock3 size={20} aria-hidden="true" />
          </span>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#757780]">
            Durasi sesi
          </p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#1F2C4F]">
            {formatDuration(summary.durationSeconds)}
          </p>
          <p className="mt-1 text-xs text-[#56638A]">
            Target: {formatDuration(summary.targetDurationSeconds)}
          </p>
        </article>
        <article className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FCDDE6] text-[#8E1744]">
            <BellOff size={20} aria-hidden="true" />
          </span>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#757780]">
            Notifikasi ditunda
          </p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#1F2C4F]">
            {summary.heldNotifications.length}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
        <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Notifikasi yang ditunda</h2>
        <div className="mt-4 space-y-2.5">
          {summary.heldNotifications.length ? (
            summary.heldNotifications.map((notification) => {
              const displayTitle = notification.title || notification.appName || 'Notifikasi Masuk'
              const displayText = notification.text.startsWith(displayTitle + ': ')
                ? notification.text.slice(displayTitle.length + 2)
                : notification.text

              return (
                <article
                  key={notification.id}
                  className="rounded-xl border border-[#FCDDE6] bg-[#FFF7F8] p-3 text-sm font-medium text-[#1F2C4F]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#1F2C4F]">{displayTitle}</span>
                    {notification.appName && (
                      <span className="rounded-full bg-[#E1EAF8] px-2 py-0.5 text-[10px] font-bold text-[#1D3668]">
                        {notification.appName}
                      </span>
                    )}
                  </div>
                  {displayText && (
                    <p className="mt-1 text-xs text-[#56638A]">{displayText}</p>
                  )}
                </article>
              )
            })
          ) : (
            <p className="rounded-xl bg-[#F6F7FC] p-4 text-sm text-[#56638A]">
              Tidak ada notifikasi yang perlu ditinjau.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
        <div className="flex items-center gap-2">
          <NotebookPen size={19} className="text-[#1D3668]" aria-hidden="true" />
          <h2 className="text-[18px] font-bold text-[#1F2C4F]">Jurnal refleksi</h2>
        </div>
        <form className="mt-4" onSubmit={handleSubmit} noValidate>
          <label
            htmlFor="session-reflection"
            className="mb-2 block text-sm font-semibold text-[#1F2C4F]"
          >
            Apa yang berjalan baik dan apa yang perlu ditingkatkan?
          </label>
          <textarea
            id="session-reflection"
            value={reflection}
            disabled={isSaving || showSuccessToast}
            onChange={(event) => setReflection(event.target.value)}
            rows={5}
            aria-invalid={Boolean(formError)}
            aria-describedby={formError ? 'reflection-error' : undefined}
            placeholder="Tuliskan refleksimu di sini..."
            className="w-full resize-y rounded-[10px] border border-[#DFE4F1] p-4 text-sm leading-5 text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668] disabled:cursor-not-allowed disabled:bg-[#F6F7FC] disabled:opacity-70"
          />
          {formError && (
            <p id="reflection-error" role="alert" className="mt-2 text-sm font-medium text-[#BA1A1A]">
              {formError}
            </p>
          )}
          <p className="mt-2 text-xs text-[#56638A]">
            Laporan durasi fokus & poin streak telah tercatat otomatis. Isi refleksi di atas untuk memperbarui catatan sesi ini.
          </p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="submit"
              disabled={isSaving || showSuccessToast}
              className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition hover:bg-[#A11B48] focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  <span>Memperbarui Refleksi...</span>
                </>
              ) : showSuccessToast ? (
                <>
                  <Flame size={18} className="fill-white text-white animate-bounce" aria-hidden="true" />
                  <span>Refleksi berhasil diperbarui! 🔥</span>
                </>
              ) : (
                <span>Simpan Refleksi & Kembali ke Dashboard</span>
              )}
            </button>
            <button
              type="button"
              disabled={isSaving || showSuccessToast}
              onClick={handleSkipReflection}
              className="flex h-[46px] items-center justify-center rounded-[10px] border border-[#DFE4F1] bg-white px-5 text-sm font-bold text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#1D3668] disabled:opacity-50"
            >
              Lewati & ke Dashboard
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
