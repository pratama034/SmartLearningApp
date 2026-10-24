import { BellOff, Clock3, NotebookPen } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useSessionStore } from '../store/sessionStore'

const reflectionSchema = z.object({
  reflection: z.string().trim().min(1, 'Refleksi tidak boleh kosong.'),
})

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return hours ? `${hours}j ${String(minutes).padStart(2, '0')}m` : `${minutes}m ${String(remainder).padStart(2, '0')}d`
}

export default function SessionSummary() {
  const summary = useSessionStore((state) => state.lastSessionSummary)
  const navigate = useNavigate()
  const [reflection, setReflection] = useState('')
  const [formError, setFormError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = reflectionSchema.safeParse({ reflection })
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message ?? 'Refleksi tidak boleh kosong.')
      return
    }

    navigate('/', { replace: true })
  }

  if (!summary) {
    return (
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-6 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
        <h1 className="text-[22px] font-extrabold text-[#1F2C4F]">Belum ada ringkasan sesi</h1>
        <p className="mt-2 text-sm leading-5 text-[#56638A]">Mulai dan akhiri sesi fokus untuk melihat refleksimu di sini.</p>
        <button type="button" onClick={() => navigate('/focus')} className="mt-5 h-11 rounded-[10px] bg-[#1D3668] px-4 text-sm font-bold text-white">Ke Mode Fokus</button>
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Sesi selesai</p>
        <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">Bagaimana fokusmu hari ini?</h1>
        <p className="mt-2 text-[13px] leading-[19px] text-[#56638A]">Ringkasan untuk {summary.block.title} sudah siap untuk direfleksikan.</p>
      </section>

      <section aria-label="Statistik sesi" className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]"><Clock3 size={20} aria-hidden="true" /></span>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#757780]">Durasi sesi</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#1F2C4F]">{formatDuration(summary.durationSeconds)}</p>
        </article>
        <article className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FCDDE6] text-[#8E1744]"><BellOff size={20} aria-hidden="true" /></span>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#757780]">Notifikasi ditunda</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#1F2C4F]">{summary.heldNotifications.length}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
        <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Notifikasi yang ditunda</h2>
        <div className="mt-4 space-y-2.5">
          {summary.heldNotifications.length ? summary.heldNotifications.map((notification) => (
            <article key={notification.id} className="rounded-xl border border-[#FCDDE6] bg-[#FFF7F8] p-3 text-sm font-medium text-[#1F2C4F]">{notification.text}</article>
          )) : <p className="rounded-xl bg-[#F6F7FC] p-4 text-sm text-[#56638A]">Tidak ada notifikasi yang perlu ditinjau.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
        <div className="flex items-center gap-2"><NotebookPen size={19} className="text-[#1D3668]" aria-hidden="true" /><h2 className="text-[18px] font-bold text-[#1F2C4F]">Jurnal refleksi</h2></div>
        <form className="mt-4" onSubmit={handleSubmit} noValidate>
          <label htmlFor="session-reflection" className="mb-2 block text-sm font-semibold text-[#1F2C4F]">Apa yang berjalan baik dan apa yang perlu ditingkatkan?</label>
          <textarea id="session-reflection" value={reflection} onChange={(event) => setReflection(event.target.value)} rows={5} aria-invalid={Boolean(formError)} aria-describedby={formError ? 'reflection-error' : undefined} placeholder="Tuliskan refleksimu di sini..." className="w-full resize-y rounded-[10px] border border-[#DFE4F1] p-4 text-sm leading-5 text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]" />
          {formError && <p id="reflection-error" role="alert" className="mt-2 text-sm font-medium text-[#BA1A1A]">{formError}</p>}
          <button type="submit" className="mt-4 flex h-[46px] w-full items-center justify-center rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition hover:bg-[#A11B48] focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2">Simpan Refleksi & Kembali ke Dashboard</button>
        </form>
      </section>
    </div>
  )
}
