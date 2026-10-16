/**
 * Phase 11 — report production: draft → edit → approve → PDF/DOCX → REPORT READY.
 * Never emails. Never becomes ready without approval.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'

const require = createRequire(import.meta.url)

describe('reportProductionService', () => {
  const requestsFile = path.join(
    __dirname,
    '../../backend/data/attendance-requests.json'
  )
  let backup: string | null = null
  let ops: any
  let reports: any
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
        x.includes('reportProductionService') ||
        x.includes('reportDraftBuilder') ||
        x.includes('clientReportPdf') ||
        x.includes('clientReportDocx') ||
        x.includes('manualBriefingOps') ||
        x.includes('manualPaymentBookingService') ||
        x.includes('auditLogService') ||
        x.includes('briefingPricing')
    )) {
      delete require.cache[k]
    }

    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = async () => {}

    ops = require('../../backend/services/ops/opsLifecycleService')
    reports = require('../../backend/services/ops/reportProductionService')

    const manual = require('../../backend/services/payments/manualPaymentBookingService')
    const created = await manual.createManualPaymentRequest(
      {
        companyName: 'Report Cert SME',
        customerEmail: 'report-cert@example.test',
        contactPerson: 'Report Contact',
        representedEntity: 'Ingenuity Engineers & Constructors',
        briefings: [
          {
            tenderNumber: 'REP-RFQ-011',
            tenderDescription: 'Phase 11 report production briefing',
            briefingDate: '2099-02-01',
            briefingTime: '09:00',
            briefingVenue: 'Pretoria Test Venue',
            province: 'Gauteng',
            department: 'Test Procuring Entity',
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
    doc.department = 'Test Procuring Entity'
    doc.representedEntity = 'Ingenuity Engineers & Constructors'
    await storage.saveAttendanceRequest(doc)

    await ops.assignManualRepresentative(
      requestId,
      {
        representativeName: 'Field Rep',
        agentPayoutCents: 40000,
        internalNotes: 'INTERNAL_PAYOUT_NOTE_DO_NOT_LEAK',
      },
      { uid: 'admin-1' }
    )
    await ops.markAttended(requestId, { note: 'Briefing completed on site.' }, { uid: 'admin-1' })
    await ops.overrideEvidenceRequirement(
      requestId,
      { reason: 'phase11_unit_cert' },
      { uid: 'admin-1' }
    )
  })

  afterEach(() => {
    if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
    else if (fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, '[]\n', 'utf8')
  })

  it('generates draft → preserves edits → requires approval before ready → PDF/DOCX', async () => {
    const { request, report } = await reports.generateDraft(requestId, {
      uid: 'admin-1',
      email: 'info@tenderbriefing.co.za',
    })
    expect(report.approvalStatus).toBe('pending')
    expect(report.status).toBe('draft')
    expect(ops.deriveManualOpsStage(request)).toBe('report_in_progress')
    expect(JSON.stringify(report.draft)).not.toMatch(/INTERNAL_PAYOUT/)
    expect(JSON.stringify(report.draft)).not.toMatch(/40000/)
    expect(report.draft.voice).toBe('third_person')

    // Cannot stamp ready without approval
    await expect(ops.markReportReady(requestId, {}, { uid: 'admin-1' })).rejects.toThrow(
      /Approve Final Report/i
    )
    expect(ops.deriveManualOpsStage(await ops.getRequest(requestId))).toBe('report_in_progress')

    const edited = await reports.editReport(
      requestId,
      {
        sections: [
          {
            id: 'executive_brief',
            title: 'Executive Brief',
            paragraphs: ['Human-edited executive summary for certification.'],
          },
        ],
      },
      { uid: 'admin-1' }
    )
    expect(edited.report.draft.sections.find((s: any) => s.id === 'executive_brief').paragraphs[0]).toContain(
      'Human-edited'
    )
    expect(
      edited.report.draft.sections.find((s: any) => s.id === 'executive_brief').humanEdited
    ).toBe(true)

    await expect(
      reports.regenerateReportSection(requestId, 'executive_brief', { force: false }, { uid: 'admin-1' })
    ).rejects.toThrow(/human edits/i)

    const approved = await reports.approveFinalReport(requestId, {
      uid: 'admin-1',
      email: 'info@tenderbriefing.co.za',
    })
    expect(approved.emailSent).toBe(false)
    expect(approved.report.approvalStatus).toBe('approved')
    expect(approved.pdfBytes).toBeInstanceOf(Buffer)
    expect(approved.pdfBytes.length).toBeGreaterThan(500)
    expect(approved.docxBytes).toBeInstanceOf(Buffer)
    expect(approved.docxBytes.length).toBeGreaterThan(500)
    // PDF magic
    expect(approved.pdfBytes.slice(0, 4).toString()).toBe('%PDF')
    // DOCX is a zip
    expect(approved.docxBytes[0]).toBe(0x50)
    expect(approved.docxBytes[1]).toBe(0x4b)

    expect(ops.deriveManualOpsStage(approved.request)).toBe('report_ready')
    expect(approved.request.reportStatus).toBe('ready')

    // Version history retained
    const versions = await reports.listVersions(requestId)
    expect(versions.length).toBeGreaterThanOrEqual(1)
    expect(versions[0].version).toBe(1)
    expect(versions[0].approvedAt).toBeTruthy()

    // Human edit still in approved draft
    expect(
      approved.report.draft.sections.find((s: any) => s.id === 'executive_brief').paragraphs[0]
    ).toContain('Human-edited')

    // Manual delivery still manual / no email
    const delivered = await ops.markDelivered(
      requestId,
      { deliveryNote: 'Founder emailed offline' },
      { uid: 'admin-1' }
    )
    expect(delivered.emailSent).toBe(false)
  })

  it('versions do not destroy prior approved snapshot when regenerating draft', async () => {
    await reports.generateDraft(requestId, { uid: 'admin-1' })
    const first = await reports.approveFinalReport(requestId, { uid: 'admin-1' })
    expect(first.report.version).toBe(1)

    // New draft version after approval (immutable approved copy kept)
    const second = await reports.generateDraft(requestId, { uid: 'admin-1' })
    expect(second.report.version).toBe(2)
    expect(second.report.approvalStatus).toBe('pending')

    const versions = await reports.listVersions(requestId)
    expect(versions.find((v: any) => v.version === 1)?.approvalStatus).toBe('approved')
    expect(versions.find((v: any) => v.version === 2)?.approvalStatus).toBe('pending')
  })

  it('flags source conflicts on draft generation', async () => {
    const storage = require('../../backend/services/storageAdapter').getStorage()
    const doc = await ops.getRequest(requestId)
    doc.briefingTime = '11:00'
    doc.briefingLines = [
      {
        lineNumber: 1,
        briefingTime: '11:30',
        tenderNumber: doc.tenderNumber,
        tenderDescription: doc.tenderTitle,
      },
    ]
    await storage.saveAttendanceRequest(doc)

    const { report } = await reports.generateDraft(requestId, { uid: 'admin-1' })
    expect(report.draft.sourceConflicts.length).toBeGreaterThan(0)
    expect(report.draft.sourceConflicts[0].message).toMatch(/SOURCE CONFLICT/)
  })
})
