import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const commandCenter = require('../../backend/services/commandCenterService')

const NOW = Date.parse('2026-08-18T12:00:00.000Z')

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    tenderNumber: 'GT-1',
    province: 'Gauteng',
    smeCompany: 'Acme',
    status: 'pending',
    paymentStatus: 'paid',
    paidAt: '2026-08-18T11:20:00.000Z',
    createdAt: '2026-08-18T10:00:00.000Z',
    notifiedAgents: ['a1'],
    quotedFee: 34900,
    ...overrides,
  }
}

describe('command center payload builder', () => {
  afterEach(() => {
    commandCenter.resetCommandCenterCacheForTests()
  })

  it('builds dispatch board, SLA heatmap, and KPIs from in-memory parts', () => {
    const payload = commandCenter.buildCommandCenterPayload({
      now: NOW,
      requests: [
        request(),
        request({
          id: 'req-2',
          province: 'Western Cape',
          paymentStatus: 'pending',
          status: 'pending',
          paidAt: null,
        }),
        request({
          id: 'req-3',
          paymentStatus: 'paid',
          status: 'completed',
          paidAt: '2026-08-18T09:00:00.000Z',
        }),
      ],
      agents: [
        {
          id: 'agent-gauteng',
          displayName: 'Thabo',
          province: 'Gauteng',
          latitude: -26.2,
          longitude: 28.04,
          reliabilityScore: 90,
          rating: 5,
        },
        {
          id: 'agent-wc',
          displayName: 'Aisha',
          province: 'Western Cape',
          reliabilityScore: 40,
        },
      ],
      waStats: { sent: 8, failed: 2, pending: 1, latest: [{ id: 'n1', status: 'sent', type: 'dispatch' }] },
      workflowTelemetry: { recent: [{ id: 'wf1', type: 'request_paid', status: 'done' }], failedQueue: [] },
    })

    expect(payload.dispatchBoard).toHaveLength(1)
    expect(payload.dispatchBoard[0].requestId).toBe('req-1')
    expect(payload.dispatchBoard[0].topAgents[0].agentId).toBe('agent-gauteng')
    expect(payload.pendingQueue).toHaveLength(1)
    expect(payload.pendingQueue[0].minutesWaiting).toBe(40)
    expect(payload.slaHeatmap.Gauteng.high).toBe(1)
    expect(payload.paymentPipeline).toEqual({ pending: 1, paid: 2, failed: 0, cancelled: 0 })
    expect(payload.executive.paidRequests).toBe(2)
    expect(payload.executive.pendingPaidRequests).toBe(1)
    expect(payload.executive.whatsappSuccessRate).toBe(80)
    expect(payload.whatsappSummary.sent).toBe(8)
    expect(payload.workflowTimeline).toHaveLength(1)
    expect(payload.activeAgentsMap).toHaveLength(1)
    expect(payload.aiOps).toBeNull()
    expect(payload.procurementIntelligence).toBeNull()
  })

  it('keeps the live loader off unbounded tender and dispatch fan-out', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(
      path.join(process.cwd(), 'backend/services/commandCenterService.js'),
      'utf8'
    )
    expect(src).not.toMatch("require('./procurementInsightsService')")
    expect(src).not.toMatch("require('./liveDispatchService')")
    expect(src).not.toMatch("require('./aiOpsExecutiveService')")
    expect(src).not.toMatch("require('./procurementIntelligenceService')")
    expect(src).not.toMatch("require('./executiveAnalyticsService')")
  })

  it('does not require tender scans or per-request dispatch matching inputs', () => {
    const payload = commandCenter.buildCommandCenterPayload({ requests: [], agents: [], now: NOW })
    expect(payload.dispatchBoard).toEqual([])
    expect(payload.slaHeatmap).toEqual({})
    expect(payload.agentTierCounts).toEqual({})
  })

  it('ranks agents without calling rankAllAgents', () => {
    const ranked = commandCenter.rankAgentsLight(
      [
        { id: 'a', displayName: 'A', reliabilityScore: 90, rating: 5 },
        { id: 'b', displayName: 'B', reliabilityScore: 20, rating: 1 },
      ],
      [
        { assignedAgentId: 'a', status: 'completed' },
        { assignedAgentId: 'a', status: 'completed' },
        { assignedAgentId: 'b', status: 'pending', briefingMissed: true },
      ]
    )
    expect(ranked[0].agentId).toBe('a')
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score)
    expect(['Platinum', 'Gold', 'Silver', 'At Risk']).toContain(ranked[0].tier)
  })
})
