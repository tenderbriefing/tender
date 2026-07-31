import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const {
  assertWorkflowTransition,
  assertPaymentTransition,
  applyWorkflowTransition,
  applyPaymentTransition,
  isDispatchablePayment,
} = require('../../backend/services/domain/lifecycleEnforcement')

describe('lifecycleEnforcement (authoritative JS)', () => {
  it('allows paid transition from pending and rejects paid→pending', () => {
    expect(() => assertPaymentTransition('pending', 'paid')).not.toThrow()
    expect(() => assertPaymentTransition('paid', 'pending')).toThrow(/Invalid payment/)
  })

  it('blocks unpaid agent assignment path via payment gate helper', () => {
    expect(isDispatchablePayment('pending')).toBe(false)
    expect(isDispatchablePayment('paid')).toBe(true)
  })

  it('allows youth-agent pending→assigned and blocks sme', () => {
    expect(() => assertWorkflowTransition('pending', 'assigned', 'youth-agent')).not.toThrow()
    expect(() => assertWorkflowTransition('pending', 'assigned', 'sme')).toThrow(/cannot transition/)
  })

  it('applies actor attribution on workflow transition', () => {
    const next = applyWorkflowTransition(
      { id: 'r1', status: 'pending', paymentStatus: 'paid' },
      'assigned',
      { role: 'youth-agent', actorId: 'agent-a' }
    )
    expect(next.status).toBe('assigned')
    expect(next.lastTransitionBy).toBe('agent-a')
    expect(next.lastTransitionRole).toBe('youth-agent')
  })

  it('applies payment transition with paidAt fields via extra', () => {
    const next = applyPaymentTransition(
      { id: 'r1', paymentStatus: 'pending' },
      'paid',
      { actorId: 'payfast_itn', extra: { paidAt: '2026-01-01T00:00:00.000Z' } }
    )
    expect(next.paymentStatus).toBe('paid')
    expect(next.paidAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('rejects completion from pending', () => {
    expect(() => assertWorkflowTransition('pending', 'completed', 'youth-agent')).toThrow()
  })
})
