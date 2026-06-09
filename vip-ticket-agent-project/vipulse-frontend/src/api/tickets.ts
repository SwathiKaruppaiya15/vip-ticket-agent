import apiClient from './client'
import type {
  PaginatedTickets,
  ReasoningResponse,
  Ticket,
  TicketCreateRequest,
  TicketFilters,
  TicketUpdateRequest,
} from '@/types/ticket'

interface ApiEnvelope<T> { success: boolean; data: T; message?: string }

/**
 * Strip undefined/null/false values from filter params so Axios
 * doesn't serialise them as the string "undefined" or send vip_only=false.
 * Only include a param if it has a meaningful value.
 */
function buildParams(filters: TicketFilters): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {}

  if (filters.page      !== undefined) params.page      = filters.page
  if (filters.page_size !== undefined) params.page_size = filters.page_size
  if (filters.status    !== undefined) params.status    = filters.status
  if (filters.priority  !== undefined) params.priority  = filters.priority
  if (filters.department !== undefined) params.department = filters.department
  // Only send vip_only when it is explicitly true — backend default is false
  if (filters.vip_only === true) params.vip_only = true
  // Only send search when it is a non-empty string
  if (filters.search && filters.search.trim()) params.search = filters.search.trim()

  return params
}

export const ticketsApi = {
  /** Create a ticket; returns the skeleton ticket (AI pipeline runs async). */
  create: async (req: TicketCreateRequest): Promise<Ticket> => {
    const { data } = await apiClient.post<ApiEnvelope<Ticket>>('/api/v1/tickets/', req)
    return data.data
  },

  /**
   * Paginated ticket list.
   *
   * Backend response envelope:
   *   { success: true, data: { items: Ticket[], total: N, page: N, pages: N, ... } }
   *
   * We strip the outer envelope here and return the inner PaginatedTickets object.
   */
  list: async (filters: TicketFilters = {}): Promise<PaginatedTickets> => {
    const params = buildParams(filters)
    const { data } = await apiClient.get<ApiEnvelope<PaginatedTickets>>(
      '/api/v1/tickets/',
      { params },
    )

    // Defensive: handle both `data.data` (standard envelope) and a bare response
    const payload = data?.data ?? (data as unknown as PaginatedTickets)

    // Ensure the shape is always valid even if backend sends something unexpected
    return {
      items:     Array.isArray(payload?.items) ? payload.items : [],
      total:     typeof payload?.total === 'number' ? payload.total : 0,
      page:      payload?.page      ?? 1,
      pages:     payload?.pages     ?? 1,
      page_size: payload?.page_size ?? 20,
      has_next:  payload?.has_next  ?? false,
      has_prev:  payload?.has_prev  ?? false,
    }
  },

  /** Get a single ticket by ID. */
  get: async (ticketId: string): Promise<Ticket> => {
    const { data } = await apiClient.get<ApiEnvelope<Ticket>>(`/api/v1/tickets/${ticketId}`)
    return data.data
  },

  /** Update a ticket's status / assignment. */
  update: async (ticketId: string, req: TicketUpdateRequest): Promise<Ticket> => {
    const { data } = await apiClient.patch<ApiEnvelope<Ticket>>(
      `/api/v1/tickets/${ticketId}`,
      req,
    )
    return data.data
  },

  /** Soft-delete a ticket. */
  delete: async (ticketId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/tickets/${ticketId}`)
  },

  /** Get full AI reasoning/explainability for a ticket. */
  getReasoning: async (ticketId: string): Promise<ReasoningResponse> => {
    const { data } = await apiClient.get<ApiEnvelope<ReasoningResponse>>(
      `/api/v1/tickets/${ticketId}/reasoning`,
    )
    return data.data
  },
}
