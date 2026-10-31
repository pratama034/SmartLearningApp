import { useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MailCheck,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import WelcomeScreen from '../components/auth/WelcomeScreen'
import { useAuthStore } from '../store/authStore'

export type AuthView = 'welcome' | 'login' | 'register'

interface AuthProps {
  initialView?: AuthView
}

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi.'),
  password: z.string().min(1, 'Sandi wajib diisi.'),
})

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nama lengkap wajib diisi.'),
  email: z
    .string()
    .trim()
    .min(1, 'Email wajib diisi.')
    .email('Format email tidak valid.')
    .refine((val) => val.endsWith('@gmail.com'), {
      message: 'Harap gunakan akun @gmail.com yang aktif',
    }),
  password: z.string().min(6, 'Sandi minimal 6 karakter.'),
})

export default function Auth({ initialView = 'welcome' }: AuthProps) {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const authError = useAuthStore((state) => state.authError)
  const clearAuthError = useAuthStore((state) => state.clearAuthError)

  const [currentView, setCurrentView] = useState<AuthView>(initialView)

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginFormError, setLoginFormError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Register form state
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [registerFormError, setRegisterFormError] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)

  // Email verification sent state
  const [isEmailSentSuccess, setIsEmailSentSuccess] = useState(false)
  const [sentToEmail, setSentToEmail] = useState('')

  function handleNavigate(view: AuthView) {
    clearAuthError()
    setLoginFormError('')
    setRegisterFormError('')
    setCurrentView(view)
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginFormError('')
    clearAuthError()

    const validation = loginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    })

    if (!validation.success) {
      setLoginFormError(validation.error.issues[0]?.message ?? 'Lengkapi email dan sandi.')
      return
    }

    setIsLoggingIn(true)
    try {
      await login(validation.data.email, validation.data.password)
      navigate('/', { replace: true })
    } catch (error) {
      setLoginFormError(error instanceof Error ? error.message : 'Login gagal. Silakan coba lagi.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRegisterFormError('')
    clearAuthError()

    const cleanEmail = registerEmail.trim()
    const cleanName = registerName.trim()

    // 1. Validasi frontend alamat Gmail
    if (!cleanEmail.endsWith('@gmail.com')) {
      setRegisterFormError('Harap gunakan akun @gmail.com yang aktif')
      return
    }

    const validation = registerSchema.safeParse({
      name: cleanName,
      email: cleanEmail,
      password: registerPassword,
    })

    if (!validation.success) {
      setRegisterFormError(validation.error.issues[0]?.message ?? 'Lengkapi data pendaftaran.')
      return
    }

    setIsRegistering(true)
    try {
      const result = await register(cleanEmail, registerPassword, cleanName)

      // 2. Tangkap respon registrasi sukses
      if (result === 'check_email') {
        setSentToEmail(cleanEmail)
        setIsEmailSentSuccess(true)
      }
    } catch (error) {
      setRegisterFormError(error instanceof Error ? error.message : 'Pendaftaran gagal. Silakan coba lagi.')
    } finally {
      setIsRegistering(false)
    }
  }

  // View A: Halaman Selamat Datang (Welcome Screen)
  if (currentView === 'welcome') {
    return <WelcomeScreen onNavigate={(view) => handleNavigate(view)} />
  }

  // View B & C: Tampilan Formulir Login atau Register
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F3F4FA] px-4 py-8 font-[Montserrat] text-[#1F2C4F] sm:px-6">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#E1EAF8]/80 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-[#FCDDE6]/50 blur-3xl" />

      <section className="relative z-10 w-full max-w-[460px] rounded-3xl border border-[#DFE4F1] bg-white p-6 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_12px_32px_rgba(29,54,104,0.06)] sm:p-8">
        {/* Tombol Navigasi Kembali ke Welcome Screen */}
        <button
          type="button"
          onClick={() => handleNavigate('welcome')}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#1D3668]"
          aria-label="Kembali ke halaman utama"
        >
          <ArrowLeft size={15} />
          <span>Kembali</span>
        </button>

        {/* ========================================================================= */}
        {/* SUB-VIEW 1: TAMPILAN EMAIL VERIFIKASI TERKIRIM                           */}
        {/* ========================================================================= */}
        {currentView === 'register' && isEmailSentSuccess ? (
          <div className="mt-4 flex flex-col items-center text-center">
            {/* Ikon Amplop / Email */}
            <div className="relative">
              <span className="grid h-16 w-16 place-items-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-600 shadow-sm">
                <MailCheck size={32} />
              </span>
              <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[#1D3668] text-white ring-2 ring-white">
                <Sparkles size={13} />
              </span>
            </div>

            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#BE2257]">
              Konfirmasi Akun Baru
            </p>
            <h1 className="mt-1.5 text-[22px] font-extrabold leading-7 text-[#1F2C4F] sm:text-[24px]">
              Verifikasi Email Terkirim
            </h1>

            {/* Kotak Informasi & Peringatan Gmail */}
            <div className="mt-4 w-full rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-left text-xs leading-relaxed text-amber-950">
              <p className="font-semibold text-[#1D3668]">
                Kami telah mengirimkan tautan aktivasi ke:
              </p>
              <p className="mt-1 break-all rounded-lg bg-white px-2.5 py-1.5 font-bold text-[#BE2257] border border-amber-200/80 shadow-2xs">
                {sentToEmail}
              </p>
              <p className="mt-2 text-[#56638A]">
                Silakan cek kotak masuk <strong>Gmail</strong> Anda (atau periksa folder <em>Spam / Promosi</em> jika belum muncul) dan klik tautan konfirmasi untuk mengaktifkan akun.
              </p>
            </div>

            {/* Panduan Langkah Ringkas */}
            <ul className="mt-4 w-full space-y-2 text-left text-xs text-[#56638A]">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#17623A]" />
                <span>Buka aplikasi Gmail atau kunjungi <strong>mail.google.com</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#17623A]" />
                <span>Klik tautan <strong>Confirm your email</strong> di pesan dari Smart Focus.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#17623A]" />
                <span>Kembali ke halaman ini dan masuk dengan akun Anda.</span>
              </li>
            </ul>

            {/* Tombol Tindakan */}
            <div className="mt-6 w-full space-y-2.5">
              <button
                type="button"
                onClick={() => window.open('https://mail.google.com', '_blank', 'noopener,noreferrer')}
                className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#1D3668] px-4 text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#162B54] active:scale-[0.98]"
              >
                <span>Buka Gmail Sekarang</span>
                <ExternalLink size={16} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEmailSentSuccess(false)
                  handleNavigate('login')
                }}
                className="flex h-[44px] w-full items-center justify-center rounded-[12px] border border-[#DFE4F1] bg-white px-4 text-xs font-bold text-[#1F2C4F] transition hover:bg-[#F6F7FC] hover:text-[#1D3668]"
              >
                Sudah Verifikasi? Masuk ke Akun
              </button>
            </div>

            <p className="mt-4 text-[11px] text-[#757780]">
              Salah mengetik email?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsEmailSentSuccess(false)
                  setRegisterFormError('')
                }}
                className="font-bold text-[#BE2257] underline hover:text-[#A11B48]"
              >
                Daftar ulang dengan email lain
              </button>
            </p>
          </div>
        ) : currentView === 'register' ? (
          /* ========================================================================= */
          /* SUB-VIEW 2: FORM PENDAFTARAN (REGISTER)                                  */
          /* ========================================================================= */
          <div>
            <div className="mt-2 flex flex-col items-center text-center">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#1D3668] text-base font-extrabold text-white shadow-sm">
                S
              </span>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#BE2257]">
                Smart Focus Akademik
              </p>
              <h1 className="mt-1 text-[24px] font-extrabold leading-8 text-[#1F2C4F]">
                Buat Akun Baru
              </h1>
              <p className="mt-1.5 text-xs text-[#56638A]">
                Wajib gunakan akun <strong>@gmail.com</strong> yang aktif untuk menerima tautan verifikasi.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleRegisterSubmit} noValidate>
              {/* Field: Nama Lengkap */}
              <div>
                <label htmlFor="reg-name" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <UserRound
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56638A]"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-name"
                    type="text"
                    autoComplete="name"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="Nama lengkap Anda"
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white py-2 pl-10 pr-4 text-xs sm:text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
              </div>

              {/* Field: Email (@gmail.com) */}
              <div>
                <label htmlFor="reg-email" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                  Alamat Email (Wajib Gmail)
                </label>
                <div className="relative">
                  <Mail
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56638A]"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="contoh: nama.mahasiswa@gmail.com"
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white py-2 pl-10 pr-4 text-xs sm:text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
                <p className="mt-1 text-[10px] text-[#56638A]">
                  * Pastikan domain berakhiran <strong>@gmail.com</strong>
                </p>
              </div>

              {/* Field: Sandi */}
              <div>
                <label htmlFor="reg-pass" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                  Kata Sandi
                </label>
                <div className="relative">
                  <LockKeyhole
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56638A]"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-pass"
                    type={showRegisterPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white py-2 pl-10 pr-11 text-xs sm:text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword((prev) => !prev)}
                    className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#1D3668]"
                    aria-label={showRegisterPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  >
                    {showRegisterPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {(registerFormError || authError) && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs font-medium text-red-700"
                >
                  {registerFormError || authError}
                </div>
              )}

              {/* Tombol Submit Daftar */}
              <button
                type="submit"
                disabled={isRegistering}
                className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-4 text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#162B54] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRegistering ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    <span>Mendaftarkan akun...</span>
                  </>
                ) : (
                  <span>Daftar Sekarang</span>
                )}
              </button>

              <p className="text-center text-xs text-[#56638A]">
                Sudah memiliki akun?{' '}
                <button
                  type="button"
                  onClick={() => handleNavigate('login')}
                  className="font-bold text-[#BE2257] hover:underline"
                >
                  Masuk di sini
                </button>
              </p>
            </form>
          </div>
        ) : (
          /* ========================================================================= */
          /* SUB-VIEW 3: FORM LOGIN                                                   */
          /* ========================================================================= */
          <div>
            <div className="mt-2 flex flex-col items-center text-center">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#1D3668] text-base font-extrabold text-white shadow-sm">
                S
              </span>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#BE2257]">
                Smart Focus Akademik
              </p>
              <h1 className="mt-1 text-[24px] font-extrabold leading-8 text-[#1F2C4F]">
                Masuk ke Akun Anda
              </h1>
              <p className="mt-1.5 text-xs text-[#56638A]">
                Kelola jadwal belajar dan lanjutkan sesi fokusmu.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleLoginSubmit} noValidate>
              {/* Field: Email */}
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                  Alamat Email Gmail
                </label>
                <div className="relative">
                  <Mail
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56638A]"
                    aria-hidden="true"
                  />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="nama.mahasiswa@gmail.com"
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white py-2 pl-10 pr-4 text-xs sm:text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
              </div>

              {/* Field: Sandi */}
              <div>
                <label htmlFor="login-pass" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                  Kata Sandi
                </label>
                <div className="relative">
                  <LockKeyhole
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56638A]"
                    aria-hidden="true"
                  />
                  <input
                    id="login-pass"
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan sandi Anda"
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white py-2 pl-10 pr-11 text-xs sm:text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#1D3668]"
                    aria-label={showLoginPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  >
                    {showLoginPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {(loginFormError || authError) && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs font-medium text-red-700"
                >
                  {loginFormError || authError}
                </div>
              )}

              {/* Tombol Masuk */}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition hover:bg-[#A11B48] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    <span>Memverifikasi akun...</span>
                  </>
                ) : (
                  <span>Masuk</span>
                )}
              </button>

              <p className="text-center text-xs text-[#56638A]">
                Belum memiliki akun?{' '}
                <button
                  type="button"
                  onClick={() => handleNavigate('register')}
                  className="font-bold text-[#1D3668] hover:text-[#BE2257]"
                >
                  Daftar sekarang
                </button>
              </p>
            </form>
          </div>
        )}

        {/* Micro-trust footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-[#DFE4F1] pt-4 text-[11px] text-[#757780]">
          <ShieldCheck size={14} className="text-[#1D3668]" />
          <span>Keamanan akun dienkripsi dengan standar Supabase Auth</span>
        </div>
      </section>
    </main>
  )
}

