/**
 * Service-layer workflow tests — JSON storage, no Firebase Admin / PayFast network.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'

const require = createRequire(import.meta.url)

describe('SME → Pay → Agent → Complete workflow', () => {
  const requestsFile = path.join(
    __dirname,
    '../../backend/data/attendance-requests.json'
  )
  let backup: string | null = null
  let agentService: any
  let paymentService: any

  beforeEach(() => {
    process.env.STORAGE_ADAPTER = 'json'
    process.env.RATE_LIMIT_BACKEND = 'memory'
    if (fs.existsSync(requestsFile)) {
      backup = fs.readFileSync(requestsFile, 'utf8')
    }
    fs.mkdirSync(path.dirname(requestsFile), { recursive: true })
    fs.writeFileSync(requestsFile, '[]\n', 'utf8')

    // Clear require cache for storage + services
    const keys = Object.keys(require.cache).filter(
      (k) =>
        k.includes('storageAdapter') ||
        k.includes('agentAssignmentService') ||
        k.includes('attendancePaymentService') ||
        k.includes('liveDispatchService') ||
        k.includes('lifecycleEnforcement')
    )
    for (const k of keys) delete require.cache[k]

    const liveDispatch = require('../../backend/services/liveDispatchService')
    liveDispatch.findBestAgentsForRequest = async () => []

    const workflow = require('../../backend/services/workflowAutomationService')
    workflow.dispatchWorkflowEvent = async () => {}
    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = async () => {}

    agentService = require('../../backend/services/agentAssignmentService')
    paymentService = require('../../backend/services/payments/attendancePaymentService')
  })

  afterEach(() => {
    if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
    else if (fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, '[]\n', 'utf8')
  })

  it('enforces payment before accept and completes assigned request', async () => {
    const { request } = await agentService.createRequest({
      tenderId: `t-${Date.now()}`,
      tenderNumber: 'TN-1',
      tenderTitle: 'Test',
      smeId: 'sme-a',
      smeName: 'SME A',
      province: 'Gauteng',
    })

    expect(request.paymentStatus).toBe('pending')
    expect(request.paymentAmount).toBe(34900)
    expect(request.briefingPriceCents).toBe(34900)

    await expect(
      agentService.acceptRequest(request.id, { id: 'agent-a', displayName: 'A' })
    ).rejects.toThrow(/paid/i)

    await paymentService.markRequestPaid(request.id, {
      pfPaymentId: 'PF-1',
      source: 'payfast_itn',
    })

    const again = await paymentService.markRequestPaid(request.id, {
      pfPaymentId: 'PF-1',
      source: 'payfast_itn',
    })
    expect(again.alreadyPaid).toBe(true)

    const assigned = await agentService.acceptRequest(request.id, {
      id: 'agent-a',
      displayName: 'Agent A',
    })
    expect(assigned.assignedAgentId).toBe('agent-a')
    expect(assigned.status).toBe('assigned')

    await expect(
      agentService.acceptRequest(request.id, { id: 'agent-b', displayName: 'B' })
    ).rejects.toThrow()

    await agentService.submitBriefingReport({
      requestId: request.id,
      agentId: 'agent-a',
      tenderId: request.tenderId,
      summary: 'Done',
      attendanceConfirmed: true,
    })

    const storage = require('../../backend/services/storageAdapter').getStorage()
    const all = await storage.getAttendanceRequests()
    const row = all.find((r: any) => r.id === request.id)
    expect(row.status).toBe('completed')
  })

  it('preserves persisted price snapshot on mark paid', async () => {
    const storage = require('../../backend/services/storageAdapter').getStorage()
    const legacyId = `legacy-${Date.now()}`
    // Generic historical snapshot (not current catalogue price) — must not be overwritten.
    const storedCents = 27500
    await storage.saveAttendanceRequest({
      id: legacyId,
      tenderId: 't-legacy',
      smeId: 'sme-a',
      status: 'pending',
      paymentStatus: 'pending',
      paymentAmount: storedCents,
      quotedFee: storedCents,
      briefingPriceCents: storedCents,
      pricingVersion: 'historical-snapshot',
      currency: 'ZAR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const paid = await paymentService.markRequestPaid(legacyId, { pfPaymentId: 'PF-legacy' })
    expect(paid.request.paymentAmount).toBe(storedCents)
    expect(paid.request.briefingPriceCents).toBe(storedCents)
  })

  it('rejects payment downgrade after paid', async () => {
    const { request } = await agentService.createRequest({
      tenderId: `t2-${Date.now()}`,
      smeId: 'sme-a',
    })
    await paymentService.markRequestPaid(request.id, { pfPaymentId: 'PF-2' })
    const afterFail = await paymentService.markRequestFailed(request.id, 'should not downgrade')
    expect(afterFail.paymentStatus).toBe('paid')
  })

  it('rejects unpaid auto-dispatch style assignment and allows paid accept', async () => {
    const { request } = await agentService.createRequest({
      tenderId: `t3-${Date.now()}`,
      smeId: 'sme-b',
      province: 'Western Cape',
    })
    await expect(
      agentService.assignRequestToAgent(request.id, { id: 'agent-x', displayName: 'X' }, { byAdmin: false })
    ).rejects.toThrow(/paid/i)

    await paymentService.markRequestPaid(request.id, { pfPaymentId: 'PF-3' })
    const assigned = await agentService.assignRequestToAgent(
      request.id,
      { id: 'agent-x', displayName: 'X' },
      { byAdmin: false }
    )
    expect(assigned.status).toBe('assigned')
    expect(assigned.lastTransitionRole).toBe('youth-agent')
  })

  it('resumes unpaid active request instead of creating a duplicate', async () => {
    const tenderId = `t-resume-${Date.now()}`
    const first = await agentService.createRequest({
      tenderId,
      smeId: 'sme-resume',
      tenderTitle: 'Resume me',
    })
    expect(first.resumed).toBeFalsy()
    expect(first.request.paymentStatus).toBe('pending')

    const second = await agentService.createRequest({
      tenderId,
      smeId: 'sme-resume',
      tenderTitle: 'Should not create another',
    })
    expect(second.resumed).toBe(true)
    expect(second.request.id).toBe(first.request.id)
    expect(second.request.paymentStatus).toBe('pending')

    const storage = require('../../backend/services/storageAdapter').getStorage()
    const all = await storage.getAttendanceRequests({ smeId: 'sme-resume' })
    expect(all.filter((r: any) => r.tenderId === tenderId)).toHaveLength(1)
  })

  it('throws ACTIVE_REQUEST_EXISTS when a paid booking already exists', async () => {
    const tenderId = `t-paid-${Date.now()}`
    const { request } = await agentService.createRequest({
      tenderId,
      smeId: 'sme-paid',
    })
    await paymentService.markRequestPaid(request.id, { pfPaymentId: 'PF-PAID' })

    try {
      await agentService.createRequest({ tenderId, smeId: 'sme-paid' })
      expect.unreachable('should have thrown')
    } catch (err: any) {
      expect(err.code).toBe('ACTIVE_REQUEST_EXISTS')
      expect(err.existingRequest?.id).toBe(request.id)
      expect(err.message).toMatch(/already exists/)
    }
  })
})
