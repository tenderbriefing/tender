/**
 * Phase 10 ops lifecycle service — assignment, evidence gates, deliver without email, close.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'

const require = createRequire(import.meta.url)

describe('opsLifecycleService', () => {
  const requestsFile = path.join(
    __dirname,
    '../../backend/data/attendance-requests.json'
  )
  let backup: string | null = null
  let ops: any
  let requestId = ''

  beforeEach(async () => {
    process.env.STORAGE_ADAPTER = 'json'
    process.env.RATE_LIMIT_BACKEND = 'memory'
    delete process.env.ATTENDANCE_FEE_CENTS

    if (fs.existsSync(requestsFile)) backup = fs.readFileSync(requestsFile, 'utf8')
    fs.mkdirSync(path.dirname(requestsFile), { recursive: true })
    fs.writeFileSync(requestsFile, '[]\n', 'utf8')

    for (const k of Object.keys(require.cache).filter(
      (x) =>
        x.includes('storageAdapter') ||
        x.includes('opsLifecycleService') ||
        x.includes('manualBriefingOps') ||
        x.includes('manualPaymentBookingService') ||
        x.includes('auditLogService') ||
        x.includes('agentAssignmentService') ||
        x.includes('briefingPricing')
    )) {
      delete require.cache[k]
    }

    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = async () => {}

    // Avoid Firebase Storage in unit tests — stub uploadEvidence path via mock after load
    ops = require('../../backend/services/ops/opsLifecycleService')

    const manual = require('../../backend/services/payments/manualPaymentBookingService')
    const created = await manual.createManualPaymentRequest(
      {
        companyName: 'Ops Cert SME',
        customerEmail: 'ops-cert@example.test',
        contactPerson: 'Ops Contact',
        briefings: [
          {
            tenderNumber: 'OPS-RFQ-001',
            tenderDescription: 'Lifecycle certification briefing',
            briefingDate: '2099-01-15',
            briefingTime: '10:00',
            briefingVenue: 'Centurion',
            province: 'Gauteng',
          },
        ],
      },
      { uid: 'admin-1', email: 'info@tenderbriefing.co.za' }
    )
    requestId = created.request.id
    // Simulate verified ITN payment without PayFast
    const storage = require('../../backend/services/storageAdapter').getStorage()
    const doc = await storage.getAttendanceRequests().then((all: any[]) =>
      all.find((r) => r.id === requestId)
    )
    doc.paymentStatus = 'paid'
    doc.paidAt = new Date().toISOString()
    doc.opsStage = 'assignment_required'
    doc.availableForAssignment = true
    await storage.saveAttendanceRequest(doc)
  })

  afterEach(() => {
    if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
    else if (fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, '[]\n', 'utf8')
  })

  it('assigns representative without YA account and keeps payout internal', async () => {
    const saved = await ops.assignManualRepresentative(
      requestId,
      {
        representativeName: 'Lindiwe Field Rep',
        representativePhone: '+27821234567',
        agentPayoutCents: 45000,
        internalNotes: 'Travel included',
      },
      { uid: 'admin-1', email: 'info@tenderbriefing.co.za' }
    )
    expect(saved.representativeName).toBe('Lindiwe Field Rep')
    expect(saved.agentPayoutCents).toBe(45000)
    expect(saved.manualRepresentative).toBe(true)
    expect(saved.agentId || null).toBeFalsy()
    expect(ops.deriveManualOpsStage(saved)).toBe('assigned')

    const row = ops.toOpsBoardRow(saved)
    expect(row.representativePayoutCents).toBe(45000)
    // Public payment view must not be built here — ensure board row is admin-shaped
    expect(row.nextAction).toMatch(/briefing|Assign|Monitor/i)
  })

  it('attendance → evidence_required → override → report → deliver (no email) → close', async () => {
    await ops.assignManualRepresentative(
      requestId,
      { representativeName: 'Rep One', agentPayoutCents: 40000 },
      { uid: 'admin-1' }
    )
    let doc = await ops.markAttended(requestId, { note: 'Present' }, { uid: 'admin-1' })
    expect(ops.deriveManualOpsStage(doc)).toBe('evidence_required')

    doc = await ops.overrideEvidenceRequirement(
      requestId,
      { reason: 'photo evidence arriving later' },
      { uid: 'admin-1' }
    )
    expect(ops.deriveManualOpsStage(doc)).toBe('evidence_received')

    doc = await ops.setReportInProgress(requestId, { uid: 'admin-1' })
    expect(ops.deriveManualOpsStage(doc)).toBe('report_in_progress')

    doc = await ops.markReportReady(requestId, {}, { uid: 'admin-1' })
    expect(ops.deriveManualOpsStage(doc)).toBe('report_ready')

    const delivered = await ops.markDelivered(
      requestId,
      { deliveryNote: 'Emailed from Founder Outlook' },
      { uid: 'admin-1', email: 'info@tenderbriefing.co.za' }
    )
    expect(delivered.emailSent).toBe(false)
    expect(ops.deriveManualOpsStage(delivered.request)).toBe('delivered')
    expect(delivered.request.closedAt).toBeFalsy()

    const closed = await ops.closeRequest(requestId, { note: 'Done' }, { uid: 'admin-1' })
    expect(ops.deriveManualOpsStage(closed)).toBe('closed')
    expect(closed.status).toBe('closed')
  })

  it('rejects mark_delivered before report_ready', async () => {
    await ops.assignManualRepresentative(
      requestId,
      { representativeName: 'Rep', agentPayoutCents: 40000 },
      { uid: 'admin-1' }
    )
    await expect(
      ops.markDelivered(requestId, {}, { uid: 'admin-1' })
    ).rejects.toThrow(/Report Ready/i)
  })

  it('rejects close before delivered', async () => {
    await ops.assignManualRepresentative(
      requestId,
      { representativeName: 'Rep', agentPayoutCents: 40000 },
      { uid: 'admin-1' }
    )
    await ops.markAttended(requestId, {}, { uid: 'admin-1' })
    await ops.overrideEvidenceRequirement(requestId, { reason: 'x' }, { uid: 'admin-1' })
    await ops.markReportReady(requestId, {}, { uid: 'admin-1' })
    await expect(ops.closeRequest(requestId, {}, { uid: 'admin-1' })).rejects.toThrow(
      /Delivered/i
    )
  })

  it('rejects invalid evidence file type/size helpers', () => {
    expect(ops.EVIDENCE_ALLOWED_TYPES.has('application/pdf')).toBe(true)
    expect(ops.EVIDENCE_ALLOWED_TYPES.has('application/x-msdownload')).toBe(false)
    expect(ops.EVIDENCE_MAX_BYTES).toBe(15 * 1024 * 1024)
  })

  it('R750 commercial price unchanged on ops path', () => {
    const { BRIEFING_PRICE_CENTS } = require('../../backend/constants/briefingPricing')
    expect(BRIEFING_PRICE_CENTS).toBe(75000)
  })
})
