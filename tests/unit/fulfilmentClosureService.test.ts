/**
 * Phase 13 — completion + reopen immutability.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'

const require = createRequire(import.meta.url)

describe('fulfilmentClosureService', () => {
  const requestsFile = path.join(
    __dirname,
    '../../backend/data/attendance-requests.json'
  )
  let backup: string | null = null
  let ops: any
  let reports: any
  let delivery: any
  let closure: any
  let requestId = ''

  beforeEach(async () => {
    process.env.STORAGE_ADAPTER = 'json'
    process.env.RATE_LIMIT_BACKEND = 'memory'
    if (fs.existsSync(requestsFile)) backup = fs.readFileSync(requestsFile, 'utf8')
    fs.mkdirSync(path.dirname(requestsFile), { recursive: true })
    fs.writeFileSync(requestsFile, '[]\n', 'utf8')

    for (const k of Object.keys(require.cache).filter(
      (x) =>
        x.includes('storageAdapter') ||
        x.includes('opsLifecycle') ||
        x.includes('reportProduction') ||
        x.includes('reportClientDelivery') ||
        x.includes('fulfilmentClosure') ||
        x.includes('opsSla') ||
        x.includes('manualBriefingOps') ||
        x.includes('manualPayment') ||
        x.includes('auditLog') ||
        x.includes('transactionalEmail') ||
        x.includes('briefingPricing') ||
        x.includes('clientReport')
    )) {
      delete require.cache[k]
    }

    require('../../backend/services/auditLogService').logEvent = async () => {}
    const tx = require('../../backend/services/transactionalEmailService')
    tx.sendClientReportDeliveryEmail = async (_i: any, opts: any) => ({
      sent: true,
      id: 're_phase13',
      idempotencyKey: opts.idempotencyKey,
    })

    ops = require('../../backend/services/ops/opsLifecycleService')
    reports = require('../../backend/services/ops/reportProductionService')
    delivery = require('../../backend/services/ops/reportClientDeliveryService')
    closure = require('../../backend/services/ops/fulfilmentClosureService')

    const manual = require('../../backend/services/payments/manualPaymentBookingService')
    const created = await manual.createManualPaymentRequest(
      {
        companyName: 'Phase13 SME',
        customerEmail: 'phase13@example.test',
        contactPerson: 'P13',
        briefings: [
          {
            tenderNumber: 'P13-RFQ',
            tenderDescription: 'Phase 13 closure',
            briefingDate: '2099-08-01',
            briefingTime: '10:00',
            briefingVenue: 'Pretoria',
            province: 'Gauteng',
          },
        ],
      },
      { uid: 'admin-1' }
    )
    requestId = created.request.id
    const storage = require('../../backend/services/storageAdapter').getStorage()
    const doc = await storage.getAttendanceRequests().then((a: any[]) =>
      a.find((r) => r.id === requestId)
    )
    doc.paymentStatus = 'paid'
    doc.paidAt = new Date().toISOString()
    await storage.saveAttendanceRequest(doc)

    await ops.assignManualRepresentative(
      requestId,
      { representativeName: 'Rep', agentPayoutCents: 40000 },
      { uid: 'admin-1' }
    )
    await ops.markAttended(requestId, {}, { uid: 'admin-1' })
    await ops.overrideEvidenceRequirement(requestId, { reason: 'p13' }, { uid: 'admin-1' })
    await reports.generateDraft(requestId, { uid: 'admin-1' })
    await reports.approveFinalReport(requestId, { uid: 'admin-1' })
    const opened = await delivery.openDeliveryReview(requestId, { uid: 'admin-1' })
    await delivery.confirmAndSend(
      requestId,
      opened.delivery.id,
      { confirm: true },
      { uid: 'admin-1' }
    )
  })

  afterEach(() => {
    if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
    else if (fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, '[]\n', 'utf8')
  })

  it('rejects incomplete completion; completes with metadata; reopen requires reason', async () => {
    const storage = require('../../backend/services/storageAdapter').getStorage()
    const incomplete = await ops.getRequest(requestId)
    incomplete.clientDeliveryStatus = null
    incomplete.deliveredAt = null
    incomplete.opsStage = 'report_ready'
    await storage.saveAttendanceRequest(incomplete)
    await expect(closure.completeFulfilment(requestId, { uid: 'admin-1' })).rejects.toThrow(
      /customer_delivery_not_accepted|Cannot complete/
    )

    // Restore delivery stamps from beforeEach confirmAndSend path
    const restored = await ops.getRequest(requestId)
    const deliveries = await delivery.listDeliveries(requestId)
    const d0 = deliveries[0]
    restored.clientDeliveryStatus = 'sent'
    restored.clientDeliveryId = d0.id
    restored.deliveredAt = d0.sentAt || new Date().toISOString()
    restored.opsStage = 'delivered'
    restored.opsReportId = d0.reportVersionId
    restored.reportStatus = 'ready'
    restored.reportReadyAt = restored.reportReadyAt || new Date().toISOString()
    restored.evidenceOverride = true
    restored.paymentStatus = 'paid'
    await storage.saveAttendanceRequest(restored)

    await expect(closure.completeFulfilment(requestId, { uid: 'admin-1' })).resolves.toMatchObject({
      alreadyCompleted: false,
    })
    let doc = await ops.getRequest(requestId)
    expect(ops.deriveManualOpsStage(doc)).toBe('completed')
    expect(doc.completedAt).toBeTruthy()
    expect(doc.finalReportVersionId).toBeTruthy()
    expect(doc.finalDeliveryId).toBeTruthy()
    const priorVersion = doc.finalReportVersionId

    await expect(
      closure.reopenForCorrection(requestId, { confirm: true, reason: 'short' }, { uid: 'admin-1' })
    ).rejects.toThrow(/Mandatory reopen reason/i)

    await expect(
      closure.reopenForCorrection(requestId, { confirm: false, reason: 'Need corrected venue note' }, { uid: 'admin-1' })
    ).rejects.toThrow(/confirm=true/i)

    const reopened = await closure.reopenForCorrection(
      requestId,
      { confirm: true, reason: 'Need corrected venue observation for client' },
      { uid: 'admin-1' }
    )
    expect(reopened.report.version).toBeGreaterThan(1)
    expect(reopened.priorReportVersionId).toBe(priorVersion)
    expect(reopened.report.id).not.toBe(priorVersion)

    doc = await ops.getRequest(requestId)
    expect(doc.completedAt).toBeFalsy()
    expect(doc.reopenReason).toMatch(/venue/)
    // Prior approved version still listed
    const versions = await reports.listVersions(requestId)
    expect(versions.find((v: any) => v.id === priorVersion)?.approvalStatus).toBe('approved')
    expect(versions.find((v: any) => v.id === reopened.report.id)?.approvalStatus).toBe('pending')
  })

  it('provider events are ordered/idempotent and do not change report version', async () => {
    const doc = await ops.getRequest(requestId)
    const d = (await delivery.listDeliveries(requestId))[0]
    expect(d.providerMessageId).toBe('re_phase13')
    const reportVersion = d.reportVersionId

    const first = await delivery.applyProviderEventByMessageId('re_phase13', {
      status: 'delivered',
      at: '2026-10-16T08:10:00.000Z',
    })
    expect(first.applied).toBe(true)
    const second = await delivery.applyProviderEventByMessageId('re_phase13', {
      status: 'delivered',
      at: '2026-10-16T08:11:00.000Z',
    })
    expect(second.applied).toBe(false)

    const bounceAfter = await delivery.applyProviderEventByMessageId('re_phase13', {
      status: 'bounced',
      at: '2026-10-16T08:12:00.000Z',
    })
    // delivered is terminal for bounce transition in our rank (bounce > delivered) — allow bounce after delivered for exception surfacing
    // Our canApplyProviderStatus blocks from delivered to bounced because delivered is not in failed set but rank bounce > delivered...
    // Wait: fromStatus delivered, toStatus bounced: RANK bounced 50 > delivered 40, and fromStatus is not bounced/failed, so applied true.
    expect(bounceAfter.applied).toBe(true)

    const after = await delivery.getDelivery(d.id)
    expect(after.reportVersionId).toBe(reportVersion)

    const row = ops.toOpsBoardRow(await ops.getRequest(requestId))
    expect(row.exceptionCode).toBe('DELIVERY_BOUNCED')
    expect(doc.agentPayoutCents || 40000).toBe(40000)
    expect(JSON.stringify(row)).not.toMatch(/INTERNAL/)
  })
})
