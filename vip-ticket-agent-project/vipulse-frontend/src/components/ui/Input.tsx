import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:  string
  error?:  string
  hint?:   string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-300">{label}</label>
      )}
      <input
        ref={ref}
        className={cn(
          'input-dark w-full px-3.5',
          error && 'border-red-500/50 focus:border-red-500',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-600">{hint}</p>}
    </div>
  ),
)
Input.displayName = 'Input'
