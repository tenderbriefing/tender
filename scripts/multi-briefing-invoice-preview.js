#!/usr/bin/env node
/**
 * Controlled multi-briefing invoice preview (NO payment, NO email send).
 *
 * Customer: Multi-Briefing Certification SME
 * 4 briefing lines → expect TOTAL = 300000 cents / R3,000.00
 *
 * Writes:
 *   tmp-multi-briefing-cert-preview.json
 *   tmp-multi-briefing-cert-preview.pdf
 */
const fs = require('fs')
const path = require('path')

process.env.STORAGE_ADAPTER = 'json'
process.env.RATE_LIMIT_BACKEND = 'memory'
delete process.env.ATTENDANCE_FEE_CENTS

const root = path.join(__dirname, '..')
const requestsFile = path.join(root, 'backend/data/attendance-requests.json')
const outJson = path.join(root, 'tmp-multi-briefing-cert-preview.json')
const outPdf = path.join(root, 'tmp-multi-briefing-cert-preview.pdf')

let backup = null
if (fs.existsSync(requestsFile)) {
  backup = fs.readFileSync(requestsFile, 'utf8')
}
fs.mkdirSync(path.dirname(requestsFile), { recursive: true })
fs.writeFileSync(requestsFile, '[]\n', 'utf8')

const checks = []
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail || null })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const audit = require('../backend/services/auditLogService')
  audit.logEvent = async () => {}

  const payfastService = require('../backend/services/integrations/payfastService')
  const origCheckout = payfastService.createCheckoutPayload
  payfastService.createCheckoutPayload = (args) => {
    const result = typeof origCheckout === 'function' ? origCheckout(args) : null
    if (result && result.ok) return result
    return {
      ok: true,
      skipped: false,
      formAction: 'https://www.payfast.co.za/eng/process',
      fields: {
        amount: (args.amountCents / 100).toFixed(2),
        m_payment_id: args.mPaymentId,
        item_name: args.itemName,
        item_description: args.itemDescription,
        signature: 'preview-only',
      },
      sandbox: false,
    }
  }

  const service = require('../backend/services/payments/manualPaymentBookingService')
  const paymentService = require('../backend/services/payments/attendancePaymentService')
  const { resolveRequestChargeCents, BRIEFING_PRICE_CENTS } = require('../backend/constants/briefingPricing')

  const briefings = [
    {
      tenderNumber: 'NHLS RFQ 1922468',
      tenderDescription: 'Renovations to Office of the CIO',
      procuringEntity: 'NHLS',
      briefingDate: '2026-10-21',
      briefingTime: '10:00',
      briefingVenue: 'NHLS Head Office',
    },
    {
      tenderNumber: 'LPT/QUT037/2026',
      tenderDescription: 'Supply and Installation of 10,000 Litre Tank',
      procuringEntity: 'Limpopo Provincial Treasury',
      briefingDate: '2026-10-20',
    },
    {
      tenderNumber: 'TNPA/2026/08/0002/114627/RFQ',
      tenderDescription: 'Port terminal works briefing',
      briefingDate: '2026-10-22',
    },
    {
      tenderNumber: 'RFQ-CERT-004/2026',
      tenderDescription: 'Multi-briefing certification line 4',
      briefingDate: '2026-10-23',
    },
  ]

  const created = await service.createManualPaymentRequest(
    {
      companyName: 'Multi-Briefing Certification SME',
      contactPerson: 'Certification Contact',
      customerEmail: 'multi-briefing-cert@example.test',
      customerPhone: '+27 11 000 0000',
      briefings,
      // Must be ignored by server
      paymentAmount: 75000,
      total: 75000,
      quantity: 1,
    },
    { uid: 'preview-admin', email: 'info@tenderbriefing.co.za' }
  )

  const chargeCents = resolveRequestChargeCents(created.request)
  check('4 structured briefing lines stored', created.request.briefingLines?.length === 4, String(created.request.briefingLines?.length))
  check('unit price locked at 75000', created.request.unitPriceCents === BRIEFING_PRICE_CENTS)
  check('server total = 300000 cents', chargeCents === 300000, String(chargeCents))
  check('one invoice number', Boolean(created.invoiceNumber), created.invoiceNumber)
  check('one payment token', Boolean(created.request.paymentToken))

  const checkout = await paymentService.createPayfastCheckoutForRequest(
    created.request,
    'https://www.tenderbriefing.co.za'
  )
  check('checkout ok', checkout.ok === true)
  check(
    'PayFast amount field = 3000.00',
    checkout.fields?.amount === '3000.00',
    checkout.fields?.amount
  )
  check(
    'PayFast amountCents resolves to 300000',
    chargeCents === 300000 && Number(checkout.fields?.amount) * 100 === 300000
  )

  const pdf = await service.buildInvoicePdfBuffer(created.request)
  fs.writeFileSync(outPdf, pdf)
  check(
    'preview PDF written',
    fs.existsSync(outPdf) && pdf.slice(0, 5).toString() === '%PDF-' && pdf.length > 5000,
    `${outPdf} (${pdf.length} bytes)`
  )
  check(
    'order has four independent tender numbers',
    new Set(created.request.briefingLines.map((l) => l.tenderNumber)).size === 4
  )
  check(
    'first line is NHLS RFQ 1922468',
    created.request.briefingLines[0].tenderNumber === 'NHLS RFQ 1922468'
  )
  check(
    'second line is LPT/QUT037/2026',
    created.request.briefingLines[1].tenderNumber === 'LPT/QUT037/2026'
  )

  // Tamper resistance
  const tampered = {
    ...created.request,
    paymentAmount: 75000,
    briefingPriceCents: 75000,
    quotedFee: 75000,
    briefingCount: 1,
    paymentStatus: 'pending',
  }
  check(
    'tampered browser total cannot reduce charge',
    resolveRequestChargeCents(tampered) === 300000,
    String(resolveRequestChargeCents(tampered))
  )

  const report = {
    verdict: checks.every((c) => c.ok) ? 'PASS' : 'FAIL',
    customer: 'Multi-Briefing Certification SME',
    invoiceNumber: created.invoiceNumber,
    bookingId: created.request.id,
    briefingCount: 4,
    unitPriceCents: BRIEFING_PRICE_CENTS,
    chargeCents,
    payfastAmountField: checkout.fields?.amount || null,
    paymentUrl: created.paymentUrl,
    pdfPath: outPdf,
    emailSent: false,
    paymentMade: false,
    checks,
    generatedAt: new Date().toISOString(),
  }

  fs.writeFileSync(outJson, JSON.stringify(report, null, 2))
  console.log('\n────────────────────────────────────────')
  console.log(`VERDICT: ${report.verdict}`)
  console.log(`Invoice: ${report.invoiceNumber}`)
  console.log(`Charge:  ${report.chargeCents} cents (R${(report.chargeCents / 100).toFixed(2)})`)
  console.log(`PDF:     ${outPdf}`)
  console.log(`Report:  ${outJson}`)
  console.log('Email:   NOT SENT (preview only)')
  console.log('Payment: NOT MADE (preview only)')
  console.log('────────────────────────────────────────')

  // Restore local attendance-requests.json — preview must not pollute local data
  if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
  else fs.writeFileSync(requestsFile, '[]\n', 'utf8')

  if (report.verdict !== 'PASS') process.exit(1)
}

main().catch((err) => {
  console.error(err)
  if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
  process.exit(1)
})
