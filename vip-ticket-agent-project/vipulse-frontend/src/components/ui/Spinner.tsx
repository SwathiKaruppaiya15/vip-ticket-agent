import { cn } from '@/utils/cn'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: 'h-4 w-4 border-[1.5px]',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-2',
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-solid',
        'border-white/10 border-t-violet-500',
        SIZES[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  )
}
