import { BarChart3, Clock3, ShieldCheck, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { mockCampusData, mockReportData } from '../lib/mockData'

type ReportTab = 'personal' | 'campus'

function FocusChart({ data, color }: { data: typeof mockReportData; color: string }) {
  return (
    <div className="h-72 min-w-0" aria-label="Grafik batang durasi fokus per hari">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#56638A', fontSize: 12, fontWeight: 600 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#757780', fontSize: 12 }} unit="m" />
          <Tooltip
            cursor={{ fill: '#F6F7FC' }}
            contentStyle={{ borderRadius: 10, border: '1px solid #DFE4F1', boxShadow: '0 8px 16px rgba(29,54,104,0.08)' }}
            formatter={(value) => [`${value} menit`, 'Waktu fokus']}
          />
          <Bar dataKey="focusMinutes" fill={color} radius={[8, 8, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Clock3; label: string; value: string; detail: string; tone: 'blue' | 'green' | 'rose' }) {
  const tones = {
    blue: 'bg-[#E1EAF8] text-[#1D3668]',
    green: 'bg-[#D6F0DE] text-[#17623A]',
    rose: 'bg-[#FCDDE6] text-[#8E1744]',
  }

  return (
    <article className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)]">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon size={20} aria-hidden="true" /></span>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#757780]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-[#1F2C4F]">{value}</p>
      <p className="mt-1 text-[12px] leading-[18px] text-[#56638A]">{detail}</p>
    </article>
  )
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('personal')
  const data = activeTab === 'personal' ? mockReportData : mockCampusData
  const totalMinutes = useMemo(() => data.reduce((total, item) => total + item.focusMinutes, 0), [data])
  const averageMinutes = Math.round(totalMinutes / data.length)

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#BE2257]">Analitik belajar</p>
        <h1 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-[#1F2C4F] sm:text-[28px] sm:leading-9">Laporan Pola Fokus</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-[19px] text-[#56638A]">Kenali kebiasaan belajarmu dan evaluasi perkembangan fokus terstruktur.</p>

        <div className="mt-6 inline-flex rounded-xl bg-[#EAEDFF] p-1" role="tablist" aria-label="Jenis laporan">
          <button type="button" role="tab" aria-selected={activeTab === 'personal'} onClick={() => setActiveTab('personal')} className={`h-10 rounded-lg px-4 text-sm font-bold transition ${activeTab === 'personal' ? 'bg-[#1D3668] text-white shadow-sm' : 'text-[#56638A] hover:text-[#1F2C4F]'}`}>Tab Pribadi</button>
          <button type="button" role="tab" aria-selected={activeTab === 'campus'} onClick={() => setActiveTab('campus')} className={`h-10 rounded-lg px-4 text-sm font-bold transition ${activeTab === 'campus' ? 'bg-[#1D3668] text-white shadow-sm' : 'text-[#56638A] hover:text-[#1F2C4F]'}`}>Tab Kampus</button>
        </div>
      </section>

      {activeTab === 'personal' ? (
        <section aria-label="Statistik fokus pribadi" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={Trophy} label="Total selesai" value="12 blok" detail="5 hari terakhir" tone="green" />
          <StatCard icon={Clock3} label="Total fokus" value={`${totalMinutes} menit`} detail="Akumulasi minggu ini" tone="blue" />
          <StatCard icon={BarChart3} label="Rata rata fokus" value={`${averageMinutes} menit`} detail="Per hari belajar" tone="rose" />
        </section>
      ) : (
        <section className="flex items-start gap-3 rounded-2xl border border-[#5E3F0C]/10 bg-[#FBEFD9] p-5 text-[#5E3F0C] shadow-[0_2px_6px_rgba(94,63,12,0.06)]">
          <ShieldCheck className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
          <div><h2 className="text-sm font-bold">Data bersifat agregat dan anonim</h2><p className="mt-1 text-[13px] leading-[19px]">Data ini adalah rata-rata fokus mahasiswa dan tidak menampilkan identitas atau aktivitas individu.</p></div>
        </section>
      )}

      <section className="rounded-2xl border border-[#DFE4F1] bg-white p-5 shadow-[0_2px_4px_rgba(29,54,104,0.03),0_8px_16px_rgba(29,54,104,0.04)] sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[18px] font-bold leading-6 text-[#1F2C4F]">{activeTab === 'personal' ? 'Durasi Fokus per Hari' : 'Rata Rata Fokus Mahasiswa per Hari'}</h2>
            <p className="mt-1 text-[13px] leading-[19px] text-[#56638A]">{activeTab === 'personal' ? 'Capaian waktu fokusmu dalam lima hari terakhir.' : 'Perbandingan waktu fokus agregat kampus dalam lima hari terakhir.'}</p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#E1EAF8] px-2.5 py-1 text-[11px] font-semibold text-[#1D3668]"><span className="h-2 w-2 rounded-sm bg-[#1D3668]" /> Menit fokus</span>
        </div>
        <div className="mt-5 min-w-0"><FocusChart data={data} color={activeTab === 'personal' ? '#1D3668' : '#BE2257'} /></div>
      </section>
    </div>
  )
}
