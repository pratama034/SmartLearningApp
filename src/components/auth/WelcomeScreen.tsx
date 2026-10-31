import { ArrowRight, BookOpenCheck, Flame, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'

export interface WelcomeScreenProps {
  onNavigate: (view: 'login' | 'register') => void
}

export default function WelcomeScreen({ onNavigate }: WelcomeScreenProps) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F3F4FA] px-4 py-8 font-[Montserrat] text-[#1F2C4F] sm:px-6">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#E1EAF8]/80 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-[#FCDDE6]/50 blur-3xl" />

      <section className="relative z-10 w-full max-w-[480px] rounded-3xl border border-[#DFE4F1] bg-white p-7 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_12px_32px_rgba(29,54,104,0.06)] sm:p-9">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <span
              className="grid h-14 w-14 place-items-center rounded-2xl bg-[#1D3668] text-xl font-extrabold text-white shadow-md shadow-[#1D3668]/25"
              aria-hidden="true"
            >
              S
            </span>
            <span
              className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[#BE2257] text-[10px] text-white ring-2 ring-white"
              aria-hidden="true"
            >
              <Sparkles size={11} />
            </span>
          </div>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#BE2257]">
            Smart Focus Akademik
          </p>

          <h1 className="mt-2 text-[26px] font-extrabold leading-8 tracking-tight text-[#1F2C4F] sm:text-[30px] sm:leading-9">
            Selamat Datang di Smart Focus
          </h1>

          <p className="mt-3 text-xs leading-relaxed text-[#56638A] sm:text-sm">
            Pendamping digital cerdas untuk menyusun jadwal belajar terstruktur, menjaga fokus bebas distraksi, dan kolaborasi ruang co-focus bersama mahasiswa.
          </p>
        </div>

        {/* Feature Highlights / Value Props */}
        <div className="mt-6 space-y-2.5 rounded-2xl border border-[#DFE4F1]/80 bg-[#F6F7FC] p-4 text-xs">
          <div className="flex items-center gap-3 text-[#1F2C4F]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#E1EAF8] text-[#1D3668]">
              <BookOpenCheck size={15} />
            </span>
            <span className="font-semibold">Time-Blocking & Mode Fokus Pomodoro</span>
          </div>

          <div className="flex items-center gap-3 text-[#1F2C4F]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#FCDDE6] text-[#BE2257]">
              <UsersRound size={15} />
            </span>
            <span className="font-semibold">Ruang Belajar Co-Focus & Realtime Diskusi</span>
          </div>

          <div className="flex items-center gap-3 text-[#1F2C4F]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-orange-100 text-orange-600">
              <Flame size={15} className="fill-orange-500" />
            </span>
            <span className="font-semibold">Pelacakan Streak Belajar & Gamifikasi Harian</span>
          </div>
        </div>

        {/* Call to Actions */}
        <div className="mt-8 space-y-3.5">
          <button
            type="button"
            onClick={() => onNavigate('register')}
            className="flex h-[48px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#1D3668] px-6 text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition-all hover:bg-[#162B54] active:scale-[0.98]"
          >
            <span>Daftar Sekarang</span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>

          <p className="text-center text-xs text-[#56638A]">
            Sudah punya akun?{' '}
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="font-bold text-[#BE2257] transition hover:underline focus:outline-none focus:ring-1 focus:ring-[#BE2257]"
            >
              Masuk
            </button>
          </p>
        </div>

        {/* Trust Badge */}
        <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-[#DFE4F1] pt-4 text-[11px] text-[#757780]">
          <ShieldCheck size={14} className="text-[#1D3668]" />
          <span>Keamanan & Autentikasi didukung Supabase Cloud</span>
        </div>
      </section>
    </main>
  )
}

