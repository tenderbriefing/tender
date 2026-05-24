import type { AgentVerificationStatus } from '@/lib/auth'

export interface AgentTrustFields {
  verificationStatus: AgentVerificationStatus
  reliabilityScore: number
  completedBriefingCount: number
  acceptedBriefingCount: number
  missedBriefingCount: number
}

export function agentTrustDefaults(profile: {
  verificationStatus?: AgentVerificationStatus
  reliabilityScore?: number
  completedBriefingCount?: number
  acceptedBriefingCount?: number
  missedBriefingCount?: number
} | null): AgentTrustFields {
  return {
    verificationStatus: profile?.verificationStatus ?? 'pending',
    reliabilityScore: profile?.reliabilityScore ?? 100,
    completedBriefingCount: profile?.completedBriefingCount ?? 0,
    acceptedBriefingCount: profile?.acceptedBriefingCount ?? 0,
    missedBriefingCount: profile?.missedBriefingCount ?? 0,
  }
}

export function computeAttendanceRate(trust: AgentTrustFields): number | null {
  const total = trust.completedBriefingCount + trust.missedBriefingCount
  if (total <= 0) return null
  return Math.round((trust.completedBriefingCount / total) * 100)
}

export function isNewAgent(trust: AgentTrustFields): boolean {
  return trust.completedBriefingCount === 0 && trust.acceptedBriefingCount === 0
}

export function isReliableAgent(trust: AgentTrustFields): boolean {
  return (
    trust.verificationStatus === 'verified' &&
    trust.reliabilityScore >= 90 &&
    trust.completedBriefingCount >= 3
  )
}
