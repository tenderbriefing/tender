/**
 * Phase 12 — client report delivery: gates, idempotency, attachments, privacy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'

const require = createRequire(import.meta.url)

describe('reportClientDeliveryService', () => {
  const requestsFile = path.join(
    __dirname,
    '../../backend/data/attendance-requests.json'
  )
  let backup: string | null = null
  let ops: any
  let reports: any
  let delivery: any
  let requestId = ''
  let sentCalls: any[] = []

  beforeEach(async () => {
    process.env.STORAGE_ADAPTER = 'json'
    process.env.RATE_LIMIT_BACKEND = 'memory'
    delete process.env.ATTENDANCE_FEE_CENTS
    sentCalls = []

    if (fs.existsSync(requestsFile)) backup = fs.readFileSync(requestsFile, 'utf8')
    fs.mkdirSync(path.dirname(requestsFile), { recursive: true })
    fs.writeFileSync(requestsFile, '[]\n', 'utf8')

    for (const k of Object.keys(require.cache).filter(
      (x) =>
        x.includes('storageAdapter') ||
        x.includes('opsLifecycleService') ||
        x.includes('reportProductionService') ||
        x.includes('reportClientDeliveryService') ||
        x.includes('reportDraftBuilder') ||
        x.includes('clientReport') ||
        x.includes('manualBriefingOps') ||
        x.includes('manualPaymentBookingService') ||
        x.includes('auditLogService') ||
        x.includes('transactionalEmailService') ||
        x.includes('briefingPricing') ||
        x.includes('clientReportDelivery')
    )) {
      delete require.cache[k]
    }

    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = async () => {}

    const tx = require('../../backend/services/transactionalEmailService')
    tx.sendClientReportDeliveryEmail = async (input: any, opts: any) => {
      sentCalls.push({ input, opts })
      return {
        sent: true,
        id: `re_test_${sentCalls.length}`,
        idempotencyKey: opts.idempotencyKey,
      }
    }

    ops = require('../../backend/services/ops/opsLifecycleService')
    reports = require('../../backend/services/ops/reportProductionService')
    delivery = require('../../backend/services/ops/reportClientDeliveryService')

    const manual = require('../../backend/services/payments/manualPaymentBookingService')
    const created = await manual.createManualPaymentRequest(
      {
        companyName: 'Delivery Cert SME',
        customerEmail: 'delivery-cert@example.test',
        contactPerson: 'Delivery Contact',
        representedEntity: 'Delivery Cert SME',
        briefings: [
          {
            tenderNumber: 'DEL-RFQ-012',
            tenderDescription: 'Phase 12 delivery certification',
            briefingDate: '2099-03-01',
            briefingTime: '10:00',
            briefingVenue: 'Pretoria',
            province: 'Gauteng',
          },
        ],
      },
      { uid: 'admin-1', email: 'info@tenderbriefing.co.za' }
    )
    requestId = created.request.id
    const storage = require('../../backend/services/storageAdapter').getStorage()
    const doc = await storage.getAttendanceRequests().then((all: any[]) =>
      all.find((r) => r.id === requestId)
    )
    doc.paymentStatus = 'paid'
    doc.paidAt = new Date().toISOString()
    doc.opsStage = 'assignment_required'
    doc.agentPayoutCents = 40000
    doc.representativeInternalNotes = 'SECRET_PAYOUT_NOTE'
    await storage.saveAttendanceRequest(doc)

    await ops.assignManualRepresentative(
      requestId,
      { representativeName: 'Rep', agentPayoutCents: 40000, internalNotes: 'SECRET_PAYOUT_NOTE' },
      { uid: 'admin-1' }
    )
    await ops.markAttended(requestId, { note: 'Present' }, { uid: 'admin-1' })
    await ops.overrideEvidenceRequirement(requestId, { reason: 'phase12' }, { uid: 'admin-1' })
  })

  afterEach(() => {
    if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
    else if (fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, '[]\n', 'utf8')
  })

  async function approveReport() {
    await reports.generateDraft(requestId, { uid: 'admin-1' })
    await reports.editReport(
      requestId,
      {
        sections: [
          {
            id: 'executive_brief',
            title: 'Executive Brief',
            paragraphs: ['PHASE12_HUMAN_EDIT persisted content.'],
          },
        ],
      },
      { uid: 'admin-1' }
    )
    return reports.approveFinalReport(requestId, { uid: 'admin-1' })
  }

  it('cannot open delivery before report_ready', async () => {
    await expect(delivery.openDeliveryReview(requestId, { uid: 'admin-1' })).rejects.toThrow(
      /Cannot open delivery review/
    )
  })

  it('cannot send unapproved / requires confirm / PDF default / exact version / idempotent', async () => {
    await reports.generateDraft(requestId, { uid: 'admin-1' })
    await expect(delivery.openDeliveryReview(requestId, { uid: 'admin-1' })).rejects.toThrow(
      /unapproved|report_ready|Cannot open/i
    )

    const approved = await approveReport()
    expect(ops.deriveManualOpsStage(approved.request)).toBe('report_ready')
    expect(approved.emailSent).toBe(false)

    const opened = await delivery.openDeliveryReview(requestId, { uid: 'admin-1' })
    expect(opened.delivery.status).toBe('delivery_review')
    expect(opened.delivery.attachPdf).toBe(true)
    expect(opened.delivery.attachDocx).toBe(false)
    expect(opened.delivery.to).toEqual(['delivery-cert@example.test'])
    expect(opened.delivery.reportVersionId).toBe(approved.report.id)
    expect(JSON.stringify(opened.delivery)).not.toMatch(/SECRET_PAYOUT|40000|agentPayout/)

    await expect(
      delivery.confirmAndSend(requestId, opened.delivery.id, { confirm: false }, { uid: 'admin-1' })
    ).rejects.toThrow(/confirm=true/i)

    await delivery.updateDeliveryDraft(
      requestId,
      opened.delivery.id,
      {
        subject: 'Custom subject — DEL-RFQ-012',
        body: 'Custom body for certification.\n\nKind regards,\nTenderBriefing',
        attachDocx: true,
      },
      { uid: 'admin-1' }
    )

    const first = await delivery.confirmAndSend(
      requestId,
      opened.delivery.id,
      { confirm: true },
      { uid: 'admin-1' }
    )
    expect(first.emailSent).toBe(true)
    expect(first.providerMessageId).toMatch(/^re_test_/)
    expect(first.delivery.status).toBe('sent')
    expect(ops.deriveManualOpsStage(first.request)).toBe('delivered')
    expect(sentCalls).toHaveLength(1)
    expect(sentCalls[0].opts.attachments.length).toBe(2)
    expect(sentCalls[0].opts.attachments[0].filename).toMatch(/\.pdf$/i)
    expect(first.delivery.attachments.every((a: any) => a.sha256 && a.fileName)).toBe(true)
    expect(sentCalls[0].input.subject).toContain('Custom subject')
    expect(JSON.stringify(sentCalls[0])).not.toMatch(/SECRET_PAYOUT|agentPayoutCents/)

    // Human edit still on approved artifact version (not regenerated)
    const { report } = await reports.getActiveReport(requestId)
    expect(
      report.draft.sections.find((s: any) => s.id === 'executive_brief').paragraphs[0]
    ).toContain('PHASE12_HUMAN_EDIT')

    // Duplicate confirm does not re-send
    const dup = await delivery.confirmAndSend(
      requestId,
      opened.delivery.id,
      { confirm: true },
      { uid: 'admin-1' }
    )
    expect(dup.duplicate).toBe(true)
    expect(dup.emailSent).toBe(false)
    expect(sentCalls).toHaveLength(1)

    // Explicit resend creates new attempt
    const resend = await delivery.resendReport(requestId, { uid: 'admin-1' })
    expect(resend.delivery.id).not.toBe(opened.delivery.id)
    expect(resend.delivery.resendOfDeliveryId).toBe(opened.delivery.id)
    expect(resend.delivery.status).toBe('delivery_review')
  })

  it('failure does not mark delivered; bounce stays undelivered-inbox', async () => {
    await approveReport()
    const opened = await delivery.openDeliveryReview(requestId, { uid: 'admin-1' })

    const tx = require('../../backend/services/transactionalEmailService')
    tx.sendClientReportDeliveryEmail = async () => ({
      sent: false,
      error: 'simulated_provider_failure',
    })

    const failed = await delivery.confirmAndSend(
      requestId,
      opened.delivery.id,
      { confirm: true },
      { uid: 'admin-1' }
    )
    expect(failed.emailSent).toBe(false)
    expect(failed.delivery.status).toBe('failed')
    expect(ops.deriveManualOpsStage(failed.request)).toBe('report_ready')

    // Restore mock success for retry
    tx.sendClientReportDeliveryEmail = async (_i: any, opts: any) => {
      sentCalls.push({ opts })
      return { sent: true, id: 're_retry', idempotencyKey: opts.idempotencyKey }
    }
    const retried = await delivery.retryDelivery(
      requestId,
      opened.delivery.id,
      {},
      { uid: 'admin-1' }
    )
    expect(retried.emailSent).toBe(true)
    expect(retried.delivery.status).toBe('sent')

    const bounced = await delivery.recordProviderBounce(retried.delivery.id, {
      reason: 'mailbox_full',
    })
    expect(bounced.status).toBe('bounced')
    const req = await ops.getRequest(requestId)
    expect(req.clientDeliveryStatus).toBe('bounced')
  })

  it('rejects invalid recipient', async () => {
    await approveReport()
    const opened = await delivery.openDeliveryReview(requestId, { uid: 'admin-1' })
    await expect(
      delivery.updateDeliveryDraft(
        requestId,
        opened.delivery.id,
        { to: 'not-an-email' },
        { uid: 'admin-1' }
      )
    ).rejects.toThrow(/Invalid recipient/i)
  })

  it('R750 commercial price unchanged', () => {
    const { BRIEFING_PRICE_CENTS } = require('../../backend/constants/briefingPricing')
    expect(BRIEFING_PRICE_CENTS).toBe(75000)
  })
})
