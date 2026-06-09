import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, PlusCircle, Ticket, BarChart3,
  ShieldCheck, LogOut, Menu, X, ChevronLeft, ChevronRight, Cpu,
} from 'lucide-react'
import { cn }      from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'

// ── Nav definitions ───────────────────────────────────────────────────────────
const PRIMARY_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/submit',    icon: PlusCircle,      label: 'Submit Ticket', new: true },
  { to: '/tickets',   icon: Ticket,          label: 'All Tickets' },
  { to: '/analytics', icon: BarChart3,       label: 'Analytics' },
]
const ADMIN_NAV = [
  { to: '/admin', icon: ShieldCheck, label: 'Admin Panel' },
]

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn(
      'flex items-center h-[60px] shrink-0 transition-all duration-200',
      collapsed ? 'justify-center px-3' : 'gap-3 px-5',
    )}
    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Animated orb */}
      <div className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inset-0 rounded-full bg-violet-500 animate-ping opacity-50" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-violet-500" />
      </div>

      {!collapsed && (
        <span className="text-[17px] font-extrabold tracking-tight text-white select-none">
          VIPulse<span className="gradient-text">AI</span>
        </span>
      )}
    </div>
  )
}

// ── Nav item ──────────────────────────────────────────────────────────────────
interface NavItemProps {
  to:         string
  icon:       React.ElementType
  label:      string
  new?:       boolean
  collapsed?: boolean
  onClick?:   () => void
}

function NavItem({ to, icon: Icon, label, new: isNew, collapsed, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={({ isActive }) => cn(
        'group relative flex items-center gap-3 text-sm font-medium transition-all duration-150 mx-2 rounded-xl',
        collapsed ? 'h-10 w-10 justify-center px-0' : 'px-3 py-2.5',
        isActive
          ? 'bg-gradient-to-r from-violet-500/15 to-transparent text-white'
          : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]',
      )}
    >
      {({ isActive }) => (
        <>
          {/* Active left indicator */}
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-violet-500" />
          )}

          <Icon className={cn(
            'h-[18px] w-[18px] shrink-0 transition-colors',
            isActive ? 'text-violet-400' : 'text-slate-600 group-hover:text-slate-400',
          )} />

          {!collapsed && (
            <>
              <span className="flex-1 truncate">{label}</span>
              {isNew && !isActive && (
                <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-violet-500/20 text-[9px] font-bold text-violet-400">
                  +
                </span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  )
}

// ── User footer ───────────────────────────────────────────────────────────────
function UserFooter({ onClose, collapsed }: { onClose?: () => void; collapsed?: boolean }) {
  const { user, logout } = useAuth()
  const initials  = (user?.username ?? 'U').slice(0, 2).toUpperCase()
  const roleLabel = (user?.role ?? 'user').replace(/_/g, ' ')

  const ROLE_BADGE: Record<string, string> = {
    admin:         'text-violet-400 bg-violet-500/15',
    manager:       'text-amber-400  bg-amber-500/15',
    support_agent: 'text-blue-400   bg-blue-500/15',
    viewer:        'text-slate-400  bg-white/5',
  }
  const badgeCls = ROLE_BADGE[user?.role ?? 'viewer'] ?? ROLE_BADGE.viewer

  return (
    <div className="px-3 py-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {!collapsed && (
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl">
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-200 leading-none mb-1">
              {user?.username}
            </p>
            <span className={cn('text-[10px] font-semibold rounded-full px-2 py-0.5 capitalize', badgeCls)}>
              {roleLabel}
            </span>
          </div>
        </div>
      )}

      {collapsed && (
        <div className="flex justify-center py-0.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}
            title={user?.username}
          >
            {initials}
          </div>
        </div>
      )}

      {/* Logout */}
      <button
        onClick={() => { onClose?.(); logout() }}
        title={collapsed ? 'Sign out' : undefined}
        className={cn(
          'flex w-full items-center rounded-xl text-sm font-medium transition-all duration-150',
          'text-slate-600 hover:text-red-400 hover:bg-red-500/10',
          collapsed ? 'h-9 justify-center' : 'gap-3 px-3 py-2',
        )}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {!collapsed && <span>Sign out</span>}
      </button>
    </div>
  )
}

// ── Sidebar content ───────────────────────────────────────────────────────────
function SidebarContent({ onClose, collapsed }: { onClose?: () => void; collapsed?: boolean }) {
  const { isAdmin } = useAuth()

  return (
    <nav
      className="sidebar-root flex h-full flex-col"
      data-sidebar
    >
      <Logo collapsed={collapsed} />

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-4 space-y-0.5">
        {!collapsed && (
          <p className="section-label px-5 pb-2">Navigation</p>
        )}

        {PRIMARY_NAV.map(item => (
          <NavItem key={item.to} {...item} onClick={onClose} collapsed={collapsed} />
        ))}

        {isAdmin && (
          <>
            <div className="mx-3 my-3" style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />
            {!collapsed && (
              <p className="section-label px-5 pb-2">Administration</p>
            )}
            {ADMIN_NAV.map(item => (
              <NavItem key={item.to} {...item} onClick={onClose} collapsed={collapsed} />
            ))}
          </>
        )}
      </div>

      {/* AI Engine badge */}
      {!collapsed && (
        <div className="mx-3 mb-2">
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
            <Cpu className="h-3.5 w-3.5 text-violet-400 shrink-0" />
            <div>
              <p className="text-[11px] font-semibold text-violet-300">LangGraph AI</p>
              <p className="text-[10px] text-slate-600">Multi-agent pipeline</p>
            </div>
            <div className="ml-auto relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-60" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-green-500" />
            </div>
          </div>
        </div>
      )}

      <UserFooter onClose={onClose} collapsed={collapsed} />
    </nav>
  )
}

// ── Desktop sidebar ───────────────────────────────────────────────────────────
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn(
      'hidden lg:flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-200 ease-in-out',
      collapsed ? 'w-[64px]' : 'w-[244px]',
    )}>
      <SidebarContent collapsed={collapsed} />

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className={cn(
          'absolute -right-3 top-[72px] z-10 flex h-6 w-6 items-center justify-center',
          'rounded-full text-slate-600 transition-all shadow-lg',
          'hover:text-slate-300',
        )}
        style={{
          background: '#111827',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  )
}

// ── Mobile drawer ─────────────────────────────────────────────────────────────
export function MobileSidebar() {
  const [open, setOpen] = useState(false)
  const location        = useLocation()
  const overlayRef      = useRef<HTMLDivElement>(null)

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    document.body.classList.toggle('no-scroll', open)
    return () => document.body.classList.remove('no-scroll')
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-white/5 transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        />
      )}

      <div className={cn(
        'fixed inset-y-0 left-0 z-50 w-[244px] transition-transform duration-200 lg:hidden',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent onClose={() => setOpen(false)} />
      </div>
    </>
  )
}
