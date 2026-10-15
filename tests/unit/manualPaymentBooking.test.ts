/**
 * Manual payment link + invoice V1 — no catalogue tender required.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'
import { BRIEFING_PRICE_CENTS } from '@/lib/domain/briefingPricing'

const require = createRequire(import.meta.url)

describe('manualPaymentBookingService', () => {
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
        k.includes('lifecycleEnforcement')
    )
    for (const k of keys) delete require.cache[k]

    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = async () => {}

    const payfastService = require('../../backend/services/integrations/payfastService')
    payfastService.createCheckoutPayload = vi.fn(
      ({ amountCents, mPaymentId, returnUrl, cancelUrl, itemName }: any) => ({
        ok: true,
        skipped: false,
        formAction: 'https://www.payfast.co.za/eng/process',
        fields: {
          amount: (amountCents / 100).toFixed(2),
          m_payment_id: mPaymentId,
          return_url: returnUrl,
          cancel_url: cancelUrl,
          item_name: itemName,
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

  it('creates a manual booking with secure token, invoice, and R750 lock', async () => {
    const result = await service.createManualPaymentRequest(
      {
        companyName: 'Acme Civils',
        customerEmail: 'buyer@acme.test',
        tenderReference: 'RFQ-EMAIL-99',
        tenderDescription: 'Supply of road markings',
        briefingDate: '2026-10-20',
        briefingTime: '09:00',
        briefingVenue: 'Municipal Hall',
        internalNotes: 'Came by email — not in catalogue',
      },
      { uid: 'admin-1', email: 'info@tenderbriefing.co.za' }
    )

    expect(result.request.source).toBe('manual_payment_link')
    expect(result.request.paymentToken).toMatch(/^[A-Za-z0-9_-]{30,}$/)
    expect(result.request.invoiceNumber).toMatch(/^TB-INV-/)
    expect(result.request.briefingPriceCents).toBe(BRIEFING_PRICE_CENTS)
    expect(result.request.paymentAmount).toBe(BRIEFING_PRICE_CENTS)
    expect(result.request.tenderId).toBeNull()
    expect(result.request.internalNotes).toContain('Came by email')
    expect(result.paymentUrl).toContain('/pay/')
    expect(result.paymentUrl).toContain(result.request.paymentToken)

    const saved = JSON.parse(fs.readFileSync(requestsFile, 'utf8'))
    expect(saved.some((r: any) => r.id === result.request.id)).toBe(true)

    const publicView = service.toPublicPaymentView(result.request)
    expect(publicView.amountCents).toBe(75000)
    expect(JSON.stringify(publicView)).not.toContain('Came by email')
    expect(JSON.stringify(publicView)).not.toContain('admin-1')
  })

  it('rejects incomplete admin create payloads', async () => {
    await expect(
      service.createManualPaymentRequest({
        companyName: 'Acme',
        customerEmail: 'bad',
        tenderReference: 'RFQ-1',
        tenderDescription: 'Desc',
      })
    ).rejects.toThrow(/valid customer email/i)
  })

  it('locks PayFast checkout at R750 with manual return URLs', async () => {
    const created = await service.createManualPaymentRequest(
      {
        companyName: 'Acme Civils',
        customerEmail: 'buyer@acme.test',
        tenderReference: 'RFQ-EMAIL-100',
        tenderDescription: 'Supply of cones',
      },
      { uid: 'admin-1' }
    )

    const checkout = await paymentService.createPayfastCheckoutForRequest(
      created.request,
      'https://www.tenderbriefing.co.za'
    )
    expect(checkout.ok).toBe(true)
    expect(checkout.fields.amount).toBe('750.00')
    expect(checkout.fields.m_payment_id).toBe(`TB-REQ-${created.request.id}`)
    expect(checkout.fields.return_url).toContain(
      `/pay/${created.request.paymentToken}/success`
    )
    expect(checkout.fields.cancel_url).toContain(
      `/pay/${created.request.paymentToken}/cancelled`
    )
    expect(checkout.fields.item_name).toBe('Tender Briefing Attendance Service')
  })

  it('renders invoice PDF without VAT inclusive wording', async () => {
    const { renderManualInvoicePdf } = require('../../backend/services/payments/manualInvoicePdf')
    const pdf = await renderManualInvoicePdf({
      id: 'req-test-1',
      invoiceNumber: 'TB-INV-20261015-ABC',
      createdAt: '2026-10-15T10:00:00.000Z',
      smeCompany: 'Acme Civils',
      smeEmail: 'buyer@acme.test',
      tenderNumber: 'RFQ-EMAIL-99',
      briefingPriceCents: 75000,
      paymentAmount: 75000,
      paymentStatus: 'pending',
      paymentToken: 'tok_test_secure_value_abcdefghijklmnop',
    })
    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.slice(0, 5).toString()).toBe('%PDF-')
    const asString = pdf.toString('latin1')
    expect(asString).not.toMatch(/VAT inclusive/i)
  })
})
