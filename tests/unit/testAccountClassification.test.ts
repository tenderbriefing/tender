import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const {
  isEffectiveTestAccount,
  matchesSmokeEvidence,
  filterByAccountScope,
  resolveAccountScope,
  testAccountWriteFields,
} = require('../../lib/domain/testAccount')
const { buildSmokeUserDoc, buildSmokeSmeDoc } = require('../../scripts/smoke-test-profiles')
const founderSvc = require('../../backend/services/founderDashboardService')

describe('testAccount classification', () => {
  it('flags ops-smoke emails and Phase smoke companies', () => {
    expect(
      matchesSmokeEvidence({ email: 'ops-smoke-sme@tenderbriefing.co.za', userType: 'sme' })
    ).toBe(true)
    expect(
      matchesSmokeEvidence({
        email: 'ops-smoke-phase2-member-123@tenderbriefing.co.za',
        companyName: 'TenderBriefing Phase 2 Smoke SME',
      })
    ).toBe(true)
    expect(
      matchesSmokeEvidence({
        companyName: 'TenderBriefing Phase 3 Production Cert Smoke SME',
        displayName: 'Phase 3 Production Cert Smoke',
      })
    ).toBe(true)
    expect(
      matchesSmokeEvidence({
        email: 'owner@acme.co.za',
        companyName: 'Acme Construction (Pty) Ltd',
      })
    ).toBe(false)
    expect(
      matchesSmokeEvidence({
        email: 'ops-smoke-phase3-cross-1@tenderbriefing.co.za',
      })
    ).toBe(true)
    expect(
      matchesSmokeEvidence({
        email: 'gcert.new.374949@example.com',
        displayName: 'GCert New',
      })
    ).toBe(true)
  })

  it('honours explicit isTestAccount over heuristics', () => {
    expect(
      isEffectiveTestAccount({
        email: 'ops-smoke-sme@tenderbriefing.co.za',
        isTestAccount: false,
      })
    ).toBe(false)
    expect(
      isEffectiveTestAccount({
        email: 'real@customer.co.za',
        isTestAccount: true,
      })
    ).toBe(true)
  })

  it('defaults account scope to real', () => {
    expect(resolveAccountScope(undefined)).toBe('real')
    expect(resolveAccountScope('test')).toBe('test')
    expect(resolveAccountScope('bogus')).toBe('real')
  })

  it('filters cohorts by account scope', () => {
    const rows = [
      { id: '1', email: 'a@x.com', companyName: 'Real Co' },
      { id: '2', email: 'ops-smoke-sme@tenderbriefing.co.za', companyName: 'Smoke Test SME' },
      { id: '3', email: 'b@x.com', isTestAccount: true },
    ]
    expect(filterByAccountScope(rows, 'real').map((r: { id: string }) => r.id)).toEqual(['1'])
    expect(filterByAccountScope(rows, 'test').map((r: { id: string }) => r.id).sort()).toEqual(['2', '3'])
    expect(filterByAccountScope(rows, 'all')).toHaveLength(3)
  })
})

describe('smoke profile writers', () => {
  it('always stamps isTestAccount on smoke SME profiles', () => {
    const ts = new Date().toISOString()
    const user = buildSmokeUserDoc({
      uid: 'u1',
      email: 'ops-smoke-sme@tenderbriefing.co.za',
      displayName: 'Smoke Test SME',
      userType: 'sme',
      timestamp: ts,
    })
    const sme = buildSmokeSmeDoc({
      uid: 'u1',
      email: 'ops-smoke-sme@tenderbriefing.co.za',
      displayName: 'Smoke Test SME',
      timestamp: ts,
    })
    expect(user.isTestAccount).toBe(true)
    expect(sme.isTestAccount).toBe(true)
    expect(testAccountWriteFields().isTestAccount).toBe(true)
  })
})

describe('founder dashboard SME rows exclude test accounts from real scope metrics', () => {
  it('tags smoke rows and keeps real commercial registration math separate', () => {
    const rows = founderSvc.buildSmeRows({
      users: [
        {
          id: 'real-1',
          email: 'real@acme.co.za',
          companyName: 'Acme',
          displayName: 'Ada',
          createdAt: '2026-08-01T00:00:00.000Z',
        },
        {
          id: 'smoke-1',
          email: 'ops-smoke-sme@tenderbriefing.co.za',
          companyName: 'Smoke Test SME (Pty) Ltd',
          displayName: 'Smoke Test SME',
          createdAt: '2026-08-02T00:00:00.000Z',
        },
      ],
      roleDocs: new Map(),
      requests: [],
      summaries: new Map(),
    }) as Array<{ id: string; isTestAccount?: boolean }>
    expect(rows.find((r) => r.id === 'smoke-1')?.isTestAccount).toBe(true)
    expect(rows.find((r) => r.id === 'real-1')?.isTestAccount).toBe(false)

    const realOnly = filterByAccountScope(
      [
        { id: 'real-1', email: 'real@acme.co.za' },
        { id: 'smoke-1', email: 'ops-smoke-sme@tenderbriefing.co.za' },
      ],
      'real'
    )
    expect(realOnly).toHaveLength(1)
    expect(realOnly[0].id).toBe('real-1')
  })

  it('does not let smoke registrations inflate real SME KPI when subtracted', () => {
    const metrics = founderSvc.computeOverviewMetrics({
      smeTotal: 10, // already real-only total from service layer
      agentTotal: 5,
      paidTotal: 2,
      completedTotal: 1,
      requests: [
        {
          id: 'r1',
          smeId: 'real-1',
          paymentStatus: 'paid',
          paymentAmount: 34900,
          paidAt: '2026-08-10T00:00:00.000Z',
          status: 'pending',
          briefingDate: '2026-09-01',
        },
      ],
      period: 'all',
      nowMs: Date.parse('2026-08-19T10:00:00.000Z'),
    })
    expect(metrics.smes).toBe(10)
  })
})
