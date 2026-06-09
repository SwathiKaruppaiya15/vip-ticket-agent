import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from 'react-query'
import { Filter, Search, X, Crown, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { TicketTable } from '@/components/tickets/TicketTable'
import { Pagination }  from '@/components/ui/Pagination'
import { Button }      from '@/components/ui/Button'
import { cn }          from '@/utils/cn'
import { ticketsApi }  from '@/api/tickets'
import type { TicketFilters, TicketStatus, Priority } from '@/types/ticket'
import { DEPARTMENTS } from '@/utils/constants'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a stable, serialisable query-key from TicketFilters.
 * undefined values are excluded so the key doesn't change when a filter
 * is cleared (undefined vs missing key are treated the same).
 */
function buildQueryKey(filters: TicketFilters): unknown[] {
  return [
    'tickets',
    filters.page ?? 1,
    filters.page_size ?? 20,
    filters.status    ?? null,
    filters.priority  ?? null,
    filters.department ?? null,
    filters.vip_only  ?? null,
    filters.search    ?? null,
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────
function TableSkeleton() {
  const cols = ['w-24','w-36','w-52','w-20','w-28','w-24','w-20','w-20','w-12']
  return (
    <div className="card-dark rounded-2xl overflow-hidden">
      {/* Header row */}
      <div
        className="flex"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
      >
        {cols.map((w, i) => (
          <div key={i} className={cn('px-4 py-3.5 flex-shrink-0', w)}>
            <div className="skeleton h-2.5 rounded-full" />
          </div>
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: 8 }).map((_, ri) => (
        <div
          key={ri}
          className="flex"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
          {cols.map((w, ci) => (
            <div key={ci} className={cn('px-4 py-4 flex-shrink-0', w)}>
              <div className="skeleton h-4 rounded" />
              {ci === 1 && <div className="skeleton h-2.5 rounded mt-1.5 w-3/4" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter chip
// ─────────────────────────────────────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-violet-400"
      style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}
    >
      {label}
      <button onClick={onRemove} className="text-violet-500 hover:text-violet-300" aria-label="Remove filter">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Select styles
// ─────────────────────────────────────────────────────────────────────────────
const SELECT_CLS = cn(
  'h-9 rounded-xl border px-3 text-xs font-semibold',
  'transition-all duration-150 cursor-pointer appearance-none pr-8',
  'focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50',
)
const selectStyle: React.CSSProperties = {
  background:  'rgba(255,255,255,0.04)',
  borderColor: 'rgba(255,255,255,0.09)',
  color:       '#94A3B8',
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Tickets() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showFilters,  setShowFilters]  = useState(false)

  // ── Filter state ────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<TicketFilters>({ page: 1, page_size: 20 })

  // Local search input — separate from the debounced filter value so the input
  // stays snappy while we throttle the API call.
  const [searchInput, setSearchInput] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Sync search param from URL (header global search) ──────────────────────
  // Run only once on mount (or when the URL param actually changes).
  const didSyncRef = useRef(false)
  useEffect(() => {
    const q = searchParams.get('search')
    if (q && !didSyncRef.current) {
      didSyncRef.current = true
      setSearchInput(q)
      setFilters(f => ({ ...f, search: q, page: 1 }))
    }
  }, [searchParams])

  // ── Debounce search input → update filters ──────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const trimmed = searchInput.trim() || undefined
      setFilters(f => {
        // Avoid unnecessary state update if value hasn't changed
        if (f.search === trimmed) return f
        return { ...f, search: trimmed, page: 1 }
      })
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput])

  // ── Stable query key ────────────────────────────────────────────────────────
  const queryKey = buildQueryKey(filters)

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data, isLoading, isFetching, refetch } = useQuery(
    queryKey,
    () => ticketsApi.list(filters),
    {
      keepPreviousData: true,
      staleTime:        15_000,   // 15s — balance freshness vs flicker
      refetchOnWindowFocus: false,
    },
  )

  // ── Filter helpers ──────────────────────────────────────────────────────────
  const set = useCallback(
    (patch: Partial<TicketFilters>) =>
      setFilters(f => ({ ...f, ...patch, page: 1 })),
    [],
  )

  const clearAll = useCallback(() => {
    setSearchInput('')
    setSearchParams({})
    didSyncRef.current = false
    setFilters({ page: 1, page_size: 20 })
  }, [setSearchParams])

  const clearSearch = useCallback(() => {
    setSearchInput('')
    setSearchParams({})
    didSyncRef.current = false
    setFilters(f => { const n = { ...f }; delete n.search; return { ...n, page: 1 } })
  }, [setSearchParams])

  const hasFilters = !!(filters.status || filters.priority || filters.department || filters.vip_only || filters.search)

  // ── Derived display values ──────────────────────────────────────────────────
  const tickets    = data?.items ?? []
  const totalCount = data?.total ?? 0

  return (
    <PageWrapper
      title="Tickets"
      subtitle={data ? `${totalCount.toLocaleString()} total tickets` : 'Loading…'}
    >
      {/* ── Toolbar ── */}
      <div className="mb-5 space-y-3">
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by ID, employee, or issue…"
              className={cn(
                'h-9 w-full rounded-xl border pl-10 pr-8 text-sm text-slate-300 placeholder-slate-600',
                'focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50',
                'transition-all duration-150',
              )}
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.09)' }}
            />
            {searchInput && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            onClick={() => setShowFilters(v => !v)}
          >
            Filters
            {hasFilters && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold text-white">
                !
              </span>
            )}
          </Button>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-white/[0.05] hover:text-slate-300 transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.09)' }}
            title="Refresh tickets"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          </button>

          {hasFilters && (
            <button
              onClick={clearAll}
              className="text-xs text-slate-600 hover:text-violet-400 transition-colors underline underline-offset-2"
            >
              Clear all
            </button>
          )}

          {/* Result count */}
          {data && (
            <span className="ml-auto text-xs text-slate-600 hidden sm:block metric tabular-nums">
              {totalCount.toLocaleString()} result{totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Expanded filter row */}
        {showFilters && (
          <div
            className="flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 animate-fade-in"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Filter className="h-3.5 w-3.5 text-slate-600 shrink-0" />

            {/* Status */}
            <select
              value={filters.status ?? ''}
              onChange={e => set({ status: (e.target.value as TicketStatus) || undefined })}
              className={SELECT_CLS}
              style={selectStyle}
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="escalated">Escalated</option>
              <option value="sla_breached">SLA Breached</option>
            </select>

            {/* Priority */}
            <select
              value={filters.priority ?? ''}
              onChange={e => set({ priority: (e.target.value as Priority) || undefined })}
              className={SELECT_CLS}
              style={selectStyle}
            >
              <option value="">All Priorities</option>
              <option value="critical">🔴 Critical</option>
              <option value="high">🟠 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>

            {/* Department */}
            <select
              value={filters.department ?? ''}
              onChange={e => set({ department: e.target.value || undefined })}
              className={SELECT_CLS}
              style={selectStyle}
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {/* VIP only */}
            <label
              className="flex cursor-pointer select-none items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
            >
              <input
                type="checkbox"
                checked={!!filters.vip_only}
                onChange={e => set({ vip_only: e.target.checked || undefined })}
                className="h-3.5 w-3.5 rounded border-slate-700 accent-amber-500"
              />
              <Crown className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-slate-400">VIP Only</span>
            </label>

            {/* Page size */}
            <select
              value={filters.page_size ?? 20}
              onChange={e => setFilters(f => ({ ...f, page_size: Number(e.target.value), page: 1 }))}
              className={cn(SELECT_CLS, 'ml-auto')}
              style={selectStyle}
            >
              {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>
        )}

        {/* Active filter chips */}
        {hasFilters && (
          <div className="flex flex-wrap gap-2">
            {filters.search && (
              <FilterChip
                label={`"${filters.search}"`}
                onRemove={clearSearch}
              />
            )}
            {filters.status && (
              <FilterChip
                label={filters.status.replace(/_/g, ' ')}
                onRemove={() => set({ status: undefined })}
              />
            )}
            {filters.priority && (
              <FilterChip
                label={filters.priority}
                onRemove={() => set({ priority: undefined })}
              />
            )}
            {filters.department && (
              <FilterChip
                label={filters.department}
                onRemove={() => set({ department: undefined })}
              />
            )}
            {filters.vip_only && (
              <FilterChip
                label="VIP Only"
                onRemove={() => set({ vip_only: undefined })}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {isLoading
        ? <TableSkeleton />
        : (
          <TicketTable
            tickets={tickets}
            queryKey={queryKey}
          />
        )
      }

      {/* ── Pagination ── */}
      {data && data.pages > 1 && (
        <div className="mt-5">
          <Pagination
            page={data.page}
            pages={data.pages}
            hasNext={data.has_next}
            hasPrev={data.has_prev}
            total={data.total}
            pageSize={data.page_size}
            onPageChange={p => setFilters(f => ({ ...f, page: p }))}
          />
        </div>
      )}
    </PageWrapper>
  )
}
