import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Filler,
} from 'chart.js'
import { format, parseISO } from 'date-fns'
import type { EscalationTrendItem } from '@/types/dashboard'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

export function EscalationTrend({ data }: { data: EscalationTrendItem[] }) {
  const labels    = data.map(d => format(parseISO(d.date), 'MMM d'))
  const totalSum  = data.reduce((s, d) => s + d.total, 0)
  const escalSum  = data.reduce((s, d) => s + d.escalated, 0)
  const escalRate = totalSum > 0 ? ((escalSum / totalSum) * 100).toFixed(1) : '0.0'

  const mkGradient = (ctx: any, color: string) => {
    const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200)
    g.addColorStop(0, color + '30')
    g.addColorStop(1, color + '00')
    return g
  }

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Total',
        data:  data.map(d => d.total),
        borderColor:     '#7C3AED',
        backgroundColor: (ctx: any) => mkGradient(ctx, '#7C3AED'),
        tension:         0.4,
        fill:            true,
        pointRadius:     4,
        pointBackgroundColor: '#7C3AED',
        pointBorderColor:     '#0F172A',
        pointBorderWidth:     2,
        pointHoverRadius:     6,
      },
      {
        label: 'Escalated',
        data:  data.map(d => d.escalated),
        borderColor:     '#06B6D4',
        backgroundColor: (ctx: any) => mkGradient(ctx, '#06B6D4'),
        tension:         0.4,
        fill:            true,
        pointRadius:     4,
        pointBackgroundColor: '#06B6D4',
        pointBorderColor:     '#0F172A',
        pointBorderWidth:     2,
        pointHoverRadius:     6,
      },
    ],
  }

  const GRID_COLOR = 'rgba(255,255,255,0.04)'
  const TICK_COLOR = '#475569'

  return (
    <div className="card-dark rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <p className="text-sm font-bold text-slate-200">Escalation Trends</p>
          <p className="text-xs text-slate-600 mt-0.5">Last 7 days · {escalRate}% escalation rate</p>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="h-2 w-3 rounded-full bg-violet-500" />
            Total
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="h-2 w-3 rounded-full bg-cyan-500" />
            Escalated
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { label: '7-day total',  value: totalSum,          color: 'text-slate-200' },
          { label: 'Escalated',    value: escalSum,           color: 'text-cyan-400'  },
          { label: 'Escalation %', value: `${escalRate}%`,   color: 'text-violet-400' },
        ].map(s => (
          <div key={s.label} className="px-5 py-3 text-center">
            <p className={`metric text-lg font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="p-5">
        <Line
          data={chartData}
          options={{
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#1E293B',
                titleColor:      '#F1F5F9',
                bodyColor:       '#94A3B8',
                borderColor:     'rgba(255,255,255,0.08)',
                borderWidth:     1,
                padding:         10,
                cornerRadius:    10,
                mode:            'index',
                intersect:       false,
              },
            },
            interaction: { mode: 'index', intersect: false },
            scales: {
              x: {
                grid:  { color: GRID_COLOR },
                ticks: { color: TICK_COLOR, font: { size: 11 } },
                border:{ display: false },
              },
              y: {
                grid:  { color: GRID_COLOR },
                ticks: { color: TICK_COLOR, font: { size: 11 } },
                border:{ display: false },
                beginAtZero: true,
              },
            },
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeOutCubic' as any },
          }}
          height={180}
        />
      </div>
    </div>
  )
}
