import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import {
  ArrowLeft, Trash2, Brain, Crown, AlertTriangle,
  Clock, User, Building2, Tag, Activity,
} from 'lucide-react'
import { PageWrapper }     from '@/components/layout/PageWrapper'
import { Card }            from '@/components/ui/Card'
import { Badge }           from '@/components/ui/Badge'
import { Button }          from '@/components/ui/Button'
import { Spinner }         from '@/components/ui/Spinner'
import { Modal }           from '@/components/ui/Modal'
import { AIDecisionPanel } from '@/components/tickets/AIDecisionPanel'
import { EscalationBadge } from '@/components/tickets/EscalationBadge'
import { useToast }        from '@/components/ui/Toast'
import { useAuth }         from '@/hooks/useAuth'
import { ticketsApi }      from '@/api/tickets'
import { fmtDate, slaColor } from '@/utils/formatters'
import { STATUS_BG } from '@/utils/constants'
import { cn }              from '@/utils/cn'

const STATUSES = ['open','in_progress','resolved','escalated','sla_breached']

function InfoField({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-slate-600" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{label}</p>
      </div>
      <p className="text-sm font-semibold text-slate-300">{value || <span className="text-slate-700 font-normal">—</span>}</p>
    </div>
  )
}

export default function TicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const { toast }    = useToast()
  const qc           = useQueryClient()
  const navigate     = useNavigate()
  const { isAdmin, isManager, user } = useAuth()
  const [showDelete, setShowDelete] = useState(false)

  const { data: ticket, isLoading } = useQuery(
    ['ticket', ticketId], () => ticketsApi.get(ticketId!), { enabled: !!ticketId },
  )
  const { data: reasoning } = useQuery(
    ['reasoning', ticketId], () => ticketsApi.getReasoning(ticketId!),
    { enabled: !!ticketId && !!ticket?.ai_reasoning?.length },
  )

  const update = useMutation(
    (status: string) => ticketsApi.update(ticketId!, { status: status as never }),
    {
      onSuccess: () => { qc.invalidateQueries(['ticket', ticketId]); toast('success', 'Status updated') },
      onError:   () => toast('error', 'Failed to update status'),
    },
  )

  const deleteMut = useMutation(
    () => ticketsApi.delete(ticketId!),
    {
      onSuccess: () => {
        toast('success', 'Ticket deleted.')
        qc.invalidateQueries('tickets')
        qc.invalidateQueries('dashboard-stats')
        qc.invalidateQueries('live-tickets')
        navigate('/tickets', { replace: true })
      },
      onError: () => {
        toast('error', 'Failed to delete ticket.')
        setShowDelete(false)
      },
    },
  )

  const canDelete = ticket && (isAdmin || isManager || ticket.created_by === user?.user_id)

  if (isLoading) {
    return (
      <PageWrapper title="Ticket">
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </PageWrapper>
    )
  }

  if (!ticket) {
    return (
      <PageWrapper title="Ticket">
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertTriangle className="h-8 w-8 text-slate-600" />
          <p className="text-sm font-semibold text-slate-500">Ticket not found</p>
          <Link to="/tickets" className="text-sm text-violet-400 hover:underline">← Back to tickets</Link>
        </div>
      </PageWrapper>
    )
  }

  const ACCENT_COLOR = {
    critical: 'bg-red-500',
    high:     'bg-orange-500',
    medium:   'bg-amber-400',
    low:      'bg-green-500',
  }[ticket.priority] ?? 'bg-violet-500'

  return (
    <PageWrapper title={ticket.ticket_id} subtitle={ticket.issue_title}>
      <div className="mx-auto max-w-4xl space-y-5">

        {/* Back + actions */}
        <div className="flex items-center justify-between">
          <Link to="/tickets" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200 transition-colors group">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            All Tickets
          </Link>
          <div className="flex items-center gap-2">
            <Link to={`/tickets/${ticket.ticket_id}/decision`}>
              <Button variant="outline" size="sm" icon={<Brain className="h-3.5 w-3.5" />}>AI Decision</Button>
            </Link>
            {canDelete && (
              <Button variant="danger" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setShowDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Header card */}
        <Card className="p-0 overflow-hidden">
          {/* Priority accent line */}
          <div className={cn('h-0.5', ACCENT_COLOR)} />

          <div className="p-6">
            {/* Badges + status changer */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant={ticket.priority as any} className="capitalize">{ticket.priority}</Badge>
                <Badge className={cn('capitalize chip', STATUS_BG[ticket.status])}>
                  {ticket.status.replace(/_/g,' ')}
                </Badge>
                {ticket.vip_detected && (
                  <span className="chip chip-vip-gold">
                    <Crown className="h-3 w-3" /> VIP
                  </span>
                )}
                <EscalationBadge ticket={ticket} />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600 font-medium">Status:</label>
                <select
                  value={ticket.status}
                  onChange={e => update.mutate(e.target.value)}
                  disabled={update.isLoading}
                  className="h-8 rounded-lg px-2.5 text-xs font-semibold text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-colors cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                </select>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-slate-100">{ticket.issue_title}</h2>
            <p className="mt-2.5 text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">{ticket.issue_description}</p>

            {/* Info grid */}
            <div className="mt-6 grid grid-cols-2 gap-4 pt-5 sm:grid-cols-4"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <InfoField icon={User}      label="Employee"   value={ticket.employee_name} />
              <InfoField icon={Tag}       label="Role"       value={ticket.role} />
              <InfoField icon={Building2} label="Department" value={ticket.department} />
              <InfoField icon={Clock}     label="Submitted"  value={fmtDate(ticket.created_at)} />
              <InfoField icon={Tag}       label="Team"       value={ticket.assigned_team} />
              <InfoField icon={Tag}       label="Category"   value={ticket.category ? `${ticket.category}${ticket.subcategory ? ` / ${ticket.subcategory}` : ''}` : null} />

              {/* SLA */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="h-3 w-3 text-slate-600" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">SLA Risk</p>
                </div>
                <p className="metric text-sm font-extrabold" style={{ color: slaColor(ticket.sla_risk_score) }}>
                  {ticket.sla_risk_score.toFixed(0)}%
                </p>
              </div>

              {/* AI Score */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Brain className="h-3 w-3 text-slate-600" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">AI Score</p>
                </div>
                <p className="metric text-sm font-extrabold text-violet-400">
                  {ticket.priority_score.toFixed(1)}/100
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* AI reasoning */}
        {(reasoning || ticket.ai_reasoning?.length > 0) && (
          <AIDecisionPanel reasoning={reasoning ?? {
            ticket_id: ticket.ticket_id, priority_score: ticket.priority_score,
            priority_label: ticket.priority.toUpperCase(), vip_detected: ticket.vip_detected,
            vip_level: ticket.vip_level, vip_confidence: ticket.vip_confidence,
            sla_risk_score: ticket.sla_risk_score, sla_deadline: ticket.sla_deadline,
            ai_reasoning: ticket.ai_reasoning, full_explanation: '',
            category: ticket.category, subcategory: ticket.subcategory,
            assigned_team: ticket.assigned_team, urgency_level: ticket.urgency_level,
            business_impact: ticket.business_impact, detected_keywords: [],
          }} />
        )}
      </div>

      {/* Delete modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} size="sm">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-8 ring-red-500/5">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Delete this ticket?</h3>
            <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
              Delete <span className="metric font-bold text-slate-300">{ticket.ticket_id}</span>?
              {' '}This action can be restored by admins.
            </p>
          </div>
          <div className="w-full rounded-xl px-3.5 py-2.5 text-left"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs font-semibold text-slate-300 truncate">{ticket.issue_title}</p>
            <p className="text-[11px] text-slate-600 mt-0.5">{ticket.employee_name} · {ticket.department}</p>
          </div>
          <div className="flex w-full gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowDelete(false)} disabled={deleteMut.isLoading}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" className="flex-1" loading={deleteMut.isLoading} onClick={() => deleteMut.mutate()}>
              Delete Ticket
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}
