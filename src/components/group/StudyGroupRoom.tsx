import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCheck,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  LogOut,
  MessageSquareText,
  Paperclip,
  PlusCircle,
  Reply,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  UserMinus,
  UsersRound,
  X,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import {
  useGroupStore,
  type GroupMemberItem,
  type StudyGroupItem,
} from '../../store/groupStore'

export interface Message {
  id: string
  senderId: string
  senderName: string
  senderAvatar?: string
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
  members: GroupMemberItem[],
  profileCache?: Map<string, { name: string; avatar: string }>
): Message {
  const isOwn = Boolean(currentUserId && row.sender_id === currentUserId)
  const member = members.find((m) => m.userId === row.sender_id)
  const cachedProfile = profileCache?.get(row.sender_id)

  let senderName = 'Rekan Belajar'
  let senderAvatar = 'RB'

  if (isOwn) {
    senderName = 'Anda'
    senderAvatar = cachedProfile?.avatar || 'Anda'.slice(0, 2).toUpperCase()
  } else if (member?.name) {
    senderName = member.name.replace(' (Anda)', '').replace(' (Host)', '')
    senderAvatar = member.avatar
  } else if (cachedProfile?.name) {
    senderName = cachedProfile.name
    senderAvatar = cachedProfile.avatar
  }

  const time = row.created_at
    ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(row.created_at))
    : new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date())

  return {
    id: row.id,
    senderId: isOwn ? 'current-user' : row.sender_id,
    senderName,
    senderAvatar,
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
        className={`mt-2 overflow-hidden rounded-xl border p-2.5 ${
          isOwn
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-[#DFE4F1] bg-white text-[#1F2C4F] shadow-2xs'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <ImageIcon
              size={16}
              className={isOwn ? 'text-[#9CC3FF]' : 'text-[#1D3668]'}
              aria-hidden="true"
            />
            <span className="truncate text-xs font-bold">
              {message.imageLabel || 'Gambar materi (JPG)'}
            </span>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
              isOwn
                ? 'bg-white/20 text-white'
                : 'bg-[#D6F0DE] text-[#17623A]'
            }`}
          >
            JPG
          </span>
        </div>

        {message.imageUrl ? (
          <div className="mt-2 overflow-hidden rounded-lg bg-black/10">
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
              <ImageIcon size={15} /> Pratinjau Alur & Diagram Materi (JPG)
            </span>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className={isOwn ? 'text-white/75' : 'text-[#56638A]'}>
            JPG · {message.fileSize || '1.8 MB'}
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
        className={`mt-2 flex items-center gap-3 rounded-xl border p-2.5 ${
          isOwn
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-[#DFE4F1] bg-white text-[#1F2C4F] shadow-2xs'
        }`}
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
            isPdf ? 'bg-[#FCDDE6] text-[#8E1744]' : 'bg-[#E1EAF8] text-[#1D3668]'
          }`}
        >
          <FileText size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
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
            {fileType} · {message.fileSize || (isPdf ? '2.4 MB' : '1.5 MB')}
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
          <Download size={15} aria-hidden="true" />
        </button>
      </div>
    )
  }

  return null
}

const EMPTY_MEMBERS: GroupMemberItem[] = []

type AttachmentType = 'pdf' | 'word' | 'jpg'

export default function StudyGroupRoom() {
  const navigate = useNavigate()
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()

  const currentUser = useAuthStore((state) => state.user)
  const activeGroup = useGroupStore((state) => state.activeGroup)
  const activeGroupId = useGroupStore((state) => state.activeGroupId)
  const groups = useGroupStore((state) => state.groups)
  const fetchMyGroups = useGroupStore((state) => state.fetchMyGroups)
  const setActiveGroup = useGroupStore((state) => state.setActiveGroup)
  const kickMember = useGroupStore((state) => state.kickMember)
  const deleteGroup = useGroupStore((state) => state.deleteGroup)
  const leaveGroup = useGroupStore((state) => state.leaveGroup)
  const isGroupsLoading = useGroupStore((state) => state.isLoading)

  // Target group ID from route or store
  const targetGroupId = routeGroupId || activeGroupId || activeGroup?.id || ''

  // Standalone group data fallback (for direct URL access or refresh)
  const [standaloneGroup, setStandaloneGroup] = useState<StudyGroupItem | null>(null)
  const [showMembersDrawer, setShowMembersDrawer] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [chatError, setChatError] = useState<string | null>(null)

  // Confirmation Modals State
  const [confirmKickTarget, setConfirmKickTarget] = useState<GroupMemberItem | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [isProcessingAction, setIsProcessingAction] = useState(false)

  const [draft, setDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [activeUploadType, setActiveUploadType] = useState<AttachmentType>('pdf')
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const profilesCacheRef = useRef<Map<string, { name: string; avatar: string }>>(new Map())

  // Resolve current group item
  const currentGroup =
    (activeGroup?.id === targetGroupId ? activeGroup : null) ||
    standaloneGroup ||
    groups.find((g) => g.id === targetGroupId) ||
    activeGroup

  const groupName = currentGroup?.name || 'Ruang Belajar Co-Focus'
  const groupMembers = currentGroup?.members ?? EMPTY_MEMBERS
  const groupMembersRef = useRef<GroupMemberItem[]>(EMPTY_MEMBERS)
  useEffect(() => {
    groupMembersRef.current = groupMembers
  }, [groupMembers])
  const joinCode = currentGroup?.joinCode || ''
  const maxMembers = currentGroup?.maxMembers && currentGroup.maxMembers >= 10 ? currentGroup.maxMembers : 10
  const remainingSlots = Math.max(0, maxMembers - groupMembers.length)

  // Check if current user is the host/creator of this room
  const isHost = Boolean(
    (currentUser?.id && currentGroup?.hostId === currentUser.id) ||
    groupMembers.some((m) => m.userId === currentUser?.id && m.isHost)
  )

  // Auto-scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Synchronize active group with targetGroupId
  useEffect(() => {
    if (!targetGroupId) return

    // If active group already matches, nothing to do
    if (activeGroup?.id === targetGroupId) return

    // Try finding in loaded groups
    const found = groups.find((g) => g.id === targetGroupId)
    if (found) {
      setActiveGroup(targetGroupId)
      return
    }

    // Otherwise, fetch groups from Supabase
    if (currentUser?.id) {
      void fetchMyGroups(currentUser.id)
    }

    // Direct query fallback for instant header rendering
    let isMounted = true
    async function loadGroupDirectly() {
      try {
        const { data: gData } = await supabase
          .from('study_groups')
          .select('*')
          .eq('id', targetGroupId)
          .maybeSingle()

        if (!gData || !isMounted) return

        const { data: mData } = await supabase
          .from('study_group_members')
          .select('*')
          .eq('group_id', targetGroupId)

        const memberUserIds = (mData || []).map((m: { user_id: string }) => m.user_id)
        let profileMap = new Map<string, { name: string; major?: string }>()

        if (memberUserIds.length > 0) {
          const { data: pData } = await supabase
            .from('profiles')
            .select('id, name, major')
            .in('id', memberUserIds)
          if (pData) {
            profileMap = new Map(pData.map((p) => [p.id, p]))
          }
        }

        const mappedMembers: GroupMemberItem[] = (mData || []).map((m: {
          id: string
          user_id: string
          role: string
          status: string
          course: string | null
        }) => {
          const prof = profileMap.get(m.user_id)
          const isCurrentUser = m.user_id === currentUser?.id
          const name = prof?.name || (isCurrentUser ? currentUser?.name || 'Anda' : 'Mahasiswa')
          const initials =
            name
              .split(' ')
              .map((w: string) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase() || 'M'

          return {
            id: m.id,
            userId: m.user_id,
            name: isCurrentUser ? `${name} (Anda)` : name,
            avatar: initials,
            status: m.status === 'istirahat' ? 'istirahat' : 'fokus',
            course: m.course || prof?.major || 'Mahasiswa',
            isHost: m.role === 'owner',
          }
        })

        if (isMounted) {
          const effectiveMax = gData.max_members && gData.max_members >= 10 ? gData.max_members : 10
          if (gData.max_members && gData.max_members < 10) {
            void supabase.from('study_groups').update({ max_members: 10 }).eq('id', gData.id)
          }

          setStandaloneGroup({
            id: gData.id,
            name: gData.name,
            description: gData.description || '',
            joinCode: gData.join_code,
            maxMembers: effectiveMax,
            hostId: gData.host_id,
            members: mappedMembers,
            createdAt: gData.created_at,
          })
        }
      } catch (err) {
        console.warn('Gagal memuat grup langsung:', err)
      }
    }

    void loadGroupDirectly()
    return () => {
      isMounted = false
    }
  }, [targetGroupId, activeGroup?.id, groups, currentUser?.id, currentUser?.name, fetchMyGroups, setActiveGroup])

  // Realtime Supabase Channel Subscription & History Fetch
  useEffect(() => {
    if (!targetGroupId) return

    let isMounted = true

    // 1. Fetch Chat History
    async function loadChatHistory() {
      setIsLoadingMessages(true)
      setChatError(null)
      try {
        const { data, error } = await supabase
          .from('group_chat_messages')
          .select('*')
          .eq('group_id', targetGroupId)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('SUPABASE ERROR (loadChatHistory):', error)
          if (isMounted) setChatError(error.message)
          return
        }

        if (isMounted && data) {
          const rawRows = data as SupabaseChatMessageRow[]

          // Cache current user profile
          if (currentUser?.id) {
            const myInitials = currentUser.name
              ? currentUser.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              : 'A'
            profilesCacheRef.current.set(currentUser.id, {
              name: currentUser.name || 'Anda',
              avatar: myInitials,
            })
          }

          // Cache known group members
          for (const m of groupMembersRef.current) {
            if (m.userId && !profilesCacheRef.current.has(m.userId)) {
              profilesCacheRef.current.set(m.userId, {
                name: m.name.replace(' (Anda)', '').replace(' (Host)', ''),
                avatar: m.avatar,
              })
            }
          }

          // Fetch any remaining sender profiles
          const uncachedIds = Array.from(new Set(rawRows.map((r) => r.sender_id))).filter(
            (id) => id && !profilesCacheRef.current.has(id)
          )

          if (uncachedIds.length > 0) {
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('id, name')
              .in('id', uncachedIds)

            if (profilesData) {
              for (const p of profilesData) {
                const initials = p.name
                  ? p.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                  : 'RB'
                profilesCacheRef.current.set(p.id, {
                  name: p.name || 'Rekan Belajar',
                  avatar: initials,
                })
              }
            }
          }

          const mapped = rawRows.map((row) =>
            mapSupabaseRowToMessage(row, currentUser?.id, groupMembersRef.current, profilesCacheRef.current)
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

    // 2. Setup Supabase Realtime Subscription for group chat messages
    const chatChannelName = `room-chat:${targetGroupId}`
    const chatChannel = supabase
      .channel(chatChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_chat_messages',
          filter: `group_id=eq.${targetGroupId}`,
        },
        async (payload) => {
          const incomingRow = payload.new as SupabaseChatMessageRow
          if (!incomingRow || !incomingRow.id) return

          let senderName = 'Rekan Belajar'
          let senderAvatar = 'RB'

          // Immediately query sender profile if missing
          if (currentUser?.id && incomingRow.sender_id === currentUser.id) {
            senderName = 'Anda'
            senderAvatar = currentUser.name
              ? currentUser.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              : 'A'
          } else if (profilesCacheRef.current.has(incomingRow.sender_id)) {
            const cached = profilesCacheRef.current.get(incomingRow.sender_id)!
            senderName = cached.name
            senderAvatar = cached.avatar
          } else if (incomingRow.sender_id) {
            try {
              const { data: p } = await supabase
                .from('profiles')
                .select('id, name')
                .eq('id', incomingRow.sender_id)
                .maybeSingle()

              if (p?.name) {
                senderName = p.name
                senderAvatar =
                  p.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || 'RB'
                profilesCacheRef.current.set(p.id, { name: senderName, avatar: senderAvatar })
              }
            } catch (err) {
              console.warn('Gagal memuat profil pengirim realtime:', err)
            }
          }

          const isOwn = Boolean(currentUser?.id && incomingRow.sender_id === currentUser.id)
          const time = incomingRow.created_at
            ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(incomingRow.created_at))
            : new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date())

          const newMessageWithProfile: Message = {
            id: incomingRow.id,
            senderId: isOwn ? 'current-user' : incomingRow.sender_id,
            senderName,
            senderAvatar,
            time,
            kind: incomingRow.kind,
            text: incomingRow.is_deleted ? 'Pesan ini telah dihapus' : (incomingRow.text || undefined),
            fileName: incomingRow.file_name || undefined,
            fileType: (incomingRow.file_type as 'PDF' | 'Word' | 'JPG') || undefined,
            fileSize: incomingRow.file_size || undefined,
            imageUrl: incomingRow.image_url || undefined,
            imageLabel: incomingRow.image_label || undefined,
            replyTo: incomingRow.reply_to_id || undefined,
            isDeleted: Boolean(incomingRow.is_deleted),
          }

          // Immutable functional update
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessageWithProfile.id)) {
              return prev.map((m) => (m.id === newMessageWithProfile.id ? newMessageWithProfile : m))
            }
            return [...prev, newMessageWithProfile]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_chat_messages',
          filter: `group_id=eq.${targetGroupId}`,
        },
        (payload) => {
          const updatedRow = payload.new as SupabaseChatMessageRow
          if (!updatedRow?.id) return

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
          console.warn('Realtime channel error pada room-chat:', targetGroupId)
        }
      })

    // 3. Realtime Subscription for member changes & kick
    const membersChannelName = `room-members:${targetGroupId}`
    const membersChannel = supabase
      .channel(membersChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'study_group_members',
          filter: `group_id=eq.${targetGroupId}`,
        },
        (payload) => {
          // If current user was removed/kicked, redirect to cofocus
          if (
            payload.eventType === 'DELETE' &&
            payload.old &&
            (payload.old as { user_id?: string }).user_id === currentUser?.id
          ) {
            navigate('/cofocus')
            return
          }
          if (currentUser?.id) {
            void fetchMyGroups(currentUser.id)
          }
        }
      )
      .subscribe()

    // 4. Realtime Subscription for room deletion by host
    const groupChannelName = `room-group:${targetGroupId}`
    const groupChannel = supabase
      .channel(groupChannelName)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'study_groups',
          filter: `id=eq.${targetGroupId}`,
        },
        () => {
          navigate('/cofocus')
        }
      )
      .subscribe()

    // Cleanup: remove channels to prevent memory leaks and duplicate connections
    return () => {
      isMounted = false
      void supabase.removeChannel(chatChannel)
      void supabase.removeChannel(membersChannel)
      void supabase.removeChannel(groupChannel)
    }
  }, [targetGroupId, currentUser?.id, currentUser?.name, fetchMyGroups, navigate])

  // Copy join code helper
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

  // Admin Kick Member
  async function handleConfirmKick() {
    if (!confirmKickTarget?.userId || !targetGroupId) return
    setIsProcessingAction(true)
    try {
      const res = await kickMember(targetGroupId, confirmKickTarget.userId)
      if (!res.success) {
        setChatError(res.error || 'Gagal mengeluarkan anggota.')
      } else {
        setConfirmKickTarget(null)
        if (currentUser?.id) {
          void fetchMyGroups(currentUser.id)
        }
      }
    } catch (err) {
      console.error(err)
      setChatError('Terjadi kesalahan saat mengeluarkan anggota.')
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Admin Delete Room
  async function handleConfirmDelete() {
    if (!targetGroupId) return
    setIsProcessingAction(true)
    try {
      const res = await deleteGroup(targetGroupId)
      if (!res.success) {
        setChatError(res.error || 'Gagal menghapus ruang belajar.')
      } else {
        setShowDeleteConfirm(false)
        navigate('/cofocus')
      }
    } catch (err) {
      console.error(err)
      setChatError('Terjadi kesalahan saat menghapus ruang belajar.')
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Member Leave Room
  async function handleConfirmLeave() {
    if (!targetGroupId) return
    setIsProcessingAction(true)
    try {
      const res = await leaveGroup(targetGroupId)
      if (!res.success) {
        setChatError(res.error || 'Gagal keluar dari ruang belajar.')
      } else {
        setShowLeaveConfirm(false)
        navigate('/cofocus')
      }
    } catch (err) {
      console.error(err)
      setChatError('Terjadi kesalahan saat keluar dari ruang belajar.')
    } finally {
      setIsProcessingAction(false)
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
    if (!file || !targetGroupId || !currentUser?.id) return

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
          group_id: targetGroupId,
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
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, groupMembers, profilesCacheRef.current)
        setMessages((prev) => (prev.some((m) => m.id === formatted.id) ? prev : [...prev, formatted]))
      }
    } catch (err) {
      console.error('SUPABASE ERROR (handleFileSelected):', err)
    }
  }

  // Sample attachment generators for instant test
  async function sendSamplePdf() {
    setShowAttachmentMenu(false)
    if (!targetGroupId || !currentUser?.id) return

    const replyId = replyingTo?.id || null
    const note = draft.trim() || 'Ini draf revisi tugas Bab 3 dalam format PDF. Silakan ditinjau bersama.'
    setDraft('')
    setReplyingTo(null)

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: targetGroupId,
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
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, groupMembers, profilesCacheRef.current)
        setMessages((prev) => (prev.some((m) => m.id === formatted.id) ? prev : [...prev, formatted]))
      }
    } catch (err) {
      console.error('SUPABASE ERROR (sendSamplePdf):', err)
    }
  }

  async function sendSampleWord() {
    setShowAttachmentMenu(false)
    if (!targetGroupId || !currentUser?.id) return

    const replyId = replyingTo?.id || null
    const note = draft.trim() || 'Draf makalah format Word (.docx) untuk kita edit dan lengkapi bersama.'
    setDraft('')
    setReplyingTo(null)

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: targetGroupId,
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
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, groupMembers, profilesCacheRef.current)
        setMessages((prev) => (prev.some((m) => m.id === formatted.id) ? prev : [...prev, formatted]))
      }
    } catch (err) {
      console.error('SUPABASE ERROR (sendSampleWord):', err)
    }
  }

  async function sendSampleJpg() {
    setShowAttachmentMenu(false)
    if (!targetGroupId || !currentUser?.id) return

    const replyId = replyingTo?.id || null
    const note = draft.trim() || 'Bagan alur rancangan antarmuka dan sistem format JPG.'
    setDraft('')
    setReplyingTo(null)

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: targetGroupId,
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
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, groupMembers, profilesCacheRef.current)
        setMessages((prev) => (prev.some((m) => m.id === formatted.id) ? prev : [...prev, formatted]))
      }
    } catch (err) {
      console.error('SUPABASE ERROR (sendSampleJpg):', err)
    }
  }

  // Send normal text message
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !targetGroupId || !currentUser?.id) return

    const replyId = replyingTo?.id || null
    setDraft('')
    setReplyingTo(null)

    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_id: targetGroupId,
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
        const formatted = mapSupabaseRowToMessage(data, currentUser.id, groupMembers, profilesCacheRef.current)
        setMessages((prev) => {
          if (prev.some((m) => m.id === formatted.id)) return prev
          return [...prev, formatted]
        })
      }
    } catch (err) {
      console.error('SUPABASE ERROR (sendMessage):', err)
    }
  }

  // Soft delete message
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

  if (isGroupsLoading && !currentGroup) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#F3F4FA] p-6 text-center font-[Montserrat]">
        <Loader2 size={36} className="animate-spin text-[#BE2257]" />
        <p className="mt-4 text-sm font-bold text-[#1F2C4F]">Memuat ruang obrolan...</p>
        <p className="mt-1 text-xs text-[#56638A]">Menghubungkan ke server realtime</p>
      </div>
    )
  }

  if (!targetGroupId) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#F3F4FA] p-6 text-center font-[Montserrat]">
        <div className="flex flex-col items-center max-w-sm rounded-2xl border border-[#DFE4F1] bg-white p-7 shadow-sm">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#E1EAF8] text-[#1D3668]">
            <UsersRound size={28} />
          </span>
          <h2 className="mt-4 text-lg font-extrabold text-[#1F2C4F]">Tidak Ada Ruangan Aktif</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#56638A]">
            Silakan pilih atau buat ruang belajar terlebih dahulu dari menu Co-Focus.
          </p>
          <button
            type="button"
            onClick={() => navigate('/cofocus')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1D3668] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#162B54]"
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Co-Focus</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col h-screen w-full bg-[#F3F4FA] overflow-hidden font-[Montserrat] select-text">
      {/* Hidden Native File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        className="hidden"
        aria-hidden="true"
      />

      {/* 1. Header Atas (Aman dari Notch / Camera Cutout via safe-area-inset & min-height) */}
      <header className="shrink-0 bg-white border-b border-[#DFE4F1] px-3 sm:px-6 pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-2.5 min-h-[calc(4rem+env(safe-area-inset-top,0px))] flex items-center justify-between z-20 shadow-[0_2px_4px_rgba(29,54,104,0.03)]">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          {/* Tombol Kembali ke Co-Focus */}
          <button
            type="button"
            onClick={() => navigate('/cofocus')}
            aria-label="Kembali ke Co-Focus"
            title="Kembali ke Co-Focus"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#1D3668] transition hover:bg-[#E1EAF8] active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Avatar Monogram & Detail Ruangan */}
          <button
            type="button"
            onClick={() => setShowMembersDrawer(true)}
            className="flex items-center gap-2.5 text-left group min-w-0 focus:outline-none"
            title="Klik untuk melihat anggota & pengaturan ruangan"
          >
            <div className="relative">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1D3668] text-xs font-extrabold text-white shadow-xs group-hover:bg-[#162B54] transition">
                {groupName.slice(0, 2).toUpperCase()}
              </span>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-sm sm:text-base font-bold text-[#1F2C4F] group-hover:text-[#1D3668] transition">
                  {groupName}
                </h1>
                {isHost && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#E1EAF8] px-2 py-0.2 text-[10px] font-extrabold text-[#1D3668]">
                    <ShieldCheck size={11} /> Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#56638A] leading-tight flex items-center gap-1.5 truncate">
                <span>{groupMembers.length} / {maxMembers} Anggota</span>
                <span>·</span>
                <span className="text-[#17623A] font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#17623A] animate-pulse inline-block" />
                  Realtime
                </span>
              </p>
            </div>
          </button>
        </div>

        {/* Action Header: Salin Kode & Buka Info Anggota */}
        <div className="flex items-center gap-2 shrink-0">
          {joinCode && (
            <button
              type="button"
              onClick={handleCopyCode}
              title="Salin Kode Ruang Belajar"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] px-2.5 py-1.5 text-xs font-bold text-[#1D3668] transition hover:border-[#1D3668]/30 hover:bg-[#E1EAF8] active:scale-95"
            >
              <span className="hidden sm:inline font-mono">Kode:</span>
              <span className="font-mono">{joinCode}</span>
              {copiedCode ? <Check size={14} className="text-[#17623A]" /> : <Copy size={14} />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowMembersDrawer((prev) => !prev)}
            aria-label="Info & Anggota Kelompok"
            title="Lihat Anggota & Pengaturan Ruangan"
            className={`grid h-9 w-9 place-items-center rounded-xl border transition active:scale-95 ${
              showMembersDrawer
                ? 'border-[#1D3668] bg-[#E1EAF8] text-[#1D3668]'
                : 'border-[#DFE4F1] bg-[#F6F7FC] text-[#56638A] hover:text-[#1D3668]'
            }`}
          >
            <UsersRound size={18} />
          </button>
        </div>
      </header>

      {/* Global Error Banner */}
      {chatError && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          <span className="flex-1 truncate">{chatError}</span>
          <button
            type="button"
            onClick={() => setChatError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. Chat Feed Area (Native WhatsApp / Telegram Style) */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-3 relative bg-[#F8F9FD]">
        {/* System Date Pill */}
        <div className="flex justify-center mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DFE4F1] bg-white/90 backdrop-blur-xs px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#757780] shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#17623A]" />
            Ruang Diskusi Realtime · Maks {maxMembers} Anggota
          </span>
        </div>

        {/* Loading Spinner */}
        {isLoadingMessages && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-[#BE2257]" />
            <p className="mt-2.5 text-xs font-semibold text-[#56638A]">Memuat pesan percakapan...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingMessages && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#E1EAF8] text-[#1D3668]">
              <MessageSquareText size={30} aria-hidden="true" />
            </span>
            <p className="mt-4 text-base font-bold text-[#1F2C4F]">Belum ada pesan di ruang obrolan</p>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[#56638A]">
              Sapa rekan belajarmu atau bagikan berkas tugas (PDF, Word, JPG) untuk memulai kolaborasi.
            </p>
          </div>
        )}

        {/* Message Bubbles */}
        {messages.map((message) => {
          const isOwn = message.senderId === 'current-user'
          const repliedMessage = message.replyTo
            ? messages.find((m) => m.id === message.replyTo)
            : undefined

          return (
            <article
              key={message.id}
              className={`group flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              {/* Other Sender Avatar */}
              {!isOwn && (
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white shadow-2xs ${getMemberColor(message.senderName, 1)}`}
                  title={message.senderName}
                >
                  {message.senderAvatar || message.senderName.slice(0, 2).toUpperCase()}
                </span>
              )}

              {/* Chat Bubble Container */}
              <div
                className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 sm:p-3.5 shadow-2xs ${
                  isOwn
                    ? 'rounded-tr-none bg-[#1D3668] text-white'
                    : 'rounded-tl-none border border-[#DFE4F1] bg-white text-[#1F2C4F]'
                }`}
              >
                {/* Sender Name for Received Messages */}
                {!isOwn && (
                  <span className="mb-1 block text-xs font-bold text-[#BE2257]">
                    {message.senderName}
                  </span>
                )}

                {/* Reply Quote Banner */}
                {repliedMessage && !message.isDeleted && (
                  <div
                    className={`mb-2 rounded-lg border-l-4 px-2.5 py-1.5 text-xs ${
                      isOwn
                        ? 'border-[#BE2257] bg-white/10 text-white/90'
                        : 'border-[#1D3668] bg-[#F6F7FC] text-[#56638A]'
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

                {/* Message Body */}
                {message.isDeleted ? (
                  <p className={`text-xs italic leading-relaxed ${isOwn ? 'text-white/70' : 'text-[#757780]'}`}>
                    Pesan ini telah dihapus
                  </p>
                ) : (
                  <>
                    {message.text && (
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isOwn ? 'text-white' : 'text-[#1F2C4F]'}`}>
                        {message.text}
                      </p>
                    )}
                    <MessageAttachment message={message} isOwn={isOwn} />
                  </>
                )}

                {/* Message Timestamp & Checkmarks */}
                <div
                  className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${
                    isOwn ? 'text-white/70' : 'text-[#757780]'
                  }`}
                >
                  <time>{message.time}</time>
                  {isOwn && <CheckCheck size={13} className="text-[#9CC3FF]" aria-hidden="true" />}
                </div>

                {/* Hover / Long-press Actions (Reply & Delete) */}
                {!message.isDeleted && (
                  <div
                    className={`absolute -top-3 ${
                      isOwn ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'
                    } hidden group-hover:flex items-center gap-1 z-10`}
                  >
                    <button
                      type="button"
                      onClick={() => setReplyingTo(message)}
                      aria-label="Balas pesan"
                      title="Balas pesan"
                      className="grid h-7 w-7 place-items-center rounded-lg border border-[#DFE4F1] bg-white text-[#56638A] shadow-xs transition hover:bg-[#E1EAF8] hover:text-[#1D3668]"
                    >
                      <Reply size={13} />
                    </button>
                    {isOwn && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(message.id)}
                        aria-label="Hapus pesan"
                        title="Hapus pesan"
                        className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-white text-red-600 shadow-xs transition hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          )
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* 3. Attachment Menu Popover */}
      {showAttachmentMenu && (
        <div
          ref={attachmentMenuRef}
          className="absolute bottom-16 left-3 sm:left-6 z-30 w-80 sm:w-96 rounded-2xl border border-[#DFE4F1] bg-white p-4 shadow-xl animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="mb-3 flex items-center justify-between border-b border-[#DFE4F1] pb-2">
            <span className="text-xs font-bold text-[#1F2C4F] flex items-center gap-1.5">
              <Paperclip size={14} className="text-[#1D3668]" />
              Pilih Berkas Lampiran
            </span>
            <button
              type="button"
              onClick={() => setShowAttachmentMenu(false)}
              className="grid h-6 w-6 place-items-center rounded-full text-[#757780] hover:bg-[#F6F7FC]"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-2">
            {/* Opsi 1: PDF */}
            <div className="rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-2.5 transition hover:bg-[#FFF5F8] hover:border-[#FCDDE6]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FCDDE6] text-[#8E1744]">
                    <FileText size={17} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#1F2C4F]">Dokumen PDF (.pdf)</p>
                    <p className="text-[10px] text-[#56638A]">Laporan final & modul kuliah</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerNativeUpload('pdf')}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#1D3668] py-1.5 text-[11px] font-bold text-white transition hover:bg-[#162B54]"
                >
                  <Upload size={12} /> Unggah PDF
                </button>
                <button
                  type="button"
                  onClick={sendSamplePdf}
                  className="rounded-lg border border-[#DFE4F1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#56638A] transition hover:bg-[#F6F7FC]"
                >
                  Sampel PDF
                </button>
              </div>
            </div>

            {/* Opsi 2: Word */}
            <div className="rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-2.5 transition hover:bg-[#F3F6FD] hover:border-[#C5D5F0]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E1EAF8] text-[#1D3668]">
                    <FileText size={17} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#1F2C4F]">Dokumen Word (.docx)</p>
                    <p className="text-[10px] text-[#56638A]">Draf makalah & catatan tugas</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerNativeUpload('word')}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#1D3668] py-1.5 text-[11px] font-bold text-white transition hover:bg-[#162B54]"
                >
                  <Upload size={12} /> Unggah Word
                </button>
                <button
                  type="button"
                  onClick={sendSampleWord}
                  className="rounded-lg border border-[#DFE4F1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#56638A] transition hover:bg-[#F6F7FC]"
                >
                  Sampel Word
                </button>
              </div>
            </div>

            {/* Opsi 3: JPG */}
            <div className="rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-2.5 transition hover:bg-[#F5FBF7] hover:border-[#D6F0DE]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#D6F0DE] text-[#17623A]">
                    <ImageIcon size={17} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#1F2C4F]">Gambar / Foto JPG (.jpg)</p>
                    <p className="text-[10px] text-[#56638A]">Bagan alur & diagram antarmuka</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerNativeUpload('jpg')}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#1D3668] py-1.5 text-[11px] font-bold text-white transition hover:bg-[#162B54]"
                >
                  <Upload size={12} /> Unggah JPG
                </button>
                <button
                  type="button"
                  onClick={sendSampleJpg}
                  className="rounded-lg border border-[#DFE4F1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#56638A] transition hover:bg-[#F6F7FC]"
                >
                  Sampel JPG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Input Bar Paling Bawah (Aman dari Nav Bar / Home Indicator) */}
      <footer className="shrink-0 bg-white border-t border-[#DFE4F1] p-2.5 sm:p-3 pb-[max(calc(0.65rem+env(safe-area-inset-bottom,0px)),0.65rem)] z-20 shadow-[0_-2px_10px_rgba(29,54,104,0.03)]">
        {/* Banner Membalas Pesan */}
        {replyingTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-[#DFE4F1] bg-[#E1EAF8]/70 px-3 py-1.5 text-xs text-[#1D3668]">
            <div className="flex min-w-0 items-center gap-1.5">
              <Reply size={13} className="shrink-0 text-[#1D3668]" />
              <span className="truncate font-semibold text-[#1D3668]">
                Membalas {replyingTo.senderName}:{' '}
                <span className="font-normal text-[#1F2C4F]">
                  {replyingTo.text || replyingTo.fileName || replyingTo.imageLabel || 'Lampiran'}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Batal membalas"
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full hover:bg-white text-[#56638A] hover:text-[#BE2257]"
            >
              <X size={13} />
            </button>
          </div>
        )}

        <form onSubmit={sendMessage} className="flex items-center gap-2">
          {/* Tombol Lampiran Berkas */}
          <button
            type="button"
            onClick={() => setShowAttachmentMenu((prev) => !prev)}
            aria-label="Pilih berkas lampiran (PDF, Word, JPG)"
            title="Lampirkan berkas (PDF, Word, JPG)"
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border transition active:scale-95 ${
              showAttachmentMenu
                ? 'border-[#1D3668] bg-[#E1EAF8] text-[#1D3668]'
                : 'border-[#DFE4F1] bg-[#F6F7FC] text-[#56638A] hover:bg-[#E1EAF8] hover:text-[#1D3668]'
            }`}
          >
            <Paperclip size={18} />
          </button>

          {/* Quick JPG Upload Button */}
          <button
            type="button"
            onClick={() => triggerNativeUpload('jpg')}
            aria-label="Kirim gambar JPG"
            title="Kirim gambar JPG"
            className="hidden sm:grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#DFE4F1] bg-[#F6F7FC] text-[#56638A] transition hover:bg-[#E1EAF8] hover:text-[#1D3668] active:scale-95"
          >
            <ImageIcon size={18} />
          </button>

          {/* Input Text Field */}
          <label className="sr-only" htmlFor="group-chat-input">
            Tulis pesan obrolan
          </label>
          <input
            id="group-chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ketik pesan diskusi..."
            className="h-11 min-w-0 flex-1 rounded-full border border-[#DFE4F1] bg-[#F6F7FC] px-4 text-sm text-[#1F2C4F] placeholder:text-[#757780] outline-none transition focus:bg-white focus:border-[#1D3668] focus:ring-1 focus:ring-[#1D3668]"
          />

          {/* Tombol Kirim */}
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Kirim pesan"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#BE2257] text-white shadow-sm transition hover:bg-[#A11B48] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </form>
      </footer>

      {/* 5. Slide-Over Drawer: Informasi & Anggota Kelompok (Aman dari Notch Atas & Bawah) */}
      {showMembersDrawer && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-[#0B1A3D]/40 backdrop-blur-xs transition-opacity"
          onClick={() => setShowMembersDrawer(false)}
        >
          <div
            className="w-full max-w-sm sm:w-96 bg-white h-full shadow-2xl flex flex-col p-5 pt-[max(calc(1.25rem+env(safe-area-inset-top,0px)),1.5rem)] pb-[max(calc(1.25rem+env(safe-area-inset-bottom,0px)),1.5rem)] overflow-y-auto animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#DFE4F1] pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E1EAF8] text-[#1D3668]">
                  <UsersRound size={18} />
                </span>
                <h3 className="text-base font-bold text-[#1F2C4F]">Info Ruang Belajar</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMembersDrawer(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-[#757780] hover:bg-[#F6F7FC]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Room Summary Card */}
            <div className="mt-4 rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-4">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-extrabold text-[#1F2C4F]">{groupName}</h4>
                {isHost && (
                  <span className="rounded-full bg-[#1D3668] px-2 py-0.5 text-[9px] font-extrabold text-white shrink-0">
                    Host / Admin
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#56638A]">
                {currentGroup?.description || 'Ruang kolaborasi terpadu untuk berdiskusi materi kuliah dan berbagi tugas.'}
              </p>
              {joinCode && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-white p-2.5 border border-[#DFE4F1]">
                  <div>
                    <span className="block text-[10px] font-bold text-[#757780] uppercase">Kode Undangan</span>
                    <span className="font-mono text-base font-extrabold text-[#1D3668]">{joinCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 rounded-md bg-[#1D3668] px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#162B54]"
                  >
                    {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedCode ? 'Disalin' : 'Salin'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Members List */}
            <div className="mt-5 flex-1">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#757780]">
                  Daftar Anggota ({groupMembers.length} / {maxMembers})
                </h4>
                <span className="text-[11px] font-bold text-[#17623A]">
                  {remainingSlots > 0 ? `${remainingSlots} slot tersisa` : 'Penuh'}
                </span>
              </div>

              <ul className="space-y-2">
                {groupMembers.map((member, index) => {
                  const isFocus = member.status === 'fokus'
                  const isSelf = member.userId === currentUser?.id
                  const canKick = isHost && !isSelf && !member.isHost

                  return (
                    <li
                      key={member.id}
                      className="flex items-center gap-2.5 rounded-xl border border-[#DFE4F1] bg-white p-2.5 shadow-2xs"
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white ${getMemberColor(member.name, index)}`}
                      >
                        {member.avatar}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[#1F2C4F]">
                          {member.name}
                          {member.isHost && (
                            <span className="ml-1.5 rounded-full bg-[#E1EAF8] px-1.5 py-0.2 text-[9px] font-bold text-[#1D3668]">
                              Host
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-[#56638A]">{member.course}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isFocus ? 'bg-[#FCDDE6] text-[#8E1744]' : 'bg-[#FDEBC8] text-[#7A4B00]'
                          }`}
                        >
                          {isFocus ? 'Fokus' : 'Istirahat'}
                        </span>

                        {/* Tombol Kick Khusus Admin Ruangan */}
                        {canKick && (
                          <button
                            type="button"
                            onClick={() => setConfirmKickTarget(member)}
                            title={`Keluarkan ${member.name} dari ruangan`}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700 active:scale-95"
                          >
                            <UserMinus size={13} />
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}

                {/* Empty slot placeholders up to maxMembers (10) */}
                {Array.from({ length: remainingSlots }).map((_, i) => (
                  <li
                    key={`slot-${i}`}
                    className="flex items-center gap-2.5 rounded-xl border-2 border-dashed border-[#DFE4F1] bg-[#F6F7FC]/70 p-2.5 text-xs text-[#757780]"
                  >
                    <PlusCircle size={16} className="text-[#56638A]" />
                    <span>Slot {groupMembers.length + i + 1} Tersedia</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Supported Files Info */}
            <div className="mt-5 rounded-xl border border-[#5E3F0C]/15 bg-[#FBEFD9] p-3 text-xs text-[#5E3F0C]">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Lightbulb size={15} />
                <span>Format Lampiran Berkas</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                Gunakan menu lampiran untuk mengirim berkas <strong>PDF (.pdf)</strong>, <strong>Word (.docx)</strong>, dan gambar <strong>JPG (.jpg)</strong> langsung ke forum belajar.
              </p>
            </div>

            {/* Tindakan Manajemen Ruangan (Admin: Hapus Ruangan | Anggota: Keluar Ruangan) */}
            <div className="mt-5 pt-3 border-t border-[#DFE4F1]">
              {isHost ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 active:scale-98"
                  >
                    <Trash2 size={15} />
                    <span>Hapus Ruang Belajar (Admin)</span>
                  </button>
                  <p className="mt-1.5 text-center text-[10px] text-[#757780]">
                    Sebagai pembuat grup, Anda dapat membubarkan ruang ini agar tidak membebani database.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#DFE4F1] bg-white py-2.5 px-3 text-xs font-bold text-[#56638A] transition hover:bg-red-50 hover:text-red-700 hover:border-red-200 active:scale-98"
                >
                  <LogOut size={15} />
                  <span>Keluar dari Ruang Belajar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi 1: Kick Anggota (Admin) */}
      {confirmKickTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-xs"
          onClick={() => !isProcessingAction && setConfirmKickTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#DFE4F1] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-600">
              <UserMinus size={24} />
            </div>
            <h3 className="mt-4 text-center text-base font-extrabold text-[#1F2C4F]">
              Keluarkan Anggota?
            </h3>
            <p className="mt-2 text-center text-xs leading-relaxed text-[#56638A]">
              Apakah Anda yakin ingin mengeluarkan <strong>{confirmKickTarget.name}</strong> dari ruang belajar ini? Mereka dapat bergabung kembali jika memasukkan kode ruangan.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setConfirmKickTarget(null)}
                className="flex-1 rounded-xl border border-[#DFE4F1] py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleConfirmKick}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {isProcessingAction ? 'Mengeluarkan...' : 'Ya, Keluarkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi 2: Hapus Ruangan (Admin) */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-xs"
          onClick={() => !isProcessingAction && setShowDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={24} />
            </div>
            <h3 className="mt-4 text-center text-base font-extrabold text-[#1F2C4F]">
              Hapus Ruang Belajar?
            </h3>
            <p className="mt-2 text-center text-xs leading-relaxed text-[#56638A]">
              Tindakan ini akan <strong>menghapus permanen</strong> ruang belajar "{groupName}" beserta seluruh riwayat obrolan dan dokumen di dalamnya. Semua anggota akan dikeluarkan.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-[#DFE4F1] py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleConfirmDelete}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {isProcessingAction ? 'Menghapus...' : 'Ya, Hapus Ruang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi 3: Keluar Ruangan (Anggota Biasa) */}
      {showLeaveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-xs"
          onClick={() => !isProcessingAction && setShowLeaveConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#DFE4F1] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700">
              <LogOut size={24} />
            </div>
            <h3 className="mt-4 text-center text-base font-extrabold text-[#1F2C4F]">
              Keluar dari Ruangan?
            </h3>
            <p className="mt-2 text-center text-xs leading-relaxed text-[#56638A]">
              Apakah Anda yakin ingin keluar dari "{groupName}"? Anda bisa bergabung kembali nanti menggunakan kode ruangan jika slot masih tersedia.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 rounded-xl border border-[#DFE4F1] py-2.5 text-xs font-bold text-[#56638A] hover:bg-[#F6F7FC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleConfirmLeave}
                className="flex-1 rounded-xl bg-[#1D3668] py-2.5 text-xs font-bold text-white transition hover:bg-[#162B54] disabled:opacity-50"
              >
                {isProcessingAction ? 'Memproses...' : 'Ya, Keluar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
