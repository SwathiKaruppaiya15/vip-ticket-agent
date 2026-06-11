import { useEffect, useState } from 'react'
import { CheckCircle2, Brain, AlertTriangle, Zap } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'
import { slaColor } from '@/utils/formatters'
import type { ReasoningResponse } from '@/types/ticket'

// ── Animated circle gauge ─────────────────────────────────────────────────────
interface CircleGaugeProps {
  value: number
  color: string
  label: string
  size?: number
}

function CircleGauge({ value, color, label, size = 72 }: CircleGaugeProps) {
  const r   = (size - 10) / 2
  const c   = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, value))

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <p className="text-[11px] font-medium text-slate-600">{label}</p>
    </div>
  )
}

interface Props { reasoning: ReasoningResponse }

export function AIDecisionPanel({ reasoning }: Props) {
  const [visible, setVisible] = useState(0)

  // Staggered bullet reveal
  useEffect(() => {
    const len = reasoning.ai_reasoning.length
    let i = 0
    const id = setInterval(() => {
      i++
      setVisible(i)
      if (i >= len) clearInterval(id)
    }, 180)
    return () => clearInterval(id)
  }, [reasoning.ai_reasoning])

  const priorityLabel = (reasoning.priority_label ?? 'MEDIUM').toUpperCase()
  const badgeVariant  = (
    priorityLabel === 'CRITICAL' ? 'critical' :
    priorityLabel === 'HIGH'     ? 'high'     :
    priorityLabel === 'MEDIUM'   ? 'medium'   : 'low'
  ) as 'critical' | 'high' | 'medium' | 'low'

  const slaCol = slaColor(reasoning.sla_risk_score)

  return (
    <div className="space-y-4">
      {/* ── Gauge row ── */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
            <Brain className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <p className="text-sm font-bold text-slate-200">AI Analysis Results</p>
          <span className="ml-auto text-[10px] font-semibold text-slate-700 uppercase tracking-wider">
            LangGraph Multi-Agent
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {/* VIP Confidence */}
          <div className="flex flex-col items-center gap-2">
            <CircleGauge
              value={reasoning.vip_confidence * 100}
              color="#A78BFA"
              label="VIP Confidence"
            />
            <p className="metric text-base font-extrabold text-violet-400 tabular-nums">
              {(reasoning.vip_confidence * 100).toFixed(1)}%
            </p>
          </div>

          {/* Priority Score */}
          <div className="flex flex-col items-center justify-center gap-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Priority Score</p>
            <p className={cn(
              'metric text-5xl font-black tabular-nums',
              priorityLabel === 'CRITICAL' ? 'text-red-400' :
              priorityLabel === 'HIGH'     ? 'text-orange-400' :
              priorityLabel === 'MEDIUM'   ? 'text-amber-400' : 'text-green-400',
            )}>
              {reasoning.priority_score.toFixed(0)}
            </p>
            <Badge variant={badgeVariant} pulse={priorityLabel === 'CRITICAL'}>
              {priorityLabel}
            </Badge>
          </div>

          {/* SLA Risk */}
          <div className="flex flex-col items-center gap-2">
            <CircleGauge
              value={reasoning.sla_risk_score}
              color={slaCol}
              label="SLA Risk"
            />
            <p className="metric text-base font-extrabold tabular-nums" style={{ color: slaCol }}>
              {reasoning.sla_risk_score.toFixed(0)}%
            </p>
          </div>

          {/* Urgency */}
          <div className="flex flex-col items-center justify-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Urgency</p>
            <Badge variant="high" className="capitalize">{reasoning.urgency_level}</Badge>
            <p className="text-[11px] text-slate-600 capitalize text-center">
              {reasoning.business_impact} impact
            </p>
          </div>
        </div>

        {/* Routing info */}
        {(reasoning.assigned_team || reasoning.category) && (
          <div className="mt-5 pt-4 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {reasoning.assigned_team && (
              <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Assigned Team</p>
                <p className="text-sm font-semibold text-violet-300">{reasoning.assigned_team}</p>
              </div>
            )}
            {reasoning.category && (
              <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Category</p>
                <p className="text-sm font-semibold text-cyan-300">
                  {reasoning.category}{reasoning.subcategory ? ` / ${reasoning.subcategory}` : ''}
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── AI Reasoning bullets ── */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-violet-400" />
          <p className="text-sm font-bold text-slate-200">AI Reasoning</p>
          <span className="ml-auto metric text-[10px] text-slate-700">
            {reasoning.ai_reasoning.length} insights
          </span>
        </div>

        {reasoning.ai_reasoning.length > 0 ? (
          <div className="space-y-2.5">
            {reasoning.ai_reasoning.map((bullet, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-3 transition-all duration-400',
                  i < visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3',
                )}
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                <CheckCircle2 className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-400 leading-relaxed">{bullet}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600 italic">AI pipeline still processing…</p>
        )}

        {reasoning.full_explanation && (
          <div className="mt-5 pt-4 rounded-xl px-4 py-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)' }}>
            <p className="text-sm text-slate-500 italic leading-relaxed">
              {reasoning.full_explanation}
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
