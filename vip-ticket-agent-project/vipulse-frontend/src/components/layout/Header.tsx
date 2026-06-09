import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, Search, LogOut, Settings, ChevronRight } from 'lucide-react'
import { useAuth }       from '@/hooks/useAuth'
import { MobileSidebar } from './Sidebar'
import { cn }            from '@/utils/cn'

interface HeaderProps {
  title:     string
  subtitle?: string
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────
function Breadcrumb({ title }: { title: string }) {
  const location = useLocation()
  const segs     = location.pathname.split('/').filter(Boolean)

  if (segs.length <= 1) {
    return <h1 className="text-[17px] font-bold text-slate-100 leading-none truncate">{title}</h1>
  }

  return (
    <div className="flex items-center gap-1">
      {segs.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-slate-700" />}
          <span className={cn(
            'text-sm capitalize',
            i === segs.length - 1
              ? 'font-semibold text-slate-200'
              : 'text-slate-600',
          )}>
            {seg.replace(/-/g, ' ')}
          </span>
        </span>
      ))}
    </div>
  )
}

// ── Global search ─────────────────────────────────────────────────────────────
function GlobalSearch() {
  const [active, setActive] = useState(false)
  const [query,  setQuery]  = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setActive(true)
      }
      if (e.key === 'Escape' && active) {
        setActive(false)
        setQuery('')
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    navigate(`/tickets?search=${encodeURIComponent(q)}`)
    setQuery('')
    setActive(false)
    inputRef.current?.blur()
  }

  return (
    <form onSubmit={handleSubmit} className="relative hidden sm:block w-64 xl:w-80">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        placeholder="Search tickets… ⌘K"
        className={cn(
          'h-9 w-full rounded-xl border pl-10 pr-10 text-sm placeholder-slate-600 transition-all duration-150',
          'focus:outline-none text-slate-200',
          active
            ? 'border-violet-500/50 ring-2 ring-violet-500/15 bg-white/[0.07]'
            : 'border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.12]',
        )}
        style={{ caretColor: '#A78BFA' }}
      />
      {active && query && (
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
          ↵
        </kbd>
      )}
    </form>
  )
}

// ── Notification bell ─────────────────────────────────────────────────────────
function NotificationBell() {
  const [count] = useState(0)

  return (
    <button
      className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors"
      aria-label="Notifications"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-500 text-[8px] font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}

// ── User avatar ───────────────────────────────────────────────────────────────
function UserAvatar() {
  const { user, logout } = useAuth()
  const [open, setOpen]  = useState(false)
  const ref              = useRef<HTMLDivElement>(null)
  const navigate         = useNavigate()

  const initials = (user?.username ?? 'U').slice(0, 2).toUpperCase()

  const ROLE_BADGE: Record<string, string> = {
    admin:         'text-violet-400 bg-violet-500/15 border-violet-500/25',
    manager:       'text-amber-400  bg-amber-500/15  border-amber-500/25',
    support_agent: 'text-blue-400   bg-blue-500/15   border-blue-500/25',
    viewer:        'text-slate-400  bg-white/5        border-white/10',
  }
  const badge = ROLE_BADGE[user?.role ?? 'viewer'] ?? ROLE_BADGE.viewer

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all hover:bg-white/[0.06]"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}
        >
          {initials}
        </div>
        <div className="hidden md:block text-left">
          <p className="text-xs font-semibold text-slate-200 leading-none">{user?.username}</p>
          <span className={cn('mt-0.5 inline-block rounded-full border px-1.5 py-px text-[9px] font-bold capitalize', badge)}>
            {user?.role?.replace(/_/g, ' ')}
          </span>
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 rounded-2xl py-1.5 z-50 animate-scale-in"
          style={{
            background: '#111827',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}
        >
          {/* User info */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-semibold text-slate-100">{user?.username}</p>
            <p className="text-xs text-slate-600 mt-0.5 truncate">{user?.email ?? 'Enterprise account'}</p>
          </div>

          <div className="py-1.5">
            {[
              { label: 'Settings', icon: Settings, onClick: () => { setOpen(false); navigate('/admin') } },
            ].map(item => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
              >
                <item.icon className="h-4 w-4 text-slate-600" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="py-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => { setOpen(false); logout() }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────
export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex h-[60px] items-center justify-between gap-4 px-4 sm:px-6"
      style={{
        background: 'rgba(11,17,32,0.90)',
        backdropFilter: 'blur(12px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <MobileSidebar />
        <div className="min-w-0">
          <Breadcrumb title={title} />
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-slate-600 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Center */}
      <div className="flex-1 flex justify-center">
        <GlobalSearch />
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <NotificationBell />
        <div className="h-4 w-px mx-1 hidden sm:block" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <UserAvatar />
      </div>
    </header>
  )
}
