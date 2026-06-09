import { useState } from 'react'
import { useQuery } from 'react-query'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Legend,
} from 'chart.js'
import { PageWrapper }  from '@/components/layout/PageWrapper'
import { Spinner }      from '@/components/ui/Spinner'
import { dashboardApi } from '@/api/dashboard'
import { slaColor, fmtPercent } from '@/utils/formatters'
import { cn }           from '@/utils/cn'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const RANGES = [
  { label: 'Last 7 days',  value: 7  },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-bold text-slate-200 mb-4">{children}</p>
  )
}

function EmptyRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      <td colSpan={cols} className="py-12 text-center text-sm text-slate-600">
        No data available
      </td>
    </tr>
  )
}

export default function Analytics() {
  const [range, setRange] = useState(30)

  const cat    = useQuery(['analytics-cat',    range], dashboardApi.getCategoryBreakdown, { staleTime: 60_000 })
  const teams  = useQuery(['analytics-teams',  range], dashboardApi.getTeamWorkload,       { staleTime: 60_000 })
  const trends = useQuery(['analytics-trends', range], dashboardApi.getEscalationTrends,  { staleTime: 60_000 })

  const GRID  = 'rgba(255,255,255,0.04)'
  const TICK  = '#475569'

  return (
    <PageWrapper title="Analytics" subtitle="Deep-dive metrics and trends">

      {/* Range selector */}
      <div className="mb-6 flex gap-2">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-150',
              range === r.value
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.05]',
            )}
            style={range !== r.value ? { border: '1px solid rgba(255,255,255,0.09)' } : {}}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">

        {/* Category breakdown */}
        <div className="card-dark rounded-2xl overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <SectionTitle>Category Breakdown</SectionTitle>
          </div>
          <div className="p-5">
            {cat.isLoading ? (
              <div className="flex h-40 items-center justify-center"><Spinner /></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Category', 'Count', 'Share', 'Bar'].map(h => (
                      <th key={h} className="pb-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(cat.data ?? []).length === 0 ? <EmptyRow /> : (cat.data ?? []).map(c => (
                    <tr key={c.category} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="py-2.5 text-slate-400">{c.category}</td>
                      <td className="py-2.5 text-right metric font-bold text-slate-200">{c.count}</td>
                      <td className="py-2.5 text-right text-slate-600">{fmtPercent(c.percentage)}</td>
                      <td className="py-2.5 pl-4">
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div
                            className="h-full rounded-full bg-violet-500/60"
                            style={{ width: `${Math.min(100, c.percentage)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Team workload */}
        <div className="card-dark rounded-2xl overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <SectionTitle>Team Workload</SectionTitle>
          </div>
          <div className="p-5">
            {teams.isLoading ? (
              <div className="flex h-40 items-center justify-center"><Spinner /></div>
            ) : (teams.data ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-600">No active team assignments</p>
            ) : (
              <div className="space-y-4">
                {(teams.data ?? []).map(t => (
                  <div key={t.team}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="max-w-[65%] truncate text-slate-400 font-semibold">{t.team}</span>
                      <span className="metric font-bold text-slate-300">{t.open_tickets} open</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (t.open_tickets / 20) * 100)}%`,
                          backgroundColor: slaColor(t.avg_sla_risk),
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Avg SLA risk: {t.avg_sla_risk.toFixed(1)}% · {t.critical_count} critical
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Escalation trend — full width */}
        <div className="card-dark rounded-2xl overflow-hidden lg:col-span-2">
          <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <SectionTitle>Escalation Trend</SectionTitle>
            <div className="flex gap-4 text-xs">
              {[['#7C3AED','Total'],['#06B6D4','Escalated']].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1.5 text-slate-500">
                  <span className="inline-block h-2 w-3 rounded-full" style={{ backgroundColor: c }} />
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div className="p-5">
            {trends.isLoading ? (
              <div className="flex h-48 items-center justify-center"><Spinner /></div>
            ) : (
              <Line
                data={{
                  labels: (trends.data ?? []).map(d => d.date),
                  datasets: [
                    {
                      label: 'Total', data: (trends.data ?? []).map(d => d.total),
                      borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.08)',
                      tension: 0.4, fill: true, pointRadius: 3,
                      pointBackgroundColor: '#7C3AED', pointBorderColor: '#0F172A', pointBorderWidth: 2,
                    },
                    {
                      label: 'Escalated', data: (trends.data ?? []).map(d => d.escalated),
                      borderColor: '#06B6D4', backgroundColor: 'rgba(6,182,212,0.08)',
                      tension: 0.4, fill: true, pointRadius: 3,
                      pointBackgroundColor: '#06B6D4', pointBorderColor: '#0F172A', pointBorderWidth: 2,
                    },
                  ],
                }}
                options={{
                  plugins: { legend: { display: false }, tooltip: { mode: 'index' as any } },
                  scales: {
                    x: { grid: { color: GRID }, ticks: { color: TICK, font: { size: 11 } }, border: { display: false } },
                    y: { grid: { color: GRID }, ticks: { color: TICK, font: { size: 11 } }, border: { display: false }, beginAtZero: true },
                  },
                  maintainAspectRatio: false,
                }}
                height={220}
              />
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
