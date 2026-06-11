import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { priorityChartColor } from '@/utils/formatters'
import type { PriorityDistItem } from '@/types/dashboard'

ChartJS.register(ArcElement, Tooltip)

const PRIORITY_ORDER  = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low',
}

export function PriorityChart({ data }: { data: PriorityDistItem[] }) {
  const sorted = [...data].sort(
    (a, b) =>
      PRIORITY_ORDER.indexOf(a.priority.toUpperCase()) -
      PRIORITY_ORDER.indexOf(b.priority.toUpperCase()),
  )
  const total = sorted.reduce((s, d) => s + d.count, 0)

  if (!sorted.length) {
    return (
      <div className="card-dark flex flex-col items-center justify-center min-h-[200px] rounded-2xl p-5">
        <p className="text-sm text-slate-600">No ticket data yet</p>
      </div>
    )
  }

  const chartData = {
    labels: sorted.map(d => d.priority.toUpperCase()),
    datasets: [{
      data:             sorted.map(d => d.count),
      backgroundColor:  sorted.map(d => priorityChartColor(d.priority) + '28'),
      borderColor:      sorted.map(d => priorityChartColor(d.priority)),
      borderWidth:      2,
      hoverOffset:      6,
      hoverBorderWidth: 3,
    }],
  }

  return (
    <div className="card-dark rounded-2xl overflow-hidden">
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-sm font-bold text-slate-200">Priority Distribution</p>
        <p className="text-xs text-slate-600 mt-0.5">{total.toLocaleString()} total tickets</p>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-8">
          {/* Donut */}
          <div className="relative h-[130px] w-[130px] shrink-0">
            <Doughnut
              data={chartData}
              options={{
                cutout: '74%',
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
                    callbacks: { label: c => `  ${c.label}: ${c.parsed}` },
                  },
                },
                animation: { duration: 600, easing: 'easeOutCubic' as any },
              }}
            />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="metric text-2xl font-extrabold text-slate-100 tabular-nums">{total}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">tickets</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-3 flex-1">
            {sorted.map(d => {
              const pct   = total > 0 ? Math.round((d.count / total) * 100) : 0
              const color = priorityChartColor(d.priority)
              return (
                <div key={d.priority} className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs font-medium text-slate-500 w-14">
                    {PRIORITY_LABELS[d.priority.toUpperCase()] ?? d.priority}
                  </span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="metric text-xs font-bold text-slate-400 w-7 text-right tabular-nums">
                    {d.count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
