import apiClient from './client'
import type {
  CategoryItem,
  DashboardStats,
  DeptIssueItem,
  EscalationTrendItem,
  LiveTicketItem,
  PriorityDistItem,
  TeamWorkload,
} from '@/types/dashboard'

interface ApiEnvelope<T> { success: boolean; data: T }

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await apiClient.get<ApiEnvelope<DashboardStats>>('/api/v1/dashboard/stats')
    return data.data
  },

  getPriorityDistribution: async (): Promise<PriorityDistItem[]> => {
    const { data } = await apiClient.get<ApiEnvelope<{ distribution: PriorityDistItem[] }>>(
      '/api/v1/dashboard/charts/priority-distribution',
    )
    return data.data.distribution
  },

  getDepartmentIssues: async (): Promise<DeptIssueItem[]> => {
    const { data } = await apiClient.get<ApiEnvelope<{ departments: DeptIssueItem[] }>>(
      '/api/v1/dashboard/charts/department-issues',
    )
    return data.data.departments
  },

  getEscalationTrends: async (): Promise<EscalationTrendItem[]> => {
    const { data } = await apiClient.get<ApiEnvelope<{ trends: EscalationTrendItem[] }>>(
      '/api/v1/dashboard/charts/escalation-trends',
    )
    return data.data.trends
  },

  getCategoryBreakdown: async (): Promise<CategoryItem[]> => {
    const { data } = await apiClient.get<ApiEnvelope<{ categories: CategoryItem[] }>>(
      '/api/v1/dashboard/charts/category-breakdown',
    )
    return data.data.categories
  },

  getLiveTickets: async (): Promise<LiveTicketItem[]> => {
    const { data } = await apiClient.get<ApiEnvelope<{ tickets: LiveTicketItem[]; total: number }>>(
      '/api/v1/dashboard/live-tickets',
    )
    return data.data.tickets
  },

  exportTickets: async (format: 'csv' | 'pdf', filters: Record<string, unknown> = {}): Promise<Blob> => {
    const { data } = await apiClient.post(
      '/api/v1/dashboard/export',
      { format, filters },
      { responseType: 'blob' },
    )
    return data
  },

  getTeamWorkload: async (): Promise<TeamWorkload[]> => {
    const { data } = await apiClient.get<ApiEnvelope<{ team_workload: TeamWorkload[] }>>(
      '/api/v1/analytics/team-workload',
    )
    return data.data.team_workload
  },
}
