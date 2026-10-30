export type StudyBlockType =
  | 'Jadwal kuliah'
  | 'Belajar mandiri'
  | 'Kerja kelompok'
  | 'Persiapan ujian'

export type MockStudyBlock = {
  id: string
  user_id?: string
  status?: 'scheduled' | 'active' | 'completed'
  title: string
  type: StudyBlockType
  date: string
  start_time: string
  end_time: string
  description: string
  recurrence_rule: string | null
  auto_focus: boolean
  co_focus_enabled: boolean
  subTasks?: { id: string; title: string; isCompleted: boolean }[]
}

export function getStudyDate(dayOffset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const parts = Object.fromEntries(values.map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export const mockStudyBlocks: MockStudyBlock[] = [
  {
    id: 'block-001',
    title: 'Menyelesaikan rangkuman Basis Data',
    type: 'Belajar mandiri',
    date: getStudyDate(),
    start_time: '09:00',
    end_time: '10:30',
    description: 'Rangkum normalisasi dan latihan query SQL.',
    recurrence_rule: null,
    auto_focus: true,
    co_focus_enabled: false,
    subTasks: [
      { id: 'st-001', title: 'Membaca materi Normalisasi 1NF hingga 3NF', isCompleted: true },
      { id: 'st-002', title: 'Menyusun rangkuman contoh kasus tabel relasional', isCompleted: false },
      { id: 'st-003', title: 'Mengerjakan 5 soal latihan query JOIN & GROUP BY', isCompleted: false },
    ],
  },
  {
    id: 'block-002',
    title: 'Diskusi proyek SmartLearning',
    type: 'Kerja kelompok',
    date: getStudyDate(),
    start_time: '13:00',
    end_time: '14:30',
    description: 'Menyepakati alur ruang belajar dan evaluasi.',
    recurrence_rule: null,
    auto_focus: false,
    co_focus_enabled: true,
    subTasks: [
      { id: 'st-004', title: 'Meninjau pembagian tugas anggota tim', isCompleted: true },
      { id: 'st-005', title: 'Menyepakati alur fitur Co-Focus & mode fokus', isCompleted: false },
      { id: 'st-006', title: 'Menyiapkan dokumen laporan progres mingguan', isCompleted: false },
    ],
  },
  {
    id: 'block-003',
    title: 'Latihan soal Statistika',
    type: 'Persiapan ujian',
    date: getStudyDate(1),
    start_time: '10:00',
    end_time: '11:30',
    description: 'Kerjakan latihan distribusi dan peluang.',
    recurrence_rule: null,
    auto_focus: true,
    co_focus_enabled: false,
    subTasks: [
      { id: 'st-007', title: 'Mengulang rumus distribusi normal dan binomial', isCompleted: false },
      { id: 'st-008', title: 'Menyelesaikan paket soal tahun lalu', isCompleted: false },
    ],
  },
  {
    id: 'block-004',
    title: 'Belajar mandiri UI/UX',
    type: 'Belajar mandiri',
    date: getStudyDate(2),
    start_time: '15:00',
    end_time: '16:00',
    description: 'Pelajari prinsip hierarki visual dan aksesibilitas.',
    recurrence_rule: null,
    auto_focus: false,
    co_focus_enabled: false,
    subTasks: [
      { id: 'st-009', title: 'Menganalisis kontras warna dan tipografi', isCompleted: false },
      { id: 'st-010', title: 'Membuat catatan evaluasi komponen interaktif', isCompleted: false },
    ],
  },
]

export type MockGroupMember = {
  id: string
  name: string
  avatar: string
  status: 'fokus' | 'istirahat'
  course: string
}

export const mockGroupMembers: MockGroupMember[] = [
  { id: 'member-001', name: 'Nadia Putri', avatar: 'NP', status: 'fokus', course: 'Basis Data' },
  { id: 'member-002', name: 'Raka Pratama', avatar: 'RP', status: 'istirahat', course: 'Statistika' },
  { id: 'member-003', name: 'Salsa Maharani', avatar: 'SM', status: 'fokus', course: 'UI/UX' },
  { id: 'member-004', name: 'Dimas Arya', avatar: 'DA', status: 'fokus', course: 'Proyek Kelompok' },
]

export type MockChatMessage = {
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

export const mockChatMessages: MockChatMessage[] = [
  {
    id: 'chat-001',
    senderId: 'member-001',
    senderName: 'Nadia Putri',
    time: '13:04',
    kind: 'text',
    text: 'Aku sudah merapikan bagian latar belakang. Coba cek ya!',
  },
  {
    id: 'chat-002',
    senderId: 'member-003',
    senderName: 'Salsa Maharani',
    time: '13:07',
    kind: 'image',
    imageLabel: 'Cuplikan rancangan alur belajar',
    text: 'Ini draft alur yang bisa kita pakai.',
  },
  {
    id: 'chat-003',
    senderId: 'member-002',
    senderName: 'Raka Pratama',
    time: '13:12',
    kind: 'document',
    fileName: 'Proposal_Kelompok.pdf',
    fileType: 'PDF',
    text: 'Proposal terbaru untuk ditinjau.',
  },
  {
    id: 'chat-004',
    senderId: 'member-004',
    senderName: 'Dimas Arya',
    time: '13:18',
    kind: 'document',
    fileName: 'Catatan_Rapat.docx',
    fileType: 'Word',
    text: 'Catatan rapat tadi sudah aku tambahkan.',
  },
  {
    id: 'chat-005',
    senderId: 'current-user',
    senderName: 'Anda',
    time: '13:21',
    kind: 'text',
    text: 'Terima kasih, aku lanjut meninjau tugasnya sekarang.',
  },
]

export const mockEvaluationData = {
  targetMinutes: 90,
  actualMinutes: 78,
  appsUsed: ['Word', 'Canva', 'Google Docs'],
}

export type MockFocusApp = {
  id: string
  name: string
  description: string
  kind: 'allowed' | 'blocked'
}

export const mockFocusApps: MockFocusApp[] = [
  { id: 'word', name: 'Word', description: 'Dokumen dan catatan', kind: 'allowed' },
  { id: 'canva', name: 'Canva', description: 'Desain dan presentasi', kind: 'allowed' },
  { id: 'docs', name: 'Docs', description: 'Tulis bersama', kind: 'allowed' },
  { id: 'instagram', name: 'Instagram', description: 'Media sosial', kind: 'blocked' },
  { id: 'tiktok', name: 'TikTok', description: 'Video pendek', kind: 'blocked' },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Pesan dan obrolan', kind: 'blocked' },
]
