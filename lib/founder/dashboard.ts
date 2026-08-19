/** Founder Dashboard V2 contracts — presentation only; payment/workflow states stay on the server. */

export const FOUNDER_DASHBOARD_PERIODS = ['7', '30', '90', 'all'] as const
export type FounderDashboardPeriod = (typeof FOUNDER_DASHBOARD_PERIODS)[number]

export const NEEDS_ATTENTION_EMPTY = 'Nothing requires your attention.'

export const PRESENTATIONAL_LIFECYCLE = [
  'paid',
  'agent_assigned',
  'attended',
  'report_delivered',
] as const

export type PresentationalLifecycle = (typeof PRESENTATIONAL_LIFECYCLE)[number] | 'cancelled' | 'unpaid'

export type FounderDashboardView = 'overview' | 'smes' | 'agents' | 'briefings' | 'detail'

export interface FounderKpis {
  smes: number
  youthAgents: number
  paidBookings: number
  revenueCents: number
  upcomingBriefings: number
  completedBriefings: number
}

export interface ActivityPoint {
  date: string
  smeRegistrations: number
  youthAgentRegistrations: number
  paidBookings: number
}

export interface NeedsAttentionItem {
  id: string
  kind:
    | 'paid_awaiting_assignment'
    | 'report_overdue'
    | 'proof_outstanding'
    | 'payment_reconciliation'
  title: string
  href: string
  recordId: string
  detail?: string | null
}

export interface SmeDirectoryRow {
  id: string
  company: string
  contact: string
  province: string | null
  joined: string | null
  bookings: number
  totalSpentCents: number | null
  lastActive: string | null
}

export interface AgentDirectoryRow {
  id: string
  agent: string
  province: string | null
  joined: string | null
  briefings: number
  completed: number
  reports: number
  earningsCents: number | null
}

export interface BriefingDirectoryRow {
  id: string
  sme: string
  tender: string
  briefingDate: string | null
  amountCents: number | null
  youthAgent: string | null
  status: string
  lifecycle: PresentationalLifecycle
  lifecycleLabel: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface FounderOverviewPayload {
  period: FounderDashboardPeriod
  kpis: FounderKpis
  activity: ActivityPoint[]
  needsAttention: NeedsAttentionItem[]
  generatedAt: string
  dataNotes: string[]
  cohortCapped: boolean
}

export interface FounderDashboardPayload {
  view: FounderDashboardView
  overview?: FounderOverviewPayload
  smes?: Paginated<SmeDirectoryRow>
  agents?: Paginated<AgentDirectoryRow>
  briefings?: Paginated<BriefingDirectoryRow>
  detail?: Record<string, unknown> | null
  generatedAt: string
}

export function formatZarFromCents(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '—'
  return `R${(cents / 100).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatJoined(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function periodLabel(period: FounderDashboardPeriod): string {
  if (period === '7') return 'Last 7 Days'
  if (period === '90') return 'Last 90 Days'
  if (period === 'all') return 'All Time'
  return 'Last 30 Days'
}
