import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  Flame,
  GraduationCap,
  Hash,
  LogOut,
  Mail,
  Medal,
  Save,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  UserRound,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function Settings() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const togglePrivacy = useAuthStore((state) => state.togglePrivacy)
  const logout = useAuthStore((state) => state.logout)
  const isPrivateProfile = user?.isPrivateProfile ?? false

  const [prevUserId, setPrevUserId] = useState(user?.id)
  const [name, setName] = useState(user?.name || '')
  const [nim, setNim] = useState(user?.nim || '')
  const [major, setMajor] = useState(user?.major || '')
  const [university, setUniversity] = useState(user?.university || '')
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user?.id !== prevUserId) {
    setPrevUserId(user?.id)
    setName(user?.name || '')
    setNim(user?.nim || '')
    setMajor(user?.major || '')
    setUniversity(user?.university || '')
  }

  // Auto-hide success toast after 3.5 seconds
  useEffect(() => {
    if (showSuccessToast) {
      const timer = window.setTimeout(() => setShowSuccessToast(false), 3500)
      return () => window.clearTimeout(timer)
    }
  }, [showSuccessToast])

  // Auto-hide error toast after 5 seconds
  useEffect(() => {
    if (errorToast) {
      const timer = window.setTimeout(() => setErrorToast(null), 5000)
      return () => window.clearTimeout(timer)
    }
  }, [errorToast])

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorToast(null)

    try {
      await updateProfile({
        name: name.trim(),
        nim: nim.trim(),
        major: major.trim(),
        university: university.trim(),
      })
      setShowSuccessToast(true)
    } catch (error) {
      setErrorToast(
        error instanceof Error ? error.message : 'Gagal menyimpan perubahan profil ke Supabase.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleTogglePrivacy() {
    setErrorToast(null)
    try {
      await togglePrivacy(!isPrivateProfile)
      setShowSuccessToast(true)
    } catch (error) {
      setErrorToast(
        error instanceof Error ? error.message : 'Gagal memperbarui pengaturan privasi.'
      )
    }
  }

  async function handleLogout() {
    setErrorToast(null)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      setErrorToast(error instanceof Error ? error.message : 'Gagal keluar dari sesi akun.')
      navigate('/login', { replace: true })
    }
  }

  const initials = (name || user?.name || 'M')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {showSuccessToast && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-xl border border-[#17623A]/20 bg-[#D6F0DE] p-4 text-[#17623A] shadow-md transition-all animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="shrink-0 text-[#17623A]" aria-hidden="true" />
            <p className="text-sm font-bold">Profil berhasil diperbarui di Supabase</p>
          </div>
          <button
            type="button"
            onClick={() => setShowSuccessToast(false)}
            className="text-xs font-semibold hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {errorToast && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-md transition-all animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert size={20} className="shrink-0 text-red-600" aria-hidden="true" />
            <p className="text-sm font-bold">{errorToast}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorToast(null)}
            className="text-xs font-semibold text-red-700 hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header Profile Card */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* Avatar Dummy */}
          <div className="relative shrink-0">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-[#1D3668] text-2xl font-extrabold text-white shadow-md sm:h-24 sm:w-24 sm:text-3xl">
              {initials}
            </div>
            <span
              className="absolute bottom-0 right-0 h-5 w-5 rounded-full border-2 border-white bg-[#17623A]"
              title="Status Mahasiswa Aktif"
              aria-label="Status Mahasiswa Aktif"
            />
          </div>

          {/* User Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#E1EAF8] text-[#1D3668]">
                <SettingsIcon size={16} aria-hidden="true" />
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
                Pengaturan Akun & Profil
              </p>
            </div>
            <h1 className="mt-1 truncate text-[22px] font-extrabold leading-tight text-[#1F2C4F] sm:text-[28px]">
              {name || user?.name || 'Mahasiswa Smart Focus'}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-[#56638A]">
              <Mail size={16} className="shrink-0 text-[#757780]" aria-hidden="true" />
              <span className="truncate">{user?.email || 'email@mahasiswa.ac.id'}</span>
            </p>

            {/* Micro Tags */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#E1EAF8] px-3 py-1 text-xs font-semibold text-[#1D3668]">
                {nim || 'NIM belum disetel'}
              </span>
              <span className="rounded-full bg-[#F6F7FC] border border-[#DFE4F1] px-3 py-1 text-xs font-semibold text-[#56638A]">
                {major || 'Program Studi'}
              </span>
              <span className="rounded-full bg-[#D6F0DE] px-3 py-1 text-xs font-semibold text-[#17623A]">
                Mahasiswa Aktif
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Edit Profile Form Card */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-7">
        <div className="mb-6 flex items-center gap-3 border-b border-[#DFE4F1] pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
            <UserRound size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Edit Data Mahasiswa</h2>
            <p className="text-xs text-[#56638A]">
              Perbarui identitas akademik Anda untuk penyesuaian jadwal dan kolaborasi kelompok.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Nama Lengkap */}
            <div className="sm:col-span-2">
              <label htmlFor="student-name" className="mb-2 block text-sm font-bold text-[#1F2C4F]">
                Nama Lengkap
              </label>
              <div className="relative">
                <UserIcon
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#757780]"
                  aria-hidden="true"
                />
                <input
                  id="student-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] py-2 pl-11 pr-4 text-sm text-[#1F2C4F] outline-none transition placeholder:text-[#757780] focus:border-[#1D3668] focus:bg-white focus:ring-2 focus:ring-[#1D3668]/20"
                />
              </div>
            </div>

            {/* NIM */}
            <div>
              <label htmlFor="student-nim" className="mb-2 block text-sm font-bold text-[#1F2C4F]">
                Nomor Induk Mahasiswa (NIM)
              </label>
              <div className="relative">
                <Hash
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#757780]"
                  aria-hidden="true"
                />
                <input
                  id="student-nim"
                  type="text"
                  required
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                  placeholder="Contoh: 2201082001"
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] py-2 pl-11 pr-4 text-sm text-[#1F2C4F] outline-none transition placeholder:text-[#757780] focus:border-[#1D3668] focus:bg-white focus:ring-2 focus:ring-[#1D3668]/20"
                />
              </div>
            </div>

            {/* Email (Readonly) */}
            <div>
              <label htmlFor="student-email" className="mb-2 block text-sm font-bold text-[#1F2C4F]">
                Email Kampus <span className="text-xs font-normal text-[#757780]">(Akun Utama)</span>
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#757780]"
                  aria-hidden="true"
                />
                <input
                  id="student-email"
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="h-11 w-full cursor-not-allowed rounded-[10px] border border-[#DFE4F1] bg-[#EEF1F8] py-2 pl-11 pr-4 text-sm text-[#56638A] opacity-90 outline-none"
                />
              </div>
            </div>

            {/* Program Studi / Jurusan */}
            <div>
              <label htmlFor="student-major" className="mb-2 block text-sm font-bold text-[#1F2C4F]">
                Program Studi / Jurusan
              </label>
              <div className="relative">
                <GraduationCap
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#757780]"
                  aria-hidden="true"
                />
                <input
                  id="student-major"
                  type="text"
                  required
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="Contoh: Teknik Informatika"
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] py-2 pl-11 pr-4 text-sm text-[#1F2C4F] outline-none transition placeholder:text-[#757780] focus:border-[#1D3668] focus:bg-white focus:ring-2 focus:ring-[#1D3668]/20"
                />
              </div>
            </div>

            {/* Universitas / Kampus */}
            <div>
              <label htmlFor="student-university" className="mb-2 block text-sm font-bold text-[#1F2C4F]">
                Universitas / Kampus
              </label>
              <div className="relative">
                <Building2
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#757780]"
                  aria-hidden="true"
                />
                <input
                  id="student-university"
                  type="text"
                  required
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="Contoh: Universitas Indonesia"
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] py-2 pl-11 pr-4 text-sm text-[#1F2C4F] outline-none transition placeholder:text-[#757780] focus:border-[#1D3668] focus:bg-white focus:ring-2 focus:ring-[#1D3668]/20"
                />
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[#162B54] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={17} aria-hidden="true" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Pengaturan Privasi & Gamifikasi */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-7">
        <div className="mb-6 flex items-center gap-3 border-b border-[#DFE4F1] pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Pengaturan Privasi & Gamifikasi</h2>
            <p className="text-xs text-[#56638A]">
              Kelola visibilitas profil Anda di papan peringkat kampus dan pantau pencapaian belajar.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Toggle Switch Privasi Leaderboard */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-4">
            <div>
              <label htmlFor="privacy-leaderboard-switch" className="cursor-pointer text-sm font-bold text-[#1F2C4F]">
                Sembunyikan profil dari Leaderboard Kampus
              </label>
              <p className="mt-1 text-xs leading-[18px] text-[#56638A]">
                {isPrivateProfile
                  ? 'Profil Anda saat ini bersifat privat dan tidak ditampilkan di peringkat publik kampus.'
                  : 'Nama dan capaian jam fokus Anda dapat dilihat oleh rekan satu kampus.'}
              </p>
            </div>
            <button
              id="privacy-leaderboard-switch"
              type="button"
              role="switch"
              aria-checked={isPrivateProfile}
              onClick={() => void handleTogglePrivacy()}
              className={`relative h-[26px] w-12 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2 ${
                isPrivateProfile ? 'bg-[#1D3668]' : 'bg-[#DFE4F1]'
              }`}
            >
              <span
                className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  isPrivateProfile ? 'translate-x-[25px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>

          {/* Info Streak & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DFE4F1] bg-white p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-50 text-orange-500">
                <Flame size={19} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#757780]">Streak Belajar</p>
                <p className="text-sm font-extrabold text-[#1F2C4F]">{user?.streak ?? 3} Hari Beruntun!</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(user?.badges ?? ['Fokus Master', 'Awal yang Baik']).map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"
                >
                  <Medal size={14} className="text-amber-500" aria-hidden="true" />
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bagian Akun (Danger Zone) */}
      <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-[0_2px_4px_rgba(220,38,38,0.03),0_8px_16px_rgba(220,38,38,0.04)] sm:p-7">
        <div className="flex items-start gap-3 border-b border-red-100 pb-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
            <ShieldAlert size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[18px] font-bold leading-6 text-red-900">Manajemen Sesi Akun</h2>
            <p className="mt-1 text-xs text-red-700">
              Keluar dari sesi aktif aplikasi SmartLearning pada perangkat ini.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <p className="text-[13px] leading-relaxed text-[#56638A]">
            Dengan keluar, data sesi lokal akan dibersihkan dan Anda perlu masuk kembali menggunakan email dan kata sandi Anda untuk mengakses jadwal belajar dan ruang Co-Focus.
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-red-500 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-red-600 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
          >
            <LogOut size={19} aria-hidden="true" />
            <span>Keluar Aplikasi</span>
          </button>
        </div>
      </section>
    </div>
  )
}
