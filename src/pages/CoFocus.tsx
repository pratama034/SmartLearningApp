import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BellOff,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  MessageSquareText,
  PlusCircle,
  ShieldCheck,
  Trash2,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useGroupStore, type StudyGroupItem } from '../store/groupStore'

export default function CoFocus() {
  const navigate = useNavigate()

  // Auth & User
  const user = useAuthStore((state) => state.user)

  // Group Store state & actions
  const groups = useGroupStore((state) => state.groups)
  const activeGroup = useGroupStore((state) => state.activeGroup)
  const isLoadingGroups = useGroupStore((state) => state.isLoading)
  const setActiveGroup = useGroupStore((state) => state.setActiveGroup)
  const createGroup = useGroupStore((state) => state.createGroup)
  const joinGroup = useGroupStore((state) => state.joinGroup)
  const fetchMyGroups = useGroupStore((state) => state.fetchMyGroups)
  const deleteGroup = useGroupStore((state) => state.deleteGroup)
  const leaveGroup = useGroupStore((state) => state.leaveGroup)

  useEffect(() => {
    if (!user?.id) return
    void fetchMyGroups(user.id)

    const channel = supabase
      .channel(`cofocus-live:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_group_members' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            useGroupStore
              .getState()
              .handleMemberUpdate(
                payload.new as {
                  id?: string
                  user_id?: string
                  group_id?: string
                  status?: string
                  course?: string | null
                }
              )
          }
          void fetchMyGroups(user.id)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_chat_messages' },
        () => {
          // Segarkan daftar grup agar preview pesan terakhir & angka pesan belum dibaca ter-update ala WhatsApp
          void fetchMyGroups(user.id)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        () => {
          void fetchMyGroups(user.id)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, fetchMyGroups])

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<StudyGroupItem | null>(null)
  const [groupToLeave, setGroupToLeave] = useState<StudyGroupItem | null>(null)
  const [newRoomName, setNewRoomName] = useState('')
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null)
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null)
  const [joinCodeInput, setJoinCodeInput] = useState('')

  // Toast / Alert state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
        if (groupToDelete) setGroupToDelete(null)
        if (groupToLeave) setGroupToLeave(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCreateModal, showJoinModal, groupToDelete, groupToLeave])

  // Safe clipboard copy with fallback (untuk modal setelah buat ruang baru)
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
        setCreatedGroupId(result.group.id)
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
        message:
          error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat ruang belajar.',
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
          message: `Berhasil bergabung ke "${result.group?.name || 'Ruang Belajar'}"! Membuka obrolan...`,
        })
        if (result.group?.id) {
          const joinedGroupId = result.group.id
          setTimeout(() => {
            navigate('/group/' + joinedGroupId)
          }, 600)
        }
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

  async function handleDeleteRoom() {
    if (!groupToDelete?.id) return
    setIsSubmitting(true)
    try {
      const res = await deleteGroup(groupToDelete.id)
      if (res.success) {
        setGroupToDelete(null)
        setToast({ type: 'success', message: 'Ruang belajar berhasil dihapus.' })
      } else {
        setToast({ type: 'error', message: res.error || 'Gagal menghapus ruang belajar.' })
      }
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', message: 'Terjadi kesalahan saat menghapus ruang belajar.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLeaveRoom() {
    if (!groupToLeave?.id) return
    setIsSubmitting(true)
    try {
      const res = await leaveGroup(groupToLeave.id)
      if (res.success) {
        setGroupToLeave(null)
        setToast({ type: 'success', message: 'Berhasil keluar dari ruang belajar.' })
      } else {
        setToast({ type: 'error', message: res.error || 'Gagal keluar dari ruang belajar.' })
      }
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', message: 'Terjadi kesalahan saat keluar dari ruang belajar.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOpenGroupChat(group: StudyGroupItem) {
    setActiveGroup(group.id)
    useGroupStore.getState().markGroupChatRead(group.id)
    navigate('/group/' + group.id)
  }

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

      {/* Header Card */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
            <UsersRound size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
              Kolaborasi belajar StuFo
            </p>
            <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">
              Co-Focus &amp; Grup Belajar
            </h1>
            <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">
              Pilih grup ruang belajarmu di bawah untuk membuka obrolan diskusi dan melihat daftar
              anggota yang sedang fokus.
            </p>
          </div>
        </div>
      </section>

      {/* Action Buttons: Buat Ruang Belajar & Gabung pakai Kode */}
      <section className="grid gap-3.5 sm:grid-cols-2">
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
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CC3FF]">
                Mulai Kelompok Baru
              </span>
              <h2 className="text-lg font-extrabold leading-6">Buat Ruang Belajar</h2>
              <p className="mt-0.5 text-xs text-white/80">
                Dapatkan kode unik 6 karakter (Maks 10 orang)
              </p>
            </div>
          </div>
          <ArrowRight
            size={20}
            className="shrink-0 text-white/80 transition-transform group-hover:translate-x-1"
          />
        </button>

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
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#BE2257]">
                Punya Kode Unik?
              </span>
              <h2 className="text-lg font-extrabold leading-6 text-[#1F2C4F]">Gabung pakai Kode</h2>
              <p className="mt-0.5 text-xs text-[#56638A]">
                Masukkan 6 karakter kode ruang belajar teman
              </p>
            </div>
          </div>
          <ArrowRight
            size={20}
            className="shrink-0 text-[#BE2257] transition-transform group-hover:translate-x-1"
          />
        </button>
      </section>

      {/* Daftar Grup Ruang Belajar Bergaya WhatsApp (dengan Badge Pesan Masuk & Hapus Ruang Kecil di Pojok Kanan Atas) */}
      {isLoadingGroups && groups.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-[#DFE4F1] bg-white p-12 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03)]">
          <Loader2 size={32} className="animate-spin text-[#BE2257]" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-[#1F2C4F]">
            Memuat daftar ruang belajar dari Cloud...
          </p>
        </section>
      ) : groups.length > 0 ? (
        <section className="space-y-3" aria-label="Daftar Grup Ruang Belajar">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-extrabold text-[#1F2C4F]">
                Daftar Grup Ruang Belajar
              </h2>
              <span className="rounded-full bg-[#E1EAF8] px-2.5 py-0.5 text-xs font-bold text-[#1D3668]">
                {groups.length} grup
              </span>
            </div>
            <span className="text-xs text-[#56638A]">
              Ketuk grup untuk masuk ke ruang obrolan
            </span>
          </div>

          <div className="divide-y divide-[#DFE4F1] overflow-hidden rounded-2xl border border-[#DFE4F1] bg-white shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
            {groups.map((group) => {
              const groupMembers = group.members || []
              const maxMembers =
                group.maxMembers && group.maxMembers >= 10 ? group.maxMembers : 10
              const focusingCount = groupMembers.filter((m) => m.status === 'fokus').length
              const unreadCount = group.unreadCount || 0
              const isHost = Boolean(
                (user?.id && group.hostId === user.id) ||
                  groupMembers.some((m) => m.userId === user?.id && m.isHost)
              )
              const groupInitials =
                group.name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join('') || 'GR'

              return (
                <article
                  key={group.id}
                  onClick={() => handleOpenGroupChat(group)}
                  className="group relative flex cursor-pointer flex-col gap-3 p-4 transition hover:bg-[#F6F7FC] sm:p-5"
                >
                  {/* Tombol Hapus Ruang / Keluar yang Diperkecil di Pojok Kanan Atas agar tidak salah pencet */}
                  <div
                    className="absolute right-3.5 top-3.5 z-10 flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {group.lastMessage?.timeLabel && (
                      <span
                        className={`mr-1 text-[11px] font-bold ${
                          unreadCount > 0 ? 'text-[#17623A]' : 'text-[#757780]'
                        }`}
                      >
                        {group.lastMessage.timeLabel}
                      </span>
                    )}
                    {isHost ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setGroupToDelete(group)
                        }}
                        title="Hapus Ruang Belajar (Admin Host)"
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-red-200 bg-red-50/80 px-2 py-0.5 text-[10px] font-bold text-red-700 transition hover:bg-red-100 hover:border-red-300"
                      >
                        <Trash2 size={11} className="text-red-600" />
                        <span>Hapus Ruang</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setGroupToLeave(group)
                        }}
                        title="Keluar dari Ruang Belajar"
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#DFE4F1] bg-white px-2 py-0.5 text-[10px] font-bold text-[#56638A] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        <LogOut size={11} />
                        <span>Keluar</span>
                      </button>
                    )}
                  </div>

                  {/* Baris Utama Gaya WhatsApp */}
                  <div className="flex items-start gap-3.5 pr-28 sm:pr-36">
                    {/* Avatar Grup */}
                    <div className="relative shrink-0">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#1D3668] text-sm font-extrabold text-white shadow-xs">
                        {groupInitials}
                      </span>
                      {focusingCount > 0 && (
                        <span
                          title={`${focusingCount} anggota sedang fokus`}
                          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#17623A]"
                        />
                      )}
                    </div>

                    {/* Nama Grup, Info Kode & Preview Pesan Terakhir */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-[16px] font-extrabold text-[#1F2C4F]">
                          {group.name}
                        </h3>
                        {group.isMuted && (
                          <span
                            title="Notifikasi grup dibisukan"
                            className="inline-flex items-center text-[#757780]"
                          >
                            <BellOff size={13} />
                          </span>
                        )}
                        {isHost && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#E1EAF8] px-2 py-0.5 text-[10px] font-bold text-[#1D3668]">
                            <ShieldCheck size={11} />
                            Host
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#56638A]">
                        <span>
                          {groupMembers.length}/{maxMembers} anggota
                        </span>
                        <span>·</span>
                        <span className="font-mono font-bold text-[#1D3668]">
                          Kode: {group.joinCode}
                        </span>
                        {focusingCount > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-[#17623A] font-bold">
                              🟢 {focusingCount} sedang fokus
                            </span>
                          </>
                        )}
                      </div>

                      {/* Preview Pesan Terakhir (Gaya WhatsApp) */}
                      <p
                        className={`mt-1.5 line-clamp-1 text-xs ${
                          unreadCount > 0
                            ? 'font-bold text-[#1F2C4F]'
                            : 'font-medium text-[#56638A]'
                        }`}
                      >
                        {group.lastMessage ? (
                          <>
                            <span className="font-bold text-[#1D3668]">
                              {group.lastMessage.senderName}:{' '}
                            </span>
                            <span>{group.lastMessage.text}</span>
                          </>
                        ) : (
                          group.description ||
                          'Belum ada obrolan. Ketuk untuk membuka ruang diskusi belajar.'
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Baris Bawah: Tombol Masuk ke Ruang Belajar + Badge Pesan Belum Dibaca Ala WhatsApp */}
                  <div className="flex items-center justify-between border-t border-[#DFE4F1]/70 pt-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1D3668] group-hover:text-[#BE2257]">
                      <MessageSquareText size={15} />
                      <span>Masuk ke Ruang Belajar &amp; Cek Anggota</span>
                      <ArrowRight
                        size={14}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </span>

                    {unreadCount > 0 && (
                      <span
                        aria-label={`${unreadCount} pesan baru belum dibaca`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#17623A] px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-xs"
                      >
                        <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-white px-1 text-[10px] font-extrabold text-[#17623A]">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                        <span>pesan baru</span>
                      </span>
                    )}
                  </div>
                </article>
              )
            })}
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
            Buat ruang baru lalu bagikan kodenya, atau masukkan kode 6 karakter dari temanmu untuk
            fokus bersama.
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
              <div className="mt-5 space-y-4 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#D6F0DE] text-[#17623A]">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h4 className="text-lg font-extrabold text-[#1F2C4F]">Ruang Belajar Siap!</h4>
                  <p className="mt-1 text-xs text-[#56638A]">
                    Bagikan 6 digit kode unik ini kepada rekan kelompokmu (Maksimal 10 anggota).
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

                <div className="flex gap-2 pt-2">
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
                      navigate('/group/' + (createdGroupId || activeGroup?.id || ''))
                    }}
                    className="flex-1 rounded-[10px] bg-[#1D3668] py-2.5 text-xs font-bold text-white hover:bg-[#162B54]"
                  >
                    Masuk ke Ruangan
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateRoom} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="create-room-name"
                    className="mb-1.5 block text-xs font-bold text-[#1F2C4F]"
                  >
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
                    Sistem otomatis menghasilkan 6 digit kode unik &amp; membatasi kapasitas maksimal
                    10 orang.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
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
                <label
                  htmlFor="join-room-code"
                  className="mb-1.5 block text-center text-xs font-bold text-[#1F2C4F]"
                >
                  Masukkan 6 Karakter Kode Ruangan
                </label>
                <input
                  id="join-room-code"
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={joinCodeInput}
                  onChange={(e) =>
                    setJoinCodeInput(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                        .slice(0, 6)
                    )
                  }
                  placeholder="KODE6X"
                  className="h-14 w-full rounded-xl border-2 border-[#DFE4F1] bg-[#F6F7FC] text-center font-mono text-3xl font-extrabold uppercase tracking-[0.25em] text-[#1D3668] outline-none transition placeholder:text-[#C4C6D0] focus:border-[#BE2257] focus:bg-white focus:ring-4 focus:ring-[#BE2257]/15"
                />
                <p className="mt-2 text-center text-[11px] text-[#56638A]">
                  Format: 6 huruf kapital/angka acak. Setiap ruang berkapasitas maksimal 10 orang.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  className="flex items-center gap-1.5 rounded-[10px] bg-[#BE2257] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#A11B48] disabled:opacity-50"
                >
                  <KeyRound size={15} />
                  <span>{isSubmitting ? 'Memeriksa...' : 'Gabung Sekarang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Hapus Ruangan (Admin) */}
      {groupToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-sm"
          onClick={() => !isSubmitting && setGroupToDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-red-100 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={24} />
            </div>
            <h4 className="mt-4 text-center text-base font-bold text-[#1F2C4F]">
              Hapus Ruang Belajar?
            </h4>
            <p className="mt-2 text-center text-xs leading-relaxed text-[#56638A]">
              Sebagai host, tindakan ini akan menghapus ruangan{' '}
              <strong className="text-[#1F2C4F]">"{groupToDelete.name}"</strong> beserta seluruh
              pesan obrolan secara permanen untuk semua anggota.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setGroupToDelete(null)}
                className="flex-1 rounded-[10px] border border-[#DFE4F1] py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteRoom}
                className="flex-1 rounded-[10px] bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Keluar Ruangan (Member) */}
      {groupToLeave && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-sm"
          onClick={() => !isSubmitting && setGroupToLeave(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#DFE4F1] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-600">
              <LogOut size={24} />
            </div>
            <h4 className="mt-4 text-center text-base font-bold text-[#1F2C4F]">
              Keluar dari Ruang Belajar?
            </h4>
            <p className="mt-2 text-center text-xs leading-relaxed text-[#56638A]">
              Apakah Anda yakin ingin keluar dari ruangan{' '}
              <strong className="text-[#1F2C4F]">"{groupToLeave.name}"</strong>? Anda dapat
              bergabung kembali sewaktu-waktu dengan kode ruangan jika masih ada slot.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setGroupToLeave(null)}
                className="flex-1 rounded-[10px] border border-[#DFE4F1] py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleLeaveRoom}
                className="flex-1 rounded-[10px] bg-[#BE2257] py-2.5 text-xs font-bold text-white transition hover:bg-[#9B1B46] disabled:opacity-50"
              >
                {isSubmitting ? 'Memproses...' : 'Ya, Keluar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
