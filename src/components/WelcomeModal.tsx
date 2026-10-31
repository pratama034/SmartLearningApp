import { ArrowRight, CalendarDays, Sparkles, Timer, UsersRound, type LucideIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface WelcomeModalProps {
  userName?: string
  onClose: () => void
}

const features: { icon: LucideIcon; title: string; description: string; tone: string }[] = [
  {
    icon: CalendarDays,
    title: 'Atur Jadwal',
    description: 'Pecah tugas besar menjadi study block kecil yang terjadwal rapi.',
    tone: 'bg-[#E1EAF8] text-[#1D3668]',
  },
  {
    icon: Timer,
    title: 'Mode Fokus Bebas Distraksi',
    description: 'Timer fokus yang menahan notifikasi pengganggu sampai sesi selesai.',
    tone: 'bg-[#FCDDE6] text-[#BE2257]',
  },
  {
    icon: UsersRound,
    title: 'Co-Focus bersama Teman',
    description: 'Gabung ruang belajar pakai kode 6 karakter, maksimal 10 orang.',
    tone: 'bg-[#D6F0DE] text-[#17623A]',
  },
]

export default function WelcomeModal({ userName, onClose }: WelcomeModalProps) {
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    primaryButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const firstName = userName?.split(' ')[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        aria-describedby="welcome-modal-desc"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[#DFE4F1] bg-white shadow-[0_16px_40px_rgba(29,54,104,0.18)]"
      >
        <div className="relative overflow-hidden bg-[#1D3668] px-6 pb-6 pt-7 text-white">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#BE2257]/40 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <img
              src="/logo.jpg"
              alt="Logo Smart Focus Akademik"
              className="h-12 w-12 rounded-xl object-contain border border-white/20 shadow-md"
            />
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80">
              <Sparkles size={16} aria-hidden="true" />
            </span>
          </div>
          <h2 id="welcome-modal-title" className="relative mt-4 text-[22px] font-extrabold leading-7 tracking-tight">
            Selamat Datang di Smart Focus!
          </h2>
          <p id="welcome-modal-desc" className="relative mt-1.5 text-[13px] leading-[19px] text-white/80">
            {firstName ? `Hai ${firstName}, ` : ''}berikut tiga hal yang bisa kamu lakukan untuk belajar lebih fokus.
          </p>
        </div>

        <ol className="space-y-3 px-6 py-5">
          {features.map(({ icon: Icon, title, description, tone }, index) => (
            <li key={title} className="flex items-start gap-3 rounded-xl border border-[#DFE4F1] bg-[#F3F4FA]/60 p-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`}>
                <Icon size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1F2C4F]">
                  {index + 1}. {title}
                </p>
                <p className="mt-0.5 text-xs leading-[18px] text-[#56638A]">{description}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="border-t border-[#DFE4F1] px-6 py-4">
          <button
            ref={primaryButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#162B54] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2 active:scale-[0.98]"
          >
            Mulai Belajar
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

