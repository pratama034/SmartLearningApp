import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  MessageSquareText,
  Paperclip,
  Send,
  UsersRound,
} from 'lucide-react'
import { mockChatMessages, mockGroupMembers, type MockChatMessage } from '../../data/mockData'

function getMemberColor(_name: string, index: number) {
  const colors = [
    'bg-[#1D3668]',
    'bg-[#BE2257]',
    'bg-[#003964]',
    'bg-[#8E1744]',
  ]
  return colors[index % colors.length]
}

function MessageAttachment({
  message,
  isOwn,
}: {
  message: MockChatMessage
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
        <div className="flex items-center gap-2">
          <ImageIcon
            size={18}
            className={isOwn ? 'text-[#9CC3FF]' : 'text-[#1D3668]'}
            aria-hidden="true"
          />
          <span className="text-xs font-bold">{message.imageLabel || 'Gambar materi bersama'}</span>
        </div>
        <div
          className={`mt-2 flex h-24 sm:h-28 items-center justify-center rounded-lg text-xs font-semibold ${
            isOwn ? 'bg-black/20 text-white/90' : 'bg-[#E1EAF8]/60 text-[#1D3668]'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <ImageIcon size={16} aria-hidden="true" /> Pratinjau Alur & Diskusi Desain
          </span>
        </div>
        <p className={`mt-1.5 text-[11px] ${isOwn ? 'text-white/70' : 'text-[#56638A]'}`}>
          Klik untuk memperbesar pratinjau materi
        </p>
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
          <span className={`block truncate text-xs font-bold ${isOwn ? 'text-white' : 'text-[#1F2C4F]'}`}>
            {fileName}
          </span>
          <span className={`mt-0.5 block text-[11px] ${isOwn ? 'text-white/75' : 'text-[#56638A]'}`}>
            {fileType} · 2.4 MB · Dokumen tugas
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

export default function StudyGroupRoom() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<MockChatMessage[]>(mockChatMessages)
  const [draft, setDraft] = useState('')

  function addLocalDocument() {
    setMessages((current) => [
      ...current,
      {
        id: `local-doc-${Date.now()}`,
        senderId: 'current-user',
        senderName: 'Anda',
        time: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
        kind: 'document',
        fileName: 'Revisi_Tugas_Inovasi_v2.pdf',
        fileType: 'PDF',
        text: 'Ini draf revisi tugas kelompok terbaru yang sudah diselaraskan.',
      },
    ])
  }

  function addLocalImage() {
    setMessages((current) => [
      ...current,
      {
        id: `local-img-${Date.now()}`,
        senderId: 'current-user',
        senderName: 'Anda',
        time: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
        kind: 'image',
        imageLabel: 'Bagan_Alur_Kerja_Kelompok.png',
        text: 'Bagan pembagian tugas dan target pengerjaan minggu ini.',
      },
    ])
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        senderId: 'current-user',
        senderName: 'Anda',
        time: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
        kind: 'text',
        text,
      },
    ])
    setDraft('')
  }

  return (
    <div className="space-y-5 sm:space-y-6">
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
          Ruang Belajar Bersama
        </span>
      </div>

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
                Kelompok Inovasi
              </h1>
              <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">
                Diskusikan materi, pertukaran berkas tugas, dan pantau ritme belajar rekan kelompok secara terkoordinasi.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D6F0DE] px-3 py-1.5 text-xs font-bold text-[#17623A]">
              <span className="h-2 w-2 rounded-full bg-[#17623A] animate-pulse" />
              {mockGroupMembers.length} Rekan Terhubung
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
                {mockGroupMembers.length}
              </span>
            </div>

            <ul className="space-y-2.5">
              {mockGroupMembers.map((member, index) => {
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
                      <p className="truncate text-sm font-bold text-[#1F2C4F]">{member.name}</p>
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
          </section>

          {/* Guidelines / Tips Card */}
          <section className="rounded-2xl border border-[#5E3F0C]/10 bg-[#FBEFD9] p-5 text-[#5E3F0C] shadow-[0_2px_6px_rgba(94,63,12,0.05)]">
            <div className="flex items-center gap-2">
              <Lightbulb size={19} aria-hidden="true" />
              <h3 className="text-sm font-bold leading-5">Prinsip Ruang Belajar</h3>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-[18px] text-[#5E3F0C]/90">
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>Rekan yang sedang <strong>Fokus</strong> menerima pesan tanpa dering notifikasi langsung.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>Unggah berkas tugas (PDF/Word) atau bagan alur untuk didiskusikan bersama.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>Pesan otomatis di Co-Focus memastikan rekan tahu kamu sedang belajar mandiri.</span>
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
                <p className="text-xs text-[#56638A]">Kelompok Inovasi · Forum aktif bersama rekan studi</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addLocalDocument}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#DFE4F1] bg-[#F6F7FC] px-3 py-1.5 text-xs font-bold text-[#1D3668] transition hover:bg-[#E1EAF8]"
                title="Simulasikan kirim lampiran dokumen tugas"
              >
                <Paperclip size={14} aria-hidden="true" />
                + Lampirkan Tugas
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1" aria-live="polite">
            <div className="flex justify-center my-2">
              <span className="rounded-full border border-[#DFE4F1] bg-[#F6F7FC] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#757780]">
                Hari ini · Diskusi Kelompok Aktif
              </span>
            </div>

            {messages.map((message) => {
              const isOwn = message.senderId === 'current-user'
              return (
                <article
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
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
                    <div
                      className={`rounded-2xl p-4 shadow-sm ${
                        isOwn
                          ? 'rounded-tr-none bg-[#1D3668] text-white'
                          : 'rounded-tl-none border border-[#DFE4F1] bg-[#F6F7FC] text-[#1F2C4F]'
                      }`}
                    >
                      {message.text && (
                        <p className={`text-sm leading-relaxed ${isOwn ? 'text-white' : 'text-[#1F2C4F]'}`}>
                          {message.text}
                        </p>
                      )}
                      <MessageAttachment message={message} isOwn={isOwn} />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {/* Form Input Bar */}
          <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-[#DFE4F1] pt-3.5">
            <button
              type="button"
              onClick={addLocalDocument}
              aria-label="Lampirkan dokumen tugas"
              title="Lampirkan dokumen tugas (PDF)"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[#DFE4F1] bg-[#F6F7FC] text-[#56638A] transition hover:bg-[#E1EAF8] hover:text-[#1D3668] focus:outline-none focus:ring-2 focus:ring-[#1D3668]"
            >
              <Paperclip size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={addLocalImage}
              aria-label="Lampirkan gambar alur"
              title="Lampirkan gambar rancangan alur"
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
