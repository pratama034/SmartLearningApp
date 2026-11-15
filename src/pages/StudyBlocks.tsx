import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutGrid,
  List,
  Loader2,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { getStudyDate } from '../data/mockData'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { useStudyStore } from '../store/studyStore'
import type { StudyBlock, StudyBlockType } from '../types'

const blockTypes = ['Jadwal kuliah', 'Belajar mandiri', 'Kerja kelompok', 'Persiapan ujian'] as const

const studyBlockSchema = z.object({
  title: z.string().trim().min(1, 'Judul wajib diisi.'),
  type: z.enum(blockTypes),
  date: z.string().min(1, 'Tanggal wajib diisi.'),
  startTime: z.string().min(1, 'Waktu mulai wajib diisi.'),
  endTime: z.string().min(1, 'Waktu selesai wajib diisi.'),
})

const typeBadgeStyles: Record<StudyBlockType, string> = {
  'Jadwal kuliah': 'bg-[#E1EAF8] text-[#1D3668]',
  'Belajar mandiri': 'bg-[#D6F0DE] text-[#17623A]',
  'Kerja kelompok': 'bg-[#FCDDE6] text-[#8E1744]',
  'Persiapan ujian': 'bg-[#FDEBC8] text-[#7A4B00]',
}

// Warna blok ala Google Calendar seperti pada contoh PDF
const calendarBlockPalettes: Record<StudyBlockType, { bg: string; border: string; text: string }> = {
  'Jadwal kuliah': {
    bg: 'bg-[#4285F4] text-white',
    border: 'border-[#2B6CB0]',
    text: 'text-white',
  },
  'Belajar mandiri': {
    bg: 'bg-[#A0C238] text-white',
    border: 'border-[#7E9B28]',
    text: 'text-white',
  },
  'Kerja kelompok': {
    bg: 'bg-[#039BE5] text-white',
    border: 'border-[#0277BD]',
    text: 'text-white',
  },
  'Persiapan ujian': {
    bg: 'bg-[#E6A100] text-white',
    border: 'border-[#B7791F]',
    text: 'text-white',
  },
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0..23
const HOUR_ROW_HEIGHT = 56 // px per jam

function displayTime(value: string) {
  return value.replace(':', '.')
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 am'
  if (hour < 12) return `${hour} am`
  if (hour === 12) return '12 pm'
  return `${hour - 12} pm`
}

function parseDateIso(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y || 2026, (m || 1) - 1, d || 1)
}

function formatDateIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getWeekDatesSundayStart(centerDateStr: string): Array<{
  iso: string
  dayNum: number
  dayLetter: string
  dayNameId: string
  monthLabel: string
}> {
  const base = parseDateIso(centerDateStr)
  const dayOfWeek = base.getDay() // 0 = Sunday
  const sunday = new Date(base)
  sunday.setDate(base.getDate() - dayOfWeek)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    return {
      iso: formatDateIso(d),
      dayNum: d.getDate(),
      dayLetter: DAY_LETTERS[i],
      dayNameId: DAY_NAMES_ID[i],
      monthLabel: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    }
  })
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = (timeStr || '08:00').split(':').map(Number)
  return (Number.isNaN(h) ? 8 : h) * 60 + (Number.isNaN(m) ? 0 : m)
}

export default function StudyBlocks() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const studyBlocks = useStudyStore((state) => state.studyBlocks)
  const fetchStudyBlocks = useStudyStore((state) => state.fetchStudyBlocks)
  const addStudyBlock = useStudyStore((state) => state.addStudyBlock)
  const deleteStudyBlock = useStudyStore((state) => state.deleteStudyBlock)
  const toggleSubTask = useStudyStore((state) => state.toggleSubTask)
  const isLoading = useStudyStore((state) => state.isLoading)
  const storeError = useStudyStore((state) => state.error)
  const clearError = useStudyStore((state) => state.clearError)
  const startSession = useSessionStore((state) => state.startSession)

  const todayIso = useMemo(() => getStudyDate(), [])
  const [selectedDate, setSelectedDate] = useState<string>(todayIso)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [selectedBlockDetail, setSelectedBlockDetail] = useState<StudyBlock | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<StudyBlockType>('Jadwal kuliah')
  const [formDate, setFormDate] = useState<string>(todayIso)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:30')
  const [subTaskInputs, setSubTaskInputs] = useState<string[]>([])
  const [newSubTaskText, setNewSubTaskText] = useState('')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (user?.id) {
      void fetchStudyBlocks(user.id)
    }
  }, [fetchStudyBlocks, user?.id])

  // Auto-scroll ke jam 7 pagi saat kalender dibuka
  useEffect(() => {
    if (viewMode === 'calendar' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 7 * HOUR_ROW_HEIGHT - 16
    }
  }, [viewMode])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const weekDays = useMemo(() => getWeekDatesSundayStart(selectedDate), [selectedDate])
  const currentMonthTitle = useMemo(() => {
    const d = parseDateIso(selectedDate)
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }, [selectedDate])

  function shiftWeek(deltaDays: number) {
    const d = parseDateIso(selectedDate)
    d.setDate(d.getDate() + deltaDays)
    setSelectedDate(formatDateIso(d))
  }

  function openAddModal(prefillDate?: string, prefillHour?: number) {
    const targetDate = prefillDate || selectedDate || todayIso
    setFormDate(targetDate)
    if (typeof prefillHour === 'number') {
      const startH = String(prefillHour).padStart(2, '0')
      const endH = String(Math.min(23, prefillHour + 1)).padStart(2, '0')
      setStartTime(`${startH}:00`)
      setEndTime(`${endH}:00`)
    } else if (!startTime) {
      setStartTime('08:00')
      setEndTime('09:30')
    }
    setFormError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setFormError('')
    setNewSubTaskText('')
  }

  function handleAddSubTaskInput() {
    const trimmed = newSubTaskText.trim()
    if (!trimmed) return
    setSubTaskInputs((prev) => [...prev, trimmed])
    setNewSubTaskText('')
  }

  function handleRemoveSubTaskInput(index: number) {
    setSubTaskInputs((prev) => prev.filter((_, idx) => idx !== index))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const validation = studyBlockSchema.safeParse({
      title,
      type,
      date: formDate,
      startTime,
      endTime,
    })

    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message ?? 'Lengkapi data jadwal.')
      return
    }

    setIsSubmitting(true)
    try {
      const pendingSubTasks = [
        ...subTaskInputs,
        ...(newSubTaskText.trim() ? [newSubTaskText.trim()] : []),
      ].map((taskTitle) => ({ title: taskTitle, isCompleted: false }))

      await addStudyBlock({
        userId: user?.id,
        title: validation.data.title,
        type: validation.data.type,
        startTime: validation.data.startTime,
        endTime: validation.data.endTime,
        start_time: validation.data.startTime,
        end_time: validation.data.endTime,
        description: description.trim(),
        recurrenceRule: null,
        recurrence_rule: null,
        date: validation.data.date,
        autoFocus: false,
        auto_focus: false,
        coFocusEnabled: false,
        co_focus_enabled: false,
        subTasks: pendingSubTasks,
      })

      setSelectedDate(validation.data.date)
      setTitle('')
      setDescription('')
      setType('Jadwal kuliah')
      setSubTaskInputs([])
      setNewSubTaskText('')
      closeModal()
      setToast({ type: 'success', message: 'Jadwal berhasil ditambahkan ke Kalender Schedule!' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan jadwal belajar.'
      setFormError(msg)
      setToast({ type: 'error', message: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string, blockTitle: string) {
    try {
      await deleteStudyBlock(id)
      if (selectedBlockDetail?.id === id) {
        setSelectedBlockDetail(null)
      }
      setToast({ type: 'success', message: `Jadwal "${blockTitle}" berhasil dihapus.` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus jadwal belajar.'
      setToast({ type: 'error', message: msg })
    }
  }

  function handleStartFocusFromCalendar(block: StudyBlock) {
    startSession(block)
    setSelectedBlockDetail(null)
    navigate('/focus')
  }

  return (
    <div className="relative space-y-4 sm:space-y-5">
      {/* Toast Alert */}
      {(toast || storeError) && (
        <div
          role="alert"
          aria-live="polite"
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 shadow-md transition-all ${
            toast?.type === 'success' && !storeError
              ? 'border-[#17623A]/20 bg-[#D6F0DE] text-[#17623A]'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {toast?.type === 'success' && !storeError ? (
              <CheckCircle2 size={20} className="shrink-0 text-[#17623A]" aria-hidden="true" />
            ) : (
              <AlertCircle size={20} className="shrink-0 text-red-600" aria-hidden="true" />
            )}
            <p className="text-sm font-bold">{storeError || toast?.message}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setToast(null)
              clearError()
            }}
            aria-label="Tutup notifikasi"
            className="rounded-lg p-1 text-xs font-semibold hover:bg-black/5"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Header Kalender ala Google Calendar */}
      <section className="overflow-hidden rounded-2xl border border-[#DFE4F1] bg-white shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
        {/* Baris Kontrol Bulan & Mode Tampilan */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DFE4F1] px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
              <CalendarIcon size={18} />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-extrabold capitalize tracking-tight text-[#1F2C4F] sm:text-xl">
                  {currentMonthTitle}
                </h1>
              </div>
              <p className="text-[11px] font-medium text-[#56638A]">
                Schedule Belajar StuFo · Klik jam kosong atau tombol + untuk tambah jadwal
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-0.5">
              <button
                type="button"
                onClick={() => shiftWeek(-7)}
                aria-label="Minggu sebelumnya"
                className="grid h-8 w-8 place-items-center rounded-lg text-[#1F2C4F] transition hover:bg-white"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(todayIso)}
                className="px-2.5 text-xs font-bold text-[#1D3668] transition hover:underline"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => shiftWeek(7)}
                aria-label="Minggu berikutnya"
                className="grid h-8 w-8 place-items-center rounded-lg text-[#1F2C4F] transition hover:bg-white"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="inline-flex items-center rounded-xl border border-[#DFE4F1] bg-[#F6F7FC] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${
                  viewMode === 'calendar'
                    ? 'bg-[#1D3668] text-white shadow-2xs'
                    : 'text-[#56638A] hover:text-[#1F2C4F]'
                }`}
              >
                <LayoutGrid size={14} />
                <span>Kalender</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${
                  viewMode === 'list'
                    ? 'bg-[#1D3668] text-white shadow-2xs'
                    : 'text-[#56638A] hover:text-[#1F2C4F]'
                }`}
              >
                <List size={14} />
                <span>Daftar</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => openAddModal(selectedDate)}
              className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#BE2257] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#A11B48]"
            >
              <Plus size={16} />
              <span>Tambah Jadwal</span>
            </button>
          </div>
        </div>

        {/* Strip Hari Mingguan (S M T W T F S) ala Google Calendar */}
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-[#DFE4F1] bg-[#F9FAFE]">
          <div className="flex flex-col items-center justify-center border-r border-[#DFE4F1] py-2 text-[10px] font-bold text-[#757780]">
            <span>WIB</span>
          </div>
          {weekDays.map((day) => {
            const isToday = day.iso === todayIso
            const isSelected = day.iso === selectedDate
            const dayBlockCount = studyBlocks.filter((b) => b.date === day.iso).length

            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => setSelectedDate(day.iso)}
                className={`flex flex-col items-center justify-center border-r border-[#DFE4F1]/60 py-2.5 transition last:border-r-0 ${
                  isSelected ? 'bg-[#E1EAF8]/45' : 'hover:bg-[#F3F4FA]'
                }`}
              >
                <span
                  className={`text-[10px] font-bold uppercase ${
                    isToday || isSelected ? 'text-[#1A73E8]' : 'text-[#56638A]'
                  }`}
                >
                  {day.dayLetter}
                </span>
                <span
                  className={`mt-1 grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold transition ${
                    isToday
                      ? 'bg-[#1A73E8] text-white shadow-sm'
                      : isSelected
                        ? 'bg-[#1D3668] text-white'
                        : 'text-[#1F2C4F]'
                  }`}
                >
                  {day.dayNum}
                </span>
                {dayBlockCount > 0 && (
                  <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-[#D93025] px-1.5 py-0.2 text-[9px] font-bold text-white">
                    ✓ {dayBlockCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ISI KALENDER: TIMELINE JAM VERTIKAL (1 AM - 11 PM) */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2.5 py-16 text-sm font-semibold text-[#1D3668]">
            <Loader2 size={20} className="animate-spin text-[#BE2257]" />
            <span>Memuat kalender jadwal dari Supabase Cloud...</span>
          </div>
        ) : viewMode === 'calendar' ? (
          <div
            ref={scrollContainerRef}
            className="relative max-h-[600px] overflow-y-auto bg-white select-none"
          >
            <div
              className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]"
              style={{ height: `${24 * HOUR_ROW_HEIGHT}px` }}
            >
              {/* Kolom Label Jam (1 am .. 11 pm) */}
              <div className="relative border-r border-[#DFE4F1] bg-[#F9FAFE]">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    style={{ height: `${HOUR_ROW_HEIGHT}px` }}
                    className="relative border-b border-[#DFE4F1]/60 pr-1.5 text-right"
                  >
                    {hour > 0 && (
                      <span className="-top-2 relative text-[10px] font-semibold text-[#757780]">
                        {formatHourLabel(hour)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* 7 Kolom Hari dalam Seminggu */}
              {weekDays.map((day) => {
                const dayBlocks = studyBlocks.filter((b) => b.date === day.iso)

                return (
                  <div
                    key={day.iso}
                    className={`relative border-r border-[#DFE4F1]/70 last:border-r-0 ${
                      day.iso === selectedDate ? 'bg-[#F8FAFF]' : 'bg-white'
                    }`}
                  >
                    {/* Slot Jam Kosong (Klik untuk tambah jadwal pada hari & jam tersebut) */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        onClick={() => openAddModal(day.iso, hour)}
                        title={`Tambah jadwal ${day.dayNameId}, ${day.dayNum} pukul ${String(hour).padStart(2, '0')}:00`}
                        style={{ height: `${HOUR_ROW_HEIGHT}px` }}
                        className="cursor-pointer border-b border-[#DFE4F1]/60 transition hover:bg-[#1A73E8]/5"
                      />
                    ))}

                    {/* Blok Jadwal Berwarna ala Google Calendar */}
                    {dayBlocks.map((block) => {
                      const startStr = block.startTime ?? block.start_time ?? '08:00'
                      const endStr = block.endTime ?? block.end_time ?? '09:00'
                      const startMins = timeToMinutes(startStr)
                      const endMins = Math.max(startMins + 30, timeToMinutes(endStr))
                      const topPx = (startMins / 60) * HOUR_ROW_HEIGHT
                      const heightPx = Math.max(28, ((endMins - startMins) / 60) * HOUR_ROW_HEIGHT - 2)
                      const palette =
                        calendarBlockPalettes[block.type] ?? calendarBlockPalettes['Jadwal kuliah']

                      return (
                        <button
                          key={block.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedBlockDetail(block)
                          }}
                          style={{
                            top: `${topPx}px`,
                            height: `${heightPx}px`,
                          }}
                          className={`absolute inset-x-0.5 z-10 flex flex-col overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left shadow-xs transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#1D3668] ${palette.bg} ${palette.border}`}
                        >
                          <span className="line-clamp-2 text-[10px] sm:text-[11px] font-extrabold leading-tight">
                            {block.title}
                          </span>
                          {heightPx >= 42 && (
                            <span className="mt-0.5 truncate text-[9px] font-semibold opacity-90">
                              {displayTime(startStr)} - {displayTime(endStr)}
                            </span>
                          )}
                          {heightPx >= 60 && block.description && (
                            <span className="mt-0.5 line-clamp-2 text-[9px] leading-tight opacity-85">
                              {block.description}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* Tampilan Daftar Jadwal */
          <div className="p-4 sm:p-6">
            {studyBlocks.length > 0 ? (
              <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {studyBlocks.map((block) => {
                  const startVal = block.startTime ?? block.start_time
                  const endVal = block.endTime ?? block.end_time
                  const subTaskCount = block.subTasks?.length ?? 0
                  const completedCount = block.subTasks?.filter((t) => t.isCompleted).length ?? 0

                  return (
                    <article
                      key={block.id}
                      onClick={() => setSelectedBlockDetail(block)}
                      className="flex cursor-pointer flex-col rounded-2xl border border-[#DFE4F1] bg-white p-4 shadow-2xs transition hover:border-[#1D3668]/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${typeBadgeStyles[block.type]}`}
                        >
                          {block.type}
                        </span>
                        <span className="text-xs font-bold text-[#56638A]">{block.date}</span>
                      </div>
                      <h3 className="mt-3 text-base font-bold text-[#1F2C4F]">{block.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-[#56638A]">
                        {block.description || 'Tidak ada catatan tambahan.'}
                      </p>
                      {subTaskCount > 0 && (
                        <div className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg bg-[#F6F7FC] px-2 py-1 text-[11px] font-semibold text-[#56638A]">
                          <CheckSquare size={13} className="text-[#1D3668]" />
                          <span>
                            {completedCount}/{subTaskCount} sub-tugas
                          </span>
                        </div>
                      )}
                      <div className="mt-4 flex items-center justify-between border-t border-[#DFE4F1] pt-3 text-xs font-bold text-[#1D3668]">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 size={14} />
                          {displayTime(startVal)} - {displayTime(endVal)}
                        </span>
                        <span className="text-[#BE2257] hover:underline">Detail →</span>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm font-bold text-[#1F2C4F]">Belum ada jadwal tersimpan</p>
                <p className="mt-1 text-xs text-[#56638A]">
                  Klik tombol + untuk menambahkan jadwal belajarmu.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Floating Action Button (+) ala Google Calendar */}
      <button
        type="button"
        onClick={() => openAddModal(selectedDate)}
        aria-label="Tambah jadwal belajar"
        className="fixed bottom-20 right-5 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-white text-[#1A73E8] shadow-[0_6px_20px_rgba(26,115,232,0.32)] ring-1 ring-[#DFE4F1] transition hover:scale-105 active:scale-95 lg:bottom-8 lg:right-8"
      >
        <Plus size={28} strokeWidth={2.6} />
      </button>

      {/* Modal Detail Jadwal Saat Blok Kalender Diklik */}
      {selectedBlockDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1A3D]/45 p-4 backdrop-blur-xs"
          onClick={() => setSelectedBlockDetail(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${typeBadgeStyles[selectedBlockDetail.type]}`}
              >
                {selectedBlockDetail.type}
              </span>
              <button
                type="button"
                onClick={() => setSelectedBlockDetail(null)}
                aria-label="Tutup detail"
                className="grid h-8 w-8 place-items-center rounded-lg text-[#56638A] hover:bg-[#F3F4FA]"
              >
                <X size={18} />
              </button>
            </div>

            <h2 className="mt-3 text-xl font-extrabold text-[#1F2C4F]">
              {selectedBlockDetail.title}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#1D3668]">
              <Clock3 size={14} />
              <span>
                {selectedBlockDetail.date} ·{' '}
                {displayTime(selectedBlockDetail.startTime ?? selectedBlockDetail.start_time)} –{' '}
                {displayTime(selectedBlockDetail.endTime ?? selectedBlockDetail.end_time)}
              </span>
            </p>

            {selectedBlockDetail.description && (
              <p className="mt-3 rounded-xl bg-[#F6F7FC] p-3 text-xs leading-relaxed text-[#56638A]">
                {selectedBlockDetail.description}
              </p>
            )}

            {(selectedBlockDetail.subTasks?.length ?? 0) > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold text-[#1F2C4F]">Sub-Tugas / Target Sesi:</p>
                <ul className="space-y-1.5">
                  {selectedBlockDetail.subTasks?.map((task) => (
                    <li key={task.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-[#F6F7FC] px-3 py-2 text-xs font-semibold text-[#1F2C4F]">
                        <input
                          type="checkbox"
                          checked={task.isCompleted}
                          onChange={() =>
                            void toggleSubTask(
                              selectedBlockDetail.id,
                              task.id,
                              !task.isCompleted
                            )
                          }
                          className="h-4 w-4 rounded border-[#C4C6D0] text-[#1D3668]"
                        />
                        <span className={task.isCompleted ? 'line-through text-[#757780]' : ''}>
                          {task.title}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleStartFocusFromCalendar(selectedBlockDetail)}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#BE2257] px-4 text-xs sm:text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition hover:bg-[#A11B48]"
              >
                <Play size={15} fill="currentColor" />
                <span>Mulai Fokus Jadwal Ini</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(selectedBlockDetail.id, selectedBlockDetail.title)}
                aria-label="Hapus jadwal"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Jadwal Belajar */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2C4F]/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-study-block-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-xl sm:p-6">
            <div className="flex items-center justify-between border-b border-[#DFE4F1] pb-4">
              <h2 id="modal-study-block-title" className="text-[18px] font-bold text-[#1F2C4F]">
                Tambah Jadwal ke Kalender
              </h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                aria-label="Tutup modal"
                className="grid h-10 w-10 place-items-center rounded-lg text-[#56638A] hover:bg-[#F3F4FA] hover:text-[#1F2C4F]"
              >
                <X size={20} />
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="block-title" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                  Mata Kuliah / Judul Jadwal
                </label>
                <input
                  id="block-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Contoh: Manajemen Keuangan | D11.10"
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-3.5 text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                />
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="block-type" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                    Kategori Warna
                  </label>
                  <select
                    id="block-type"
                    value={type}
                    onChange={(event) => setType(event.target.value as StudyBlockType)}
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white px-3.5 text-sm text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  >
                    {blockTypes.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="block-date" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                    Tanggal
                  </label>
                  <input
                    id="block-date"
                    type="date"
                    value={formDate}
                    onChange={(event) => setFormDate(event.target.value)}
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-3.5 text-sm text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="block-start" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                    Waktu Mulai
                  </label>
                  <input
                    id="block-start"
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-3.5 text-sm text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>

                <div>
                  <label htmlFor="block-end" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                    Waktu Selesai
                  </label>
                  <input
                    id="block-end"
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-3.5 text-sm text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="block-description" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                  Ruangan / Dosen / Catatan (Opsional)
                </label>
                <textarea
                  id="block-description"
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Contoh: Ruang A20.5 · Bab 3-4"
                  className="w-full rounded-[10px] border border-[#DFE4F1] p-3.5 text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                />
              </div>

              <div>
                <label htmlFor="block-subtask-input" className="mb-1.5 block text-xs font-semibold text-[#1F2C4F]">
                  Daftar Sub-Tugas / Target Sesi (Opsional)
                </label>
                <div className="flex gap-2">
                  <input
                    id="block-subtask-input"
                    type="text"
                    value={newSubTaskText}
                    onChange={(event) => setNewSubTaskText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleAddSubTaskInput()
                      }
                    }}
                    placeholder="Contoh: Kerjakan latihan soal"
                    className="h-10 flex-1 rounded-[10px] border border-[#DFE4F1] px-3 text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubTaskInput}
                    className="h-10 shrink-0 rounded-[10px] bg-[#E1EAF8] px-3.5 text-xs font-bold text-[#1D3668] transition hover:bg-[#d2dff5]"
                  >
                    + Tambah
                  </button>
                </div>

                {subTaskInputs.length > 0 && (
                  <ul className="mt-2.5 space-y-1.5">
                    {subTaskInputs.map((item, idx) => (
                      <li
                        key={`${item}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg bg-[#F6F7FC] px-3 py-1.5 text-xs font-medium text-[#1F2C4F]"
                      >
                        <span className="truncate">{item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubTaskInput(idx)}
                          className="text-[#8E1744] hover:underline"
                        >
                          Hapus
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {formError && (
                <p role="alert" className="text-sm font-medium text-[#BA1A1A]">
                  {formError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="h-11 rounded-[10px] border border-[#DFE4F1] px-4 text-sm font-semibold text-[#56638A] hover:bg-[#F3F4FA]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-5 text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#162B54] disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Jadwal</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
