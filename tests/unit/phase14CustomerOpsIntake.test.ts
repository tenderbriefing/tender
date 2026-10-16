/**
 * Phase 14 — customer booking → invoice → paid → ops intake glue.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'
import {
  BRIEFING_PRICE_CENTS,
  resolveRequestChargeCents,
} from '@/lib/domain/briefingPricing'
import {
  resolveCustomerBookingStatus,
  customerBookingStatusLabel,
} from '@/lib/domain/customerBookingStatus'

const require = createRequire(import.meta.url)

describe('Phase 14 customer booking status mapping', () => {
  it('maps payment and ops stages to customer-safe labels', () => {
    expect(resolveCustomerBookingStatus({ paymentStatus: 'pending' })).toBe(
      'payment_required'
    )
    expect(resolveCustomerBookingStatus({ paymentStatus: 'failed' })).toBe(
      'payment_failed'
    )
    expect(
      resolveCustomerBookingStatus({
        paymentStatus: 'paid',
        opsStage: 'assignment_required',
      })
    ).toBe('representative_arranging')
    expect(
      resolveCustomerBookingStatus({
        paymentStatus: 'paid',
        assignedAgentId: 'agent-1',
      })
    ).toBe('representative_confirmed')
    expect(
      resolveCustomerBookingStatus({
        paymentStatus: 'paid',
        opsStage: 'report_ready',
      })
    ).toBe('report_ready')
    expect(
      resolveCustomerBookingStatus({
        paymentStatus: 'paid',
        completedAt: '2026-10-16T00:00:00.000Z',
      })
    ).toBe('completed')
    expect(customerBookingStatusLabel('representative_arranging')).toMatch(
      /Representative being arranged/i
    )
    expect(customerBookingStatusLabel('payment_required')).not.toMatch(/assignment_required/)
  })
})

describe('Phase 14 invoice stamp + ops intake', () => {
  const requestsFile = path.join(
    __dirname,
    '../../backend/data/attendance-requests.json'
  )
  let backup: string | null = null
  let agentService: any
  let paymentService: any
  let opsService: any

  beforeEach(() => {
    process.env.STORAGE_ADAPTER = 'json'
    process.env.RATE_LIMIT_BACKEND = 'memory'
    process.env.PAYFAST_MERCHANT_ID = '10000100'
    delete process.env.ATTENDANCE_FEE_CENTS

    if (fs.existsSync(requestsFile)) {
      backup = fs.readFileSync(requestsFile, 'utf8')
    }
    fs.mkdirSync(path.dirname(requestsFile), { recursive: true })
    fs.writeFileSync(requestsFile, '[]\n', 'utf8')

    const keys = Object.keys(require.cache).filter(
      (k) =>
        k.includes('storageAdapter') ||
        k.includes('agentAssignmentService') ||
        k.includes('attendancePaymentService') ||
        k.includes('opsLifecycleService') ||
        k.includes('invoiceNumber') ||
        k.includes('payfastService') ||
        k.includes('briefingPricing') ||
        k.includes('auditLogService') ||
        k.includes('lifecycleEnforcement') ||
        k.includes('founderOpsNotificationService')
    )
    for (const k of keys) delete require.cache[k]

    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = async () => {}
    const liveDispatch = require('../../backend/services/liveDispatchService')
    liveDispatch.findBestAgentsForRequest = async () => []
    const workflow = require('../../backend/services/workflowAutomationService')
    workflow.dispatchWorkflowEvent = async () => {}
    const founderOps = require('../../backend/services/founderOpsNotificationService')
    founderOps.notifyAttendanceRequestCreatedSafe = async () => ({ notified: false })
    founderOps.notifyAttendanceRequestPaidSafe = async () => ({ notified: false })

    const payfastService = require('../../backend/services/integrations/payfastService')
    payfastService.createCheckoutPayload = vi.fn(({ amountCents }: { amountCents: number }) => ({
      ok: true,
      skipped: false,
      formAction: 'https://www.payfast.co.za/eng/process',
      fields: { amount: (amountCents / 100).toFixed(2) },
      sandbox: false,
    }))
    payfastService.verifyItnSignature = () => ({ ok: true })
    payfastService.validateItnWithPayfast = async () => ({ ok: true, raw: 'VALID' })

    agentService = require('../../backend/services/agentAssignmentService')
    paymentService = require('../../backend/services/payments/attendancePaymentService')
    opsService = require('../../backend/services/ops/opsLifecycleService')
  })

  afterEach(() => {
    if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
    else if (fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, '[]\n', 'utf8')
  })

  it('stamps a unique invoice once on catalogue create and refuses client price spoof', async () => {
    const { request } = await agentService.createRequest({
      tenderId: `t-p14-${Date.now()}`,
      tenderNumber: 'RFQ-P14-1',
      tenderTitle: 'Phase 14 intake tender',
      smeId: 'sme-p14-1',
      smeName: 'Phase Fourteen',
      smeCompany: 'Phase Fourteen (Pty) Ltd',
      smeEmail: 'p14@example.test',
      contactPerson: 'Thandi Nkosi',
      representedEntity: 'Phase Fourteen Bidding Arm',
      briefingDate: '2099-12-01',
      briefingTime: '10:00',
      briefingVenue: 'Civic Hall',
      notes: 'Gate access via north entrance',
      // spoof attempts — stripped / ignored
      paymentAmount: 100,
      briefingPriceCents: 100,
      quotedFee: 1,
    })

    expect(request.invoiceNumber).toMatch(/^TB-INV-/)
    expect(request.invoiceStatus).toBe('UNPAID')
    expect(request.briefingPriceCents).toBe(BRIEFING_PRICE_CENTS)
    expect(request.paymentAmount).toBe(BRIEFING_PRICE_CENTS)
    expect(resolveRequestChargeCents(request)).toBe(75000)
    expect(request.opsStage).toBe('payment_required')
    expect(request.contactPerson).toBe('Thandi Nkosi')
    expect(request.representedEntity).toBe('Phase Fourteen Bidding Arm')

    const firstInvoice = request.invoiceNumber
    const again = ensureIdempotentInvoice(request)
    expect(again.invoiceNumber).toBe(firstInvoice)
  })

  it('marks paid exactly once and surfaces on Ops Board paid_intake filter', async () => {
    const { request } = await agentService.createRequest({
      tenderId: `t-p14-paid-${Date.now()}`,
      tenderNumber: 'RFQ-P14-PAID',
      tenderTitle: 'Paid intake',
      smeId: 'sme-p14-2',
      smeName: 'Paid SME',
      smeCompany: 'Paid SME Co',
      smeEmail: 'paid@example.test',
      briefingDate: '2099-11-15',
      briefingTime: '09:00',
      briefingVenue: 'Hall A',
    })

    const first = await paymentService.markRequestPaid(request.id, {
      pfPaymentId: 'PF-P14-1',
      checkoutId: `TB-REQ-${request.id}`,
      source: 'payfast_itn',
    })
    expect(first.alreadyPaid).toBeFalsy()

    const dup = await paymentService.markRequestPaid(request.id, {
      pfPaymentId: 'PF-P14-1',
      checkoutId: `TB-REQ-${request.id}`,
      source: 'payfast_itn',
    })
    expect(dup.alreadyPaid).toBe(true)

    const paid = await agentService.getRequestById(request.id)
    expect(paid.paymentStatus).toBe('paid')
    expect(paid.opsStage).toBe('assignment_required')
    expect(paid.invoiceStatus).toBe('PAID')
    expect(paid.availableForAssignment).toBe(true)
    expect(paid.payfastPaymentId).toBe('PF-P14-1')
    expect(paid.invoiceNumber).toMatch(/^TB-INV-/)

    const board = await opsService.listOpsBoard({ filter: 'paid_intake' })
    expect(board.some((r: { id: string }) => r.id === request.id)).toBe(true)

    const unpaidBoard = await opsService.listOpsBoard({ filter: 'unpaid' })
    expect(unpaidBoard.some((r: { id: string }) => r.id === request.id)).toBe(false)
  })

  it('rejects client-spoofed amounts via resolveRequestChargeCents', async () => {
    const { request } = await agentService.createRequest({
      tenderId: `t-p14-mismatch-${Date.now()}`,
      tenderNumber: 'RFQ-P14-BAD',
      tenderTitle: 'Mismatch',
      smeId: 'sme-p14-3',
      smeName: 'Mismatch SME',
      smeCompany: 'Mismatch Co',
      smeEmail: 'bad@example.test',
      briefingDate: '2099-11-20',
      paymentAmount: 100,
      briefingPriceCents: 100,
    })
    expect(resolveRequestChargeCents(request)).toBe(75000)
    const board = await opsService.listOpsBoard({ filter: 'paid_intake' })
    expect(board.some((r: { id: string }) => r.id === request.id)).toBe(false)
    const unpaid = await opsService.listOpsBoard({ filter: 'unpaid' })
    expect(unpaid.some((r: { id: string }) => r.id === request.id)).toBe(true)
  })
})

function ensureIdempotentInvoice(request: { invoiceNumber?: string }) {
  const { ensureInvoiceOnRequest } = require('../../backend/services/payments/invoiceNumber')
  const first = ensureInvoiceOnRequest(request)
  const second = ensureInvoiceOnRequest(first.request)
  expect(second.minted).toBe(false)
  expect(second.request.invoiceNumber).toBe(first.request.invoiceNumber)
  return second.request
}

describe('Phase 14 founder paid email subject', () => {
  it('uses NEW PAID BRIEFING REQUEST subject', () => {
    const founderOps = require('../../backend/services/founderOpsNotificationService')
    const summary = founderOps.buildAttendanceSummary(
      {
        id: 'req-p14',
        smeName: 'Acme',
        smeCompany: 'Acme',
        tenderTitle: 'Supply',
        tenderNumber: 'RFQ-1',
        briefingDate: '2099-01-01',
        briefingTime: '10:00',
        briefingVenue: 'Hall',
        paymentStatus: 'paid',
        briefingPriceCents: 75000,
        paymentAmount: 75000,
        representedEntity: 'Acme BidCo',
      },
      'paid'
    )
    const tpl = founderOps.buildEmailTemplate(summary)
    expect(tpl.subject).toMatch(/NEW PAID BRIEFING REQUEST/i)
    expect(tpl.text).toMatch(/Operations:/)
    expect(tpl.html).toMatch(/Open Operations Board/)
    expect(tpl.text).not.toMatch(/payout/i)
  })
})
