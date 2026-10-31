import { Loader2 } from 'lucide-react'

interface SplashScreenProps {
  isVisible: boolean
}

export default function SplashScreen({ isVisible }: SplashScreenProps) {
  return (
    <div
      role="dialog"
      aria-label="Layar pembuka Smart Focus"
      aria-hidden={!isVisible}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1D3668] select-none overflow-hidden font-[Montserrat] transition-opacity duration-500 ease-out ${
        isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Konten Tengah (Logo & Branding Smart Focus) */}
      <div className="flex flex-col items-center text-center px-4">
        {/* Logo Resmi Smart Focus Akademik dengan Ambient Glow & Animasi Halus */}
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-5 rounded-full bg-[#BE2257]/30 blur-2xl animate-pulse" />
          <img
            src="/logo.jpg"
            alt="Logo Smart Focus Akademik"
            className="relative h-28 w-28 sm:h-36 sm:w-36 rounded-3xl object-contain shadow-2xl border border-white/20 backdrop-blur-md transition-transform duration-700 hover:scale-105"
          />
        </div>

        {/* Tagline Pendukung */}
        <div className="mt-5 flex flex-col items-center">
          <p className="text-xs sm:text-sm font-semibold tracking-wide text-white/80">
            Teman Belajar & Kolaborasi Mahasiswa
          </p>
        </div>
      </div>

      {/* Indikator Loading di Bawah Layar */}
      <div className="absolute bottom-10 sm:bottom-12 flex flex-col items-center gap-2.5">
        <Loader2
          size={20}
          className="animate-spin text-[#FCDDE6]"
          aria-hidden="true"
        />
        <p className="text-[11px] sm:text-xs font-medium tracking-wider text-white/60">
          Memuat ruang fokus...
        </p>
      </div>
    </div>
  )
}

