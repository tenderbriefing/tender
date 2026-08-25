import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const store = new Map<string, Record<string, unknown>>()

const mockTransaction = {
  get: vi.fn(async (ref: { id: string; _col: string }) => {
    const key = `${ref._col}/${ref.id}`
    const data = store.get(key)
    return { exists: Boolean(data), data: () => data }
  }),
  set: vi.fn(
    (
      ref: { id: string; _col: string },
      data: Record<string, unknown>,
      opts?: { merge?: boolean }
    ) => {
      const key = `${ref._col}/${ref.id}`
      if (opts?.merge && store.has(key)) {
        store.set(key, { ...store.get(key), ...data })
      } else {
        store.set(key, data)
      }
    }
  ),
}

function docRef(col: string, id: string) {
  return {
    id,
    _col: col,
    get: async () => {
      const key = `${col}/${id}`
      const data = store.get(key)
      return { exists: Boolean(data), data: () => data, id }
    },
  }
}

function docsForCollection(name: string) {
  return Array.from(store.entries())
    .filter(([k]) => k.startsWith(`${name}/`))
    .map(([k, data]) => ({
      id: k.split('/')[1],
      data: () => data,
    }))
}

function queryChain(name: string) {
  const chain = {
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => ({
      get: vi.fn(async () => ({ docs: docsForCollection(name) })),
    })),
    get: vi.fn(async () => ({ docs: docsForCollection(name) })),
  }
  return chain
}

const mockDb = {
  collection: vi.fn((name: string) => ({
    doc: (id?: string) => docRef(name, id || `auto-${Math.random().toString(36).slice(2, 10)}`),
    ...queryChain(name),
  })),
  runTransaction: vi.fn(async (fn: (tx: typeof mockTransaction) => unknown) =>
    fn(mockTransaction)
  ),
}

function seedPayout(id: string, data: Record<string, unknown>) {
  store.set(`youthAgentPayouts/${id}`, {
    payoutId: id,
    payoutAmountCents: 20000,
    status: 'eligible',
    eligibilityStatus: 'eligible',
    youthAgentUid: 'agent-1',
    requestId: id.replace('ya-payout-', ''),
    settlementBatchId: null,
    ...data,
  })
}

function seedBanking(uid = 'agent-1') {
  store.set(`youthAgentBankingProfiles/${uid}`, {
    youthAgentUid: uid,
    accountHolderName: 'Test Agent',
    bankName: 'FNB',
    accountNumber: '62123456789',
    accountType: 'cheque',
    branchCode: '250655',
    version: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    createdBy: uid,
    updatedBy: uid,
  })
}

describe('youthAgentPayoutBatchService', () => {
  let batchSvc: typeof import('../../backend/services/finance/youthAgentPayoutBatchService.js')
  let payoutSvc: typeof import('../../backend/services/finance/youthAgentPayoutService.js')

  beforeEach(() => {
    vi.clearAllMocks()
    store.clear()
    mockTransaction.get.mockClear()
    mockTransaction.set.mockClear()

    const firebaseAdmin = require('../../backend/config/firebaseAdmin')
    vi.spyOn(firebaseAdmin, 'getFirestore').mockReturnValue(mockDb)

    const audit = require('../../backend/services/auditLogService')
    vi.spyOn(audit, 'logEvent').mockResolvedValue({})

    for (const path of [
      '../../backend/services/finance/youthAgentBankingService.js',
      '../../backend/services/finance/youthAgentPayoutBatchService.js',
      '../../backend/services/finance/youthAgentPayoutService.js',
    ]) {
      delete require.cache[require.resolve(path)]
    }
    batchSvc = require('../../backend/services/finance/youthAgentPayoutBatchService.js')
    payoutSvc = require('../../backend/services/finance/youthAgentPayoutService.js')
  })

  it('builds deterministic batch id', () => {
    expect(batchSvc.buildBatchId('agent-1', '2026-08')).toBe('ya-batch-agent-1-2026-08')
  })

  it('generates monthly batch for 5 eligible jobs = R1,000', async () => {
    const periodKey = '2026-08'
    for (let i = 1; i <= 5; i++) {
      seedPayout(`ya-payout-req-${i}`, {
        youthAgentUid: 'agent-1',
        requestId: `req-${i}`,
        eligibleAt: `2026-08-${String(i).padStart(2, '0')}T10:00:00.000Z`,
      })
    }

    const result = await batchSvc.generateMonthlyBatches({
      periodKey,
      actorUid: 'founder-1',
    })

    expect(result.batches.length).toBe(1)
    const batch = result.batches[0].batch
    expect(batch.eligibleJobCount).toBe(5)
    expect(batch.grossEarningsCents).toBe(100000)
    expect(batch.status).toBe('ready')

    const batchId = batchSvc.buildBatchId('agent-1', periodKey)
    for (let i = 1; i <= 5; i++) {
      const row = store.get(`youthAgentPayouts/ya-payout-req-${i}`)
      expect(row?.status).toBe('batched')
      expect(row?.settlementBatchId).toBe(batchId)
    }
  })

  it('is idempotent when generating the same monthly batch twice', async () => {
    seedPayout('ya-payout-req-a', {
      youthAgentUid: 'agent-1',
      eligibleAt: '2026-08-10T10:00:00.000Z',
    })
    await batchSvc.generateMonthlyBatches({ periodKey: '2026-08', actorUid: 'f1' })
    const second = await batchSvc.generateMonthlyBatches({ periodKey: '2026-08', actorUid: 'f1' })
    expect(second.batches[0].alreadyExists).toBe(true)
    const batchRows = Array.from(store.keys()).filter((k) =>
      k.startsWith('youthAgentPayoutBatches/')
    )
    expect(batchRows.length).toBe(1)
  })

  it('marks batch paid and settles all linked jobs', async () => {
    seedBanking()
    for (let i = 1; i <= 5; i++) {
      seedPayout(`ya-payout-req-${i}`, {
        youthAgentUid: 'agent-1',
        requestId: `req-${i}`,
        eligibleAt: `2026-08-0${i}T10:00:00.000Z`,
      })
    }
    await batchSvc.generateMonthlyBatches({ periodKey: '2026-08', actorUid: 'f1' })
    const batchId = batchSvc.buildBatchId('agent-1', '2026-08')

    const paid = await batchSvc.markBatchPaid(batchId, {
      actorUid: 'founder-1',
      paymentReference: 'EFT-2026-08-001',
      paymentMethod: 'EFT',
      amountPaidCents: 100000,
    } as Record<string, unknown>)
    expect(paid.alreadyPaid).toBe(false)
    expect(paid.batch.status).toBe('paid')
    expect(paid.batch.paymentMethod).toBe('EFT')

    for (let i = 1; i <= 5; i++) {
      const row = store.get(`youthAgentPayouts/ya-payout-req-${i}`)
      expect(row?.status).toBe('settled')
      expect(row?.settlementBatchId).toBe(batchId)
      expect(row?.paymentReference).toBe('EFT-2026-08-001')
    }
  })

  it('mark batch paid is idempotent on retry', async () => {
    seedBanking()
    seedPayout('ya-payout-req-x', {
      youthAgentUid: 'agent-1',
      eligibleAt: '2026-08-11T10:00:00.000Z',
    })
    await batchSvc.generateMonthlyBatches({ periodKey: '2026-08', actorUid: 'f1' })
    const batchId = batchSvc.buildBatchId('agent-1', '2026-08')
    await batchSvc.markBatchPaid(batchId, {
      actorUid: 'founder-1',
      paymentReference: 'EFT-ONCE',
      amountPaidCents: 20000,
    } as Record<string, unknown>)
    const again = await batchSvc.markBatchPaid(batchId, {
      actorUid: 'founder-1',
      paymentReference: 'EFT-ONCE',
      amountPaidCents: 20000,
    } as Record<string, unknown>)
    expect(again.alreadyPaid).toBe(true)
  })

  it('blocks legacy per-job mark paid when batched', async () => {
    seedPayout('ya-payout-req-b', {
      youthAgentUid: 'agent-1',
      eligibleAt: '2026-08-12T10:00:00.000Z',
    })
    await batchSvc.generateMonthlyBatches({ periodKey: '2026-08', actorUid: 'f1' })
    await expect(
      payoutSvc.markPayoutPaid('ya-payout-req-b', {
        actorUid: 'founder-1',
        paymentReference: 'X',
      })
    ).rejects.toThrow(/monthly batch/)
  })

  it('excludes held jobs from monthly batch generation', async () => {
    seedPayout('ya-payout-req-eligible', {
      youthAgentUid: 'agent-1',
      eligibleAt: '2026-08-05T10:00:00.000Z',
    })
    seedPayout('ya-payout-req-held', {
      youthAgentUid: 'agent-1',
      status: 'held',
      eligibilityStatus: 'held',
      eligibleAt: '2026-08-06T10:00:00.000Z',
    })
    const result = await batchSvc.generateMonthlyBatches({ periodKey: '2026-08', actorUid: 'f1' })
    expect(result.batches[0].batch.eligibleJobCount).toBe(1)
    expect(result.batches[0].batch.grossEarningsCents).toBe(20000)
  })
})
