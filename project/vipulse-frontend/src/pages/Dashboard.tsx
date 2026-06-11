import { useQuery } from 'react-query'
import {
  Ticket, Crown, Flame, AlertTriangle, CheckCircle2, Activity, RefreshCw,
} from 'lucide-react'
import { PageWrapper }       from '@/components/layout/PageWrapper'
import { StatsCard, StatsCardSkeleton } from '@/components/dashboard/StatsCard'
import { PriorityChart }     from '@/components/dashboard/PriorityChart'
import { DeptChart }         from '@/components/dashboard/DeptChart'
import { EscalationTrend }   from '@/components/dashboard/EscalationTrend'
import { LiveTicketFeed }    from '@/components/dashboard/LiveTicketFeed'
import { useToast }          from '@/components/ui/Toast'
import { useWebSocket }      from '@/hooks/useWebSocket'
import { dashboardApi }      from '@/api/dashboard'
import { cn }                from '@/utils/cn'

// ── Chart skeleton ────────────────────────────────────────────────────────────
function ChartSkeleton({ height = 'h-48' }: { height?: string }) {
  return (
    <div className={cn('card-dark rounded-2xl overflow-hidden', height)}>
      <div className="flex h-full flex-col">
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-white/10 border-t-violet-500 animate-spin" />
            <p className="text-xs text-slate-600">Loading…</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="h-3.5 w-0.5 rounded-full bg-violet-500" />
        <p className="section-label">{children}</p>
      </div>
      {action}
    </div>
  )
}

// ── Performance metric row ────────────────────────────────────────────────────
function MetricRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span className="text-sm text-slate-500">{label}</span>
      <span className={cn('metric text-sm font-bold', color ?? 'text-slate-300')}>{value}</span>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { toast } = useToast()

  const stats = useQuery('dashboard-stats',   dashboardApi.getStats,                { refetchInterval: 30_000 })
  const prio  = useQuery('priority-dist',     dashboardApi.getPriorityDistribution, { refetchInterval: 60_000 })
  const dept  = useQuery('dept-issues',       dashboardApi.getDepartmentIssues,     { refetchInterval: 60_000 })
  const trend = useQuery('escalation-trends', dashboardApi.getEscalationTrends,     { refetchInterval: 60_000 })
  const live  = useQuery('live-tickets',      dashboardApi.getLiveTickets,          { refetchInterval: 30_000 })

  useWebSocket(msg => {
    if (msg.event === 'ticket_updated') {
      toast('info', `Ticket ${msg.ticket_id} updated · ${String(msg.priority).toUpperCase()}`)
      live.refetch(); stats.refetch()
    }
    if (msg.event === 'ticket_deleted') {
      live.refetch(); stats.refetch()
    }
  })

  const s = stats.data

  return (
    <PageWrapper title="Dashboard" subtitle="Real-time AI service desk overview">

      {/* ── KPI Cards ── */}
      <SectionLabel
        action={
          <button
            onClick={() => { stats.refetch(); live.refetch() }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-300 hover:bg-white/[0.05] transition-all"
          >
            <RefreshCw className={cn('h-3 w-3', stats.isFetching && 'animate-spin')} />
            Refresh
          </button>
        }
      >
        Today's Overview
      </SectionLabel>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-8">
        {stats.isLoading
          ? Array.from({ length: 5 }).map((_, i) => <StatsCardSkeleton key={i} />)
          : (
            <>
              <div className="animate-fade-in-up animate-stagger-1">
                <StatsCard title="Tickets Today"  value={s?.today_total ?? 0}
                  icon={<Ticket className="h-5 w-5" />}   color="blue"
                  description={`${s?.open_tickets ?? 0} still open`} />
              </div>
              <div className="animate-fade-in-up animate-stagger-2">
                <StatsCard title="VIP Tickets"    value={s?.today_vip ?? 0}
                  icon={<Crown className="h-5 w-5" />}    color="purple"
                  suffix={s ? `${s.vip_percentage.toFixed(1)}%` : undefined} />
              </div>
              <div className="animate-fade-in-up animate-stagger-3">
                <StatsCard title="Critical"       value={s?.today_critical ?? 0}
                  icon={<Flame className="h-5 w-5" />}    color="red" />
              </div>
              <div className="animate-fade-in-up animate-stagger-4">
                <StatsCard title="Escalated"      value={s?.today_escalated ?? 0}
                  icon={<AlertTriangle className="h-5 w-5" />} color="orange" />
              </div>
              <div className="animate-fade-in-up animate-stagger-5">
                <StatsCard title="SLA Saved"      value={s?.sla_saved ?? 0}
                  icon={<CheckCircle2 className="h-5 w-5" />}  color="green" />
              </div>
            </>
          )
        }
      </div>

      {/* ── Performance + Priority chart ── */}
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        {/* Performance card */}
        <div className="card-dark rounded-2xl p-5 animate-fade-in-up animate-stagger-2">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">Performance</p>
              <p className="text-xs text-slate-600">Service metrics</p>
            </div>
          </div>
          {stats.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-3 rounded" />)}</div>
          ) : (
            <div>
              <MetricRow label="Avg Resolution" value={`${s?.avg_resolution_hours?.toFixed(1) ?? '—'} hrs`} color="text-cyan-400" />
              <MetricRow label="Open Tickets"   value={s?.open_tickets ?? 0} color="text-blue-400" />
              <MetricRow label="VIP %"          value={`${s?.vip_percentage?.toFixed(1) ?? '0'}%`} color="text-violet-400" />
              <MetricRow label="Escalated Today" value={s?.today_escalated ?? 0} color="text-orange-400" />
            </div>
          )}
        </div>

        {/* Priority chart — 2 cols */}
        <div className="lg:col-span-2">
          {prio.isLoading
            ? <ChartSkeleton height="h-full min-h-[200px]" />
            : <PriorityChart data={prio.data ?? []} />
          }
        </div>
      </div>

      {/* ── Dept + Escalation charts ── */}
      <SectionLabel>Breakdown</SectionLabel>
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        {dept.isLoading  ? <ChartSkeleton height="h-64" /> : <DeptChart data={dept.data ?? []} />}
        {trend.isLoading ? <ChartSkeleton height="h-64" /> : <EscalationTrend data={trend.data ?? []} />}
      </div>

      {/* ── Live feed ── */}
      <div className="mt-4">
        <SectionLabel
          action={
            <div className="flex items-center gap-1.5">
              <div className="live-dot" />
              <span className="text-xs font-semibold text-slate-600">Real-time</span>
            </div>
          }
        >
          Live Ticket Feed
        </SectionLabel>
        {live.isLoading
          ? <ChartSkeleton height="h-72" />
          : <LiveTicketFeed tickets={(live.data ?? []).slice(0, 10)} />
        }
      </div>
    </PageWrapper>
  )
}
