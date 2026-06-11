import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/utils/cn'

interface PaginationProps {
  page:         number
  pages:        number
  hasNext:      boolean
  hasPrev:      boolean
  onPageChange: (page: number) => void
  total?:       number
  pageSize?:    number
}

function PageBtn({ children, active, disabled, onClick, label }: {
  children: React.ReactNode
  active?:  boolean
  disabled?: boolean
  onClick?: () => void
  label:    string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all duration-150',
        active
          ? 'bg-violet-600 text-white shadow-sm'
          : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-200',
        disabled && 'opacity-30 cursor-not-allowed pointer-events-none',
      )}
    >
      {children}
    </button>
  )
}

export function Pagination({
  page, pages, hasNext, hasPrev, onPageChange, total, pageSize,
}: PaginationProps) {
  const getPages = () => {
    if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1)
    if (page <= 3) return [1, 2, 3, 4, 5]
    if (page >= pages - 2) return [pages - 4, pages - 3, pages - 2, pages - 1, pages]
    return [page - 2, page - 1, page, page + 1, page + 2]
  }

  const start = total && pageSize ? (page - 1) * pageSize + 1 : undefined
  const end   = total && pageSize ? Math.min(page * pageSize, total) : undefined

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row text-sm">
      <span className="text-xs text-slate-600">
        {start !== undefined && end !== undefined && total !== undefined
          ? `${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()} results`
          : total !== undefined
          ? `${total.toLocaleString()} results`
          : ''}
      </span>

      <div className="flex items-center gap-1">
        <PageBtn label="First" disabled={!hasPrev} onClick={() => onPageChange(1)}>
          <ChevronsLeft className="h-3.5 w-3.5" />
        </PageBtn>
        <PageBtn label="Previous" disabled={!hasPrev} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </PageBtn>

        <div className="flex gap-1 mx-1">
          {getPages().map(p => (
            <PageBtn key={p} active={p === page} onClick={() => onPageChange(p)} label={`Page ${p}`}>
              {p}
            </PageBtn>
          ))}
        </div>

        <PageBtn label="Next" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </PageBtn>
        <PageBtn label="Last" disabled={!hasNext} onClick={() => onPageChange(pages)}>
          <ChevronsRight className="h-3.5 w-3.5" />
        </PageBtn>
      </div>
    </div>
  )
}
