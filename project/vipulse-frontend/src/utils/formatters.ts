import { format, formatDistanceToNow, parseISO } from 'date-fns'

export const fmtDate = (iso: string) =>
  format(parseISO(iso), 'MMM d, yyyy HH:mm')

export const fmtRelative = (iso: string) =>
  formatDistanceToNow(parseISO(iso), { addSuffix: true })

export const fmtHours = (h: number) =>
  h < 1 ? `${Math.round(h * 60)}m` : h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`

export const fmtPriority = (p: string) =>
  p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()

export const fmtPercent = (n: number, decimals = 1) =>
  `${n.toFixed(decimals)}%`

export const slaColor = (score: number) => {
  if (score >= 76) return '#dc2626'
  if (score >= 51) return '#f97316'
  if (score >= 26) return '#f59e0b'
  return '#22c55e'
}

export const priorityChartColor = (p: string) => {
  const map: Record<string, string> = {
    CRITICAL: '#dc2626',
    HIGH:     '#f97316',
    MEDIUM:   '#f59e0b',
    LOW:      '#22c55e',
  }
  return map[p.toUpperCase()] ?? '#64748b'
}
