import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/utils/cn'

type ToastType = 'success' | 'error' | 'warning' | 'info'
interface ToastItem { id: string; type: ToastType; title?: string; message: string }

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info }

const STYLES: Record<ToastType, { accent: string; icon: string }> = {
  success: { accent: 'bg-green-500',  icon: 'text-green-400' },
  error:   { accent: 'bg-red-500',    icon: 'text-red-400'   },
  warning: { accent: 'bg-amber-500',  icon: 'text-amber-400' },
  info:    { accent: 'bg-violet-500', icon: 'text-violet-400' },
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, title?: string) => void
}
const ToastContext = createContext<ToastContextValue>({ toast: () => {} })
export function useToast() { return useContext(ToastContext) }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) =>
    setToasts(prev => prev.filter(t => t.id !== id)), [])

  const toast = useCallback((type: ToastType, message: string, title?: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev.slice(-4), { id, type, message, title }])
    setTimeout(() => dismiss(id), 4500)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map(t => {
          const Icon   = ICONS[t.type]
          const styles = STYLES[t.type]
          return (
            <div
              key={t.id}
              role="alert"
              className="pointer-events-auto relative flex items-start gap-3 min-w-[320px] max-w-[420px] rounded-2xl overflow-hidden animate-slide-up"
              style={{
                background:   '#111827',
                border:       '1px solid rgba(255,255,255,0.10)',
                boxShadow:    '0 16px 48px rgba(0,0,0,0.6)',
              }}
            >
              {/* Accent stripe */}
              <div className={cn('absolute left-0 top-0 bottom-0 w-[3px]', styles.accent)} />

              <div className="flex items-start gap-3 pl-5 pr-4 py-3.5 w-full">
                <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', styles.icon)} />
                <div className="flex-1 min-w-0">
                  {t.title && (
                    <p className="text-sm font-bold text-slate-100 leading-none mb-1">{t.title}</p>
                  )}
                  <p className="text-sm text-slate-400 leading-snug">{t.message}</p>
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 text-slate-600 hover:text-slate-300 transition-colors mt-0.5"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
