import { ArrowRight, MessageSquareText, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockGroupMembers } from '../data/mockData'
import { useSessionStore } from '../store/sessionStore'

const statusStyles = {
  'Sedang Fokus': 'bg-[#FCDDE6] text-[#8E1744]',
  Istirahat: 'bg-[#FDEBC8] text-[#7A4B00]',
} as const

export default function CoFocus() {
  const navigate = useNavigate()
  const [isSharing, setIsSharing] = useState(() => window.localStorage.getItem('smartlearning-cofocus-sharing') !== 'false')
  const [autoReply, setAutoReply] = useState(() => window.localStorage.getItem('smartlearning-cofocus-auto-reply') ?? 'Sedang fokus belajar modul Manajemen Inovasi. Balasan menyusul setelah sesi tuntas.')
  const sessionStatus = useSessionStore((state) => state.status)
  const ownStatus = sessionStatus === 'running' || sessionStatus === 'paused' ? 'Sedang Fokus' : 'Tersedia'

  useEffect(() => {
    window.localStorage.setItem('smartlearning-cofocus-sharing', String(isSharing))
  }, [isSharing])

  useEffect(() => {
    window.localStorage.setItem('smartlearning-cofocus-auto-reply', autoReply)
  }, [autoReply])

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header & Status Card */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
            <UsersRound size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Kolaborasi belajar</p>
            <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">Co-Focus</h1>
            <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">Bagikan status fokusmu dan lihat ritme belajar rekan kelompok secara transparan.</p>
          </div>
        </div>

        <div className="mt-6 space-y-5 border-t border-[#DFE4F1] pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="share-focus-status" className="text-sm font-bold text-[#1F2C4F]">Bagikan status saya</label>
              <p className="mt-1 text-[13px] leading-[18px] text-[#56638A]">
                Status dibagikan: <strong className="font-semibold text-[#1F2C4F]">{isSharing ? ownStatus : 'Tersembunyi'}</strong>.
              </p>
            </div>
            <button
              id="share-focus-status"
              type="button"
              role="switch"
              aria-checked={isSharing}
              onClick={() => setIsSharing((current) => !current)}
              className={`relative h-[26px] w-12 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2 ${isSharing ? 'bg-[#1D3668]' : 'bg-[#DFE4F1]'}`}
            >
              <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${isSharing ? 'translate-x-[25px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          <div>
            <label htmlFor="cofocus-auto-reply" className="mb-2 flex items-center gap-2 text-sm font-bold text-[#1F2C4F]">
              <MessageSquareText size={17} aria-hidden="true" /> Pesan Balasan Otomatis
            </label>
            <input
              id="cofocus-auto-reply"
              type="text"
              value={autoReply}
              onChange={(event) => setAutoReply(event.target.value)}
              className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] px-4 text-sm text-[#1F2C4F] outline-none transition placeholder:text-[#56638A] focus:bg-white focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]/20"
            />
          </div>
        </div>
      </section>

      {/* Ruang Belajar Bersama Section */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 sm:p-6 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
              <MessageSquareText size={22} aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Ruang Belajar Bersama</p>
                <span className="rounded-full bg-[#D6F0DE] px-2 py-0.5 text-[10px] font-bold text-[#17623A]">
                  Aktif
                </span>
              </div>
              <h2 className="mt-1 text-[18px] font-bold leading-6 text-[#1F2C4F]">
                Forum Grup Belajar: Kelompok Inovasi
              </h2>
              <p className="mt-1 max-w-2xl text-[13px] leading-[19px] text-[#56638A]">
                Ruang kolaborasi terpadu untuk berdiskusi materi kuliah, bertukar lampiran dokumen/gambar tugas, dan memantau status fokus anggota secara real-time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/cofocus/room')}
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#162B54] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2"
          >
            <MessageSquareText size={17} aria-hidden="true" />
            <span>Masuk ke Ruang Belajar</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Anggota Kelompok Section */}
      <section aria-labelledby="cofocus-members-title">
        <div className="mb-3 flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <h2 id="cofocus-members-title" className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Anggota Kelompok Belajar</h2>
            <span className="rounded-full bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]">{mockGroupMembers.length} anggota</span>
          </div>
          <span className="text-[11px] font-semibold text-[#56638A]">Kelompok Inovasi</span>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {mockGroupMembers.map((member, index) => {
            const status = member.status === 'fokus' ? 'Sedang Fokus' : 'Istirahat'
            return (
              <article key={member.name} className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] transition hover:border-[#B7C7E8]">
                <span className={`grid h-11 w-11 place-items-center rounded-full text-xs font-extrabold text-white ${index % 2 ? 'bg-[#BE2257]' : 'bg-[#1D3668]'}`}>{member.avatar}</span>
                <h3 className="mt-4 text-[16px] font-bold leading-[22px] text-[#1F2C4F]">{member.name}</h3>
                <p className="mt-1 text-xs text-[#56638A]">{member.course}</p>
                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[status]}`}>{status}</span>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
