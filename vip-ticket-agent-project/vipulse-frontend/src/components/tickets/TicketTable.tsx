import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from 'react-query'
import { Crown, ExternalLink, Trash2, AlertTriangle, Ticket as TicketIcon } from 'lucide-react'
import { cn }         from '@/utils/cn'
import { fmtRelative, slaColor } from '@/utils/formatters'
import { PRIORITY_BG, STATUS_BG } from '@/utils/constants'
import { Modal }      from '@/components/ui/Modal'
import { Button }     from '@/components/ui/Button'
import { useToast }   from '@/components/ui/Toast'
import { useAuth }    from '@/hooks/useAuth'
import { ticketsApi } from '@/api/tickets'
import type { Ticket } from '@/types/ticket'

interface TicketTableProps {
  tickets:    Ticket[]
  queryKey?:  unknown[]
}

const HEADERS = ['Ticket ID', 'Employee', 'Issue', 'Priority', 'Team', 'SLA Risk', 'Status', 'Created', '']

// ── SLA bar ───────────────────────────────────────────────────────────────────
function SlaBar({ score }: { score: number }) {
  const color = slaColor(score)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-14 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, backgroundColor: color }} />
      </div>
      <span className="metric text-xs font-bold tabular-nums" style={{ color }}>{score.toFixed(0)}%</span>
    </div>
  )
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteModal({ ticket, onClose, onConfirm, loading }: {
  ticket:    Ticket | null
  onClose:   () => void
  onConfirm: (id: string) => void
  loading:   boolean
}) {
  if (!ticket) return null
  return (
    <Modal open={!!ticket} onClose={onClose} size="sm">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-8 ring-red-500/5">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-100">Delete ticket?</h3>
          <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
            Delete{' '}
            <span className="metric font-bold text-slate-300">{ticket.ticket_id}</span>?
            {' '}This action can be restored by admins.
          </p>
        </div>
        <div className="w-full rounded-xl px-3.5 py-2.5 text-left" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-semibold text-slate-300 truncate">{ticket.issue_title}</p>
          <p className="text-[11px] text-slate-600 mt-0.5">{ticket.employee_name} · {ticket.department}</p>
        </div>
        <div className="flex w-full gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="danger"  size="sm" className="flex-1" loading={loading} onClick={() => onConfirm(ticket.ticket_id)}>
            Delete Ticket
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <TicketIcon className="h-7 w-7 text-slate-600" />
      </div>
      <p className="text-sm font-semibold text-slate-500">No tickets found</p>
      <p className="text-xs text-slate-700">Try adjusting your search or filters</p>
    </div>
  )
}

// ── Main table ────────────────────────────────────────────────────────────────
export function TicketTable({ tickets, queryKey = ['tickets'] }: TicketTableProps) {
  const { toast }                     = useToast()
  const qc                            = useQueryClient()
  const { isAdmin, isManager, user }  = useAuth()
  const [toDelete, setToDelete]       = useState<Ticket | null>(null)

  const deleteMutation = useMutation(
    (id: string) => ticketsApi.delete(id),
    {
      onMutate: async (id) => {
        await qc.cancelQueries(queryKey)
        const prev = qc.getQueryData(queryKey)
        qc.setQueryData(queryKey, (old: any) => old ? {
          ...old,
          items: old.items?.filter((t: Ticket) => t.ticket_id !== id) ?? [],
          total: Math.max(0, (old.total ?? 1) - 1),
        } : old)
        return { prev }
      },
      onSuccess: () => {
        toast('success', 'Ticket deleted successfully.')
        setToDelete(null)
        qc.invalidateQueries(queryKey)
        qc.invalidateQueries('dashboard-stats')
        qc.invalidateQueries('live-tickets')
      },
      onError: (_e, _id, ctx: any) => {
        if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev)
        toast('error', 'Failed to delete ticket.')
        setToDelete(null)
      },
    },
  )

  const canDelete = (t: Ticket) => isAdmin || isManager || t.created_by === user?.user_id

  if (!tickets.length) {
    return (
      <div className="card-dark rounded-2xl overflow-hidden">
        <EmptyState />
      </div>
    )
  }

  return (
    <>
      <div className="card-dark rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {HEADERS.map(h => <th key={h} className="th-cell">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {tickets.map((t, idx) => (
              <tr
                key={t.ticket_id}
                className={cn('group transition-colors duration-100', t.vip_detected && 'border-l-2 border-l-amber-500/50')}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', animationDelay: `${idx * 25}ms` }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {/* ID */}
                <td className="td-cell">
                  <span className="metric text-xs font-bold text-slate-500 whitespace-nowrap">{t.ticket_id}</span>
                </td>

                {/* Employee */}
                <td className="td-cell">
                  <div className="flex items-center gap-2">
                    {t.vip_detected && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                    <div>
                      <p className="font-semibold text-slate-200 whitespace-nowrap">{t.employee_name}</p>
                      <p className="text-[11px] text-slate-600">{t.department}</p>
                    </div>
                  </div>
                </td>

                {/* Issue */}
                <td className="td-cell max-w-[220px]">
                  <p className="truncate text-sm font-medium text-slate-300">{t.issue_title}</p>
                  {t.category && (
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {t.category}{t.subcategory ? ` · ${t.subcategory}` : ''}
                    </p>
                  )}
                </td>

                {/* Priority */}
                <td className="td-cell whitespace-nowrap">
                  <span className={cn('chip capitalize', PRIORITY_BG[t.priority])}>{t.priority}</span>
                </td>

                {/* Team */}
                <td className="td-cell max-w-[160px]">
                  {t.assigned_team
                    ? <span className="text-xs text-slate-500 truncate block">{t.assigned_team}</span>
                    : <span className="text-xs text-slate-700 italic">Unassigned</span>
                  }
                </td>

                {/* SLA */}
                <td className="td-cell whitespace-nowrap"><SlaBar score={t.sla_risk_score} /></td>

                {/* Status */}
                <td className="td-cell whitespace-nowrap">
                  <span className={cn('chip capitalize', STATUS_BG[t.status])}>
                    {t.status.replace(/_/g, ' ')}
                  </span>
                </td>

                {/* Created */}
                <td className="td-cell text-xs text-slate-600 whitespace-nowrap">
                  {fmtRelative(t.created_at)}
                </td>

                {/* Actions */}
                <td className="td-cell">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link to={`/tickets/${t.ticket_id}`} className="icon-btn" title="View details">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    {canDelete(t) && (
                      <button onClick={() => setToDelete(t)} className="icon-btn-danger" title="Delete ticket">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DeleteModal
        ticket={toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={id => deleteMutation.mutate(id)}
        loading={deleteMutation.isLoading}
      />
    </>
  )
}
