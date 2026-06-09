import { Crown, AlertTriangle, Flame } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Ticket } from '@/types/ticket'

interface Props {
  ticket: Pick<Ticket, 'vip_detected' | 'vip_level' | 'priority' | 'status'>
}

export function EscalationBadge({ ticket }: Props) {
  if (ticket.status === 'sla_breached') {
    return (
      <span className="chip animate-pulse" style={{
        background: 'rgba(239,68,68,0.15)',
        color: '#F87171',
        border: '1px solid rgba(239,68,68,0.30)',
      }}>
        <Flame className="h-3 w-3" />
        SLA Breached
      </span>
    )
  }

  if (ticket.status === 'escalated') {
    return (
      <span className="chip" style={{
        background: 'rgba(249,115,22,0.15)',
        color: '#FB923C',
        border: '1px solid rgba(249,115,22,0.25)',
      }}>
        <AlertTriangle className="h-3 w-3" />
        Escalated
      </span>
    )
  }

  if (ticket.vip_detected) {
    const isPlatinum = ticket.vip_level === 'platinum'
    return (
      <span className={cn('chip', isPlatinum ? 'chip-vip-platinum' : 'chip-vip-gold')}>
        <Crown className="h-3 w-3" />
        {ticket.vip_level?.toUpperCase()}
      </span>
    )
  }

  return null
}
