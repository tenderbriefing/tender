import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { daysUntil, isClosingSoon } from './dates'

export type TenderDisplayStatus =
  | 'open'
  | 'closing_soon'
  | 'closed'
  | 'briefing_available'
  | 'compulsory_briefing'

export function getTenderDisplayStatus(tender: TenderBriefing): TenderDisplayStatus {
  if (tender.status === 'closed' || tender.status === 'cancelled') return 'closed'
  const daysLeft = daysUntil(tender.closingDate)
  if (daysLeft !== null && daysLeft < 0) return 'closed'
  if (tender.briefingCompulsory) return 'compulsory_briefing'
  if (isClosingSoon(tender.closingDate)) return 'closing_soon'
  if (tender.briefingDate) return 'briefing_available'
  return 'open'
}

export function computeTenderDashboardStats(tenders: TenderBriefing[]) {
  let open = 0
  let closingSoon = 0
  let compulsory = 0
  for (const t of tenders) {
    const status = getTenderDisplayStatus(t)
    if (status === 'closed') continue
    open += 1
    if (status === 'closing_soon') closingSoon += 1
    if (t.briefingCompulsory) compulsory += 1
  }
  return {
    total: tenders.length,
    open,
    closingSoon,
    compulsory,
  }
}
