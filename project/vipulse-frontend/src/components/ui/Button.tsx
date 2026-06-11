import { cn } from '@/utils/cn'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'gradient'
  size?:    'sm' | 'md' | 'lg'
  loading?: boolean
  icon?:    React.ReactNode
}

const VARIANTS: Record<string, string> = {
  primary:  'bg-violet-600 text-white hover:bg-violet-500 shadow-sm',
  gradient: 'btn-gradient text-white',
  secondary:'bg-white/[0.06] text-slate-300 hover:bg-white/[0.10] border border-white/[0.09]',
  danger:   'bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 hover:text-red-300',
  ghost:    'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200',
  outline:  'border border-white/[0.10] text-slate-300 hover:border-white/[0.18] hover:bg-white/[0.04]',
}

const SIZES: Record<string, string> = {
  sm: 'h-8  px-3   text-xs  gap-1.5 rounded-lg',
  md: 'h-9  px-4   text-sm  gap-2   rounded-xl',
  lg: 'h-10 px-5   text-sm  gap-2   rounded-xl',
}

export function Button({
  variant = 'primary',
  size    = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]',
        'disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  )
}
