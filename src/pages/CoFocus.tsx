import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  MessageSquareText,
  PlusCircle,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useGroupStore, type GroupMemberItem } from '../store/groupStore'
import { useSessionStore } from '../store/sessionStore'

const statusStyles: Record<'Sedang Fokus' | 'Istirahat', string> = {
  'Sedang Fokus': 'bg-[#FCDDE6] text-[#8E1744]',
  Istirahat: 'bg-[#FDEBC8] text-[#7A4B00]',
}

export default function CoFocus() {
  const navigate = useNavigate()

  // Session & Local settings
  const [isSharing, setIsSharing] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('smartlearning-cofocus-sharing') !== 'false'
    } catch {
      return true
    }
  })
  const [autoReply, setAutoReply] = useState(() => {
    try {
      return (
        (typeof window !== 'undefined' && window.localStorage.getItem('smartlearning-cofocus-auto-reply')) ||
        'Sedang fokus belajar modul Manajemen Inovasi. Balasan menyusul setelah sesi tuntas.'
      )
    } catch {
      return 'Sedang fokus belajar modul Manajemen Inovasi. Balasan menyusul setelah sesi tuntas.'
    }
  })
  const sessionStatus = useSessionStore((state) => state.status)
  const ownStatus = sessionStatus === 'running' || sessionStatus === 'paused' ? 'Sedang Fokus' : 'Tersedia'

  // Auth & User
  const user = useAuthStore((state) => state.user)

  // Group Store state & actions
  const groups = useGroupStore((state) => state.groups)
  const activeGroupId = useGroupStore((state) => state.activeGroupId)
  const activeGroup = useGroupStore((state) => state.activeGroup)
  const isLoadingGroups = useGroupStore((state) => state.isLoading)
  const setActiveGroup = useGroupStore((state) => state.setActiveGroup)
  const createGroup = useGroupStore((state) => state.createGroup)
  const joinGroup = useGroupStore((state) => state.joinGroup)
  const fetchMyGroups = useGroupStore((state) => state.fetchMyGroups)

  useEffect(() => {
    if (user?.id) {
      void fetchMyGroups(user.id)
    }
  }, [user?.id, fetchMyGroups])

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null)
  const [joinCodeInput, setJoinCodeInput] = useState('')

  // Toast / Alert state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync settings to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem('smartlearning-cofocus-sharing', String(isSharing))
    } catch {
      // Ignore storage errors
    }
  }, [isSharing])

  useEffect(() => {
    try {
      window.localStorage.setItem('smartlearning-cofocus-auto-reply', autoReply)
    } catch {
      // Ignore storage errors
    }
  }, [autoReply])

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = window.setTimeout(() => setToast(null), 4000)
      return () => window.clearTimeout(timer)
    }
  }, [toast])

  // Close modals when Escape key is pressed
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showCreateModal) setShowCreateModal(false)
        if (showJoinModal) setShowJoinModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCreateModal, showJoinModal])

  // Safe clipboard copy with fallback
  const handleCopy = async (code?: string | null) => {
    if (!code) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code)
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea')
        textArea.value = code
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch (err) {
      console.warn('Gagal menyalin teks ke clipboard:', err)
    }
  }

  // Handle Create Room
  async function handleCreateRoom(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = newRoomName.trim()
    if (!trimmed) return

    try {
      setIsSubmitting(true)
      const result = await createGroup(trimmed)
      if (result.success && result.group) {
        setCreatedRoomCode(result.group.joinCode)
        setToast({
          type: 'success',
          message: `Ruang belajar "${result.group.name}" berhasil dibuat dengan kode: ${result.group.joinCode}!`,
        })
      } else {
        setToast({
          type: 'error',
          message: 'Gagal membuat ruang belajar. Silakan coba kembali.',
        })
      }
    } catch (error) {
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat ruang belajar.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Join Room by 6-char Code
  async function handleJoinRoom(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const cleanCode = joinCodeInput.trim().toUpperCase()
    if (!cleanCode) {
      setToast({ type: 'error', message: 'Silakan masukkan 6 karakter kode ruangan.' })
      return
    }

    try {
      setIsSubmitting(true)
      const result = await joinGroup(cleanCode)
      if (!result.success) {
        setToast({
          type: 'error',
          message: result.error || 'Gagal bergabung ke ruang belajar.',
        })
      } else {
        setShowJoinModal(false)
        setJoinCodeInput('')
        setToast({
          type: 'success',
          message: `Berhasil bergabung ke "${result.group?.name || 'Ruang Belajar'}"!`,
        })
      }
    } catch (error) {
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan saat bergabung.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentMembers: GroupMemberItem[] = activeGroup?.members || []
  const maxMembers = activeGroup?.maxMembers || 6
  const remainingSlots = Math.max(0, maxMembers - currentMembers.length)
  const roomJoinCode = activeGroup?.joinCode || ''

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Toast Alert Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between rounded-xl border p-4 shadow-md transition-all duration-200 ${
            toast.type === 'success'
              ? 'border-[#17623A]/20 bg-[#D6F0DE] text-[#17623A]'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? (
              <CheckCircle2 size={20} className="shrink-0 text-[#17623A]" aria-hidden="true" />
            ) : (
              <AlertCircle size={20} className="shrink-0 text-red-600" aria-hidden="true" />
            )}
            <p className="text-sm font-bold">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-semibold hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header & Status Card */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
            <UsersRound size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Kolaborasi belajar</p>
            <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">Co-Focus</h1>
            <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">Bagikan status fokusmu dan berkolaborasi dalam ruang belajar bersama (maksimal 6 orang).</p>
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

      {/* Action Buttons: Buat Ruang Belajar & Gabung pakai Kode */}
      <section className="grid gap-3.5 sm:grid-cols-2">
        {/* Tombol Buat Ruang Belajar */}
        <button
          type="button"
          onClick={() => {
            setNewRoomName('')
            setCreatedRoomCode(null)
            setShowCreateModal(true)
          }}
          className="group relative flex items-center justify-between overflow-hidden rounded-2xl border-2 border-[#1D3668] bg-[#1D3668] p-5 text-left text-white shadow-md shadow-[#1D3668]/15 transition-all hover:bg-[#162B54] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-white transition-transform group-hover:scale-105">
              <PlusCircle size={24} />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CC3FF]">Mulai Kelompok Baru</span>
              <h2 className="text-lg font-extrabold leading-6">Buat Ruang Belajar</h2>
              <p className="mt-0.5 text-xs text-white/80">Dapatkan kode unik 6 karakter (Maks 6 orang)</p>
            </div>
          </div>
          <ArrowRight size={20} className="shrink-0 text-white/80 transition-transform group-hover:translate-x-1" />
        </button>

        {/* Tombol Gabung pakai Kode */}
        <button
          type="button"
          onClick={() => {
            setJoinCodeInput('')
            setShowJoinModal(true)
          }}
          className="group relative flex items-center justify-between overflow-hidden rounded-2xl border-2 border-[#BE2257] bg-white p-5 text-left shadow-sm transition-all hover:bg-[#FFF5F8] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#FCDDE6] text-[#BE2257] transition-transform group-hover:scale-105">
              <KeyRound size={24} />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#BE2257]">Punya Kode Unik?</span>
              <h2 className="text-lg font-extrabold leading-6 text-[#1F2C4F]">Gabung pakai Kode</h2>
              <p className="mt-0.5 text-xs text-[#56638A]">Masukkan 6 karakter kode ruang belajar teman</p>
            </div>
          </div>
          <ArrowRight size={20} className="shrink-0 text-[#BE2257] transition-transform group-hover:translate-x-1" />
        </button>
      </section>

      {/* Switcher Ruangan (Jika pengguna tergabung di lebih dari 1 ruangan) */}
      {groups.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs font-bold text-[#56638A]">Daftar Ruangan Anda:</span>
          {groups.map((group) => {
            const isActive = group.id === activeGroupId
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroup(group.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
                  isActive
                    ? 'bg-[#1D3668] text-white shadow-sm'
                    : 'border border-[#DFE4F1] bg-white text-[#56638A] hover:bg-[#F6F7FC] hover:text-[#1D3668]'
                }`}
              >
                {group.name} ({group.members.length}/6)
              </button>
            )
          })}
        </div>
      )}

      {/* Ruang Belajar Bersama Card (Active Group) */}
      {isLoadingGroups && groups.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-[#DFE4F1] bg-white p-12 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03)]">
          <Loader2 size={32} className="animate-spin text-[#BE2257]" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-[#1F2C4F]">Memuat ruang belajar dari Cloud...</p>
        </section>
      ) : activeGroup ? (
        <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 sm:p-6 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
                <MessageSquareText size={22} aria-hidden="true" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Ruang Belajar Aktif</p>
                  <span className="rounded-full bg-[#D6F0DE] px-2 py-0.5 text-[10px] font-bold text-[#17623A]">
                    {currentMembers.length >= 6 ? 'Penuh (Maks 6)' : `${currentMembers.length} / 6 Anggota`}
                  </span>
                  {roomJoinCode && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DFE4F1] bg-[#F6F7FC] px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-[#1D3668]">
                      <span>Kode: {roomJoinCode}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(roomJoinCode)}
                        title="Salin Kode Ruangan"
                        className="text-[#56638A] hover:text-[#1D3668]"
                      >
                        {copiedCode ? <Check size={12} className="text-[#17623A]" /> : <Copy size={12} />}
                      </button>
                    </span>
                  )}
                </div>
                <h2 className="mt-1 text-[18px] font-bold leading-6 text-[#1F2C4F]">
                  Forum Grup Belajar: {activeGroup.name}
                </h2>
                <p className="mt-1 max-w-2xl text-[13px] leading-[19px] text-[#56638A]">
                  {activeGroup.description || 'Ruang kolaborasi terpadu untuk berdiskusi materi kuliah dan berbagi tugas.'}
                  {remainingSlots > 0
                    ? ` Masih tersedia ${remainingSlots} slot anggota lagi.`
                    : ' Ruangan telah mencapai batas kapasitas maksimum (6 orang).'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              {roomJoinCode && (
                <button
                  type="button"
                  onClick={() => handleCopy(roomJoinCode)}
                  className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] px-4 text-xs font-bold text-[#1D3668] transition hover:bg-[#E1EAF8]"
                >
                  {copiedCode ? <Check size={15} className="text-[#17623A]" /> : <Copy size={15} />}
                  <span>{copiedCode ? 'Kode Disalin!' : 'Salin Kode'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/cofocus/room')}
                className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#162B54] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2"
              >
                <MessageSquareText size={17} aria-hidden="true" />
                <span>Masuk ke Ruang Belajar</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex flex-col items-center rounded-2xl border-2 border-dashed border-[#DFE4F1] bg-white px-6 py-12 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:py-14">
          <span className="grid h-24 w-24 place-items-center rounded-full bg-[#F3F4FA]">
            <Users className="h-16 w-16 text-[#1D3668]/30" strokeWidth={1.4} aria-hidden="true" />
          </span>
          <h2 className="mt-5 max-w-md text-lg font-extrabold text-[#1F2C4F]">
            Kamu belum bergabung di ruang belajar mana pun
          </h2>
          <p className="mt-1.5 max-w-sm text-[13px] leading-[19px] text-[#56638A]">
            Buat ruang baru lalu bagikan kodenya, atau masukkan kode 6 karakter dari temanmu untuk fokus bersama.
          </p>
          <div className="mt-6 flex w-full flex-col justify-center gap-2.5 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setNewRoomName('')
                setCreatedRoomCode(null)
                setShowCreateModal(true)
              }}
              className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-5 text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#162B54] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2 active:scale-[0.98]"
            >
              <PlusCircle size={17} aria-hidden="true" />
              Buat Ruang
            </button>
            <button
              type="button"
              onClick={() => {
                setJoinCodeInput('')
                setShowJoinModal(true)
              }}
              className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#BE2257] bg-white px-5 text-sm font-bold text-[#BE2257] transition hover:bg-[#FFF5F8] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2 active:scale-[0.98]"
            >
              <KeyRound size={17} aria-hidden="true" />
              Gabung Ruang
            </button>
          </div>
        </section>
      )}

      {/* Anggota Kelompok Section (Max 6) — hanya tampil jika ada ruang aktif */}
      {activeGroup && (
      <section aria-labelledby="cofocus-members-title">
        <div className="mb-3 flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <h2 id="cofocus-members-title" className="text-[18px] font-bold leading-6 text-[#1F2C4F]">
              Anggota Ruang Belajar
            </h2>
            <span className="rounded-full bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]">
              {currentMembers.length} / 6 Anggota
            </span>
          </div>
          <span className="text-[11px] font-semibold text-[#56638A]">
            {activeGroup?.name || 'Kelompok Belajar'}
          </span>
        </div>

        {/* Grid 6 slots showing member status and room limit */}
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {currentMembers.map((member, index) => {
            const statusLabel: 'Sedang Fokus' | 'Istirahat' = member.status === 'fokus' ? 'Sedang Fokus' : 'Istirahat'
            const badgeStyle = statusStyles[statusLabel]

            return (
              <article
                key={member.id || `member-${index}`}
                className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] transition hover:border-[#B7C7E8]"
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-full text-xs font-extrabold text-white ${
                      index % 2 ? 'bg-[#BE2257]' : 'bg-[#1D3668]'
                    }`}
                  >
                    {member.avatar || 'M'}
                  </span>
                  {member.isHost && (
                    <span className="rounded-full bg-[#E1EAF8] px-2 py-0.5 text-[10px] font-bold text-[#1D3668]">
                      Host Ruang
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-[16px] font-bold leading-[22px] text-[#1F2C4F]">{member.name}</h3>
                <p className="mt-1 text-xs text-[#56638A]">{member.course || 'Mahasiswa'}</p>
                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeStyle}`}>
                  {statusLabel}
                </span>
              </article>
            )
          })}

          {/* Placeholder cards for empty slots up to 6 members */}
          {Array.from({ length: remainingSlots }).map((_, slotIndex) => (
            <div
              key={`empty-slot-${slotIndex}`}
              className="flex min-h-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DFE4F1] bg-[#F6F7FC]/60 p-5 text-center"
            >
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#E1EAF8] text-[#56638A]">
                <PlusCircle size={18} />
              </div>
              <p className="mt-2 text-xs font-bold text-[#56638A]">
                Slot {currentMembers.length + slotIndex + 1} Tersedia
              </p>
              {roomJoinCode ? (
                <p className="mt-0.5 text-[11px] text-[#757780]">
                  Ajak teman pakai kode: <strong className="font-mono text-[#1D3668]">{roomJoinCode}</strong>
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] text-[#757780]">
                  Siap digunakan untuk anggota baru
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
      )}

      {/* Modal 1: Buat Ruang Belajar */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#DFE4F1] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#DFE4F1] pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E1EAF8] text-[#1D3668]">
                  <PlusCircle size={18} />
                </span>
                <h3 className="text-base font-bold text-[#1F2C4F]">Buat Ruang Belajar Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-[#757780] hover:bg-[#F6F7FC]"
              >
                <X size={16} />
              </button>
            </div>

            {createdRoomCode ? (
              // Success Screen after creation
              <div className="mt-5 space-y-4 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#D6F0DE] text-[#17623A]">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h4 className="text-lg font-extrabold text-[#1F2C4F]">Ruang Belajar Siap!</h4>
                  <p className="mt-1 text-xs text-[#56638A]">
                    Bagikan 6 digit kode unik ini kepada rekan kelompokmu (Maksimal 6 anggota).
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#C5D5F0] bg-[#E1EAF8] p-4 text-left">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#757780]">
                      Kode Unik Ruangan
                    </span>
                    <span className="font-mono text-3xl font-extrabold tracking-[0.2em] text-[#1D3668]">
                      {createdRoomCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdRoomCode)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#1D3668] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#162B54]"
                  >
                    {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedCode ? 'Tersalin!' : 'Copy Kode'}</span>
                  </button>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 rounded-[10px] border border-[#DFE4F1] py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC]"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      navigate('/cofocus/room')
                    }}
                    className="flex-1 rounded-[10px] bg-[#1D3668] py-2.5 text-xs font-bold text-white hover:bg-[#162B54]"
                  >
                    Masuk ke Ruangan
                  </button>
                </div>
              </div>
            ) : (
              // Form Input Screen
              <form onSubmit={handleCreateRoom} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="create-room-name" className="mb-1.5 block text-xs font-bold text-[#1F2C4F]">
                    Nama Ruang Belajar
                  </label>
                  <input
                    id="create-room-name"
                    type="text"
                    required
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Contoh: Kelompok Proyek Aplikasi Web"
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] px-4 text-sm text-[#1F2C4F] outline-none transition placeholder:text-[#757780] focus:border-[#1D3668] focus:bg-white focus:ring-2 focus:ring-[#1D3668]/20"
                  />
                  <p className="mt-1.5 text-[11px] text-[#56638A]">
                    Sistem otomatis menghasilkan 6 digit kode unik & membatasi kapasitas maksimal 6 orang.
                  </p>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-[10px] border border-[#DFE4F1] px-4 py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newRoomName.trim()}
                    className="flex items-center gap-1.5 rounded-[10px] bg-[#1D3668] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#162B54] disabled:opacity-50"
                  >
                    <PlusCircle size={15} />
                    <span>{isSubmitting ? 'Membuat...' : 'Buat Ruang Belajar'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: Gabung pakai Kode */}
      {showJoinModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-sm"
          onClick={() => setShowJoinModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#DFE4F1] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#DFE4F1] pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FCDDE6] text-[#BE2257]">
                  <KeyRound size={18} />
                </span>
                <h3 className="text-base font-bold text-[#1F2C4F]">Gabung ke Ruang Belajar</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-[#757780] hover:bg-[#F6F7FC]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleJoinRoom} className="mt-5 space-y-4">
              <div>
                <label htmlFor="join-room-code" className="mb-1.5 block text-center text-xs font-bold text-[#1F2C4F]">
                  Masukkan 6 Karakter Kode Ruangan
                </label>
                <input
                  id="join-room-code"
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="KODE6X"
                  className="h-14 w-full text-center font-mono text-3xl font-extrabold uppercase tracking-[0.25em] rounded-xl border-2 border-[#DFE4F1] bg-[#F6F7FC] text-[#1D3668] outline-none transition placeholder:text-[#C4C6D0] focus:border-[#BE2257] focus:bg-white focus:ring-4 focus:ring-[#BE2257]/15"
                />
                <p className="mt-2 text-center text-[11px] text-[#56638A]">
                  Format: 6 huruf kapital/angka acak. Setiap ruang berkapasitas maksimal 6 orang.
                </p>
                <div className="mt-2 flex justify-center gap-1.5 text-[10px] text-[#757780]">
                  <span>Contoh kode aktif:</span>
                  <button
                    type="button"
                    onClick={() => setJoinCodeInput('INOV26')}
                    className="font-mono font-bold text-[#1D3668] underline hover:text-[#BE2257]"
                  >
                    INOV26
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setJoinCodeInput('PENUH6')}
                    title="Uji coba validasi ruangan penuh"
                    className="font-mono font-bold text-red-600 underline hover:text-red-700"
                  >
                    PENUH6 (Penuh)
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="rounded-[10px] border border-[#DFE4F1] px-4 py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || joinCodeInput.trim().length !== 6}
                  className="flex items-center gap-1.5 rounded-[10px] bg-[#BE2257] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#A11B48] disabled:opacity-50 shadow-sm"
                >
                  <KeyRound size={15} />
                  <span>{isSubmitting ? 'Memeriksa...' : 'Gabung Sekarang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
