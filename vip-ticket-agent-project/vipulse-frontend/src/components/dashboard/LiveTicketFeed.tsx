import { Crown, ExternalLink, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { slaColor, fmtRelative } from '@/utils/formatters'
import { PRIORITY_BG, STATUS_BG } from '@/utils/constants'
import type { LiveTicketItem } from '@/types/dashboard'

function SlaBar({ score }: { score: number }) {
  const color = slaColor(score)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-14 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, score)}%`, backgroundColor: color }}
        />
      </div>
      <span className="metric text-xs font-bold tabular-nums" style={{ color }}>
        {score.toFixed(0)}%
      </span>
    </div>
  )
}

export function LiveTicketFeed({ tickets }: { tickets: LiveTicketItem[] }) {
  return (
    <div className="card-dark rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <p className="text-sm font-bold text-slate-200">Live Ticket Feed</p>
          <p className="text-xs text-slate-600 mt-0.5">Open tickets · sorted by AI priority score</p>
        </div>
        <div className="flex items-center gap-2.5">
          {tickets.length > 0 && (
            <span className="metric text-[11px] font-bold text-slate-600 rounded-full px-2.5 py-0.5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {tickets.length}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <div className="live-dot" />
            <span className="text-xs font-semibold text-slate-500">Live</span>
          </div>
        </div>
      </div>

      {tickets.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['ID', 'Employee', 'Priority', 'SLA Risk', 'Status', 'Created', ''].map(h => (
                  <th key={h} className="th-cell">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, idx) => (
                <tr
                  key={t.ticket_id}
                  className={cn(
                    'group transition-colors duration-100',
                    t.vip_detected && 'border-l-2 border-l-amber-500/50',
                  )}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    animationDelay: `${idx * 40}ms`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td className="td-cell">
                    <span className="metric text-xs font-bold text-slate-500 whitespace-nowrap">
                      {t.ticket_id}
                    </span>
                  </td>
                  <td className="td-cell">
                    <div className="flex items-center gap-1.5">
                      {t.vip_detected && <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                      <div>
                        <p className="font-semibold text-slate-200 whitespace-nowrap text-sm">{t.employee_name}</p>
                        <p className="text-[11px] text-slate-600">{t.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td-cell whitespace-nowrap">
                    <span className={cn('chip capitalize', PRIORITY_BG[t.priority])}>{t.priority}</span>
                  </td>
                  <td className="td-cell whitespace-nowrap">
                    <SlaBar score={t.sla_risk_score} />
                  </td>
                  <td className="td-cell whitespace-nowrap">
                    <span className={cn('chip capitalize', STATUS_BG[t.status])}>
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="td-cell text-xs text-slate-600 whitespace-nowrap">
                    {fmtRelative(t.created_at)}
                  </td>
                  <td className="td-cell">
                    <Link
                      to={`/tickets/${t.ticket_id}`}
                      className="icon-btn opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`View ${t.ticket_id}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10">
            <Inbox className="h-6 w-6 text-green-500" />
          </div>
          <p className="text-sm font-semibold text-slate-400">All clear!</p>
          <p className="text-xs text-slate-600">No open tickets at this moment</p>
        </div>
      )}
    </div>
  )
}
