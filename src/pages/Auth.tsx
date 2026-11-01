import { useState, type FormEvent } from 'react'
import {
  AlertCircle,
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
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle)
  const authError = useAuthStore((state) => state.authError)
  const clearAuthError = useAuthStore((state) => state.clearAuthError)

  const [currentView, setCurrentView] = useState<AuthView>(initialView)

  // Google OAuth state
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  async function handleGoogleAuth() {
    clearAuthError()
    setRegisterFormError('')
    setLoginFormError('')
    setIsGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan Google.'
      if (currentView === 'register') {
        setRegisterFormError(msg)
      } else {
        setLoginFormError(msg)
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

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
      const rawMsg = error instanceof Error ? error.message : 'Pendaftaran gagal. Silakan coba lagi.'
      const rawLower = rawMsg.toLowerCase()
      const isRateLimit =
        rawLower.includes('rate limit') ||
        rawLower.includes('rate_limit') ||
        rawLower.includes('429') ||
        rawLower.includes('too many') ||
        rawLower.includes('security purposes') ||
        rawLower.includes('over_email_send_rate_limit') ||
        rawLower.includes('over_request_rate_limit') ||
        rawLower.includes('sedang padat')

      const friendlyMsg = isRateLimit
        ? "Sistem pendaftaran sedang padat. Silakan gunakan tombol 'Login dengan Google' atau coba beberapa saat lagi."
        : rawMsg

      setRegisterFormError(friendlyMsg)
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
              <img
                src="/logo.jpg"
                alt="Logo Smart Focus Akademik"
                className="h-14 w-14 rounded-2xl object-contain shadow-md shadow-[#1D3668]/20 border border-[#1D3668]/15"
              />
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
              {(registerFormError || authError) && (() => {
                const currentError = registerFormError || authError || ''
                const isRateLimitAlert =
                  currentError.toLowerCase().includes('rate limit') ||
                  currentError.includes('Login dengan Google') ||
                  currentError.includes('padat')

                return (
                  <div
                    role="alert"
                    className={`rounded-xl border p-3.5 text-xs transition-all ${
                      isRateLimitAlert
                        ? 'border-amber-300 bg-amber-50 text-amber-950 shadow-sm'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertCircle
                        size={18}
                        className={`mt-0.5 shrink-0 ${
                          isRateLimitAlert ? 'text-amber-600' : 'text-red-600'
                        }`}
                      />
                      <div className="min-w-0 flex-1 leading-relaxed">
                        <p className="font-semibold">{currentError}</p>
                        {isRateLimitAlert && (
                          <div className="mt-2.5">
                            <button
                              type="button"
                              onClick={() => void handleGoogleAuth()}
                              disabled={isGoogleLoading}
                              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#1F2C4F] border border-amber-300 shadow-xs hover:bg-amber-100/50 transition active:scale-95 disabled:opacity-60"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                              </svg>
                              <span>{isGoogleLoading ? 'Menghubungkan...' : 'Login dengan Google'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

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

              {/* Opsi Login Alternatif dengan Google */}
              <div className="relative my-3 flex items-center justify-center">
                <div className="w-full border-t border-[#DFE4F1]" />
                <span className="absolute bg-white px-2 text-[11px] font-semibold text-[#56638A]">
                  atau
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleGoogleAuth()}
                disabled={isGoogleLoading || isRegistering}
                className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#DFE4F1] bg-white px-4 text-xs font-bold text-[#1F2C4F] shadow-2xs transition hover:bg-[#F6F7FC] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isGoogleLoading ? 'Menghubungkan ke Google...' : 'Login dengan Google'}</span>
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
              <img
                src="/logo.jpg"
                alt="Logo Smart Focus Akademik"
                className="h-14 w-14 rounded-2xl object-contain shadow-md shadow-[#1D3668]/20 border border-[#1D3668]/15"
              />
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

              {/* Opsi Login Alternatif dengan Google */}
              <div className="relative my-3 flex items-center justify-center">
                <div className="w-full border-t border-[#DFE4F1]" />
                <span className="absolute bg-white px-2 text-[11px] font-semibold text-[#56638A]">
                  atau
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleGoogleAuth()}
                disabled={isGoogleLoading || isLoggingIn}
                className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#DFE4F1] bg-white px-4 text-xs font-bold text-[#1F2C4F] shadow-2xs transition hover:bg-[#F6F7FC] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isGoogleLoading ? 'Menghubungkan ke Google...' : 'Login dengan Google'}</span>
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

