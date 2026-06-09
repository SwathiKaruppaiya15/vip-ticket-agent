import { cn } from '@/utils/cn'

interface CardProps {
  children:   React.ReactNode
  className?: string
  accent?:    'brand' | 'critical' | 'high' | 'medium' | 'low' | 'cyan' | 'none'
  padding?:   boolean
}

const ACCENT_COLORS: Record<string, string> = {
  brand:    'border-l-violet-500',
  critical: 'border-l-red-500',
  high:     'border-l-orange-500',
  medium:   'border-l-amber-500',
  low:      'border-l-green-500',
  cyan:     'border-l-cyan-500',
  none:     '',
}

export function Card({ children, className, accent = 'none', padding = true }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-200',
        accent !== 'none' && `border-l-2 ${ACCENT_COLORS[accent]}`,
        padding && 'p-5',
        className,
      )}
      style={{
        background:   '#111827',
        border:       accent !== 'none' ? undefined : '1px solid rgba(255,255,255,0.07)',
        boxShadow:    '0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between px-5 py-4', className)}
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>
}
