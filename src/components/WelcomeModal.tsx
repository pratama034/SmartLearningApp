import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Sparkles,
  Timer,
  Trophy,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface WelcomeModalProps {
  userName?: string
  onClose: () => void
}

interface HootySlide {
  badge: string
  title: string
  hootySpeech: string
  description: string
  icon: LucideIcon
  tone: string
}

const hootySlides: HootySlide[] = [
  {
    badge: 'Kenalan Yuk! 🦉',
    title: 'Halo! Aku Hooty, Teman Belajarmu di StuFo!',
    hootySpeech:
      '"Selamat datang di StuFo (Study & Focus)! Aku Hooty si burung hantu yang siap menemani kamu mengatur jadwal, fokus belajar, dan kolaborasi bareng teman-temanmu!"',
    description:
      'StuFo dirancang khusus agar kamu bisa langsung fokus belajar tanpa ribet, memantau jadwal ala Google Calendar, dan saling menyemangati dengan teman.',
    icon: Sparkles,
    tone: 'bg-[#E1EAF8] text-[#1D3668]',
  },
  {
    badge: 'Fitur 1 · Schedule & Dashboard',
    title: 'Jadwal Model Google Calendar & Status Teman',
    hootySpeech:
      '"Di Dashboard, kamu bisa langsung cek jadwal hari ini dan lihat teman-temanmu yang sedang fokus lengkap dengan durasi berapa lama mereka sudah belajar!"',
    description:
      'Buka menu Study untuk menyusun jadwal mingguan/harian dengan tampilan timeline jam ala Google Calendar yang penuh warna.',
    icon: CalendarDays,
    tone: 'bg-[#E1EAF8] text-[#1D3668]',
  },
  {
    badge: 'Fitur 2 · Mode Fokus Spontan',
    title: 'Fokus Kapan Saja: Mode Timer & Stopwatch',
    hootySpeech:
      '"Lagi pengen langsung belajar tanpa bikin jadwal dulu? Bisa banget! Pilih Timer hitung mundur (lengkap dengan notifikasi saat selesai) atau Stopwatch hitung maju!"',
    description:
      'Kamu bebas memilih belajar dari jadwal yang sudah ada atau langsung mulai sesi fokus spontan kapan pun semangat belajarmu muncul.',
    icon: Timer,
    tone: 'bg-[#FCDDE6] text-[#BE2257]',
  },
  {
    badge: 'Fitur 3 & 4 · Co-Focus & Leaderboard',
    title: 'Grup Chat Lengkap & Peringkat Durasi Teman',
    hootySpeech:
      '"Diskusi dan kirim materi PDF, Word, JPG, hingga PPT di Co-Focus Chat! Kamu juga bisa cek Leaderboard Teman di menu Laporan biar makin termotivasi!"',
    description:
      'Dilengkapi tanda baca centang dua ala WhatsApp, notifikasi chat masuk, opsi Mute grup, serta laporan durasi fokus Mingguan, Bulanan, dan Tahunan.',
    icon: Trophy,
    tone: 'bg-[#D6F0DE] text-[#17623A]',
  },
]

const quickFeatures: { icon: LucideIcon; title: string; subtitle: string; tone: string }[] = [
  {
    icon: CalendarDays,
    title: 'Schedule Kalender',
    subtitle: 'Timeline jam ala Google Calendar',
    tone: 'bg-[#E1EAF8] text-[#1D3668]',
  },
  {
    icon: Timer,
    title: 'Timer & Stopwatch',
    subtitle: 'Fokus spontan + notif selesai',
    tone: 'bg-[#FCDDE6] text-[#BE2257]',
  },
  {
    icon: UsersRound,
    title: 'Co-Focus & PPT Chat',
    subtitle: 'Status baca WA, notif & mute grup',
    tone: 'bg-[#D6F0DE] text-[#17623A]',
  },
  {
    icon: Trophy,
    title: 'Leaderboard Teman',
    subtitle: 'Rekap mingguan, bulanan & tahunan',
    tone: 'bg-[#FDEBC8] text-[#7A4B00]',
  },
]

export default function WelcomeModal({ userName, onClose }: WelcomeModalProps) {
  const [step, setStep] = useState(0)
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
  const currentSlide = hootySlides[step] ?? hootySlides[0]
  const SlideIcon = currentSlide.icon
  const isLastStep = step === hootySlides.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/60 p-3 sm:p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        aria-describedby="welcome-modal-desc"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#DFE4F1] bg-white shadow-[0_20px_50px_rgba(29,54,104,0.28)]"
      >
        {/* Ilustrasi Banner Hooty si Burung Hantu */}
        <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-[#1D3668]">
          <img
            src="/hooty-mascot.jpg"
            alt="Hooty si Burung Hantu — Maskot StuFo (Study & Focus)"
            className="h-full w-full object-cover object-center"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0F2042]/90 via-[#0F2042]/20 to-transparent" />

          {/* Badge Kiri Atas */}
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-[11px] font-extrabold text-[#1D3668] shadow-md">
            <img src="/logo.jpg" alt="StuFo" className="h-4 w-4 rounded-full object-cover" />
            <span>StuFo · Study &amp; Focus</span>
          </div>

          {/* Tombol Lewati / Tutup Kanan Atas */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Lewati panduan Hooty"
            className="absolute right-3.5 top-3.5 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur-xs transition hover:bg-black/60"
          >
            <X size={16} />
          </button>

          {/* Nama Maskot di Bawah Gambar */}
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#BE2257] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                {currentSlide.badge}
              </span>
              <h2
                id="welcome-modal-title"
                className="mt-1 text-lg sm:text-xl font-extrabold leading-tight drop-shadow-xs"
              >
                {firstName && step === 0 ? `Hai ${firstName}! 👋 ` : ''}
                {currentSlide.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Konten Penjelasan Hooty */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-4">
          {/* Balon Ucapan Hooty */}
          <div className="relative rounded-2xl border border-[#1D3668]/15 bg-[#F6F7FC] p-3.5 sm:p-4">
            <div className="flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${currentSlide.tone}`}>
                <SlideIcon size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#BE2257]">
                  Kata Hooty si Burung Hantu:
                </p>
                <p
                  id="welcome-modal-desc"
                  className="mt-1 text-xs sm:text-[13px] font-semibold italic leading-relaxed text-[#1F2C4F]"
                >
                  {currentSlide.hootySpeech}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#56638A]">
                  {currentSlide.description}
                </p>
              </div>
            </div>
          </div>

          {/* Ringkasan 4 Fitur Utama di Slide Pertama */}
          {step === 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              {quickFeatures.map(({ icon: Icon, title, subtitle, tone }) => (
                <div
                  key={title}
                  className="flex items-start gap-2.5 rounded-xl border border-[#DFE4F1] bg-white p-2.5 shadow-2xs"
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone}`}>
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-[#1F2C4F]">{title}</p>
                    <p className="mt-0.5 text-[10px] leading-tight text-[#56638A]">{subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Indikator Dot Langkah */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {hootySlides.map((slide, index) => (
              <button
                key={slide.badge}
                type="button"
                onClick={() => setStep(index)}
                aria-label={`Langkah ${index + 1}`}
                className={`h-2 rounded-full transition-all ${
                  index === step ? 'w-6 bg-[#1D3668]' : 'w-2 bg-[#DFE4F1] hover:bg-[#56638A]/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer Navigasi */}
        <div className="flex items-center justify-between gap-2.5 border-t border-[#DFE4F1] bg-[#F9FAFE] px-5 py-3.5 sm:px-6">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => Math.max(0, prev - 1))}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#DFE4F1] bg-white px-3.5 text-xs font-bold text-[#56638A] transition hover:bg-[#F3F4FA] hover:text-[#1D3668]"
            >
              <ArrowLeft size={15} />
              <span>Sebelumnya</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-xl px-3 text-xs font-bold text-[#757780] transition hover:bg-[#F3F4FA] hover:text-[#1F2C4F]"
            >
              Lewati
            </button>
          )}

          <button
            ref={primaryButtonRef}
            type="button"
            onClick={() => {
              if (isLastStep) {
                onClose()
              } else {
                setStep((prev) => prev + 1)
              }
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1D3668] px-5 text-xs sm:text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#162B54] active:scale-[0.98]"
          >
            <span>{isLastStep ? 'Mulai Belajar Bersama Hooty!' : 'Lanjut'}</span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
