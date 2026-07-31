/**
 * TypeScript bridge to support ticket CommonJS service (bundled/traced for Cloud Run).
 */
const support = require('../../backend/services/supportTicketService.js')

export const COL = support.COL as string
export const CATEGORIES = support.CATEGORIES as string[]
export const STATUSES = support.STATUSES as string[]
export const PRIORITIES = support.PRIORITIES as string[]

export const createTicket = support.createTicket as (
  payload: Record<string, unknown>,
  actor?: Record<string, unknown> | null
) => Promise<any>

export const getTicket = support.getTicket as (ticketId: string) => Promise<any>
export const listTickets = support.listTickets as (filters?: Record<string, unknown>) => Promise<any[]>
export const addMessage = support.addMessage as (
  ticketId: string,
  opts: Record<string, unknown>
) => Promise<any>
export const updateTicket = support.updateTicket as (
  ticketId: string,
  patch: Record<string, unknown>,
  adminUid?: string
) => Promise<any>
export const getSupportStats = support.getSupportStats as () => Promise<any>
export const canUserAccessTicket = support.canUserAccessTicket as (
  ticket: any,
  user: any
) => boolean
