import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export type LandingTenderFilter = (tender: TenderBriefing) => boolean

export const LANDING_TENDER_FILTERS: Record<string, LandingTenderFilter> = {
  'compulsory-tender-briefings': (t) => t.briefingCompulsory,
  'tender-briefings-south-africa': () => true,
  'tender-briefing-agent': (t) => t.briefingCompulsory,
  'tender-briefing-attendance': (t) => t.briefingCompulsory && Boolean(t.briefingDate),
  'rfq-briefing-support': (t) => {
    const haystack = `${t.procurementMethod} ${t.title} ${t.description} ${t.category}`.toLowerCase()
    return (
      haystack.includes('rfq') ||
      haystack.includes('request for quotation') ||
      haystack.includes('request for quote') ||
      t.privateRfq === true
    )
  },
  'youth-agent-tender-support': (t) => t.briefingCompulsory,
}

export function getLandingTenderFilter(slug: string): LandingTenderFilter {
  return LANDING_TENDER_FILTERS[slug] ?? (() => true)
}
