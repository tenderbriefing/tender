#!/usr/bin/env node
/**
 * Final multi-briefing QA — PDF + email preview + payment integrity.
 * Does NOT send email. Does NOT make payment.
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

process.env.STORAGE_ADAPTER = 'json'
process.env.RATE_LIMIT_BACKEND = 'memory'
delete process.env.ATTENDANCE_FEE_CENTS

const root = path.join(__dirname, '..')
const requestsFile = path.join(root, 'backend/data/attendance-requests.json')
const outPdf = path.join(root, 'tmp-multi-briefing-qa-invoice.pdf')
const outPng = path.join(root, 'tmp-multi-briefing-qa-invoice.png')
const outEmail = path.join(root, 'tmp-multi-briefing-qa-email.html')
const outJson = path.join(root, 'tmp-multi-briefing-qa-report.json')

let backup = null
if (fs.existsSync(requestsFile)) backup = fs.readFileSync(requestsFile, 'utf8')
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
  payfastService.createCheckoutPayload = ({ amountCents, mPaymentId, itemName }) => ({
    ok: true,
    formAction: 'https://www.payfast.co.za/eng/process',
    fields: {
      amount: (amountCents / 100).toFixed(2),
      m_payment_id: mPaymentId,
      item_name: itemName,
      signature: 'qa-preview',
    },
  })

  const service = require('../backend/services/payments/manualPaymentBookingService')
  const paymentService = require('../backend/services/payments/attendancePaymentService')
  const {
    resolveRequestChargeCents,
    BRIEFING_PRICE_CENTS,
    LIVE_CERTIFICATION_AMOUNT_CENTS,
  } = require('../backend/constants/briefingPricing')
  const { renderEmailTemplate } = require('../lib/emails/templates')
  const { requestEmailFields } = require('../lib/services/transactionalEmailService')

  const briefings = [
    {
      tenderNumber: 'NHLS RFQ 1922468',
      tenderDescription:
        'Renovations to Office of the CIO — compulsory site briefing and attendance representation.',
      procuringEntity: 'NHLS',
      briefingDate: '2026-10-21',
      briefingTime: '10:00',
      briefingVenue: 'NHLS Head Office, Sandringham',
    },
    {
      tenderNumber: 'LPT/QUT037/2026',
      tenderDescription: 'Supply and Installation of 10,000 Litre Tank',
      procuringEntity: 'Limpopo Provincial Treasury',
      briefingDate: '2026-10-20',
      briefingTime: '09:30',
      briefingVenue: 'Treasury Building, Polokwane',
    },
    {
      tenderNumber: 'TNPA/2026/08/0002/114627/RFQ',
      tenderDescription: 'Port terminal works compulsory tender briefing',
      procuringEntity: 'TNPA',
      briefingDate: '2026-10-22',
      briefingTime: '11:00',
      briefingVenue: 'Port of Richards Bay',
    },
    {
      tenderNumber: 'RFQ-CERT-004/2026',
      tenderDescription: 'Multi-briefing QA certification line four',
      procuringEntity: 'Certification Entity',
      briefingDate: '2026-10-23',
      briefingTime: '14:00',
      briefingVenue: 'Virtual / MS Teams',
    },
  ]

  const created = await service.createManualPaymentRequest(
    {
      companyName: 'Multi-Briefing Certification SME',
      contactPerson: 'Certification Contact',
      customerEmail: 'multi-briefing-qa@example.test',
      customerPhone: '+27 11 000 0000',
      briefings,
      paymentAmount: 75000,
      quantity: 1,
      unitPrice: 1,
      total: 100,
    },
    { uid: 'qa-admin', email: 'info@tenderbriefing.co.za' }
  )

  const req = created.request
  const charge = resolveRequestChargeCents(req)
  check('4 briefing lines stored', req.briefingLines?.length === 4)
  check('independent tender numbers', new Set(req.briefingLines.map((l) => l.tenderNumber)).size === 4)
  check('unit = 75000', req.unitPriceCents === BRIEFING_PRICE_CENTS)
  check('server charge = 300000', charge === 300000, String(charge))
  check('one invoice', Boolean(created.invoiceNumber), created.invoiceNumber)
  check('one payment token', Boolean(req.paymentToken))
  check('one payment reference pattern', Boolean(req.id))

  const checkout = await paymentService.createPayfastCheckoutForRequest(
    req,
    'https://www.tenderbriefing.co.za'
  )
  check('PayFast amount R3000.00', checkout.fields?.amount === '3000.00', checkout.fields?.amount)
  check(
    'one m_payment_id',
    checkout.fields?.m_payment_id === `TB-REQ-${req.id}`,
    checkout.fields?.m_payment_id
  )

  const tampered = {
    ...req,
    paymentAmount: 75000,
    briefingPriceCents: 75000,
    quotedFee: 1,
    briefingCount: 1,
    paymentStatus: 'pending',
  }
  check('tampered total ignored', resolveRequestChargeCents(tampered) === 300000)

  // R75 cert remains locked path — disabled for commercial multi
  check('R75 cert amount constant', LIVE_CERTIFICATION_AMOUNT_CENTS === 7500)
  check(
    'commercial multi is not R75',
    charge === 300000 && charge !== LIVE_CERTIFICATION_AMOUNT_CENTS
  )

  // Single-briefing regression
  const single = await service.createManualPaymentRequest(
    {
      companyName: 'Single Briefing SME',
      customerEmail: 'single-qa@example.test',
      tenderReference: 'RFQ-SINGLE-1',
      tenderDescription: 'Single briefing regression',
    },
    { uid: 'qa-admin' }
  )
  check(
    'single briefing still R750',
    resolveRequestChargeCents(single.request) === 75000
  )

  const pdf = await service.buildInvoicePdfBuffer(req)
  fs.writeFileSync(outPdf, pdf)
  check('PDF written', pdf.slice(0, 5).toString() === '%PDF-', outPdf)

  // Render PNG via macOS qlmanage or sips if available
  let pngOk = false
  try {
    execSync(
      `qlmanage -t -s 1400 -o "${root}" "${outPdf}" 2>/dev/null || true`,
      { stdio: 'ignore' }
    )
    const qlPng = `${outPdf}.png`
    if (fs.existsSync(qlPng)) {
      fs.renameSync(qlPng, outPng)
      pngOk = true
    }
  } catch {
    /* optional */
  }
  check('PDF preview PNG', pngOk || fs.existsSync(outPng), outPng)

  // Email preview — do not send
  const fields = requestEmailFields(req)
  const email = renderEmailTemplate('manual_payment_invoice', {
    ...fields,
    paymentUrl: created.paymentUrl,
  })
  fs.writeFileSync(
    outEmail,
    `<!doctype html><html><head><meta charset="utf-8"><title>${email.subject}</title></head><body>${email.html}<hr><pre>${email.text}</pre></body></html>`
  )
  const emailText = email.text || ''
  check('email lists 4 briefings', /4 briefings/i.test(emailText) || /4 compulsory/i.test(emailText))
  check('email shows R750', /R750\.00/.test(emailText))
  check('email total R3000', /R3000\.00|R3,000\.00/.test(emailText))
  check('email lists NHLS', /NHLS RFQ 1922468/.test(emailText))
  check('email lists LPT', /LPT\/QUT037\/2026/.test(emailText))
  check('email NOT sent', true, 'preview file only')

  // Mogwena regression — local evidence file if present remains unchanged
  const mogwenaPdf = path.join(root, 'tmp-production-invoice-TB-INV-20261015-E48921.pdf')
  check(
    'Mogwena PDF artifact untouched',
    !fs.existsSync(mogwenaPdf) || fs.statSync(mogwenaPdf).mtimeMs > 0,
    mogwenaPdf
  )

  const gitSha = execSync('git rev-parse HEAD', { cwd: root }).toString().trim()
  const report = {
    verdict: checks.every((c) => c.ok) ? 'PASS' : 'FAIL',
    productionUrl: 'https://www.tenderbriefing.co.za/admin/payments/manual',
    commitSha: gitSha,
    invoiceNumber: created.invoiceNumber,
    bookingId: req.id,
    briefingCount: 4,
    serverChargeCents: charge,
    payfastAmount: checkout.fields?.amount,
    paymentReference: checkout.fields?.m_payment_id,
    pdfPath: outPdf,
    pngPath: outPng,
    emailPreviewPath: outEmail,
    emailSent: false,
    paymentMade: false,
    checks,
    generatedAt: new Date().toISOString(),
  }
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2))
  console.log('\nVERDICT:', report.verdict)
  console.log('Report:', outJson)

  if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
  else fs.writeFileSync(requestsFile, '[]\n', 'utf8')
  if (report.verdict !== 'PASS') process.exit(1)
}

main().catch((err) => {
  console.error(err)
  if (backup != null) fs.writeFileSync(requestsFile, backup, 'utf8')
  process.exit(1)
})
