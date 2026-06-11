import { cn } from '@/utils/cn'

interface BadgeProps {
  children:   React.ReactNode
  variant?:   'default' | 'critical' | 'high' | 'medium' | 'low' | 'brand' | 'vip-gold' | 'vip-platinum' | 'outline' | 'cyan'
  pulse?:     boolean
  className?: string
  dot?:       boolean
}

const VARIANTS: Record<string, string> = {
  default:        'bg-white/[0.06] text-slate-400 border-white/[0.09]',
  brand:          'bg-violet-500/15 text-violet-400 border-violet-500/25',
  cyan:           'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  critical:       'bg-red-500/15 text-red-400 border-red-500/25',
  high:           'bg-orange-500/15 text-orange-400 border-orange-500/25',
  medium:         'bg-amber-500/15 text-amber-400 border-amber-500/25',
  low:            'bg-green-500/15 text-green-400 border-green-500/25',
  'vip-gold':     'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'vip-platinum': 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  outline:        'bg-transparent text-slate-500 border-white/[0.12]',
}

const DOT_COLORS: Record<string, string> = {
  critical:       'bg-red-500',
  high:           'bg-orange-500',
  medium:         'bg-amber-400',
  low:            'bg-green-500',
  brand:          'bg-violet-500',
  cyan:           'bg-cyan-400',
  'vip-gold':     'bg-amber-400',
  'vip-platinum': 'bg-violet-400',
}

export function Badge({ children, variant = 'default', pulse = false, dot = false, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold',
      pulse && 'animate-pulse',
      VARIANTS[variant],
      className,
    )}>
      {dot && variant in DOT_COLORS && (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', DOT_COLORS[variant])} />
      )}
      {children}
    </span>
  )
}
