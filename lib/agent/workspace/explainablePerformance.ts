/**
 * Explainable performance score — mirrors agentPerformanceService formula
 * with human-readable factor breakdown (no invented facts).
 */

export interface PerformanceInputs {
  smeRating?: number | null
  completionRate?: number
  missedBriefings?: number
  acceptanceSpeedMinutes?: number | null
  reportUploadHours?: number | null
  reportingQuality?: number
  verified?: boolean
  transportAvailable?: boolean
}

export interface PerformanceFactor {
  key: string
  label: string
  contribution: number
  detail: string
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/**
 * Same composite 0–100 as backend agentPerformanceScore, with factor trail.
 */
export function explainPerformanceScore(inputs: PerformanceInputs = {}): {
  score: number
  tier: string
  factors: PerformanceFactor[]
} {
  const {
    smeRating = 3,
    completionRate = 0,
    missedBriefings = 0,
    acceptanceSpeedMinutes = null,
    reportUploadHours = null,
    reportingQuality = 50,
    verified = false,
    transportAvailable = false,
  } = inputs

  const factors: PerformanceFactor[] = []
  let score = 50
  factors.push({
    key: 'base',
    label: 'Baseline',
    contribution: 50,
    detail: 'Neutral starting score before field outcomes',
  })

  if (smeRating != null) {
    const c = clamp((smeRating - 3) * 8, -16, 16)
    score += c
    factors.push({
      key: 'sme_rating',
      label: 'SME rating',
      contribution: c,
      detail: `Rating ${smeRating}/5 → ${c >= 0 ? '+' : ''}${c}`,
    })
  }

  const completionContrib = clamp(completionRate * 25, 0, 25)
  score += completionContrib
  factors.push({
    key: 'completion_rate',
    label: 'Completion rate',
    contribution: completionContrib,
    detail: `${Math.round(completionRate * 100)}% completed assignments`,
  })

  const missPenalty = clamp(missedBriefings * 8, 0, 32)
  score -= missPenalty
  factors.push({
    key: 'missed_briefings',
    label: 'Missed briefings',
    contribution: -missPenalty,
    detail: `${missedBriefings} missed (−${missPenalty})`,
  })

  if (acceptanceSpeedMinutes !== null) {
    let c = -6
    let detail = `Avg accept ${Math.round(acceptanceSpeedMinutes)} min (slow)`
    if (acceptanceSpeedMinutes <= 15) {
      c = 12
      detail = `Avg accept ${Math.round(acceptanceSpeedMinutes)} min (fast)`
    } else if (acceptanceSpeedMinutes <= 60) {
      c = 6
      detail = `Avg accept ${Math.round(acceptanceSpeedMinutes)} min`
    }
    score += c
    factors.push({
      key: 'acceptance_speed',
      label: 'Acceptance speed',
      contribution: c,
      detail,
    })
  }

  if (reportUploadHours !== null) {
    let c = -4
    let detail = `Avg upload ${reportUploadHours.toFixed(1)}h after briefing`
    if (reportUploadHours <= 4) {
      c = 10
      detail = `Avg upload ${reportUploadHours.toFixed(1)}h (prompt)`
    } else if (reportUploadHours <= 24) {
      c = 4
      detail = `Avg upload ${reportUploadHours.toFixed(1)}h`
    }
    score += c
    factors.push({
      key: 'report_upload',
      label: 'Report upload speed',
      contribution: c,
      detail,
    })
  }

  const qualityContrib = clamp((reportingQuality - 50) / 5, -10, 10)
  score += qualityContrib
  factors.push({
    key: 'reporting_quality',
    label: 'Reporting quality',
    contribution: Math.round(qualityContrib * 10) / 10,
    detail: `Reliability index ${reportingQuality}`,
  })

  if (verified) {
    score += 4
    factors.push({
      key: 'verified',
      label: 'Verified agent',
      contribution: 4,
      detail: 'Identity / onboarding verified',
    })
  }
  if (transportAvailable) {
    score += 2
    factors.push({
      key: 'transport',
      label: 'Transport available',
      contribution: 2,
      detail: 'Transport capability on profile',
    })
  }

  const finalScore = clamp(Math.round(score), 0, 100)
  const tier =
    finalScore >= 85 ? 'Platinum' : finalScore >= 70 ? 'Gold' : finalScore >= 50 ? 'Silver' : 'At Risk'

  return { score: finalScore, tier, factors }
}
