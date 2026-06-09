export type TicketStatus  = 'open' | 'in_progress' | 'resolved' | 'escalated' | 'sla_breached'
export type Priority      = 'low' | 'medium' | 'high' | 'critical'
export type VIPLevel      = 'standard' | 'silver' | 'gold' | 'platinum'
export type Severity      = 'low' | 'medium' | 'high' | 'critical'

export interface Ticket {
  ticket_id: string
  employee_id: string
  employee_name: string
  role: string
  department: string
  issue_title: string
  issue_description: string
  severity: Severity
  category: string | null
  subcategory: string | null
  priority: Priority
  priority_score: number
  vip_detected: boolean
  vip_level: VIPLevel | null
  vip_confidence: number
  urgency_level: string
  business_impact: string
  assigned_team: string | null
  assigned_agent: string | null
  sla_risk_score: number
  sla_deadline: string | null
  ai_reasoning: string[]
  status: TicketStatus
  discord_notified: boolean
  email_notified: boolean
  created_at: string
  updated_at: string
  resolved_at: string | null
  created_by: string
}

export interface TicketCreateRequest {
  employee_id: string
  employee_name: string
  role: string
  department: string
  issue_title: string
  issue_description: string
  severity: Severity
}

export interface TicketUpdateRequest {
  status?: TicketStatus
  assigned_team?: string
  assigned_agent?: string
  priority?: Priority
}

export interface PaginatedTickets {
  items: Ticket[]
  total: number
  page: number
  pages: number
  page_size: number
  has_next: boolean
  has_prev: boolean
}

export interface TicketFilters {
  status?:     TicketStatus
  priority?:   Priority
  vip_only?:   boolean
  department?: string
  search?:     string
  page?:       number
  page_size?:  number
}

export interface ReasoningResponse {
  ticket_id: string
  priority_score: number
  priority_label: string
  vip_detected: boolean
  vip_level: string | null
  vip_confidence: number
  sla_risk_score: number
  sla_deadline: string | null
  ai_reasoning: string[]
  full_explanation: string
  category: string | null
  subcategory: string | null
  assigned_team: string | null
  urgency_level: string
  business_impact: string
  detected_keywords: string[]
}
