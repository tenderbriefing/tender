import { describe, expect, it } from 'vitest'
import {
  deriveManualOpsStage,
  deriveUrgencyFlags,
  clampAgentPayoutCents,
  normalizeOpsStage,
  SUGGESTED_AGENT_PAYOUT_CENTS,
  MAX_AGENT_PAYOUT_CENTS,
  manualOpsLabel,
} from '@/lib/domain/manualBriefingOps'
import { resolveYouthAgentPayoutCents, BRIEFING_PRICE_CENTS } from '@/lib/domain/briefingPricing'

describe('manualBriefingOps Phase 10', () => {
  it('maps unpaid → payment_required', () => {
    expect(deriveManualOpsStage({ paymentStatus: 'pending' })).toBe('payment_required')
  })

  it('maps paid without representative → assignment_required', () => {
    expect(
      deriveManualOpsStage({
        paymentStatus: 'paid',
        status: 'pending',
      })
    ).toBe('assignment_required')
  })

  it('normalizes legacy paid_agent_required → assignment_required', () => {
    expect(normalizeOpsStage('paid_agent_required')).toBe('assignment_required')
    expect(normalizeOpsStage('paid_assignment_required')).toBe('assignment_required')
    expect(manualOpsLabel('paid_agent_required')).toBe('Assignment Required')
    expect(
      deriveManualOpsStage({
        paymentStatus: 'paid',
        opsStage: 'paid_agent_required',
      })
    ).toBe('assignment_required')
  })

  it('maps assigned representative → assigned', () => {
    expect(
      deriveManualOpsStage({
        paymentStatus: 'paid',
        status: 'assigned',
        representativeName: 'Thabo Field',
      })
    ).toBe('assigned')
  })

  it('maps report ready without auto-delivery', () => {
    expect(
      deriveManualOpsStage({
        paymentStatus: 'paid',
        representativeName: 'Rep',
        attended: true,
        evidenceOverride: true,
        reportReadyAt: '2026-10-16T00:00:00Z',
      })
    ).toBe('report_ready')
  })

  it('delivered does not imply closed', () => {
    expect(
      deriveManualOpsStage({
        paymentStatus: 'paid',
        deliveredAt: '2026-10-16T00:00:00Z',
      })
    ).toBe('delivered')
    expect(
      deriveManualOpsStage({
        paymentStatus: 'paid',
        deliveredAt: '2026-10-16T00:00:00Z',
        closedAt: '2026-10-17T00:00:00Z',
      })
    ).toBe('closed')
  })

  it('attended without evidence → evidence_required', () => {
    expect(
      deriveManualOpsStage({
        paymentStatus: 'paid',
        representativeName: 'Rep',
        attended: true,
        evidenceItems: [],
      })
    ).toBe('evidence_required')
  })

  it('flags assignment / briefing / evidence / report exceptions', () => {
    const soonIso = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
    const flags = deriveUrgencyFlags({
      paymentStatus: 'paid',
      briefingDate: soonIso,
      briefingVenue: '',
      documents: [{ kind: 'rfq' }],
    })
    expect(flags).toContain('assignment_required')
    expect(flags).toContain('paid_no_agent')
    expect(flags).toContain('missing_loa')
    expect(flags).toContain('venue_unconfirmed')
    expect(flags).toContain('briefing_within_24h')
  })

  it('clamps payout override into R100–R600 band', () => {
    expect(clampAgentPayoutCents(40000)).toBe(40000)
    expect(clampAgentPayoutCents(SUGGESTED_AGENT_PAYOUT_CENTS)).toBe(40000)
    expect(clampAgentPayoutCents(MAX_AGENT_PAYOUT_CENTS)).toBe(60000)
    expect(clampAgentPayoutCents(5000)).toBeNull()
    expect(clampAgentPayoutCents(70000)).toBeNull()
  })

  it('resolveYouthAgentPayoutCents prefers override without changing SME price', () => {
    expect(BRIEFING_PRICE_CENTS).toBe(75000)
    expect(resolveYouthAgentPayoutCents({ agentPayoutCents: 45000 })).toBe(45000)
    expect(resolveYouthAgentPayoutCents({})).toBeGreaterThan(0)
  })
})
