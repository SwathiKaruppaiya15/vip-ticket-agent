import { create } from 'zustand'
import type { Ticket } from '@/types/ticket'

interface TicketState {
  selectedTicket: Ticket | null
  recentlyCreated: Ticket | null
  setSelected: (ticket: Ticket | null) => void
  setRecentlyCreated: (ticket: Ticket | null) => void
}

export const useTicketStore = create<TicketState>()((set) => ({
  selectedTicket: null,
  recentlyCreated: null,
  setSelected: (ticket) => set({ selectedTicket: ticket }),
  setRecentlyCreated: (ticket) => set({ recentlyCreated: ticket }),
}))
