import { CalendarDays, Clock3, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useStudyStore } from '../store/studyStore'
import { useAuthStore } from '../store/authStore'
import type { StudyBlockType } from '../types'
import { z } from 'zod'

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
  const blocks = useStudyStore((state) => state.blocks)
  const addBlock = useStudyStore((state) => state.addBlock)
  const deleteBlock = useStudyStore((state) => state.deleteBlock)
  const user = useAuthStore((state) => state.user)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<StudyBlockType>('Belajar mandiri')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [formError, setFormError] = useState('')

  function closeModal() {
    setIsModalOpen(false)
    setFormError('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = studyBlockSchema.safeParse({ title, type, startTime, endTime })

    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message ?? 'Lengkapi data jadwal.')
      return
    }

    addBlock({
      id: crypto.randomUUID(),
      user_id: user?.id ?? 'user-uuid-001',
      title: validation.data.title,
      type: validation.data.type,
      start_time: validation.data.startTime,
      end_time: validation.data.endTime,
      description: '',
      recurrence_rule: null,
      date: new Date().toISOString().slice(0, 10),
      auto_focus: false,
      co_focus_enabled: false,
      status: 'scheduled',
    })

    setTitle('')
    setType('Belajar mandiri')
    setStartTime('')
    setEndTime('')
    closeModal()
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Perencanaan belajar</p>
          <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">Study Block</h1>
          <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">Susun waktu belajar agar sesi fokusmu lebih terarah.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex h-[46px] shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#BE2257] px-4 text-sm font-bold text-white shadow-md shadow-[#BE2257]/20 transition hover:bg-[#A11B48] focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2 active:scale-[0.98]"
        >
          <Plus size={18} strokeWidth={2.4} />
          Tambah Jadwal
        </button>
      </section>

      <section aria-labelledby="study-block-list-title">
        <div className="mb-3 flex items-center justify-between px-0.5">
          <h2 id="study-block-list-title" className="text-[18px] font-bold leading-6 text-[#1F2C4F]">Jadwal tersimpan</h2>
          <span className="rounded-full bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]">{blocks.length} jadwal</span>
        </div>

        {blocks.length ? (
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {blocks.map((block) => (
              <article key={block.id} className="flex min-h-[196px] flex-col rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${typeStyles[block.type]}`}>
                    {block.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteBlock(block.id)}
                    aria-label={`Hapus jadwal ${block.title}`}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#FCDDE6] text-[#8E1744] transition hover:bg-[#FCDDE6] focus:outline-none focus:ring-2 focus:ring-[#BE2257] focus:ring-offset-2"
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
                <h3 className="mt-4 text-[18px] font-bold leading-6 text-[#1F2C4F]">{block.title}</h3>
                <p className="mt-1 line-clamp-2 text-[13px] leading-[18px] text-[#56638A]">{block.description}</p>
                <div className="mt-auto flex items-center gap-2 border-t border-[#DFE4F1] pt-4 text-[13px] font-semibold text-[#1D3668]">
                  <Clock3 size={16} aria-hidden="true" />
                  <span className="tabular-nums">{displayTime(block.start_time)} - {displayTime(block.end_time)}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#C4C6D0] bg-white px-5 py-10 text-center shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
              <CalendarDays size={21} aria-hidden="true" />
            </span>
            <h3 className="mt-3 text-sm font-bold text-[#1F2C4F]">Belum ada jadwal belajar</h3>
            <p className="mt-1 text-xs leading-[18px] text-[#56638A]">Tambahkan study block pertamamu untuk mulai merencanakan fokus belajar.</p>
          </div>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-study-block-title"
            className="w-full max-w-lg rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_16px_32px_rgba(29,54,104,0.12)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Jadwal baru</p>
                <h2 id="add-study-block-title" className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F]">Tambah Study Block</h2>
                <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">Tentukan kegiatan dan waktu fokus belajarmu.</p>
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
                <label htmlFor="block-title" className="mb-2 block text-sm font-semibold text-[#1F2C4F]">Judul</label>
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
                <label htmlFor="block-type" className="mb-2 block text-sm font-semibold text-[#1F2C4F]">Jenis kegiatan</label>
                <select
                  id="block-type"
                  value={type}
                  onChange={(event) => setType(event.target.value as StudyBlockType)}
                  className="h-11 w-full rounded-[10px] border border-[#DFE4F1] bg-white px-4 text-sm text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                >
                  {blockTypes.map((blockType) => <option key={blockType} value={blockType}>{blockType}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="block-start-time" className="mb-2 block text-sm font-semibold text-[#1F2C4F]">Waktu mulai</label>
                  <input
                    id="block-start-time"
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-4 text-sm text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
                <div>
                  <label htmlFor="block-end-time" className="mb-2 block text-sm font-semibold text-[#1F2C4F]">Waktu selesai</label>
                  <input
                    id="block-end-time"
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="h-11 w-full rounded-[10px] border border-[#DFE4F1] px-4 text-sm text-[#1F2C4F] outline-none focus:border-[#1D3668] focus:ring-2 focus:ring-[#1D3668]"
                  />
                </div>
              </div>

              {formError && <p role="alert" className="text-sm font-medium text-[#BA1A1A]">{formError}</p>}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeModal} className="h-11 rounded-[10px] border border-[#DFE4F1] px-4 text-sm font-semibold text-[#1D3668] transition hover:bg-[#F6F7FC] focus:outline-none focus:ring-2 focus:ring-[#1D3668]">
                  Batal
                </button>
                <button type="submit" className="h-11 rounded-[10px] bg-[#1D3668] px-4 text-sm font-bold text-white transition hover:bg-[#152A55] focus:outline-none focus:ring-2 focus:ring-[#1D3668] focus:ring-offset-2">
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
