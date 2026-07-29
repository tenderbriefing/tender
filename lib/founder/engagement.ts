/**
 * Transparent engagement classification rules for Founder User Intelligence.
 * Background polling / automatic refreshes are never "meaningful".
 */

export type EngagementClass =
  | 'new'
  | 'onboarding'
  | 'exploring'
  | 'active'
  | 'highly_active'
  | 'at_risk'
  | 'dormant'
  | 're_engaged'

export const ENGAGEMENT_RULES = {
  newDays: 7,
  activeDays: 14,
  atRiskMinDays: 14,
  atRiskMaxDays: 30,
  dormantDays: 30,
  highlyActiveMinSessions: 3,
  highlyActiveMinMeaningful: 5,
} as const

export function daysBetween(fromIso: string | null | undefined, to = new Date()): number | null {
  if (!fromIso) return null
  const t = new Date(fromIso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((to.getTime() - t) / (24 * 60 * 60 * 1000))
}

export function classifyEngagement(input: {
  registeredAt: string | null
  lastMeaningfulAt: string | null
  onboardingCompleted: boolean
  meaningfulEventCount: number
  sessionCount: number
  wasDormantBefore?: boolean
}): EngagementClass {
  const daysSinceReg = daysBetween(input.registeredAt) ?? 9999
  const daysSinceActive = daysBetween(input.lastMeaningfulAt)

  if (!input.onboardingCompleted && daysSinceReg <= 60) return 'onboarding'
  if (daysSinceReg <= ENGAGEMENT_RULES.newDays) return 'new'

  if (daysSinceActive == null) {
    return daysSinceReg > ENGAGEMENT_RULES.dormantDays ? 'dormant' : 'exploring'
  }

  if (
    input.wasDormantBefore &&
    daysSinceActive <= ENGAGEMENT_RULES.activeDays
  ) {
    return 're_engaged'
  }

  if (daysSinceActive > ENGAGEMENT_RULES.dormantDays) return 'dormant'
  if (
    daysSinceActive >= ENGAGEMENT_RULES.atRiskMinDays &&
    daysSinceActive <= ENGAGEMENT_RULES.atRiskMaxDays
  ) {
    return 'at_risk'
  }

  if (
    daysSinceActive <= ENGAGEMENT_RULES.activeDays &&
    input.sessionCount >= ENGAGEMENT_RULES.highlyActiveMinSessions &&
    input.meaningfulEventCount >= ENGAGEMENT_RULES.highlyActiveMinMeaningful
  ) {
    return 'highly_active'
  }

  if (daysSinceActive <= ENGAGEMENT_RULES.activeDays) {
    return input.meaningfulEventCount > 0 ? 'active' : 'exploring'
  }

  return 'exploring'
}

export function engagementLabel(c: EngagementClass): string {
  const map: Record<EngagementClass, string> = {
    new: 'New',
    onboarding: 'Onboarding',
    exploring: 'Exploring',
    active: 'Active',
    highly_active: 'Highly Active',
    at_risk: 'At Risk',
    dormant: 'Dormant',
    re_engaged: 'Re-engaged',
  }
  return map[c]
}
