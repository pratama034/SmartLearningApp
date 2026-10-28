import { useEffect, useState } from 'react'
import {
  BookOpen,
  Camera,
  Check,
  CircleHelp,
  Clock3,
  FileText,
  MessageCircle,
  Music2,
  Palette,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { mockFocusApps, type MockFocusApp } from '../../data/mockData'

const appIcons: Record<string, LucideIcon> = {
  word: FileText,
  canva: Palette,
  docs: BookOpen,
  instagram: Camera,
  tiktok: Music2,
  whatsapp: MessageCircle,
}

const appThemes: Record<string, { accent: string; iconColor: string }> = {
  word: { accent: 'bg-blue-500/15 ring-blue-400/20', iconColor: 'text-blue-300' },
  canva: { accent: 'bg-cyan-500/15 ring-cyan-300/20', iconColor: 'text-cyan-200' },
  docs: { accent: 'bg-emerald-500/15 ring-emerald-300/20', iconColor: 'text-emerald-200' },
  instagram: { accent: 'bg-white/[0.06] ring-white/[0.08]', iconColor: 'text-slate-400' },
  tiktok: { accent: 'bg-white/[0.06] ring-white/[0.08]', iconColor: 'text-slate-400' },
  whatsapp: { accent: 'bg-white/[0.06] ring-white/[0.08]', iconColor: 'text-slate-400' },
}

const allowedApps = mockFocusApps.filter((app) => app.kind === 'allowed')
const blockedApps = mockFocusApps.filter((app) => app.kind === 'blocked')

function AppCard({
  app,
  blocked = false,
  onBlockedClick,
}: {
  app: MockFocusApp
  blocked?: boolean
  onBlockedClick?: () => void
}) {
  const Icon = appIcons[app.id] ?? CircleHelp
  const theme = appThemes[app.id] ?? {
    accent: 'bg-white/[0.06] ring-white/[0.08]',
    iconColor: 'text-slate-400',
  }
  const content = (
    <>
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1 ${theme.accent}`}
        aria-hidden="true"
      >
        <Icon size={23} strokeWidth={1.8} className={theme.iconColor} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold text-white">{app.name}</span>
        <span className="mt-1 block text-xs text-slate-400">{app.description}</span>
      </span>
      {blocked ? (
        <span className="rounded-full border border-slate-600/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Diblokir
        </span>
      ) : (
        <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
          <Check size={14} strokeWidth={2.5} aria-hidden="true" />
        </span>
      )}
    </>
  )

  const cardClass = `flex min-h-[88px] w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-slate-900/70 p-4 transition ${blocked ? 'cursor-pointer opacity-50 grayscale hover:opacity-70 focus-visible:opacity-70' : 'opacity-100'}`

  if (blocked) {
    return (
      <button
        type="button"
        className={`${cardClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70`}
        onClick={onBlockedClick}
        aria-label={`${app.name}, aplikasi diblokir saat mode fokus`}
      >
        {content}
      </button>
    )
  }

  return <div className={cardClass}>{content}</div>
}

export default function FocusMode() {
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    if (!showToast) return
    const timeoutId = window.setTimeout(() => setShowToast(false), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [showToast])

  return (
    <main className="min-h-screen overflow-hidden bg-[#080d18] px-4 py-8 text-white sm:px-8 sm:py-10">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 -top-48 h-[28rem] w-[28rem] rounded-full bg-blue-500/[0.08] blur-[100px]" />
        <div className="absolute -bottom-64 -right-28 h-[34rem] w-[34rem] rounded-full bg-indigo-500/[0.08] blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5 sm:pb-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-400/10 text-indigo-200 ring-1 ring-indigo-300/15">
              <ShieldCheck size={21} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-wide text-white">Smart Focus</p>
              <p className="mt-0.5 text-xs text-slate-400">Sesi fokus aktif</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-300 transition hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70"
          >
            <X size={16} aria-hidden="true" />
            Akhiri Sesi Fokus
          </button>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-12 text-center sm:py-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-3 py-1.5 text-xs font-medium text-emerald-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
            Fokus berjalan
          </span>
          <div className="mt-6 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
            <Clock3 size={14} aria-hidden="true" />
            Waktu tersisa
          </div>
          <p
            className="mt-3 font-mono text-[5.5rem] font-semibold leading-none tracking-[-0.08em] text-white tabular-nums sm:text-[7.5rem]"
            aria-label="45 menit tersisa"
          >
            45:00
          </p>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
            Satu hal dalam satu waktu. Tetap di jalur dan berikan perhatian penuh pada pekerjaanmu.
          </p>
        </section>

        <div className="grid gap-10 pb-4 lg:grid-cols-2 lg:gap-12">
          <section aria-labelledby="allowed-apps-title">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Tetap produktif</p>
                <h2 id="allowed-apps-title" className="mt-1 text-lg font-semibold text-white">
                  Aplikasi yang Diizinkan
                </h2>
              </div>
              <span className="text-xs text-slate-500">{allowedApps.length} aplikasi</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {allowedApps.map((app) => <AppCard key={app.name} app={app} />)}
            </div>
          </section>

          <section aria-labelledby="blocked-apps-title">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Kurangi gangguan</p>
                <h2 id="blocked-apps-title" className="mt-1 text-lg font-semibold text-white">
                  Aplikasi yang Diblokir
                </h2>
              </div>
              <span className="text-xs text-slate-500">{blockedApps.length} aplikasi</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {blockedApps.map((app) => (
                <AppCard key={app.name} app={app} blocked onBlockedClick={() => setShowToast(true)} />
              ))}
            </div>
          </section>
        </div>
      </div>

      {showToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-amber-200/15 bg-slate-800 px-4 py-3 text-sm font-medium text-white shadow-2xl shadow-black/40"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-300/10 text-amber-200">
            <ShieldCheck size={16} aria-hidden="true" />
          </span>
          Akses ditahan. Anda sedang dalam mode fokus.
        </div>
      )}
    </main>
  )
}
