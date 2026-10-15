/**
 * TenderBriefing professional accounting-style payment invoice PDF.
 * Not a tax invoice — TenderBriefing is not VAT registered.
 * Redesign-only: does not touch PayFast / ITN / pricing logic.
 */
const { PDFDocument, StandardFonts, rgb, PDFString, PDFName } = require('pdf-lib')
const fs = require('fs')
const path = require('path')
const {
  BRIEFING_PRICE_CENTS,
  formatBriefingPriceZar,
  resolveRequestChargeCents,
} = require('../../constants/briefingPricing')

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 48
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

/** Canonical supplier profile (mirrors lib/contact.ts — JS backend). */
const SUPPLIER = {
  name: 'TENDERBRIEFING',
  displayName: 'TenderBriefing',
  email: 'info@tenderbriefing.co.za',
  phone: '+27 12 004 8728',
  website: 'www.tenderbriefing.co.za',
  addressLines: [
    'Byls Bridge Office Park',
    'First Floor, Block B',
    'Olievenhoutbosch Road, Doringkloof',
    'Centurion, 0157',
    'South Africa',
  ],
}

const BOOKING_CONFIRMATION =
  'Payment confirms the booking request for a TenderBriefing Youth Agent, subject to agent availability and the briefing information supplied.'

const SERVICE_DESCRIPTION = 'Tender Briefing Attendance Service'

const ink = rgb(0.1, 0.12, 0.14)
const muted = rgb(0.4, 0.43, 0.47)
const rule = rgb(0.78, 0.8, 0.82)
const ruleStrong = rgb(0.22, 0.24, 0.27)
const brand = rgb(0.05, 0.22, 0.38)
const headerBg = rgb(0.96, 0.97, 0.98)
const payBtn = rgb(0.05, 0.22, 0.38)
const white = rgb(1, 1, 1)
const paidGreen = rgb(0.12, 0.45, 0.28)
const unpaidAmber = rgb(0.55, 0.35, 0.05)

function loadLogoBytes() {
  const candidates = [
    path.join(process.cwd(), 'public', 'brand', 'mark.png'),
    path.join(process.cwd(), 'public', 'brand', 'logo.png'),
    path.join(process.cwd(), 'public', 'logo.png'),
  ]
  for (const p of candidates) {
    try {
      return fs.readFileSync(p)
    } catch {
      /* try next */
    }
  }
  return null
}

function formatDate(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    return d.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return String(iso)
  }
}

function formatDisplayDate(value) {
  if (!value) return null
  const asIso = formatDate(value)
  if (asIso && asIso !== String(value)) return asIso
  return String(value).trim() || null
}

function paymentStatusLabel(request) {
  return request.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'
}

function moneyLabel(cents) {
  return formatBriefingPriceZar(
    Number.isFinite(cents) ? cents : BRIEFING_PRICE_CENTS
  )
}

function drawRightText(page, text, rightX, y, size, font, color) {
  const width = font.widthOfTextAtSize(String(text), size)
  page.drawText(String(text), {
    x: rightX - width,
    y,
    size,
    font,
    color,
  })
}

function wrapLines(text, font, size, maxWidth) {
  const paragraphs = String(text || '').split(/\r?\n/)
  const lines = []
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }
    let current = ''
    for (const word of words) {
      const trial = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = trial
      }
    }
    if (current) lines.push(current)
  }
  return lines.length ? lines : ['']
}

function drawWrapped(page, text, x, y, size, font, color, maxWidth, lineHeight) {
  const lines = wrapLines(text, font, size, maxWidth)
  let cursor = y
  for (const line of lines) {
    page.drawText(line, { x, y: cursor, size, font, color })
    cursor -= lineHeight
  }
  return cursor
}

function addLinkAnnotation(pdf, page, { x, y, width, height, url }) {
  if (!url) return
  try {
    const annot = pdf.context.register(
      pdf.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [x, y, x + width, y + height],
        Border: [0, 0, 0],
        C: [0, 0, 0],
        A: {
          Type: 'Action',
          S: 'URI',
          URI: PDFString.of(String(url)),
        },
      })
    )
    const annots = page.node.lookup(PDFName.of('Annots'))
    if (annots) {
      annots.push(annot)
    } else {
      page.node.set(PDFName.of('Annots'), pdf.context.obj([annot]))
    }
  } catch {
    /* URL is also printed in plain text */
  }
}

/**
 * @param {object} request - attendance request (manual booking)
 * @param {{ paymentUrl?: string }} [opts]
 * @returns {Promise<Buffer>}
 */
async function renderManualInvoicePdf(request, opts = {}) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const cents = resolveRequestChargeCents(request)
  const amountLabel = moneyLabel(cents)
  const zeroLabel = moneyLabel(0)
  const status = paymentStatusLabel(request)
  const isPaid = status === 'PAID'
  const invoiceNumber = request.invoiceNumber || '—'
  const invoiceDate =
    formatDate(request.invoiceIssuedAt || request.createdAt) || '—'
  const paymentDate = formatDate(request.paidAt)
  const paymentUrl =
    opts.paymentUrl ||
    (request.paymentToken
      ? `https://www.tenderbriefing.co.za/pay/${request.paymentToken}`
      : '')

  const companyName = String(request.smeCompany || request.smeName || '').trim()
  const customerEmail = String(request.smeEmail || '').trim()
  const contactPerson = String(
    request.contactPerson ||
      request.smeContactName ||
      (request.smeName &&
      request.smeCompany &&
      request.smeName !== request.smeCompany
        ? request.smeName
        : '') ||
      ''
  ).trim()

  const tenderRef = String(request.tenderNumber || '').trim()
  const briefingDate = formatDisplayDate(request.briefingDate)
  const briefingTime = String(request.briefingTime || '').trim() || null
  const briefingVenue = String(request.briefingVenue || '').trim() || null
  const bookingRef = String(request.id || '').trim() || null

  let y = PAGE_HEIGHT - MARGIN

  // ── Header: supplier left / INVOICE meta right ─────────────────────────
  const logoBytes = loadLogoBytes()
  const logoBox = 40
  let supplierTextX = MARGIN

  if (logoBytes) {
    try {
      const logo = await pdf.embedPng(logoBytes)
      page.drawRectangle({
        x: MARGIN,
        y: y - logoBox,
        width: logoBox,
        height: logoBox,
        color: rgb(0.05, 0.05, 0.06),
      })
      const pad = 4
      const fit = logoBox - pad * 2
      const scale = Math.min(fit / logo.width, fit / logo.height)
      const lw = logo.width * scale
      const lh = logo.height * scale
      page.drawImage(logo, {
        x: MARGIN + (logoBox - lw) / 2,
        y: y - logoBox + (logoBox - lh) / 2,
        width: lw,
        height: lh,
      })
      supplierTextX = MARGIN + logoBox + 10
    } catch {
      /* text-only */
    }
  }

  page.drawText(SUPPLIER.name, {
    x: supplierTextX,
    y: y - 11,
    size: 11,
    font: fontBold,
    color: brand,
  })
  let supplierY = y - 24
  for (const line of [
    ...SUPPLIER.addressLines,
    SUPPLIER.email,
    SUPPLIER.phone,
    SUPPLIER.website,
  ]) {
    page.drawText(line, {
      x: supplierTextX,
      y: supplierY,
      size: 7.5,
      font,
      color: muted,
    })
    supplierY -= 10
  }

  const metaRight = PAGE_WIDTH - MARGIN
  drawRightText(page, 'INVOICE', metaRight, y - 14, 20, fontBold, brand)

  const metaRows = [
    ['Invoice Number', invoiceNumber],
    ['Invoice Date', invoiceDate],
    ['Due Date', 'Due on Receipt'],
    ['Status', status],
  ]
  if (isPaid && paymentDate) metaRows.push(['Payment Date', paymentDate])

  let metaY = y - 38
  const metaLabelX = metaRight - 200
  for (const [label, value] of metaRows) {
    page.drawText(`${label}:`, {
      x: metaLabelX,
      y: metaY,
      size: 9,
      font,
      color: muted,
    })
    const valueColor =
      label === 'Status' ? (isPaid ? paidGreen : unpaidAmber) : ink
    page.drawText(String(value), {
      x: metaLabelX + 95,
      y: metaY,
      size: 9,
      font: fontBold,
      color: valueColor,
    })
    metaY -= 13
  }

  y = Math.min(supplierY, metaY) - 14
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1.2,
    color: ruleStrong,
  })
  y -= 20

  // ── BILL TO ────────────────────────────────────────────────────────────
  page.drawText('BILL TO', { x: MARGIN, y, size: 8, font: fontBold, color: muted })
  y -= 13
  if (companyName) {
    page.drawText(companyName.slice(0, 72), {
      x: MARGIN,
      y,
      size: 11,
      font: fontBold,
      color: ink,
    })
    y -= 13
  }
  if (contactPerson) {
    page.drawText(contactPerson.slice(0, 72), {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: ink,
    })
    y -= 12
  }
  if (customerEmail) {
    page.drawText(customerEmail.slice(0, 72), {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: muted,
    })
    y -= 16
  } else {
    y -= 4
  }

  // ── Booking / reference (populated fields only) ────────────────────────
  const refs = []
  if (tenderRef) refs.push(['Tender / RFQ Reference', tenderRef])
  if (briefingDate) refs.push(['Briefing Date', briefingDate])
  if (briefingTime) refs.push(['Briefing Time', briefingTime])
  if (briefingVenue) refs.push(['Briefing Venue', briefingVenue])
  if (bookingRef) refs.push(['Booking Reference', bookingRef])

  if (refs.length) {
    page.drawText('BOOKING DETAILS', {
      x: MARGIN,
      y,
      size: 8,
      font: fontBold,
      color: muted,
    })
    y -= 8

    const rowH = []
    for (const [, value] of refs) {
      const lines = wrapLines(String(value), fontBold, 9, CONTENT_WIDTH - 168)
      rowH.push(Math.max(14, lines.length * 11 + 3))
    }
    const boxH = rowH.reduce((a, b) => a + b, 0) + 10
    const boxBottom = y - boxH

    page.drawRectangle({
      x: MARGIN,
      y: boxBottom,
      width: CONTENT_WIDTH,
      height: boxH,
      borderColor: rule,
      borderWidth: 0.7,
      color: headerBg,
    })

    let ry = y - 10
    for (let i = 0; i < refs.length; i++) {
      const [label, value] = refs[i]
      page.drawText(`${label}:`, {
        x: MARGIN + 8,
        y: ry,
        size: 8,
        font,
        color: muted,
      })
      const lines = wrapLines(String(value), fontBold, 9, CONTENT_WIDTH - 168)
      let vy = ry
      for (const vl of lines) {
        page.drawText(vl, {
          x: MARGIN + 148,
          y: vy,
          size: 9,
          font: fontBold,
          color: ink,
        })
        vy -= 11
      }
      ry -= rowH[i]
    }
    y = boxBottom - 18
  }

  // ── Line items table ───────────────────────────────────────────────────
  const colDesc = MARGIN
  const colQty = MARGIN + 330
  const colRate = MARGIN + 385
  const colAmt = PAGE_WIDTH - MARGIN

  page.drawRectangle({
    x: MARGIN,
    y: y - 5,
    width: CONTENT_WIDTH,
    height: 18,
    color: headerBg,
  })
  page.drawText('DESCRIPTION', {
    x: colDesc + 6,
    y,
    size: 8,
    font: fontBold,
    color: muted,
  })
  page.drawText('QTY', { x: colQty, y, size: 8, font: fontBold, color: muted })
  page.drawText('RATE', { x: colRate, y, size: 8, font: fontBold, color: muted })
  drawRightText(page, 'AMOUNT', colAmt - 6, y, 8, fontBold, muted)
  y -= 5
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.8,
    color: ruleStrong,
  })
  y -= 16

  page.drawText(SERVICE_DESCRIPTION, {
    x: colDesc + 6,
    y,
    size: 10,
    font: fontBold,
    color: ink,
  })
  page.drawText('1', { x: colQty + 6, y, size: 10, font, color: ink })
  page.drawText(amountLabel, { x: colRate, y, size: 10, font, color: ink })
  drawRightText(page, amountLabel, colAmt - 6, y, 10, fontBold, ink)
  y -= 12
  if (tenderRef) {
    page.drawText(`RFQ / Tender: ${tenderRef}`.slice(0, 92), {
      x: colDesc + 6,
      y,
      size: 8,
      font,
      color: muted,
    })
    y -= 12
  }
  y -= 4
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.6,
    color: rule,
  })
  y -= 20

  // ── Totals ─────────────────────────────────────────────────────────────
  const totalsLabelX = PAGE_WIDTH - MARGIN - 170
  const totalsValueRight = PAGE_WIDTH - MARGIN

  page.drawText('Subtotal', {
    x: totalsLabelX,
    y,
    size: 10,
    font,
    color: muted,
  })
  drawRightText(page, amountLabel, totalsValueRight, y, 10, font, ink)
  y -= 14

  if (isPaid) {
    page.drawText('Amount Paid', {
      x: totalsLabelX,
      y,
      size: 10,
      font,
      color: muted,
    })
    drawRightText(page, amountLabel, totalsValueRight, y, 10, font, paidGreen)
    y -= 13
    page.drawText('Balance Due', {
      x: totalsLabelX,
      y,
      size: 10,
      font,
      color: muted,
    })
    drawRightText(page, zeroLabel, totalsValueRight, y, 10, fontBold, ink)
    y -= 16
  }

  page.drawLine({
    start: { x: totalsLabelX - 6, y: y + 6 },
    end: { x: totalsValueRight, y: y + 6 },
    thickness: 1,
    color: ruleStrong,
  })
  page.drawText('TOTAL DUE', {
    x: totalsLabelX,
    y,
    size: 11,
    font: fontBold,
    color: ink,
  })
  drawRightText(
    page,
    isPaid ? zeroLabel : amountLabel,
    totalsValueRight,
    y,
    13,
    fontBold,
    brand
  )
  y -= 13
  page.drawText('VAT is not charged.', {
    x: totalsLabelX,
    y,
    size: 8,
    font,
    color: muted,
  })
  y -= 24

  // ── Payment / paid settlement ──────────────────────────────────────────
  if (isPaid) {
    page.drawText('PAYMENT RECEIVED', {
      x: MARGIN,
      y,
      size: 8,
      font: fontBold,
      color: paidGreen,
    })
    y -= 13
    const paidLines = [
      `Amount Paid: ${amountLabel}`,
      `Balance Due: ${zeroLabel}`,
    ]
    if (paymentDate) paidLines.push(`Payment Date: ${paymentDate}`)
    if (request.payfastPaymentId) {
      paidLines.push(`PayFast Payment ID: ${String(request.payfastPaymentId)}`)
    }
    if (request.paymentReference) {
      paidLines.push(`Payment Reference: ${String(request.paymentReference)}`)
    }
    for (const line of paidLines) {
      page.drawText(line, { x: MARGIN, y, size: 9, font, color: ink })
      y -= 12
    }
    y -= 6
  } else if (paymentUrl) {
    page.drawText('PAYMENT', {
      x: MARGIN,
      y,
      size: 8,
      font: fontBold,
      color: muted,
    })
    y -= 13
    page.drawText('Pay securely online using PayFast:', {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: ink,
    })
    y -= 16

    const btnLabel = `PAY NOW — ${amountLabel}`
    const btnPadX = 14
    const btnTextW = fontBold.widthOfTextAtSize(btnLabel, 10)
    const btnW = btnTextW + btnPadX * 2
    const btnH = 24
    const btnX = MARGIN
    const btnY = y - btnH + 5

    page.drawRectangle({
      x: btnX,
      y: btnY,
      width: btnW,
      height: btnH,
      color: payBtn,
    })
    page.drawText(btnLabel, {
      x: btnX + btnPadX,
      y: btnY + 7,
      size: 10,
      font: fontBold,
      color: white,
    })
    addLinkAnnotation(pdf, page, {
      x: btnX,
      y: btnY,
      width: btnW,
      height: btnH,
      url: paymentUrl,
    })
    y = btnY - 12

    page.drawText('Or open this payment link:', {
      x: MARGIN,
      y,
      size: 8,
      font,
      color: muted,
    })
    y -= 10
    y = drawWrapped(page, paymentUrl, MARGIN, y, 7.5, font, brand, CONTENT_WIDTH, 10)
    y -= 8
  }

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: rule,
  })
  y -= 12
  drawWrapped(
    page,
    BOOKING_CONFIRMATION,
    MARGIN,
    y,
    8,
    font,
    muted,
    CONTENT_WIDTH,
    11
  )

  // ── Footer ─────────────────────────────────────────────────────────────
  const footerY = MARGIN
  page.drawLine({
    start: { x: MARGIN, y: footerY + 26 },
    end: { x: PAGE_WIDTH - MARGIN, y: footerY + 26 },
    thickness: 0.5,
    color: rule,
  })
  page.drawText('Thank you for your business.', {
    x: MARGIN,
    y: footerY + 12,
    size: 8,
    font,
    color: muted,
  })
  page.drawText(
    `${SUPPLIER.displayName}  ·  ${SUPPLIER.website}  ·  ${SUPPLIER.email}`,
    {
      x: MARGIN,
      y: footerY,
      size: 8,
      font,
      color: muted,
    }
  )

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

module.exports = {
  renderManualInvoicePdf,
  BOOKING_CONFIRMATION,
  SERVICE_DESCRIPTION,
  SUPPLIER,
}
