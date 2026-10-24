import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuthStore } from '../store/authStore'

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const login = useAuthStore((state) => state.login)
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    const validation = loginSchema.safeParse({ email, password })
    if (!validation.success) {
      setFormError('Email dan Sandi wajib diisi')
      return
    }

    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Login gagal. Silakan coba lagi.')
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4FA] px-4 py-8 font-[Montserrat] text-[#1F2C4F] sm:px-6">
      <section className="w-full max-w-[440px] rounded-2xl border border-[#DFE4F1] bg-white p-6 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-8">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#1D3668] text-lg font-extrabold text-white" aria-hidden="true">
            S
          </span>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Smart Focus Akademik</p>
          <h1 className="mt-2 text-[28px] font-extrabold leading-9 tracking-tight text-[#1F2C4F]">Masuk ke akun Anda</h1>
          <p className="mt-2 text-sm leading-5 text-[#56638A]">Kelola jadwal belajar dan mulai sesi fokusmu.</p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#1F2C4F]">
              Email kampus
            </label>
            <div className="relative">
              <Mail aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#56638A]" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(formError)}
                aria-describedby={formError ? 'login-form-error' : undefined}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@kampus.id"
                className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white py-2 pl-11 pr-4 text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#1F2C4F]">
              Sandi
            </label>
            <div className="relative">
              <LockKeyhole aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#56638A]" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={Boolean(formError)}
                aria-describedby={formError ? 'login-form-error' : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Masukkan sandi"
                className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white py-2 pl-11 pr-12 text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                aria-pressed={showPassword}
                className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#1D3668] focus:outline-none focus:ring-2 focus:ring-[#1D3668]"
              >
                {showPassword ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="flex h-[46px] w-full items-center justify-center rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition hover:bg-[#A11B48] focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2 active:scale-[0.98]"
          >
            Masuk
          </button>
          {formError && (
            <p id="login-form-error" role="alert" className="text-center text-sm font-medium text-[#BA1A1A]">
              {formError}
            </p>
          )}
          <p className="text-center text-sm text-[#56638A]">Belum memiliki akun? <Link to="/register" className="font-bold text-[#1D3668] hover:text-[#BE2257]">Daftar sekarang</Link></p>
        </form>
      </section>
    </main>
  )
}
