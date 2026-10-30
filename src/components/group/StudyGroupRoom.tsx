import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  MessageSquareText,
  Paperclip,
  Reply,
  Send,
  Trash2,
  Upload,
  UsersRound,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useGroupStore, type GroupMemberItem } from '../../store/groupStore'

export interface Message {
  id: string
  senderId: string
  senderName: string
  time: string
  kind: 'text' | 'image' | 'document'
  text?: string
  fileName?: string
  fileType?: 'PDF' | 'Word' | 'JPG'
  fileSize?: string
  imageUrl?: string
  imageLabel?: string
  replyTo?: string
  isDeleted?: boolean
}

interface SupabaseChatMessageRow {
  id: string
  group_id: string
  sender_id: string
  reply_to_id: string | null
  kind: 'text' | 'image' | 'document'
  text: string | null
  file_url: string | null
  file_name: string | null
  file_type: 'PDF' | 'Word' | 'JPG' | null
  file_size: string | null
  image_url: string | null
  image_label: string | null
  is_deleted: boolean
  created_at: string
}

function getMemberColor(_name: string, index: number) {
  const colors = [
    'bg-[#1D3668]',
    'bg-[#BE2257]',
    'bg-[#003964]',
    'bg-[#8E1744]',
  ]
  return colors[index % colors.length]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function mapSupabaseRowToMessage(
  row: SupabaseChatMessageRow,
  currentUserId: string | undefined,
  members: GroupMemberItem[]
): Message {
  const isOwn = Boolean(currentUserId && row.sender_id === currentUserId)
  const member = members.find((m) => m.userId === row.sender_id)

  let senderName = 'Rekan Belajar'
  if (isOwn) {
    senderName = 'Anda'
  } else if (member?.name) {
    senderName = member.name.replace(' (Anda)', '').replace(' (Host)', '')
  }

  const time = row.created_at
    ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(row.created_at))
    : new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date())

  return {
    id: row.id,
    senderId: isOwn ? 'current-user' : row.sender_id,
    senderName,
    time,
    kind: row.kind,
    text: row.is_deleted ? 'Pesan ini telah dihapus' : (row.text || undefined),
    fileName: row.file_name || undefined,
    fileType: (row.file_type as 'PDF' | 'Word' | 'JPG') || undefined,
    fileSize: row.file_size || undefined,
    imageUrl: row.image_url || undefined,
    imageLabel: row.image_label || undefined,
    replyTo: row.reply_to_id || undefined,
    isDeleted: Boolean(row.is_deleted),
  }
}

function MessageAttachment({
  message,
  isOwn,
}: {
  message: Message
  isOwn: boolean
}) {
  if (message.kind === 'image') {
    return (
      <div
        className={`mt-2.5 overflow-hidden rounded-xl border p-3 ${
          isOwn
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-[#DFE4F1] bg-white text-[#1F2C4F] shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImageIcon
              size={18}
              className={isOwn ? 'text-[#9CC3FF]' : 'text-[#1D3668]'}
              aria-hidden="true"
            />
            <span className="truncate text-xs font-bold">
              {message.imageLabel || 'Gambar materi (JPG)'}
            </span>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isOwn
                ? 'bg-white/20 text-white'
                : 'bg-[#D6F0DE] text-[#17623A]'
            }`}
          >
            JPG
          </span>
        </div>

        {message.imageUrl ? (
          <div className="mt-2.5 overflow-hidden rounded-lg bg-black/10">
            <img
              src={message.imageUrl}
              alt={message.imageLabel || 'Pratinjau lampiran gambar'}
              className="max-h-60 w-full object-contain rounded-lg"
            />
          </div>
        ) : (
          <div
            className={`mt-2 flex h-24 sm:h-28 items-center justify-center rounded-lg text-xs font-semibold ${
              isOwn ? 'bg-black/20 text-white/90' : 'bg-[#E1EAF8]/60 text-[#1D3668]'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ImageIcon size={16} /> Pratinjau Alur & Diagram Materi (JPG)
            </span>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className={isOwn ? 'text-white/75' : 'text-[#56638A]'}>
            JPG · {message.fileSize || '1.8 MB'} · Lampiran gambar
          </span>
          {message.imageUrl && (
            <a
              href={message.imageUrl}
              download={message.imageLabel || 'gambar_materi.jpg'}
              className={`inline-flex items-center gap-1 font-semibold hover:underline ${
                isOwn ? 'text-white' : 'text-[#1D3668]'
              }`}
            >
              <Download size={13} /> Unduh
            </a>
          )}
        </div>
      </div>
    )
  }

  if (message.kind === 'document') {
    const fileName = message.fileName || 'Tugas_Kelompok.pdf'
    const fileType = message.fileType || 'PDF'
    const isPdf = fileType === 'PDF'

    return (
      <div
        className={`mt-2.5 flex items-center gap-3 rounded-xl border p-3 ${
          isOwn
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-[#DFE4F1] bg-white text-[#1F2C4F] shadow-sm'
        }`}
      >
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
            isPdf ? 'bg-[#FCDDE6] text-[#8E1744]' : 'bg-[#E1EAF8] text-[#1D3668]'
          }`}
        >
          <FileText size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`block truncate text-xs font-bold ${isOwn ? 'text-white' : 'text-[#1F2C4F]'}`}>
              {fileName}
            </span>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.2 text-[9px] font-extrabold ${
                isPdf
                  ? isOwn
                    ? 'bg-rose-400/20 text-rose-200'
                    : 'bg-[#FCDDE6] text-[#8E1744]'
                  : isOwn
                    ? 'bg-blue-400/20 text-blue-200'
                    : 'bg-[#E1EAF8] text-[#1D3668]'
              }`}
            >
              {fileType}
            </span>
          </div>
          <span className={`mt-0.5 block text-[11px] ${isOwn ? 'text-white/75' : 'text-[#56638A]'}`}>
            {fileType} · {message.fileSize || (isPdf ? '2.4 MB' : '1.5 MB')} · Dokumen tugas
          </span>
        </div>
        <button
          type="button"
          aria-label={`Unduh ${fileName}`}
          title={`Unduh ${fileName}`}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
            isOwn
              ? 'text-white/80 hover:bg-white/20 hover:text-white'
              : 'text-[#56638A] hover:bg-[#E1EAF8] hover:text-[#1D3668]'
          }`}
        >
          <Download size={16} aria-hidden="true" />
        </button>
      </div>
    )
  }

  return null
}

type AttachmentType = 'pdf' | 'word' | 'jpg'

export default function StudyGroupRoom() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.user)
  const activeGroup = useGroupStore((state) => state.activeGroup)
  const fetchMyGroups = useGroupStore((state) => state.fetchMyGroups)
  const isGroupsLoading = useGroupStore((state) => state.isLoading)

  const [copiedCode, setCopiedCode] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [chatError, setChatError] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [activeUploadType, setActiveUploadType] = useState<AttachmentType>('pdf')
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const groupName = activeGroup?.name || 'Kelompok Belajar'
  const groupMembers = activeGroup?.members || []
  const joinCode = activeGroup?.joinCode || ''

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Sync groups if user refreshed page
  useEffect(() => {
    if (!activeGroup && currentUser?.id) {
      void fetchMyGroups(currentUser.id)
    }
  }, [activeGroup, currentUser?.id, fetchMyGroups])

  // Fetch chat messages and setup Realtime Subscription
  useEffect(() => {
    if (!activeGroup?.id) {
      return
    }

    const currentGroupId = activeGroup.id
    let isMounted = true

    // 1. Fetch message history
    async function loadChatHistory() {
      setIsLoadingMessages(true)
      setChatError(null)
      try {
        const { data, error } = await supabase
          .from('group_chat_messages')
          .select('*')
          .eq('group_id', currentGroupId)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('SUPABASE ERROR (loadChatHistory):', error)
          if (isMounted) setChatError(error.message)
          return
        }

        if (isMounted && data) {
          const currentMembers = useGroupStore.getState().activeGroup?.members || []
          const mapped = (data as SupabaseChatMessageRow[]).map((row) =>
            mapSupabaseRowToMessage(row, currentUser?.id, currentMembers)
          )
          setMessages(mapped)
        }
      } catch (err) {
        console.error('SUPABASE ERROR (loadChatHistory catch):', err)
        if (isMounted) {
          setChatError(err instanceof Error ? err.message : 'Gagal memuat pesan chat.')
        }
      } finally {
        if (isMounted) setIsLoadingMessages(false)
      }
    }

    void loadChatHistory()

    // 2. Setup Realtime Channel
    const channel = supabase
      .channel(`room-chat:${currentGroupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_chat_messages',
          filter: `group_id=eq.${currentGroupId}`,
        },
        (payload) => {
          const incomingRow = payload.new as SupabaseChatMessageRow
          const currentMembers = useGroupStore.getState().activeGroup?.members || []
          const formattedMsg = mapSupabaseRowToMessage(
            incomingRow,
            currentUser?.id,
            currentMembers
          )
          setMessages((prev) => {
            if (prev.some((m) => m.id === formattedMsg.id)) return prev
            return [...prev, formattedMsg]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_chat_messages',
          filter: `group_id=eq.${activeGroup.id}`,
        },
        (payload) => {
          const updatedRow = payload.new as SupabaseChatMessageRow
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === updatedRow.id) {
                return {
                  ...msg,
                  isDeleted: Boolean(updatedRow.is_deleted),
                  text: updatedRow.is_deleted ? 'Pesan ini telah dihapus' : (updatedRow.text || msg.text),
                }
              }
              return msg
            })
          )
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime channel error on room-chat:', currentGroupId)
        }
      })

    return () => {
      isMounted = false
      void supabase.removeChannel(channel)
    }
  }, [activeGroup?.id, currentUser?.id])

  async function handleCopyCode() {
    if (!joinCode) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(joinCode)
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea')
        textArea.value = joinCode
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
      console.warn('Gagal menyalin kode ke clipboard:', err)
    }
  }

  // Close attachment dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(event.target as Node)
      ) {
        setShowAttachmentMenu(false)
      }
    }

    if (showAttachmentMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAttachmentMenu])

  function triggerNativeUpload(type: AttachmentType) {
    setActiveUploadType(type)
    setShowAttachmentMenu(false)
    if (fileInputRef.current) {
      if (type === 'pdf') {
        fileInputRef.current.accept = '.pdf,application/pdf'
      } else if (type === 'word') {
        fileInputRef.current.accept = '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      } else if (type === 'jpg') {
        fileInputRef.current.accept = '.jpg,.jpeg,.png,image/jpeg,image/png'
      }
      fileInputRef.current.click()
    }
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !activeGroup?.id || !currentUser?.id) return

    const fileName = file.name
    const lowerName = fileName.toLowerCase()
    const sizeStr = formatFileSize(file.size)
    const replyId = replyingTo?.id || null
    const customText = draft.trim()

    let kind: 'text' | 'image' | 'document' = 'document'
    let fileType: 'PDF' | 'Word' | 'JPG' | null = null
    let imageLabel: string | null = null
    let text = customText

    if (lowerName.endsWith('.pdf')) {
      kind = 'document'
      fileType = 'PDF'
      if (!text) text = `Melampirkan dokumen PDF: ${fileName}`
    } else if (lowerName.endsWith('.doc') || lowerName.endsWith('.docx')) {
      kind = 'document'
      fileType = 'Word'
      if (!text) text = `Melampirkan dokumen Word: ${fileName}`
    } else if (
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.png') ||
      file.type.startsWith('image/')
    ) {
      kind = 'image'
      fileType = 'JPG'
      imageLabel = fileName
      if (!text) text = `Melampirkan gambar/foto: ${fileName}`
    } else {
      if (activeUploadType === 'word') {
        kind = 'document'
        fileType = 'Word'
        if (!text) text = `Melampirkan dokumen Word: ${fileName}`
      } else {
        kind = 'document'
        fileType = 'PDF'
        if (!text) text = `Melampirkan dokumen: ${fileName}`
      }
    }

    setDraft('')
    setReplyingTo(null)
    event.target.value = ''

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: activeGroup.id,
          sender_id: currentUser.id,
          reply_to_id: replyId,
          kind,
          file_name: fileName,
          file_type: fileType,
          file_size: sizeStr,
          image_label: imageLabel,
          text,
          is_deleted: false,
        })
        .select('*')
        .single<SupabaseChatMessageRow>()

      if (error) {
        console.error('SUPABASE ERROR (handleFileSelected):', error)
        setChatError(error.message)
      } else if (data) {
        const currentMembers = useGroupStore.getState().activeGroup?.members || []
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, currentMembers)
        setMessages((prev) => (prev.some((m) => m.id === formatted.id) ? prev : [...prev, formatted]))
      }
    } catch (err) {
      console.error('SUPABASE ERROR (handleFileSelected):', err)
    }
  }

  // Preset Template Helpers
  async function sendSamplePdf() {
    setShowAttachmentMenu(false)
    if (!activeGroup?.id || !currentUser?.id) return

    const replyId = replyingTo?.id || null
    const note = draft.trim() || 'Ini draf revisi tugas Bab 3 dalam format PDF. Silakan ditinjau bersama.'
    setDraft('')
    setReplyingTo(null)

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: activeGroup.id,
          sender_id: currentUser.id,
          reply_to_id: replyId,
          kind: 'document',
          file_name: 'Laporan_Bab_3_Metodologi.pdf',
          file_type: 'PDF',
          file_size: '2.8 MB',
          text: note,
          is_deleted: false,
        })
        .select('*')
        .single<SupabaseChatMessageRow>()

      if (error) {
        console.error('SUPABASE ERROR (sendSamplePdf):', error)
        setChatError(error.message)
      } else if (data) {
        const currentMembers = useGroupStore.getState().activeGroup?.members || []
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, currentMembers)
        setMessages((prev) => (prev.some((m) => m.id === formatted.id) ? prev : [...prev, formatted]))
      }
    } catch (err) {
      console.error('SUPABASE ERROR (sendSamplePdf):', err)
    }
  }

  async function sendSampleWord() {
    setShowAttachmentMenu(false)
    if (!activeGroup?.id || !currentUser?.id) return

    const replyId = replyingTo?.id || null
    const note = draft.trim() || 'Draf makalah format Word (.docx) untuk kita edit dan lengkapi bersama.'
    setDraft('')
    setReplyingTo(null)

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: activeGroup.id,
          sender_id: currentUser.id,
          reply_to_id: replyId,
          kind: 'document',
          file_name: 'Draf_Makalah_Inovasi_Kelompok.docx',
          file_type: 'Word',
          file_size: '1.4 MB',
          text: note,
          is_deleted: false,
        })
        .select('*')
        .single<SupabaseChatMessageRow>()

      if (error) {
        console.error('SUPABASE ERROR (sendSampleWord):', error)
        setChatError(error.message)
      } else if (data) {
        const currentMembers = useGroupStore.getState().activeGroup?.members || []
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, currentMembers)
        setMessages((prev) => (prev.some((m) => m.id === formatted.id) ? prev : [...prev, formatted]))
      }
    } catch (err) {
      console.error('SUPABASE ERROR (sendSampleWord):', err)
    }
  }

  async function sendSampleJpg() {
    setShowAttachmentMenu(false)
    if (!activeGroup?.id || !currentUser?.id) return

    const replyId = replyingTo?.id || null
    const note = draft.trim() || 'Bagan alur rancangan antarmuka dan sistem format JPG.'
    setDraft('')
    setReplyingTo(null)

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: activeGroup.id,
          sender_id: currentUser.id,
          reply_to_id: replyId,
          kind: 'image',
          image_label: 'Diagram_Alur_Sistem_SmartFocus.jpg',
          file_size: '1.9 MB',
          text: note,
          is_deleted: false,
        })
        .select('*')
        .single<SupabaseChatMessageRow>()

      if (error) {
        console.error('SUPABASE ERROR (sendSampleJpg):', error)
        setChatError(error.message)
      } else if (data) {
        const currentMembers = useGroupStore.getState().activeGroup?.members || []
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, currentMembers)
        setMessages((prev) => (prev.some((m) => m.id === formatted.id) ? prev : [...prev, formatted]))
      }
    } catch (err) {
      console.error('SUPABASE ERROR (sendSampleJpg):', err)
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !activeGroup?.id || !currentUser?.id) return

    const replyId = replyingTo?.id || null
    setDraft('')
    setReplyingTo(null)

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: activeGroup.id,
          sender_id: currentUser.id,
          reply_to_id: replyId,
          kind: 'text',
          text,
          is_deleted: false,
        })
        .select('*')
        .single<SupabaseChatMessageRow>()

      if (error) {
        console.error('SUPABASE ERROR (sendMessage):', error)
        setChatError(error.message)
      } else if (data) {
        const currentMembers = useGroupStore.getState().activeGroup?.members || []
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, currentMembers)
        setMessages((prev) => {
          if (prev.some((m) => m.id === formatted.id)) return prev
          return [...prev, formatted]
        })
      }
    } catch (err) {
      console.error('SUPABASE ERROR (sendMessage):', err)
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!currentUser?.id) return

    // Optimistic local update
    setMessages((current) =>
      current.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              isDeleted: true,
              text: 'Pesan ini telah dihapus',
            }
          : msg
      )
    )
    if (replyingTo?.id === messageId) {
      setReplyingTo(null)
    }

    try {
      const { error } = await supabase
        .from('group_chat_messages')
        .update({ is_deleted: true })
        .eq('id', messageId)
        .eq('sender_id', currentUser.id)

      if (error) {
        console.error('SUPABASE ERROR (handleDeleteMessage):', error)
        setChatError(error.message)
      }
    } catch (err) {
      console.error('SUPABASE ERROR (handleDeleteMessage):', err)
    }
  }

  if (isGroupsLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-[#DFE4F1] bg-white p-8">
        <Loader2 size={32} className="animate-spin text-[#BE2257]" />
        <p className="mt-3 text-sm font-bold text-[#1F2C4F]">Memuat ruang belajar...</p>
      </div>
    )
  }

  if (!activeGroup) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-[#DFE4F1] bg-white p-8 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03)]">
        <UsersRound size={44} className="text-[#56638A]/50" />
        <h2 className="mt-3 text-lg font-bold text-[#1F2C4F]">Tidak Ada Ruang Belajar Aktif</h2>
        <p className="mt-1 text-xs text-[#56638A]">
          Silakan buat atau pilih ruang belajar terlebih dahulu di halaman Co-Focus.
        </p>
        <button
          type="button"
          onClick={() => navigate('/cofocus')}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1D3668] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#162B54]"
        >
          <ArrowLeft size={15} />
          Kembali ke Co-Focus
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Hidden Native File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        className="hidden"
        aria-hidden="true"
      />

      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/cofocus')}
          className="inline-flex items-center gap-2 rounded-lg py-1 text-sm font-bold text-[#56638A] transition hover:text-[#1D3668]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Kembali ke Co-Focus</span>
        </button>
        <span className="rounded-full bg-[#E1EAF8] px-3 py-1 text-[11px] font-bold text-[#1D3668]">
          Ruang Belajar Aktif
        </span>
      </div>

      {chatError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{chatError}</span>
          <button
            type="button"
            onClick={() => setChatError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Hero Header Card */}
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
              <UsersRound size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
                Forum Grup Belajar Bersama
              </p>
              <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">
                {groupName}
              </h1>
              <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">
                Diskusikan materi, pertukaran berkas tugas (PDF, Word, JPG), dan pantau ritme belajar kelompok secara terkoordinasi.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {joinCode && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DFE4F1] bg-[#F6F7FC] px-3 py-1 font-mono text-xs font-bold text-[#1D3668]">
                <span>Kode: {joinCode}</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Salin Kode Ruang Belajar"
                  className="text-[#56638A] hover:text-[#1D3668]"
                >
                  {copiedCode ? <Check size={13} className="text-[#17623A]" /> : <Copy size={13} />}
                </button>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D6F0DE] px-3 py-1.5 text-xs font-bold text-[#17623A]">
              <span className="h-2 w-2 rounded-full bg-[#17623A] animate-pulse" />
              {groupMembers.length} / {activeGroup.maxMembers || 6} Anggota
            </span>
          </div>
        </div>
      </section>

      {/* Main Bento Grid */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* Left Column: Sidebar (Members & Guidelines) */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Members List Card */}
          <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
            <div className="mb-4 flex items-center justify-between border-b border-[#DFE4F1] pb-3">
              <h2 className="text-base font-bold text-[#1F2C4F] flex items-center gap-2">
                <UsersRound size={18} className="text-[#1D3668]" aria-hidden="true" />
                Anggota Kelompok
              </h2>
              <span className="rounded-full bg-[#E1EAF8] px-2.5 py-0.5 text-[11px] font-semibold text-[#1D3668]">
                {groupMembers.length} / {activeGroup.maxMembers || 6}
              </span>
            </div>

            {groupMembers.length === 0 ? (
              <p className="text-center py-4 text-xs text-[#56638A]">Belum ada anggota terdaftar</p>
            ) : (
              <ul className="space-y-2.5">
                {groupMembers.map((member, index) => {
                  const isFocus = member.status === 'fokus'
                  return (
                    <li
                      key={member.id}
                      className="flex items-center gap-3 rounded-xl bg-[#F6F7FC] p-3 transition hover:bg-[#EEF2FA]"
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white ${getMemberColor(member.name, index)}`}
                      >
                        {member.avatar}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#1F2C4F]">
                          {member.name}
                          {member.isHost && (
                            <span className="ml-1.5 rounded-full bg-[#E1EAF8] px-1.5 py-0.2 text-[9px] font-bold text-[#1D3668]">
                              Host
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-[#56638A]">{member.course}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          isFocus ? 'bg-[#FCDDE6] text-[#8E1744]' : 'bg-[#FDEBC8] text-[#7A4B00]'
                        }`}
                      >
                        {isFocus ? 'Sedang Fokus' : 'Istirahat'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Guidelines / Tips Card */}
          <section className="rounded-2xl border border-[#5E3F0C]/10 bg-[#FBEFD9] p-5 text-[#5E3F0C] shadow-[0_2px_6px_rgba(94,63,12,0.05)]">
            <div className="flex items-center gap-2">
              <Lightbulb size={19} aria-hidden="true" />
              <h3 className="text-sm font-bold leading-5">Format Berkas yang Didukung</h3>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-[18px] text-[#5E3F0C]/90">
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span><strong>Dokumen PDF (.pdf):</strong> Ideal untuk laporan final, e-book, atau proposal.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span><strong>Dokumen Word (.docx):</strong> Untuk draf makalah yang butuh revisi bersama.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span><strong>Gambar JPG (.jpg / .jpeg):</strong> Untuk tangkapan layar, bagan alur, dan diagram.</span>
              </li>
            </ul>
          </section>
        </aside>

        {/* Right Column: Forum Chat & Discussion Feed */}
        <section className="lg:col-span-8 flex flex-col h-[650px] sm:h-[680px] rounded-2xl border border-[#DFE4F1] bg-white p-4 sm:p-6 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
          {/* Forum Header */}
          <div className="flex items-center justify-between border-b border-[#DFE4F1] pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
                <MessageSquareText size={20} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-[#1F2C4F]">Obrolan & Diskusi Materi</h2>
                <p className="text-xs text-[#56638A]">{groupName} · Kirim pesan & berkas (PDF, Word, JPG)</p>
              </div>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAttachmentMenu((prev) => !prev)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#DFE4F1] bg-[#F6F7FC] px-3 py-1.5 text-xs font-bold text-[#1D3668] transition hover:bg-[#E1EAF8]"
                title="Pilih jenis berkas yang ingin dilampirkan"
              >
                <Paperclip size={14} aria-hidden="true" />
                + Lampirkan Berkas
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1" aria-live="polite">
            <div className="flex justify-center my-2">
              <span className="rounded-full border border-[#DFE4F1] bg-[#F6F7FC] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#757780]">
                Ruang Diskusi Realtime
              </span>
            </div>

            {isLoadingMessages && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 size={26} className="animate-spin text-[#BE2257]" />
                <p className="mt-2.5 text-xs font-semibold text-[#56638A]">Memuat pesan percakapan...</p>
              </div>
            )}

            {!isLoadingMessages && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#E1EAF8] text-[#1D3668]">
                  <MessageSquareText size={26} aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-bold text-[#1F2C4F]">Belum ada pesan di ruang belajar ini</p>
                <p className="mt-1 max-w-sm text-xs text-[#56638A]">
                  Mulai percakapan dengan mengirimkan sapaan atau bagikan berkas tugas (PDF, Word, JPG) bersama anggota kelompok.
                </p>
              </div>
            )}

            {messages.map((message) => {
              const isOwn = message.senderId === 'current-user'
              const repliedMessage = message.replyTo
                ? messages.find((m) => m.id === message.replyTo)
                : undefined

              return (
                <article
                  key={message.id}
                  className={`group flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[88%] sm:max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`mb-1 flex items-center gap-1.5 text-xs ${
                        isOwn ? 'justify-end text-[#757780]' : 'text-[#56638A]'
                      }`}
                    >
                      <span className="font-semibold">{message.senderName}</span>
                      <span aria-hidden="true">·</span>
                      <time>{message.time}</time>
                    </div>

                    <div className={`flex items-center gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div
                        className={`rounded-2xl p-4 shadow-sm ${
                          isOwn
                            ? 'rounded-tr-none bg-[#1D3668] text-white'
                            : 'rounded-tl-none border border-[#DFE4F1] bg-[#F6F7FC] text-[#1F2C4F]'
                        }`}
                      >
                        {/* Kutipan Pesan yang Dibalas (Reply Quote) */}
                        {repliedMessage && !message.isDeleted && (
                          <div
                            className={`mb-2.5 rounded-lg border-l-4 px-3 py-2 text-xs ${
                              isOwn
                                ? 'border-[#BE2257] bg-white/10 text-white/90'
                                : 'border-[#1D3668] bg-white text-[#56638A]'
                            }`}
                          >
                            <p className={`font-bold ${isOwn ? 'text-[#9CC3FF]' : 'text-[#1D3668]'}`}>
                              {repliedMessage.senderName}
                            </p>
                            <p className={`mt-0.5 line-clamp-2 ${repliedMessage.isDeleted ? 'italic opacity-75' : ''}`}>
                              {repliedMessage.isDeleted
                                ? 'Pesan ini telah dihapus'
                                : repliedMessage.text || repliedMessage.fileName || repliedMessage.imageLabel || 'Lampiran berkas'}
                            </p>
                          </div>
                        )}

                        {message.isDeleted ? (
                          <p className={`text-sm italic leading-relaxed ${isOwn ? 'text-white/75' : 'text-[#757780]'}`}>
                            Pesan ini telah dihapus
                          </p>
                        ) : (
                          <>
                            {message.text && (
                              <p className={`text-sm leading-relaxed ${isOwn ? 'text-white' : 'text-[#1F2C4F]'}`}>
                                {message.text}
                              </p>
                            )}
                            <MessageAttachment message={message} isOwn={isOwn} />
                          </>
                        )}
                      </div>

                      {/* Tombol Aksi Hover (Reply & Delete) */}
                      {!message.isDeleted && (
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={() => setReplyingTo(message)}
                            aria-label={`Balas pesan ${message.senderName}`}
                            title="Balas pesan"
                            className="grid h-8 w-8 place-items-center rounded-lg border border-[#DFE4F1] bg-white text-[#56638A] shadow-2xs transition hover:border-[#1D3668]/30 hover:bg-[#E1EAF8] hover:text-[#1D3668]"
                          >
                            <Reply size={14} aria-hidden="true" />
                          </button>
                          {isOwn && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(message.id)}
                              aria-label="Hapus pesan"
                              title="Hapus pesan"
                              className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-white text-red-600 shadow-2xs transition hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachment Selector Dropdown Modal / Popover */}
          <div className="relative">
            {showAttachmentMenu && (
              <div
                ref={attachmentMenuRef}
                className="absolute bottom-3 left-0 z-20 w-80 sm:w-96 rounded-2xl border border-[#DFE4F1] bg-white p-4 shadow-[0_8px_24px_rgba(29,54,104,0.12)] animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="mb-3 flex items-center justify-between border-b border-[#DFE4F1] pb-2.5">
                  <span className="text-xs font-bold text-[#1F2C4F] flex items-center gap-1.5">
                    <Paperclip size={14} className="text-[#1D3668]" />
                    Pilih Format Berkas
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAttachmentMenu(false)}
                    className="grid h-6 w-6 place-items-center rounded-full text-[#757780] hover:bg-[#F6F7FC]"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {/* Option 1: PDF Document */}
                  <div className="rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-3 transition hover:border-[#FCDDE6] hover:bg-[#FFF5F8]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FCDDE6] text-[#8E1744]">
                          <FileText size={18} />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-[#1F2C4F]">Dokumen PDF (.pdf)</p>
                          <p className="text-[10px] text-[#56638A]">Laporan final, proposal, e-book</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => triggerNativeUpload('pdf')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1D3668] py-1.5 px-2.5 text-[11px] font-bold text-white transition hover:bg-[#162B54]"
                      >
                        <Upload size={12} /> Unggah PDF
                      </button>
                      <button
                        type="button"
                        onClick={sendSamplePdf}
                        className="rounded-lg border border-[#DFE4F1] bg-white py-1.5 px-2.5 text-[11px] font-semibold text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#1D3668]"
                      >
                        Contoh PDF
                      </button>
                    </div>
                  </div>

                  {/* Option 2: Word Document */}
                  <div className="rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-3 transition hover:border-[#C5D5F0] hover:bg-[#F3F6FD]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E1EAF8] text-[#1D3668]">
                          <FileText size={18} />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-[#1F2C4F]">Dokumen Word (.docx / .doc)</p>
                          <p className="text-[10px] text-[#56638A]">Draf makalah, catatan revisi</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => triggerNativeUpload('word')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1D3668] py-1.5 px-2.5 text-[11px] font-bold text-white transition hover:bg-[#162B54]"
                      >
                        <Upload size={12} /> Unggah Word
                      </button>
                      <button
                        type="button"
                        onClick={sendSampleWord}
                        className="rounded-lg border border-[#DFE4F1] bg-white py-1.5 px-2.5 text-[11px] font-semibold text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#1D3668]"
                      >
                        Contoh Word
                      </button>
                    </div>
                  </div>

                  {/* Option 3: JPG Image */}
                  <div className="rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-3 transition hover:border-[#D6F0DE] hover:bg-[#F5FBF7]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#D6F0DE] text-[#17623A]">
                          <ImageIcon size={18} />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-[#1F2C4F]">Gambar / Foto JPG (.jpg / .jpeg)</p>
                          <p className="text-[10px] text-[#56638A]">Bagan alur, diagram, tangkapan layar</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => triggerNativeUpload('jpg')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1D3668] py-1.5 px-2.5 text-[11px] font-bold text-white transition hover:bg-[#162B54]"
                      >
                        <Upload size={12} /> Unggah JPG
                      </button>
                      <button
                        type="button"
                        onClick={sendSampleJpg}
                        className="rounded-lg border border-[#DFE4F1] bg-white py-1.5 px-2.5 text-[11px] font-semibold text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#1D3668]"
                      >
                        Contoh JPG
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Banner Membalas Pesan */}
          {replyingTo && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#DFE4F1] bg-[#E1EAF8]/60 px-3.5 py-2 text-xs text-[#1F2C4F]">
              <div className="flex min-w-0 items-center gap-2">
                <Reply size={14} className="shrink-0 text-[#1D3668]" aria-hidden="true" />
                <span className="truncate font-semibold text-[#1D3668]">
                  Membalas:{' '}
                  <span className="font-normal text-[#1F2C4F]">
                    {replyingTo.text || replyingTo.fileName || replyingTo.imageLabel || 'Lampiran berkas'}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                aria-label="Batal membalas pesan"
                title="Batal membalas"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#56638A] transition hover:bg-white hover:text-[#BE2257]"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Form Input Bar */}
          <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-[#DFE4F1] pt-3.5">
            <button
              type="button"
              onClick={() => setShowAttachmentMenu((prev) => !prev)}
              aria-label="Pilih lampiran berkas (PDF, Word, JPG)"
              title="Pilih lampiran berkas (PDF, Word, JPG)"
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border transition focus:outline-none focus:ring-2 focus:ring-[#1D3668] ${
                showAttachmentMenu
                  ? 'border-[#1D3668] bg-[#E1EAF8] text-[#1D3668]'
                  : 'border-[#DFE4F1] bg-[#F6F7FC] text-[#56638A] hover:bg-[#E1EAF8] hover:text-[#1D3668]'
              }`}
            >
              <Paperclip size={18} aria-hidden="true" />
            </button>

            {/* Quick JPG Button */}
            <button
              type="button"
              onClick={() => triggerNativeUpload('jpg')}
              aria-label="Unggah gambar JPG"
              title="Unggah gambar JPG langsung dari perangkat"
              className="hidden sm:grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] text-[#56638A] transition hover:bg-[#E1EAF8] hover:text-[#1D3668] focus:outline-none focus:ring-2 focus:ring-[#1D3668]"
            >
              <ImageIcon size={18} aria-hidden="true" />
            </button>

            <label className="sr-only" htmlFor="group-chat-input">
              Tulis pesan untuk kelompok belajar
            </label>
            <input
              id="group-chat-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Tulis pesan atau pertanyaan untuk kelompok belajar..."
              className="h-11 min-w-0 flex-1 rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] px-4 text-sm text-[#1F2C4F] placeholder:text-[#757780] outline-none transition focus:bg-white focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]/20"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Kirim pesan"
              className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-4 sm:px-5 text-sm font-bold text-white transition hover:bg-[#162B54] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2"
            >
              <span className="hidden sm:inline">Kirim</span>
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
