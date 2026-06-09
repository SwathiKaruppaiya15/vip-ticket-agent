// ── Priority chip classes (dark mode) ─────────────────────────────────────────
export const PRIORITY_BG: Record<string, string> = {
  critical: 'chip-critical',
  high:     'chip-high',
  medium:   'chip-medium',
  low:      'chip-low',
}

export const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high:     'text-orange-400',
  medium:   'text-amber-400',
  low:      'text-green-400',
}

export const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-400',
  low:      'bg-green-500',
}

// ── Status chip classes (dark mode) ──────────────────────────────────────────
export const STATUS_BG: Record<string, string> = {
  open:         'chip-open',
  in_progress:  'chip-in_progress',
  resolved:     'chip-resolved',
  escalated:    'chip-escalated',
  sla_breached: 'chip-sla_breached',
}

// ── VIP tier chip classes (dark mode) ─────────────────────────────────────────
export const VIP_COLORS: Record<string, string> = {
  platinum: 'chip-vip-platinum',
  gold:     'chip-vip-gold',
  silver:   'bg-white/5 text-slate-300 border border-white/10',
  standard: 'bg-white/5 text-slate-400 border border-white/10',
}

// ── Chart colours ──────────────────────────────────────────────────────────────
export const PRIORITY_CHART_COLORS: Record<string, string> = {
  CRITICAL: '#EF4444',
  HIGH:     '#F97316',
  MEDIUM:   '#F59E0B',
  LOW:      '#22C55E',
}

// ── Form options ───────────────────────────────────────────────────────────────
export const DEPARTMENTS = [
  'Engineering', 'Finance', 'HR', 'Legal', 'Marketing', 'Operations',
  'Product', 'Sales', 'Security', 'Executive', 'IT', 'Other',
]

export const ROLES = [
  'CEO', 'CTO', 'CFO', 'COO',
  'VP Engineering', 'VP Sales', 'VP Finance',
  'Director', 'Senior Manager', 'Manager',
  'Team Lead', 'Senior Engineer', 'Engineer',
  'Analyst', 'Coordinator', 'Intern', 'Other',
]
