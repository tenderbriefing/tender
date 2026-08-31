import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const mockTransaction = {
  get: vi.fn(),
  set: vi.fn(),
}

const mockDocRef = { id: 'ya-payout-req-1' }
const mockCollection = {
  doc: vi.fn(() => mockDocRef),
}

const mockDb = {
  collection: vi.fn(() => mockCollection),
  runTransaction: vi.fn(async (fn: (tx: typeof mockTransaction) => unknown) => fn(mockTransaction)),
}

describe('youthAgentPayoutService', () => {
  let svc: typeof import('../../backend/services/finance/youthAgentPayoutService.js')

  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.get.mockReset()
    mockTransaction.set.mockReset()

    const firebaseAdmin = require('../../backend/config/firebaseAdmin')
    vi.spyOn(firebaseAdmin, 'getFirestore').mockReturnValue(mockDb)

    const audit = require('../../backend/services/auditLogService')
    vi.spyOn(audit, 'logEvent').mockResolvedValue({})

    // Clear cached service so spies apply
    const svcPath = require.resolve('../../backend/services/finance/youthAgentPayoutService.js')
    delete require.cache[svcPath]
    svc = require('../../backend/services/finance/youthAgentPayoutService.js')
  })

  it('builds deterministic payout id per request', () => {
    expect(svc.buildPayoutId('req-abc')).toBe('ya-payout-req-abc')
  })

  it('creates eligible R200 payout on valid evidence', async () => {
    mockTransaction.get.mockResolvedValue({ exists: false })
    const result: any = await svc.ensurePayoutOnEvidenceSubmitted({
      requestId: 'req-1',
      tenderId: 't-1',
      youthAgentUid: 'agent-1',
      reportId: 'rep-1',
      attendanceVerified: true,
      evidenceSubmitted: true,
      briefingRevenueCents: 34900,
      actorUid: 'agent-1',
    })
    expect(result.ok).toBe(true)
    expect(result.created).toBe(true)
    expect(result.payout.payoutAmountCents).toBe(20000)
    expect(result.payout.grossContributionCents).toBe(14900)
    expect(result.payout.status).toBe('eligible')
  })

  it('does not create duplicate payout on retry', async () => {
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({
        status: 'eligible',
        payoutAmountCents: 20000,
        eligibleAt: '2026-01-01T00:00:00.000Z',
      }),
    })
    const result: any = await svc.ensurePayoutOnEvidenceSubmitted({
      requestId: 'req-1',
      tenderId: 't-1',
      youthAgentUid: 'agent-1',
      attendanceVerified: true,
      evidenceSubmitted: true,
      briefingRevenueCents: 34900,
    })
    expect(result.created).toBe(false)
    expect(result.updated).toBe(true)
  })

  it('preserves gross contribution from stored briefing revenue', async () => {
    mockTransaction.get.mockResolvedValue({ exists: false })
    const result: any = await svc.ensurePayoutOnEvidenceSubmitted({
      requestId: 'req-legacy',
      tenderId: 't-1',
      youthAgentUid: 'agent-1',
      attendanceVerified: true,
      evidenceSubmitted: true,
      briefingRevenueCents: 27500,
    })
    expect(result.payout.briefingRevenueCents).toBe(27500)
    expect(result.payout.grossContributionCents).toBe(7500)
  })

  it('enforces payout state machine', () => {
    expect(svc.canTransition('eligible', 'batched')).toBe(true)
    expect(svc.canTransition('batched', 'settled')).toBe(true)
    expect(svc.canTransition('eligible', 'paid')).toBe(true)
    expect(svc.canTransition('settled', 'eligible')).toBe(false)
    expect(svc.canTransition('held', 'eligible')).toBe(true)
  })

  it('prevents marking the same payout paid twice', async () => {
    const paidAt = '2026-08-24T12:00:00.000Z'
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({
        status: 'paid',
        payoutAmountCents: 20000,
        paidAt,
        paymentReference: 'REF-1',
      }),
    })
    const result: any = await svc.markPayoutPaid('ya-payout-req-paid', {
      actorUid: 'founder-1',
      paymentReference: 'REF-2',
    })
    expect(result.alreadyPaid).toBe(true)
    expect(result.payout.status).toBe('paid')
    expect(result.payout.paidAt).toBe(paidAt)
  })
})
