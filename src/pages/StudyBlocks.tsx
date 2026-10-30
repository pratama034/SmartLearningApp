import {
  AlertCircle,
  CalendarX,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { getStudyDate } from '../data/mockData'
import { useAuthStore } from '../store/authStore'
import { useStudyStore } from '../store/studyStore'
import type { StudyBlockType } from '../types'

const blockTypes = ['Jadwal kuliah', 'Belajar mandiri', 'Kerja kelompok', 'Persiapan ujian'] as const

const studyBlockSchema = z.object({
  title: z.string().trim().min(1, 'Judul wajib diisi.'),
  type: z.enum(blockTypes),
  startTime: z.string().min(1, 'Waktu mulai wajib diisi.'),
  endTime: z.string().min(1, 'Waktu selesai wajib diisi.'),
})

const typeStyles: Record<StudyBlockType, string> = {
  'Jadwal kuliah': 'bg-[#E1EAF8] text-[#1D3668]',
  'Belajar mandiri': 'bg-[#D6F0DE] text-[#17623A]',
  'Kerja kelompok': 'bg-[#FCDDE6] text-[#8E1744]',
  'Persiapan ujian': 'bg-[#FDEBC8] text-[#7A4B00]',
}

function displayTime(value: string) {
  return value.replace(':', '.')
}

export default function StudyBlocks() {
  const user = useAuthStore((state) => state.user)
  const studyBlocks = useStudyStore((state) => state.studyBlocks)
  const fetchStudyBlocks = useStudyStore((state) => state.fetchStudyBlocks)
  const addStudyBlock = useStudyStore((state) => state.addStudyBlock)
  const deleteStudyBlock = useStudyStore((state) => state.deleteStudyBlock)
  const isLoading = useStudyStore((state) => state.isLoading)
  const storeError = useStudyStore((state) => state.error)
  const clearError = useStudyStore((state) => state.clearError)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<StudyBlockType>('Belajar mandiri')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [subTaskInputs, setSubTaskInputs] = useState<string[]>([])
  const [newSubTaskText, setNewSubTaskText] = useState('')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (user?.id) {
      void fetchStudyBlocks(user.id)
    }
  }, [fetchStudyBlocks, user?.id])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

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
    const validation = studyBlockSchema.safeParse({ title, type, startTime, endTime })

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
        date: getStudyDate(),
        autoFocus: false,
        auto_focus: false,
        coFocusEnabled: false,
        co_focus_enabled: false,
        subTasks: pendingSubTasks,
      })

      setTitle('')
      setDescription('')
      setType('Belajar mandiri')
      setStartTime('')
      setEndTime('')
      setSubTaskInputs([])
      setNewSubTaskText('')
      closeModal()
      setToast({ type: 'success', message: 'Jadwal belajar berhasil disimpan ke Supabase.' })
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
      setToast({ type: 'success', message: `Jadwal "${blockTitle}" berhasil dihapus.` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus jadwal belajar.'
      setToast({ type: 'error', message: msg })
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
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

      <section className="flex flex-col gap-4 rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
            Perencanaan belajar
          </p>
          <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">
            Study Block
          </h1>
          <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">
            Susun waktu belajar agar sesi fokusmu lebih terarah dan tersinkronisasi di cloud.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={isLoading}
          className="flex h-[46px] shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition hover:bg-[#A11B48] focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={18} strokeWidth={2.4} />
          Tambah Jadwal
        </button>
      </section>

      <section aria-labelledby="study-block-list-title">
        <div className="mb-3 flex items-center justify-between px-0.5">
          <h2 id="study-block-list-title" className="text-[18px] font-bold leading-6 text-[#1F2C4F]">
            Jadwal tersimpan
          </h2>
          <span className="rounded-full bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]">
            {studyBlocks.length} jadwal
          </span>
        </div>

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="space-y-4"
          >
            <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[#DFE4F1] bg-white px-5 py-6 text-sm font-semibold text-[#1D3668] shadow-[0_2px_4px_rgba(29,54,104,0.03)]">
              <Loader2 size={20} className="animate-spin text-[#BE2257]" aria-hidden="true" />
              <span>Mengambil jadwal belajar dari Supabase Cloud...</span>
            </div>
            <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="flex min-h-[196px] animate-pulse flex-col rounded-2xl border border-[#DFE4F1] bg-white p-5"
                >
                  <div className="h-6 w-28 rounded-full bg-[#E1EAF8]" />
                  <div className="mt-4 h-6 w-3/4 rounded-lg bg-[#EEF1F8]" />
                  <div className="mt-2 h-4 w-full rounded-lg bg-[#F6F7FC]" />
                  <div className="mt-auto h-5 w-36 rounded-lg bg-[#EEF1F8]" />
                </div>
              ))}
            </div>
          </div>
        ) : studyBlocks.length ? (
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {studyBlocks.map((block) => {
              const startVal = block.startTime ?? block.start_time
              const endVal = block.endTime ?? block.end_time
              const subTaskCount = block.subTasks?.length ?? 0
              const completedCount = block.subTasks?.filter((t) => t.isCompleted).length ?? 0

              return (
                <article
                  key={block.id}
                  className="flex min-h-[196px] flex-col rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${typeStyles[block.type]}`}
                    >
                      {block.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDelete(block.id, block.title)}
                      aria-label={`Hapus jadwal ${block.title}`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#FCDDE6] text-[#8E1744] transition hover:bg-[#FCDDE6] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2"
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <h3 className="mt-4 text-[18px] font-bold leading-6 text-[#1F2C4F]">
                    {block.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-[18px] text-[#56638A]">
                    {block.description || 'Tidak ada catatan tambahan.'}
                  </p>
                  {subTaskCount > 0 && (
                    <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg bg-[#F6F7FC] px-2.5 py-1 text-xs font-semibold text-[#56638A]">
                      <CheckSquare size={14} className="text-[#1D3668]" aria-hidden="true" />
                      <span>
                        {completedCount}/{subTaskCount} sub-tugas selesai
                      </span>
                    </div>
                  )}
                  <div className="mt-auto flex items-center gap-2 border-t border-[#DFE4F1] pt-4 text-[13px] font-semibold text-[#1D3668]">
                    <Clock3 size={16} aria-hidden="true" />
                    <span className="tabular-nums">
                      {displayTime(startVal)} - {displayTime(endVal)}
                    </span>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-[#DFE4F1] bg-white px-6 py-12 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:py-14">
            <span className="grid h-24 w-24 place-items-center rounded-full bg-[#F3F4FA]">
              <CalendarX
                className="h-16 w-16 text-[#1D3668]/30"
                strokeWidth={1.4}
                aria-hidden="true"
              />
            </span>
            <h3 className="mt-5 text-lg font-extrabold text-[#1F2C4F]">
              Belum ada jadwal hari ini
            </h3>
            <p className="mt-1.5 max-w-sm text-[13px] leading-[19px] text-[#56638A]">
              Pecah tugas besarmu menjadi blok-blok waktu kecil agar lebih fokus.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-6 flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-5 text-sm font-bold text-white shadow-md shadow-[#1D3668]/20 transition hover:bg-[#162B54] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2 active:scale-[0.98]"
            >
              <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
              Buat Jadwal Pertama
            </button>
          </div>
        )}
      </section>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-study-block-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_16px_32px_rgba(29,54,104,0.12)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">
                  Jadwal baru
                </p>
                <h2
                  id="add-study-block-title"
                  className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F]"
                >
                  Tambah Study Block
                </h2>
                <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">
                  Tentukan kegiatan dan waktu fokus belajarmu.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[#56638A] transition hover:bg-[#F6F7FC] hover:text-[#1D3668] focus:outline-none focus:ring-2 focus:ring-[#1D3668]"
                aria-label="Tutup formulir tambah jadwal"
              >
                ×
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              <div>
                <label
                  htmlFor="block-title"
                  className="mb-2 block text-sm font-semibold text-[#1F2C4F]"
                >
                  Judul
                </label>
                <input
                  id="block-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Contoh: Belajar untuk UTS"
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-4 text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                />
              </div>

              <div>
                <label
                  htmlFor="block-description"
                  className="mb-2 block text-sm font-semibold text-[#1F2C4F]"
                >
                  Deskripsi singkat (opsional)
                </label>
                <input
                  id="block-description"
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Contoh: Rangkum bab 1-3 dan latihan soal"
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-4 text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                />
              </div>

              <div>
                <label
                  htmlFor="block-type"
                  className="mb-2 block text-sm font-semibold text-[#1F2C4F]"
                >
                  Jenis kegiatan
                </label>
                <select
                  id="block-type"
                  value={type}
                  onChange={(event) => setType(event.target.value as StudyBlockType)}
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white px-4 text-sm text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                >
                  {blockTypes.map((blockType) => (
                    <option key={blockType} value={blockType}>
                      {blockType}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="block-start-time"
                    className="mb-2 block text-sm font-semibold text-[#1F2C4F]"
                  >
                    Waktu mulai
                  </label>
                  <input
                    id="block-start-time"
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-4 text-sm text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="block-end-time"
                    className="mb-2 block text-sm font-semibold text-[#1F2C4F]"
                  >
                    Waktu selesai
                  </label>
                  <input
                    id="block-end-time"
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-4 text-sm text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
              </div>

              {/* Sub-tasks / Checklist opsional */}
              <div>
                <label
                  htmlFor="block-subtask-input"
                  className="mb-2 block text-sm font-semibold text-[#1F2C4F]"
                >
                  Target Sub-Tugas / Checklist (opsional)
                </label>
                <div className="flex gap-2">
                  <input
                    id="block-subtask-input"
                    type="text"
                    value={newSubTaskText}
                    onChange={(e) => setNewSubTaskText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddSubTaskInput()
                      }
                    }}
                    placeholder="Tambah langkah kecil lalu klik +"
                    className="h-10 flex-1 rounded-[10px] border border-[#DFE4F1] px-3.5 text-sm text-[#1F2C4F] outline-none placeholder:text-[#56638A] focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubTaskInput}
                    className="flex h-10 items-center justify-center rounded-[10px] bg-[#E1EAF8] px-3.5 text-xs font-bold text-[#1D3668] transition hover:bg-[#D2E0F5]"
                  >
                    + Tambah
                  </button>
                </div>

                {subTaskInputs.length > 0 && (
                  <ul className="mt-2.5 space-y-1.5">
                    {subTaskInputs.map((item, idx) => (
                      <li
                        key={`${item}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[#DFE4F1] bg-[#F6F7FC] px-3 py-1.5 text-xs font-medium text-[#1F2C4F]"
                      >
                        <span className="truncate">{item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubTaskInput(idx)}
                          className="text-red-600 hover:text-red-800"
                          aria-label={`Hapus sub-tugas ${item}`}
                        >
                          <X size={14} aria-hidden="true" />
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

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="h-11 rounded-[10px] border border-[#DFE4F1] px-4 text-sm font-semibold text-[#1D3668] transition hover:bg-[#F6F7FC] focus:outline-none focus:ring-2 focus:ring-[#1D3668]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1D3668] px-4 text-sm font-bold text-white transition hover:bg-[#152A55] focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Jadwal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
