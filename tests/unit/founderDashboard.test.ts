import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'
import {
  evaluateFounderAccess,
  isFounderDashboardV2Enabled,
  isFounderEmail,
} from '@/lib/founder/access'

const require = createRequire(import.meta.url)
const svc = require('../../backend/services/founderDashboardService')

const NOW = Date.parse('2026-08-19T10:00:00.000Z')

function paidRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    smeId: 'sme-1',
    smeCompany: 'Acme (Pty) Ltd',
    tenderTitle: 'Road maintenance',
    tenderNumber: 'T-100',
    paymentStatus: 'paid',
    paymentAmount: 24900,
    status: 'pending',
    briefingDate: '2026-09-01',
    paidAt: '2026-08-10T08:00:00.000Z',
    createdAt: '2026-08-10T07:00:00.000Z',
    ...overrides,
  }
}

describe('founder access', () => {
  it('denies anonymous callers', () => {
    expect(
      evaluateFounderAccess({
        enabled: true,
        authenticated: false,
        userType: 'admin',
        email: 'info@tenderbriefing.co.za',
      })
    ).toEqual({ ok: false, reason: 'unauthorized' })
  })

  it('denies authenticated non-admins', () => {
    expect(
      evaluateFounderAccess({
        enabled: true,
        authenticated: true,
        userType: 'sme',
        email: 'info@tenderbriefing.co.za',
      }).ok
    ).toBe(false)
  })

  it('denies admins off the allow-list without founderAccess', () => {
    expect(
      evaluateFounderAccess({
        enabled: true,
        authenticated: true,
        userType: 'admin',
        email: 'ops@example.com',
      })
    ).toEqual({ ok: false, reason: 'forbidden_not_founder' })
  })

  it('allows allow-listed founder admins', () => {
    expect(isFounderEmail('info@tenderbriefing.co.za')).toBe(true)
    expect(
      evaluateFounderAccess({
        enabled: true,
        authenticated: true,
        userType: 'admin',
        email: 'info@tenderbriefing.co.za',
      }).ok
    ).toBe(true)
  })

  it('does not treat HTML shell access as founder authorization', () => {
    expect(isFounderDashboardV2Enabled()).toBe(true)
    const decision = evaluateFounderAccess({
      enabled: true,
      authenticated: false,
    })
    expect(decision.ok).toBe(false)
    if (!decision.ok) expect(decision.reason).toBe('unauthorized')
  })
})

describe('founder dashboard metrics', () => {
  it('counts paid bookings from paymentStatus, not request creation', () => {
    const metrics = svc.computeOverviewMetrics({
      smeTotal: 12,
      agentTotal: 8,
      paidTotal: 2,
      completedTotal: 1,
      requests: [
        paidRequest(),
        paidRequest({
          id: 'req-2',
          paymentStatus: 'pending',
          paymentAmount: 24900,
          status: 'pending',
        }),
        paidRequest({
          id: 'req-3',
          paymentStatus: 'paid',
          paymentAmount: 24900,
          status: 'completed',
          briefingDate: '2026-07-01',
        }),
      ],
      period: 'all',
      nowMs: NOW,
    })
    expect(metrics.smes).toBe(12)
    expect(metrics.youthAgents).toBe(8)
    expect(metrics.paidBookings).toBe(2)
    expect(metrics.paidInPeriodCount).toBe(2)
  })

  it('sums stored payment amounts and does not invent bookings × R249', () => {
    const metrics = svc.computeOverviewMetrics({
      smeTotal: 1,
      agentTotal: 1,
      paidTotal: 2,
      completedTotal: 0,
      requests: [
        paidRequest({ id: 'a', paymentAmount: 24900 }),
        paidRequest({ id: 'b', paymentAmount: 24900, quotedFee: 24900 }),
        paidRequest({ id: 'c', paymentStatus: 'pending', paymentAmount: 24900 }),
      ],
      period: '30',
      nowMs: NOW,
    })
    expect(metrics.paidBookings).toBe(2)
    expect(metrics.revenueCents).toBe(49800)
    expect(metrics.revenueCents).not.toBe(3 * 24900)
  })

  it('omits paid rows with no stored amount from revenue', () => {
    const metrics = svc.computeOverviewMetrics({
      smeTotal: 0,
      agentTotal: 0,
      paidTotal: 1,
      completedTotal: 0,
      requests: [
        paidRequest({
          paymentAmount: null,
          quotedFee: null,
        }),
      ],
      period: 'all',
      nowMs: NOW,
    })
    expect(metrics.paidBookings).toBe(1)
    expect(metrics.revenueCents).toBe(0)
    expect(metrics.paidWithoutAmount).toBe(1)
  })

  it('counts upcoming as paid, not cancelled, with a future briefingDate', () => {
    const requests = [
      paidRequest({ id: 'future', briefingDate: '2026-09-01' }),
      paidRequest({ id: 'past', briefingDate: '2026-01-01', status: 'completed' }),
      paidRequest({ id: 'cancelled', briefingDate: '2026-09-01', status: 'cancelled' }),
      paidRequest({ id: 'unpaid', paymentStatus: 'pending', briefingDate: '2026-09-01' }),
      paidRequest({ id: 'no-date', briefingDate: null }),
    ]
    const metrics = svc.computeOverviewMetrics({
      smeTotal: 0,
      agentTotal: 0,
      paidTotal: 4,
      completedTotal: 1,
      requests,
      period: 'all',
      nowMs: NOW,
    })
    expect(metrics.upcomingBriefings).toBe(1)
    expect(svc.isUpcomingPaid(requests[0], NOW)).toBe(true)
    expect(svc.isUpcomingPaid(requests[1], NOW)).toBe(false)
  })

  it('counts completed from workflow status completed', () => {
    const metrics = svc.computeOverviewMetrics({
      smeTotal: 0,
      agentTotal: 0,
      paidTotal: 2,
      completedTotal: 7,
      requests: [
        paidRequest({ id: 'c1', status: 'completed', briefingDate: '2026-08-01' }),
        paidRequest({ id: 'c2', status: 'closed', briefingDate: '2026-08-01' }),
        paidRequest({ id: 'c3', status: 'assigned', briefingDate: '2026-08-01' }),
      ],
      period: 'all',
      nowMs: NOW,
    })
    expect(metrics.completedBriefings).toBe(7)
    expect(svc.isCompletedWorkflow({ status: 'completed' })).toBe(true)
    expect(svc.isCompletedWorkflow({ status: 'closed' })).toBe(false)
  })

  it('filters paid bookings to the selected period using paidAt', () => {
    const metrics = svc.computeOverviewMetrics({
      smeTotal: 0,
      agentTotal: 0,
      paidTotal: 3,
      completedTotal: 0,
      requests: [
        paidRequest({ id: 'recent', paidAt: '2026-08-15T00:00:00.000Z' }),
        paidRequest({ id: 'old', paidAt: '2026-01-01T00:00:00.000Z' }),
      ],
      period: '30',
      nowMs: NOW,
    })
    expect(metrics.paidBookings).toBe(1)
    expect(metrics.revenueCents).toBe(24900)
  })
})

describe('needs attention', () => {
  it('emits only actionable production exceptions', () => {
    const items = svc.buildNeedsAttention(
      [
        paidRequest({ id: 'awaiting', status: 'pending', assignedAgentId: null, agentId: null }),
        paidRequest({
          id: 'overdue',
          status: 'assigned',
          assignedAgentId: 'ya-1',
          reportSlaStatus: 'overdue',
        }),
        paidRequest({
          id: 'failed',
          paymentStatus: 'failed',
          status: 'pending',
          paymentFailureReason: 'ITN amount mismatch',
        }),
        paidRequest({
          id: 'no-proof',
          status: 'completed',
          assignedAgentId: 'ya-1',
        }),
      ],
      new Map()
    )
    const kinds = items.map((i: { kind: string }) => i.kind)
    expect(kinds).toContain('paid_awaiting_assignment')
    expect(kinds).toContain('report_overdue')
    expect(kinds).toContain('payment_reconciliation')
    expect(kinds).toContain('proof_outstanding')
    expect(items.every((i: { href: string }) => i.href.startsWith('/founder/briefings/'))).toBe(
      true
    )
  })

  it('does not flag completed briefings that already have proof', () => {
    const items = svc.buildNeedsAttention(
      [paidRequest({ id: 'ok', status: 'completed', assignedAgentId: 'ya-1' })],
      new Map([['ok', { attendanceProofUrl: 'https://example.com/proof.pdf' }]])
    )
    expect(items.filter((i: { kind: string }) => i.kind === 'proof_outstanding')).toHaveLength(0)
  })

  it('returns an empty list when nothing is actionable', () => {
    expect(svc.buildNeedsAttention([])).toEqual([])
    expect(svc.NEEDS_ATTENTION_EMPTY).toBe('Nothing requires your attention.')
  })
})

describe('directories and lifecycle', () => {
  it('paginates without returning the full collection', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ id: String(i) }))
    const page = svc.paginate(rows, 2, 10)
    expect(page.items).toHaveLength(10)
    expect(page.page).toBe(2)
    expect(page.total).toBe(40)
    expect(page.totalPages).toBe(4)
    expect(page.items[0].id).toBe('10')
  })

  it('returns an empty page for empty directories', () => {
    const page = svc.paginate([], 1, 25)
    expect(page.items).toEqual([])
    expect(page.total).toBe(0)
    expect(page.totalPages).toBe(1)
  })

  it('builds SME rows with paid bookings and spent from payment records', () => {
    const rows = svc.buildSmeRows({
      users: [
        {
          id: 'sme-1',
          displayName: 'Thandi',
          companyName: '',
          createdAt: '2026-04-01T00:00:00.000Z',
          province: 'Gauteng',
        },
      ],
      roleDocs: new Map([['sme-1', { companyName: 'Acme (Pty) Ltd', contactPerson: 'Thandi' }]]),
      requests: [
        paidRequest({ smeId: 'sme-1' }),
        paidRequest({ smeId: 'sme-1', id: 'req-2', paymentStatus: 'pending' }),
      ],
      summaries: new Map([['sme-1', { lastMeaningfulAt: '2026-08-18T00:00:00.000Z' }]]),
    })
    expect(rows[0].company).toBe('Acme (Pty) Ltd')
    expect(rows[0].contact).toBe('Thandi')
    expect(rows[0].province).toBe('Gauteng')
    expect(rows[0].bookings).toBe(1)
    expect(rows[0].totalSpentCents).toBe(24900)
    expect(rows[0].lastActive).toContain('2026-08-18')
  })

  it('builds Youth Agent rows and omits invented earnings when amount is missing', () => {
    const rows = svc.buildAgentRows({
      users: [
        {
          id: 'ya-1',
          displayName: 'Sipho',
          createdAt: '2026-03-01T00:00:00.000Z',
          province: 'KwaZulu-Natal',
        },
      ],
      roleDocs: new Map(),
      requests: [
        paidRequest({
          id: 'r1',
          assignedAgentId: 'ya-1',
          status: 'completed',
          paymentAmount: 24900,
        }),
        paidRequest({
          id: 'r2',
          assignedAgentId: 'ya-1',
          status: 'completed',
          paymentAmount: null,
          quotedFee: null,
        }),
      ],
      reports: [{ id: 'rep-1', agentId: 'ya-1', requestId: 'r1' }],
      payoutsByAgent: new Map([['ya-1', 20000]]),
    })
    expect(rows[0].agent).toBe('Sipho')
    expect(rows[0].briefings).toBe(2)
    expect(rows[0].completed).toBe(2)
    expect(rows[0].reports).toBe(1)
    expect(rows[0].earningsCents).toBe(20000)
  })

  it('presents lifecycle Paid → Agent Assigned → Attended → Report Delivered without replacing backend status', () => {
    expect(svc.presentationalLifecycle(paidRequest({ status: 'pending' })).label).toBe('Paid')
    expect(
      svc.presentationalLifecycle(
        paidRequest({ status: 'assigned', assignedAgentId: 'ya-1' })
      ).label
    ).toBe('Agent Assigned')
    expect(
      svc.presentationalLifecycle(
        paidRequest({ status: 'completed', assignedAgentId: 'ya-1' })
      ).label
    ).toBe('Attended')
    expect(
      svc.presentationalLifecycle(
        paidRequest({
          status: 'completed',
          assignedAgentId: 'ya-1',
          reportSubmittedAt: '2026-08-12T00:00:00.000Z',
        })
      ).label
    ).toBe('Report Delivered')
    expect(svc.presentationalLifecycle(paidRequest({ paymentStatus: 'pending' })).key).toBe(
      'unpaid'
    )
    const row = svc.buildBriefingRows([
      paidRequest({ status: 'assigned', assignedAgentId: 'ya-1', agentName: 'Sipho' }),
    ])[0]
    expect(row.status).toBe('assigned')
    expect(row.lifecycle).toBe('agent_assigned')
  })

  it('builds a subtle activity series over the selected period', () => {
    const series = svc.buildActivitySeries({
      smeRegs: ['2026-08-18T00:00:00.000Z'],
      yaRegs: ['2026-08-17T00:00:00.000Z'],
      paidAtList: ['2026-08-18T12:00:00.000Z'],
      period: '7',
      nowMs: NOW,
    })
    expect(series.length).toBe(8)
    const last = series[series.length - 1]
    expect(last.date).toBe('2026-08-19')
    const day18 = series.find((p: { date: string }) => p.date === '2026-08-18')
    expect(day18.smeRegistrations).toBe(1)
    expect(day18.paidBookings).toBe(1)
  })
})

describe('founder dashboard API surface', () => {
  it('keeps the dashboard route founder-authorized and bounded', () => {
    const { readFileSync } = require('node:fs')
    const { join } = require('node:path')
    const route = readFileSync(
      join(process.cwd(), 'app/api/founder/dashboard/route.ts'),
      'utf8'
    )
    expect(route).toMatch(/verifyFounderUser/)
    expect(route).toMatch(/founderDashboardService/)
    expect(route).not.toMatch(/getAllTenders/)
  })

  it('returns 403 for authenticated non-founders rather than collapsing them to 401', () => {
    const { readFileSync } = require('node:fs')
    const { join } = require('node:path')
    const src = readFileSync(join(process.cwd(), 'lib/founder/verifyFounder.ts'), 'utf8')
    expect(src).toContain("verifyApiUser(authorizationHeader)")
    expect(src).not.toContain("verifyApiUser(authorizationHeader, ['admin'])")
    expect(src).toContain("forbiddenResponse('Founder access required')")
    expect(src).toContain("unauthorizedResponse('Sign in required')")
  })

  it('ships empty, loading, and error copy in the V2 UI', () => {
    const { readFileSync } = require('node:fs')
    const { join } = require('node:path')
    const ui = readFileSync(join(process.cwd(), 'components/founder/v2/ui.tsx'), 'utf8')
    expect(ui).toContain('Nothing requires your attention.')
    expect(ui).toContain('Loading…')
    expect(ui).toContain('Could not load this view')
    expect(ui).toContain('No activity in this period.')
  })
})
