import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface ModalProps {
  open:      boolean
  onClose:   () => void
  title?:    string
  children:  React.ReactNode
  size?:     'sm' | 'md' | 'lg' | 'xl'
  footer?:   React.ReactNode
}

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) {
      document.addEventListener('keydown', handler)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={cn(
          'relative w-full rounded-2xl overflow-hidden animate-scale-in',
          SIZES[size],
        )}
        style={{
          background:   '#111827',
          border:       '1px solid rgba(255,255,255,0.10)',
          boxShadow:    '0 25px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Header */}
        {title && (
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <h2 id="modal-title" className="text-base font-bold text-slate-100">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-white/[0.06] hover:text-slate-300 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-2 px-6 py-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
