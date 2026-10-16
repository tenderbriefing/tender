import { describe, expect, it } from 'vitest'
import {
  deriveManualOpsStage,
  deriveUrgencyFlags,
  clampAgentPayoutCents,
  SUGGESTED_AGENT_PAYOUT_CENTS,
  MAX_AGENT_PAYOUT_CENTS,
} from '@/lib/domain/manualBriefingOps'
import { resolveYouthAgentPayoutCents, BRIEFING_PRICE_CENTS } from '@/lib/domain/briefingPricing'

describe('manualBriefingOps', () => {
  it('maps unpaid → Awaiting Payment', () => {
    expect(deriveManualOpsStage({ paymentStatus: 'pending' })).toBe('awaiting_payment')
  })

  it('maps paid without agent → Paid — Agent Required (payment ≠ agent secured)', () => {
    expect(
      deriveManualOpsStage({
        paymentStatus: 'paid',
        status: 'pending',
      })
    ).toBe('paid_agent_required')
  })

  it('maps assigned → Agent Assigned', () => {
    expect(
      deriveManualOpsStage({
        paymentStatus: 'paid',
        status: 'assigned',
        assignedAgentId: 'ya-1',
      })
    ).toBe('agent_assigned')
  })

  it('maps report approved → Report Ready (not auto-delivered)', () => {
    expect(
      deriveManualOpsStage({
        paymentStatus: 'paid',
        status: 'completed',
        completed: true,
        reportApprovedAt: '2026-10-16T00:00:00Z',
      })
    ).toBe('report_ready')
  })

  it('flags paid-no-agent, missing LOA, venue, and 24h urgency', () => {
    const tomorrow = new Date()
    tomorrow.setHours(tomorrow.getHours() + 12)
    const date = tomorrow.toISOString().slice(0, 10)
    const flags = deriveUrgencyFlags({
      paymentStatus: 'paid',
      briefingDate: date,
      briefingVenue: '',
      documents: [{ kind: 'rfq' }],
    })
    expect(flags).toContain('paid_no_agent')
    expect(flags).toContain('missing_loa')
    expect(flags).toContain('venue_unconfirmed')
    expect(flags).toContain('briefing_within_24h')
  })

  it('clamps YA payout override into R100–R600 band', () => {
    expect(clampAgentPayoutCents(40000)).toBe(40000)
    expect(clampAgentPayoutCents(SUGGESTED_AGENT_PAYOUT_CENTS)).toBe(40000)
    expect(clampAgentPayoutCents(MAX_AGENT_PAYOUT_CENTS)).toBe(60000)
    expect(clampAgentPayoutCents(5000)).toBeNull()
    expect(clampAgentPayoutCents(70000)).toBeNull()
  })

  it('resolveYouthAgentPayoutCents prefers assignment override without changing SME price', () => {
    expect(BRIEFING_PRICE_CENTS).toBe(75000)
    expect(resolveYouthAgentPayoutCents({ agentPayoutCents: 45000 })).toBe(45000)
    expect(resolveYouthAgentPayoutCents({})).toBeGreaterThan(0)
  })
})
