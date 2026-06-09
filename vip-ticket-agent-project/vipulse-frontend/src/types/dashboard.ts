export interface DashboardStats {
  today_total: number
  today_vip: number
  today_critical: number
  today_escalated: number
  sla_saved: number
  open_tickets: number
  avg_resolution_hours: number
  vip_percentage: number
}

export interface PriorityDistItem {
  priority: string
  count: number
}

export interface DeptIssueItem {
  department: string
  count: number
}

export interface EscalationTrendItem {
  date: string
  total: number
  escalated: number
}

export interface CategoryItem {
  category: string
  count: number
  percentage: number
}

export interface LiveTicketItem {
  ticket_id: string
  employee_name: string
  role: string
  priority: string
  status: string
  vip_detected: boolean
  sla_risk_score: number
  created_at: string
}

export interface TeamWorkload {
  team: string
  open_tickets: number
  avg_sla_risk: number
  critical_count: number
}
