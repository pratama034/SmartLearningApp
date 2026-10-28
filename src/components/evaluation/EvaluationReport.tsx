import { CheckCircle2, Clock3, Target } from 'lucide-react'
import { mockEvaluationData } from '../../data/mockData'

export default function EvaluationReport() {
  const targetMinutes = Math.max(0, mockEvaluationData.targetMinutes ?? 0)
  const actualMinutes = Math.max(0, mockEvaluationData.actualMinutes ?? 0)
  const completion = targetMinutes === 0 ? 0 : Math.min(100, Math.round((actualMinutes / targetMinutes) * 100))
  const remainingMinutes = Math.max(0, targetMinutes - actualMinutes)
  const appsUsed = Array.isArray(mockEvaluationData.appsUsed) ? mockEvaluationData.appsUsed : []

  return (
    <main className="min-h-screen bg-[#080d18] px-4 py-10 text-white sm:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">Evaluasi sesi</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ringkasan Fokus</h1>
          <p className="mt-2 text-sm text-slate-400">Tinjau target dan aktivitasmu dalam sesi belajar ini.</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-3xl border border-white/[0.08] bg-slate-900/60 p-6">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-300/10 text-indigo-200">
              <Target size={21} aria-hidden="true" />
            </span>
            <p className="mt-5 text-sm text-slate-400">Target waktu fokus</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{targetMinutes} <span className="text-base font-medium text-slate-400">menit</span></p>
          </article>
          <article className="rounded-3xl border border-white/[0.08] bg-slate-900/60 p-6">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200">
              <Clock3 size={21} aria-hidden="true" />
            </span>
            <p className="mt-5 text-sm text-slate-400">Durasi aktual</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{actualMinutes} <span className="text-base font-medium text-slate-400">menit</span></p>
          </article>
        </section>

        <section className="rounded-3xl border border-white/[0.08] bg-slate-900/60 p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Pencapaian target</h2>
              <p className="mt-1 text-sm text-slate-400">
                {remainingMinutes === 0 ? 'Target waktu sesi tercapai.' : `Kurang ${remainingMinutes} menit dari target.`}
              </p>
            </div>
            <span className="text-2xl font-semibold tabular-nums text-indigo-100">{completion}%</span>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-label="Pencapaian target fokus" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}>
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-300 transition-all" style={{ width: `${completion}%` }} />
          </div>
          <p className="mt-3 text-xs text-slate-500">{actualMinutes} dari {targetMinutes} menit</p>
        </section>

        <section className="rounded-3xl border border-white/[0.08] bg-slate-900/60 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/10 text-emerald-200">
              <CheckCircle2 size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold">Aplikasi yang digunakan</h2>
              <p className="mt-1 text-xs text-slate-400">Data contoh untuk evaluasi sesi</p>
            </div>
          </div>
          {appsUsed.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-2">
              {appsUsed.map((app, index) => (
                <li key={`${app}-${index}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">
                  {app || 'Aplikasi'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
              Belum ada aplikasi yang tercatat.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
