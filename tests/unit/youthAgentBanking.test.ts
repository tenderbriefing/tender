import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createRequire } from 'module'
import {
  maskAccountNumber,
  isBankingProfileComplete,
} from '../../lib/finance/youthAgentBankingTypes'

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
  const chain: Record<string, unknown> = {
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

function seedBanking(uid: string, overrides: Record<string, unknown> = {}) {
  store.set(`youthAgentBankingProfiles/${uid}`, {
    youthAgentUid: uid,
    accountHolderName: 'Jane Mokoena',
    bankName: 'FNB',
    accountNumber: '62123456789',
    accountType: 'cheque',
    branchCode: '250655',
    version: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    createdBy: uid,
    updatedBy: uid,
    ...overrides,
  })
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

describe('youthAgentBankingTypes', () => {
  it('masks account numbers', () => {
    expect(maskAccountNumber('62123456789')).toBe('******6789')
    expect(maskAccountNumber('12')).toBe('****12')
  })

  it('validates complete profiles', () => {
    expect(
      isBankingProfileComplete({
        accountHolderName: 'A',
        bankName: 'FNB',
        accountNumber: '12345678',
        accountType: 'cheque',
        branchCode: '250655',
      })
    ).toBe(true)
    expect(isBankingProfileComplete({ accountHolderName: 'A' })).toBe(false)
  })
})

describe('youthAgentBankingService', () => {
  let bankingSvc: typeof import('../../backend/services/finance/youthAgentBankingService.js')

  beforeEach(() => {
    vi.clearAllMocks()
    store.clear()
    const firebaseAdmin = require('../../backend/config/firebaseAdmin')
    vi.spyOn(firebaseAdmin, 'getFirestore').mockReturnValue(mockDb)
    const audit = require('../../backend/services/auditLogService')
    vi.spyOn(audit, 'logEvent').mockResolvedValue({})
    delete require.cache[require.resolve('../../backend/services/finance/youthAgentBankingService.js')]
    bankingSvc = require('../../backend/services/finance/youthAgentBankingService.js')
  })

  it('creates and updates banking profile with version increment', async () => {
    const created = await bankingSvc.upsertBankingProfile(
      'agent-1',
      {
        accountHolderName: 'Jane Mokoena',
        bankName: 'FNB',
        accountNumber: '62123456789',
        accountType: 'cheque',
        branchCode: '250655',
      },
      { actorUid: 'agent-1' }
    )
    expect(created.created).toBe(true)
    expect(created.profile.version).toBe(1)
    const pub = bankingSvc.toPublic(created.profile)
    expect(pub!.accountNumberMasked).toBe('******6789')
    expect((pub as Record<string, unknown>).accountNumber).toBeUndefined()

    const updated = await bankingSvc.upsertBankingProfile(
      'agent-1',
      {
        accountHolderName: 'Jane Mokoena',
        bankName: 'Standard Bank',
        accountNumber: '62123456789',
        accountType: 'savings',
        branchCode: '051001',
      },
      { actorUid: 'agent-1' }
    )
    expect(updated.created).toBe(false)
    expect(updated.profile.version).toBe(2)
    expect(updated.profile.bankName).toBe('Standard Bank')
    const history = Array.from(store.keys()).filter((k) =>
      k.startsWith('youthAgentBankingProfileHistory/')
    )
    expect(history.length).toBe(1)
  })

  it('keeps stored account number when update omits it', async () => {
    await bankingSvc.upsertBankingProfile(
      'agent-1',
      {
        accountHolderName: 'Jane Mokoena',
        bankName: 'FNB',
        accountNumber: '62123456789',
        accountType: 'cheque',
        branchCode: '250655',
      },
      { actorUid: 'agent-1' }
    )
    const updated = await bankingSvc.upsertBankingProfile(
      'agent-1',
      {
        accountHolderName: 'Jane Mokoena',
        bankName: 'Standard Bank',
        accountType: 'savings',
        branchCode: '051001',
      },
      { actorUid: 'agent-1' }
    )
    expect(updated.profile.version).toBe(2)
    expect(updated.profile.bankName).toBe('Standard Bank')
    expect(updated.profile.accountNumber).toBe('62123456789')
    expect(updated.accountNumberChanged).toBe(false)
    const pub = bankingSvc.toPublic(updated.profile)
    expect(pub!.accountNumberMasked).toBe('******6789')
    expect((pub as Record<string, unknown>).accountNumber).toBeUndefined()
  })

  it('rejects invalid account data', async () => {
    await expect(
      bankingSvc.upsertBankingProfile(
        'agent-1',
        {
          accountHolderName: 'Jane',
          bankName: 'FNB',
          accountNumber: 'abc',
          accountType: 'cheque',
          branchCode: '250655',
        },
        { actorUid: 'agent-1' }
      )
    ).rejects.toThrow(/accountNumber/)
  })

  it('rejects cross-agent updates', async () => {
    await expect(
      bankingSvc.upsertBankingProfile(
        'agent-1',
        {
          accountHolderName: 'Jane',
          bankName: 'FNB',
          accountNumber: '62123456789',
          accountType: 'cheque',
          branchCode: '250655',
        },
        { actorUid: 'agent-2' }
      )
    ).rejects.toThrow(/own banking/)
  })
})

describe('youthAgentPayoutBatchService with banking', () => {
  let batchSvc: typeof import('../../backend/services/finance/youthAgentPayoutBatchService.js')

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
  })

  it('snapshots banking details into monthly batch and keeps them after profile update', async () => {
    seedBanking('agent-1')
    for (let i = 1; i <= 5; i++) {
      seedPayout(`ya-payout-req-${i}`, {
        youthAgentUid: 'agent-1',
        requestId: `req-${i}`,
        eligibleAt: `2026-08-0${i}T10:00:00.000Z`,
      })
    }
    const result = await batchSvc.generateMonthlyBatches({
      periodKey: '2026-08',
      actorUid: 'founder-1',
    })
    const batch = result.batches[0].batch
    expect(batch.eligibleJobCount).toBe(5)
    expect(batch.grossEarningsCents).toBe(100000)
    expect(batch.bankingDetailsPresent).toBe(true)
    expect(batch.bankingSnapshot.bankName).toBe('FNB')
    expect(batch.bankingSnapshot.accountNumber).toBe('62123456789')
    expect(batch.bankingSnapshot.bankingProfileVersion).toBe(1)

    // Later profile update must not mutate the batch snapshot.
    store.set('youthAgentBankingProfiles/agent-1', {
      ...store.get('youthAgentBankingProfiles/agent-1'),
      bankName: 'Capitec',
      accountNumber: '99999999999',
      version: 2,
    })
    const batchId = batchSvc.buildBatchId('agent-1', '2026-08')
    const stored = store.get(`youthAgentPayoutBatches/${batchId}`)
    expect(stored?.bankingSnapshot).toMatchObject({
      bankName: 'FNB',
      accountNumber: '62123456789',
      bankingProfileVersion: 1,
    })
  })

  it('flags missing bank details but still creates batch', async () => {
    seedPayout('ya-payout-req-z', {
      youthAgentUid: 'agent-1',
      eligibleAt: '2026-08-10T10:00:00.000Z',
    })
    const result = await batchSvc.generateMonthlyBatches({
      periodKey: '2026-08',
      actorUid: 'f1',
    })
    expect(result.batches[0].batch.bankingDetailsPresent).toBe(false)
    expect(result.batches[0].batch.bankingSnapshot).toBeNull()
    expect(batchSvc.batchOperationalStatus(result.batches[0].batch)).toBe(
      'missing_bank_details'
    )
  })

  it('rejects Record EFT with wrong amount', async () => {
    seedBanking('agent-1')
    seedPayout('ya-payout-req-w', {
      youthAgentUid: 'agent-1',
      eligibleAt: '2026-08-10T10:00:00.000Z',
    })
    await batchSvc.generateMonthlyBatches({ periodKey: '2026-08', actorUid: 'f1' })
    const batchId = batchSvc.buildBatchId('agent-1', '2026-08')
    await expect(
      batchSvc.markBatchPaid(batchId, {
        actorUid: 'founder-1',
        paymentReference: 'EFT-BAD',
        amountPaidCents: 999,
      } as Record<string, unknown>)
    ).rejects.toThrow(/Amount mismatch/)
  })

  it('rejects Record EFT when bank details missing', async () => {
    seedPayout('ya-payout-req-m', {
      youthAgentUid: 'agent-1',
      eligibleAt: '2026-08-10T10:00:00.000Z',
    })
    await batchSvc.generateMonthlyBatches({ periodKey: '2026-08', actorUid: 'f1' })
    const batchId = batchSvc.buildBatchId('agent-1', '2026-08')
    await expect(
      batchSvc.markBatchPaid(batchId, {
        actorUid: 'founder-1',
        paymentReference: 'EFT-NOBANK',
        amountPaidCents: 20000,
      } as Record<string, unknown>)
    ).rejects.toThrow(/Bank details required/)
  })

  it('settles 5×R200 with banking snapshot and idempotent retry', async () => {
    seedBanking('agent-1')
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
      paymentDate: '2026-09-01',
    } as Record<string, unknown>)
    expect(paid.alreadyPaid).toBe(false)
    expect(paid.batch.status).toBe('paid')
    expect(paid.batch.paidAmountCents).toBe(100000)
    expect(paid.batch.bankingSnapshot.accountNumber).toBe('62123456789')
    for (let i = 1; i <= 5; i++) {
      expect(store.get(`youthAgentPayouts/ya-payout-req-${i}`)?.status).toBe('settled')
    }
    const again = await batchSvc.markBatchPaid(batchId, {
      actorUid: 'founder-1',
      paymentReference: 'EFT-2026-08-001',
      amountPaidCents: 100000,
    } as Record<string, unknown>)
    expect(again.alreadyPaid).toBe(true)
  })
})
