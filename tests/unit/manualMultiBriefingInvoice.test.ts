/**
 * Multi-briefing manual invoice certification — parent/child lines, one PayFast charge.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'
import {
  BRIEFING_PRICE_CENTS,
  resolveRequestChargeCents,
} from '@/lib/domain/briefingPricing'

const require = createRequire(import.meta.url)

function sampleBriefings(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    tenderNumber:
      i === 0
        ? 'NHLS RFQ 1922468'
        : i === 1
          ? 'LPT/QUT037/2026'
          : i === 2
            ? 'TNPA/2026/08/0002/114627/RFQ'
            : `RFQ-MULTI-${i + 1}`,
    tenderDescription:
      i === 0
        ? 'Renovations to Office of the CIO'
        : i === 1
          ? 'Supply and Installation of 10,000 Litre Tank'
          : `Multi-briefing line ${i + 1}`,
    procuringEntity: i === 0 ? 'NHLS' : i === 1 ? 'Limpopo Provincial Treasury' : '',
    briefingDate: `2026-10-${20 + (i % 9)}`,
    briefingTime: '10:00',
    briefingVenue: i === 0 ? 'NHLS Head Office' : '',
    notes: `Line note ${i + 1}`,
  }))
}

describe('manual multi-briefing invoices', () => {
  const requestsFile = path.join(
    __dirname,
    '../../backend/data/attendance-requests.json'
  )
  let backup: string | null = null
  let service: any
  let paymentService: any

  beforeEach(() => {
    process.env.STORAGE_ADAPTER = 'json'
    process.env.RATE_LIMIT_BACKEND = 'memory'
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
        k.includes('manualPaymentBookingService') ||
        k.includes('manualInvoicePdf') ||
        k.includes('payfastService') ||
        k.includes('briefingPricing') ||
        k.includes('auditLogService') ||
        k.includes('lifecycleEnforcement') ||
        k.includes('workflowAutomationService') ||
        k.includes('liveDispatchService')
    )
    for (const k of keys) delete require.cache[k]

    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = async () => {}
    const workflow = require('../../backend/services/workflowAutomationService')
    workflow.dispatchWorkflowEvent = async () => {}
    try {
      const liveDispatch = require('../../backend/services/liveDispatchService')
      liveDispatch.findBestAgentsForRequest = async () => []
      liveDispatch.notifyAgentsAfterPayment = async () => {}
    } catch {
      /* optional */
    }

    const payfastService = require('../../backend/services/integrations/payfastService')
    payfastService.createCheckoutPayload = vi.fn(
      ({ amountCents, mPaymentId, itemName, itemDescription }: any) => ({
        ok: true,
        skipped: false,
        formAction: 'https://www.payfast.co.za/eng/process',
        fields: {
          amount: (amountCents / 100).toFixed(2),
          m_payment_id: mPaymentId,
          item_name: itemName,
          item_description: itemDescription,
          signature: 'test',
        },
        sandbox: false,
      })
    )

    service = require('../../backend/services/payments/manualPaymentBookingService')
    paymentService = require('../../backend/services/payments/attendancePaymentService')
  })

  afterEach(() => {
    if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
    else if (fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, '[]\n', 'utf8')
  })

  it.each([
    [1, 75000, '750.00'],
    [2, 150000, '1500.00'],
    [4, 300000, '3000.00'],
    [10, 750000, '7500.00'],
  ])(
    '%i briefing(s) = %i cents / R%s PayFast amount',
    async (count, cents, amountField) => {
      const created = await service.createManualPaymentRequest(
        {
          companyName: 'Multi Briefing SME',
          contactPerson: 'Ops Lead',
          customerEmail: `multi${count}@example.test`,
          briefings: sampleBriefings(count as number),
          // Attack payloads — must be ignored
          paymentAmount: 1,
          total: 1,
          quantity: 99,
          unitPrice: 1,
        },
        { uid: 'admin-1', email: 'info@tenderbriefing.co.za' }
      )

      expect(created.request.briefingLines).toHaveLength(count as number)
      expect(created.request.briefingCount).toBe(count)
      expect(created.request.paymentAmount).toBe(cents)
      expect(created.request.briefingPriceCents).toBe(cents)
      expect(resolveRequestChargeCents(created.request)).toBe(cents)

      const checkout = await paymentService.createPayfastCheckoutForRequest(
        created.request,
        'https://www.tenderbriefing.co.za'
      )
      expect(checkout.ok).toBe(true)
      expect(checkout.fields.amount).toBe(amountField)
      expect(checkout.fields.m_payment_id).toBe(`TB-REQ-${created.request.id}`)
    }
  )

  it('four briefing lines create one invoice, one payment reference, independent records', async () => {
    const created = await service.createManualPaymentRequest(
      {
        companyName: 'ABC Construction (Pty) Ltd',
        customerEmail: 'buyer@abc.test',
        briefings: sampleBriefings(4),
      },
      { uid: 'admin-1' }
    )

    const saved = JSON.parse(fs.readFileSync(requestsFile, 'utf8'))
    const matching = saved.filter((r: any) => r.id === created.request.id)
    expect(matching).toHaveLength(1)
    expect(matching[0].briefingLines).toHaveLength(4)
    expect(new Set(matching[0].briefingLines.map((l: any) => l.tenderNumber)).size).toBe(4)
    expect(created.invoiceNumber).toMatch(/^TB-INV-/)
    expect(created.request.paymentToken).toBeTruthy()
    expect(created.request.paymentReference || `TB-REQ-${created.request.id}`).toContain(
      created.request.id
    )

    // Server rejects forged low total even if stored paymentAmount is tampered in memory
    const tampered = {
      ...created.request,
      paymentAmount: 75000,
      briefingPriceCents: 75000,
      quotedFee: 75000,
      briefingCount: 1,
      paymentStatus: 'pending',
    }
    expect(resolveRequestChargeCents(tampered)).toBe(300000)
  })

  it('legacy single-briefing flat fields still create one R750 order', async () => {
    const created = await service.createManualPaymentRequest(
      {
        companyName: 'Legacy SME',
        customerEmail: 'legacy@example.test',
        tenderReference: 'RFQ-LEGACY-1',
        tenderDescription: 'Single flat field briefing',
      },
      { uid: 'admin-1' }
    )
    expect(created.request.briefingLines).toHaveLength(1)
    expect(resolveRequestChargeCents(created.request)).toBe(BRIEFING_PRICE_CENTS)
  })

  it('ITN paid marks parent paid and authorizes lines without attended/completed', async () => {
    const created = await service.createManualPaymentRequest(
      {
        companyName: 'Paid Multi SME',
        customerEmail: 'paid-multi@example.test',
        briefings: sampleBriefings(4),
      },
      { uid: 'admin-1' }
    )

    const marked = await paymentService.markRequestPaid(created.request.id, {
      source: 'payfast_itn',
      pfPaymentId: 'pf-multi-test-001',
    })
    expect(marked.request.paymentStatus).toBe('paid')
    expect(marked.request.invoiceStatus).toBe('PAID')
    expect(marked.request.payfastPaymentId).toBe('pf-multi-test-001')
    expect(marked.request.briefingLines).toHaveLength(4)
    for (const line of marked.request.briefingLines) {
      expect(line.paymentAuthorized).toBe(true)
      expect(line.fulfilmentStatus).toBe('awaiting_assignment')
      expect(line.attended).toBe(false)
      expect(line.completed).toBe(false)
    }

    const dup = await paymentService.markRequestPaid(created.request.id, {
      source: 'payfast_itn',
      pfPaymentId: 'pf-multi-test-001',
    })
    // Idempotent ITN: already paid (or remains paid) with no attendance side effects
    expect(dup.request.paymentStatus).toBe('paid')
    expect(dup.request.payfastPaymentId).toBe('pf-multi-test-001')
    for (const line of dup.request.briefingLines || []) {
      expect(line.attended).not.toBe(true)
      expect(line.completed).not.toBe(true)
    }
  })

  it('renders multi-briefing invoice PDF', async () => {
    const { renderManualInvoicePdf } = require('../../backend/services/payments/manualInvoicePdf')
    const request = {
      id: 'req-multi-1',
      invoiceNumber: 'TB-INV-20261016-MULTI',
      createdAt: '2026-10-16T10:00:00.000Z',
      smeCompany: 'Multi-Briefing Certification SME',
      smeEmail: 'preview@example.test',
      briefingLines: sampleBriefings(4).map((l, i) => ({
        ...l,
        lineNumber: i + 1,
        unitPriceCents: 75000,
      })),
      briefingCount: 4,
      briefingPriceCents: 300000,
      paymentAmount: 300000,
      paymentStatus: 'pending',
      paymentToken: 'tok_multi_preview_abcdefghijklmnop',
    }
    expect(resolveRequestChargeCents(request)).toBe(300000)
    const pdf = await renderManualInvoicePdf(request)
    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.slice(0, 5).toString()).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(5000)
    // Compressed PDF bodies are not reliably searchable as latin1; charge + structure is the lock.
  })

  it('R75 certification path remains distinct from multi-briefing commercial totals', () => {
    const {
      LIVE_CERTIFICATION_AMOUNT_CENTS,
      LIVE_CERTIFICATION_PURPOSE,
      LIVE_CERTIFICATION_SOURCE,
    } = require('../../backend/constants/briefingPricing')
    expect(LIVE_CERTIFICATION_AMOUNT_CENTS).toBe(7500)
    expect(
      resolveRequestChargeCents({
        paymentStatus: 'pending',
        purpose: LIVE_CERTIFICATION_PURPOSE,
        source: LIVE_CERTIFICATION_SOURCE,
        singleUse: true,
        expectedAmountCents: 7500,
        certificationAmountCents: 7500,
        serverAuthorizedCertification: true,
        briefingLines: sampleBriefings(4),
      })
    ).toBe(7500)
  })
})
