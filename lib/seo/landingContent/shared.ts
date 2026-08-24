import { BRIEFING_PRICE_LABEL } from '@/lib/domain/briefingPricing'
import type { SeoFaqItem } from '@/components/seo/SeoFaqSection'

export const SME_FREE_FAQ: SeoFaqItem = {
  question: 'Is TenderBriefing free for SMEs?',
  answer:
    'Yes. Discovering compulsory tender briefings, tracking opportunities, viewing official tender details and downloading documents is completely free for registered SMEs on TenderBriefing. You only pay when you choose optional Youth Agent attendance support.',
}

export const BRIEFING_PRICE_FAQ: SeoFaqItem = {
  question: `When do I pay the ${BRIEFING_PRICE_LABEL} fee?`,
  answer: `The fixed ${BRIEFING_PRICE_LABEL} fee applies only when you request a verified Youth Agent to attend a compulsory tender briefing on your behalf. There is no monthly subscription, no paywall on tender discovery and no charge for browsing live opportunities synced from official eTenders data.`,
}

/** @deprecated Use BRIEFING_PRICE_FAQ */
export const R249_FAQ = BRIEFING_PRICE_FAQ

export { BRIEFING_PRICE_LABEL } from '@/lib/domain/briefingPricing'

export const ETENDERS_FAQ: SeoFaqItem = {
  question: 'Does TenderBriefing replace the National Treasury eTenders portal?',
  answer:
    'No. TenderBriefing organises and enriches official eTenders data with a focus on compulsory briefings, SME-friendly workflows and optional agent attendance.',
}

export const COMPULSORY_DISQUALIFICATION_FAQ: SeoFaqItem = {
  question: 'What happens if I miss a compulsory tender briefing?',
  answer:
    'For many South African government tenders, failure to attend a compulsory briefing or site meeting results in automatic disqualification — even if your pricing and technical proposal are strong. Always confirm attendance rules in the official tender documents before investing in a bid.',
}

export const AGENT_DELEGATION_FAQ: SeoFaqItem = {
  question: 'Can someone attend a compulsory briefing on behalf of my company?',
  answer:
    `In many cases, yes — provided the tender allows representation and you follow any registration or proof-of-attendance requirements. Through TenderBriefing you can request a verified Youth Agent to attend on your behalf for a fixed ${BRIEFING_PRICE_LABEL} fee, subject to availability and the specific tender rules.`,
}
