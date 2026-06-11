import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
import type { DeptIssueItem } from '@/types/dashboard'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

// Cycle through vibrant colors on dark bg
const BAR_COLORS = [
  '#7C3AED', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444',
  '#8B5CF6', '#14B8A6', '#84CC16', '#FB923C', '#F87171',
]

export function DeptChart({ data }: { data: DeptIssueItem[] }) {
  const top = data.slice(0, 10)
  const total = top.reduce((s, d) => s + d.count, 0)

  if (!top.length) {
    return (
      <div className="card-dark rounded-2xl flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-sm text-slate-600">No department data yet</p>
      </div>
    )
  }

  const chartData = {
    labels: top.map(d => d.department),
    datasets: [{
      label:           'Tickets',
      data:            top.map(d => d.count),
      backgroundColor: top.map((_, i) => BAR_COLORS[i % BAR_COLORS.length] + '28'),
      borderColor:     top.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]),
      borderWidth:     1.5,
      borderRadius:    6,
      borderSkipped:   false,
    }],
  }

  return (
    <div className="card-dark rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <p className="text-sm font-bold text-slate-200">Issues by Department</p>
          <p className="text-xs text-slate-600 mt-0.5">{total} tickets · {top.length} departments</p>
        </div>
        <span className="metric text-[10px] font-bold text-slate-600 bg-white/[0.04] rounded-full px-2.5 py-1 border border-white/[0.07]">
          Top {top.length}
        </span>
      </div>
      <div className="p-5">
        <Bar
          data={chartData}
          options={{
            indexAxis: 'y',
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
                callbacks: { label: c => `  ${c.parsed.x} tickets` },
              },
            },
            scales: {
              x: {
                grid:  { color: 'rgba(255,255,255,0.04)' },
                ticks: { color: '#475569', font: { size: 11 } },
                border:{ display: false },
              },
              y: {
                grid:  { display: false },
                ticks: { color: '#64748B', font: { size: 11 } },
                border:{ display: false },
              },
            },
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeOutCubic' as any },
          }}
          height={220}
        />
      </div>
    </div>
  )
}
