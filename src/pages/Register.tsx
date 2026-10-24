import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuthStore } from '../store/authStore'

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.'),
  email: z.string().email('Masukkan alamat email yang valid.'),
  password: z.string().min(6, 'Sandi minimal 6 karakter.'),
})

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const register = useAuthStore((state) => state.register)
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setNotice('')
    const validation = registerSchema.safeParse({ name, email, password })
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message ?? 'Lengkapi data pendaftaran.')
      return
    }

    try {
      await register(validation.data.email, validation.data.password, validation.data.name)
      if (useAuthStore.getState().isAuthenticated) {
        navigate('/', { replace: true })
      } else {
        setNotice('Pendaftaran berhasil. Periksa email untuk mengonfirmasi akun jika diminta oleh Supabase, lalu masuk.')
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Pendaftaran gagal. Silakan coba lagi.')
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4FA] px-4 py-8 font-[Montserrat] text-[#1F2C4F] sm:px-6">
      <section className="w-full max-w-[440px] rounded-2xl border border-[#DFE4F1] bg-white p-6 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-8">
        <div className="flex flex-col items-center text-center"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#1D3668] text-lg font-extrabold text-white" aria-hidden="true">S</span><p className="mt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Smart Focus Akademik</p><h1 className="mt-2 text-[28px] font-extrabold leading-9 tracking-tight text-[#1F2C4F]">Buat akun baru</h1><p className="mt-2 text-sm leading-5 text-[#56638A]">Mulai menyusun ritme belajar yang lebih fokus.</p></div>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div><label htmlFor="register-name" className="mb-2 block text-sm font-semibold text-[#1F2C4F]">Nama</label><div className="relative"><UserRound aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#56638A]" /><input id="register-name" type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama lengkap" className="h-11 w-full rounded-[10px] border border-[#DFE4F1] py-2 pl-11 pr-4 text-sm outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]" /></div></div>
          <div><label htmlFor="register-email" className="mb-2 block text-sm font-semibold text-[#1F2C4F]">Email kampus</label><div className="relative"><Mail aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#56638A]" /><input id="register-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@kampus.id" className="h-11 w-full rounded-[10px] border border-[#DFE4F1] py-2 pl-11 pr-4 text-sm outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]" /></div></div>
          <div><label htmlFor="register-password" className="mb-2 block text-sm font-semibold text-[#1F2C4F]">Sandi</label><div className="relative"><LockKeyhole aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#56638A]" /><input id="register-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 6 karakter" className="h-11 w-full rounded-[10px] border border-[#DFE4F1] py-2 pl-11 pr-12 text-sm outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-[#56638A] hover:bg-[#F6F7FC] focus:outline-none focus:ring-2 focus:ring-[#1D3668]">{showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button></div></div>
          {formError && <p role="alert" className="text-center text-sm font-medium text-[#BA1A1A]">{formError}</p>}
          {notice && <p role="status" className="text-center text-sm font-medium text-[#17623A]">{notice}</p>}
          <button type="submit" className="flex h-[46px] w-full items-center justify-center rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition hover:bg-[#A11B48] focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2">Daftar</button>
          <p className="text-center text-sm text-[#56638A]">Sudah memiliki akun? <Link to="/login" className="font-bold text-[#1D3668] hover:text-[#BE2257]">Masuk</Link></p>
        </form>
      </section>
    </main>
  )
}
