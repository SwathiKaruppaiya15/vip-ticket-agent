import { useEffect, useRef, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/utils/cn'

interface StatsCardProps {
  title:        string
  value:        number | string
  icon:         React.ReactNode
  change?:      number
  suffix?:      string
  color?:       'default' | 'red' | 'orange' | 'amber' | 'green' | 'purple' | 'blue' | 'cyan'
  description?: string
}

// ── Animated counter ──────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)

  useEffect(() => {
    if (typeof target !== 'number') return
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(target * eased))
      if (progress < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return val
}

// ── Color configs ─────────────────────────────────────────────────────────────
const COLOR_CONFIG: Record<string, { icon: string; glow: string; accent: string; gradient: string }> = {
  default: { icon: 'text-slate-400 bg-white/5',           glow: '',                              accent: '#475569', gradient: 'rgba(71,85,105,0.15)' },
  red:     { icon: 'text-red-400   bg-red-500/10',        glow: 'rgba(239,68,68,0.15)',          accent: '#EF4444', gradient: 'rgba(239,68,68,0.08)' },
  orange:  { icon: 'text-orange-400 bg-orange-500/10',    glow: 'rgba(249,115,22,0.15)',         accent: '#F97316', gradient: 'rgba(249,115,22,0.08)' },
  amber:   { icon: 'text-amber-400  bg-amber-500/10',     glow: 'rgba(245,158,11,0.15)',         accent: '#F59E0B', gradient: 'rgba(245,158,11,0.08)' },
  green:   { icon: 'text-green-400  bg-green-500/10',     glow: 'rgba(34,197,94,0.15)',          accent: '#22C55E', gradient: 'rgba(34,197,94,0.08)' },
  purple:  { icon: 'text-violet-400 bg-violet-500/10',    glow: 'rgba(124,58,237,0.15)',         accent: '#7C3AED', gradient: 'rgba(124,58,237,0.08)' },
  blue:    { icon: 'text-blue-400   bg-blue-500/10',      glow: 'rgba(59,130,246,0.15)',         accent: '#3B82F6', gradient: 'rgba(59,130,246,0.08)' },
  cyan:    { icon: 'text-cyan-400   bg-cyan-500/10',      glow: 'rgba(6,182,212,0.15)',          accent: '#06B6D4', gradient: 'rgba(6,182,212,0.08)' },
}

export function StatsCard({
  title, value, icon, change, suffix, color = 'default', description,
}: StatsCardProps) {
  const numValue   = typeof value === 'number' ? value : 0
  const animated   = useCountUp(numValue)
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0
  const isNeutral  = change !== undefined && change === 0
  const cfg        = COLOR_CONFIG[color]

  return (
    <div
      className="stat-card group cursor-default p-5"
      style={{ position: 'relative' }}
    >
      {/* Gradient corner accent */}
      <div
        className="pointer-events-none absolute top-0 right-0 h-24 w-24 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(circle at top right, ${cfg.gradient}, transparent 70%)` }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 truncate">
            {title}
          </p>

          <div className="mt-2.5 flex items-baseline gap-1.5">
            <p className="metric text-[1.75rem] font-extrabold text-slate-100 leading-none tabular-nums">
              {typeof value === 'number' ? animated.toLocaleString() : value}
            </p>
            {suffix && (
              <span className="text-xs font-semibold text-slate-600">{suffix}</span>
            )}
          </div>

          {description && (
            <p className="mt-1.5 text-xs text-slate-600 truncate">{description}</p>
          )}

          {change !== undefined && (
            <div className={cn(
              'mt-3 inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5',
              isPositive ? 'text-green-400 bg-green-500/12' :
              isNegative ? 'text-red-400   bg-red-500/12'   :
                           'text-slate-500 bg-white/5',
            )}>
              {isPositive  ? <TrendingUp   className="h-3 w-3" /> :
               isNegative  ? <TrendingDown className="h-3 w-3" /> :
               isNeutral   ? <Minus        className="h-3 w-3" /> : null}
              <span>{Math.abs(change)}% vs yesterday</span>
            </div>
          )}
        </div>

        {/* Icon */}
        <div className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110',
          cfg.icon,
        )}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export function StatsCardSkeleton() {
  return (
    <div className="stat-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <div className="skeleton h-2.5 w-20 rounded-full" />
          <div className="skeleton h-8 w-16 rounded-lg" />
          <div className="skeleton h-2 w-24 rounded-full" />
        </div>
        <div className="skeleton h-11 w-11 rounded-xl" />
      </div>
    </div>
  )
}
