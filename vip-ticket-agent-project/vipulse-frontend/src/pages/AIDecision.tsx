import { useParams, Link } from 'react-router-dom'
import { useQuery } from 'react-query'
import { ArrowLeft, Users, MessageSquare, Mail, CheckCircle2, Clock, Cpu } from 'lucide-react'
import { PageWrapper }     from '@/components/layout/PageWrapper'
import { Card }            from '@/components/ui/Card'
import { Badge }           from '@/components/ui/Badge'
import { Button }          from '@/components/ui/Button'
import { Spinner }         from '@/components/ui/Spinner'
import { AIDecisionPanel } from '@/components/tickets/AIDecisionPanel'
import { EscalationBadge } from '@/components/tickets/EscalationBadge'
import { ticketsApi }      from '@/api/tickets'
import { fmtDate }         from '@/utils/formatters'
import { PRIORITY_BG }     from '@/utils/constants'
import { cn }              from '@/utils/cn'

export default function AIDecision() {
  const { ticketId } = useParams<{ ticketId: string }>()

  const ticket = useQuery(
    ['ticket', ticketId],
    () => ticketsApi.get(ticketId!),
    {
      enabled: !!ticketId,
      refetchInterval: (data) => (!data?.ai_reasoning?.length ? 3000 : false),
    },
  )

  const reasoning = useQuery(
    ['reasoning', ticketId],
    () => ticketsApi.getReasoning(ticketId!),
    { enabled: !!ticketId && !!ticket.data?.ai_reasoning?.length },
  )

  if (ticket.isLoading) {
    return (
      <PageWrapper title="AI Analysis">
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </PageWrapper>
    )
  }

  const t = ticket.data
  if (!t) {
    return (
      <PageWrapper title="AI Analysis">
        <p className="text-slate-500">Ticket not found.</p>
      </PageWrapper>
    )
  }

  const stillProcessing = !t.ai_reasoning?.length

  return (
    <PageWrapper title="AI Decision" subtitle={t.ticket_id}>
      <div className="mx-auto max-w-4xl space-y-5 animate-fade-in">

        {/* Back */}
        <Link
          to="/tickets"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200 transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Tickets
        </Link>

        {/* Ticket header card */}
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="metric text-xs font-bold rounded-lg px-2.5 py-1 text-violet-400"
                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.20)' }}
              >
                {t.ticket_id}
              </span>
              <span className={cn('chip capitalize', PRIORITY_BG[t.priority])}>
                {t.priority}
              </span>
              <EscalationBadge ticket={t} />
              {stillProcessing && (
                <Badge variant="brand" pulse>
                  <Cpu className="h-3 w-3" /> Processing…
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Clock className="h-3.5 w-3.5" />
              {fmtDate(t.created_at)}
            </div>
          </div>

          <h2 className="text-xl font-bold text-slate-100 leading-tight">{t.issue_title}</h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed line-clamp-3">{t.issue_description}</p>

          <div
            className="mt-5 pt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            {[
              { label: 'Employee',   value: t.employee_name },
              { label: 'Role',       value: t.role },
              { label: 'Department', value: t.department },
              { label: 'Category',   value: t.category ? `${t.category}${t.subcategory ? ` / ${t.subcategory}` : ''}` : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-slate-300">{value}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* AI Panel or loading */}
        {stillProcessing ? (
          <Card className="flex flex-col items-center gap-5 py-20">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ background: 'radial-gradient(#7C3AED, transparent)' }}
              />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 border border-violet-500/20">
                <Cpu className="h-7 w-7 text-violet-400 animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-slate-300">LangGraph agents processing…</p>
              <p className="mt-1 text-sm text-slate-600">Auto-refreshing every 3 seconds</p>
            </div>
            <div className="flex gap-3">
              {['Intake','VIP','Priority','Routing','SLA','Explain'].map((step, i) => (
                <div key={step} className="flex flex-col items-center gap-1.5">
                  <div
                    className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                  <span className="text-[9px] font-semibold text-slate-700">{step}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : reasoning.data ? (
          <AIDecisionPanel reasoning={reasoning.data} />
        ) : (
          <AIDecisionPanel reasoning={{
            ticket_id:       t.ticket_id,
            priority_score:  t.priority_score,
            priority_label:  t.priority.toUpperCase(),
            vip_detected:    t.vip_detected,
            vip_level:       t.vip_level,
            vip_confidence:  t.vip_confidence,
            sla_risk_score:  t.sla_risk_score,
            sla_deadline:    t.sla_deadline,
            ai_reasoning:    t.ai_reasoning,
            full_explanation:'',
            category:        t.category,
            subcategory:     t.subcategory,
            assigned_team:   t.assigned_team,
            urgency_level:   t.urgency_level,
            business_impact: t.business_impact,
            detected_keywords: [],
          }} />
        )}

        {/* Team routing */}
        {t.assigned_team && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
                <Users className="h-3.5 w-3.5 text-violet-400" />
              </div>
              <p className="text-sm font-bold text-slate-200">Team Routing</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Users className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="font-bold text-slate-200">{t.assigned_team}</p>
                <p className="text-xs text-slate-600 mt-0.5">Routed based on category and VIP status</p>
              </div>
            </div>
          </Card>
        )}

        {/* Notification status */}
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-200 mb-4">Notification Status</p>
          <div className="flex flex-wrap gap-5">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="h-4 w-4 text-slate-600" />
              {t.discord_notified ? (
                <Badge variant="low" dot>Discord Sent</Badge>
              ) : (
                <Badge variant="outline">Discord Pending</Badge>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-slate-600" />
              {t.email_notified ? (
                <Badge variant="low" dot>
                  <CheckCircle2 className="h-3 w-3" />
                  Email Sent
                </Badge>
              ) : (
                <Badge variant="outline">Email Pending</Badge>
              )}
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end pb-4">
          <Link to={`/tickets/${t.ticket_id}`}>
            <Button variant="outline" size="sm">View Full Ticket</Button>
          </Link>
          <Link to="/submit">
            <Button variant="gradient" size="sm">Submit Another</Button>
          </Link>
        </div>
      </div>
    </PageWrapper>
  )
}
