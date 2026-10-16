/**
 * TenderBriefing professional accounting-style payment invoice PDF.
 * Not a tax invoice — TenderBriefing is not VAT registered.
 * Branding: horizontal invoice-logo.png wordmark + PDF text for contact details.
 * Pricing: resolveRequestChargeCents only — no client amounts.
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
const FOOTER_RESERVE = 56
const PAGE_BOTTOM = MARGIN + FOOTER_RESERVE

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

/** Horizontal TenderBriefing wordmark logo for invoice headers (transparent bg). */
function loadInvoiceLogoBytes() {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), 'public', 'brand', 'invoice-logo.png')
    )
  } catch {
    return null
  }
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
  if (request.paymentStatus === 'paid') return 'PAID'
  if (request.paymentStatus === 'cancelled') return 'CANCELLED'
  return 'PENDING'
}

/** Invoice display money — thousands separator for readability (R3,000.00). */
function invoiceMoneyLabel(cents) {
  const n = Number.isFinite(cents) ? cents : BRIEFING_PRICE_CENTS
  if (!Number.isFinite(n) || n <= 0) return formatBriefingPriceZar(0)
  const rand = (n / 100).toFixed(2)
  const [whole, frac] = rand.split('.')
  const withSep = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `R${withSep}.${frac}`
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

function drawPageFooter(page, font, pageIndex, pageCount) {
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
  const right = `Page ${pageIndex + 1} of ${pageCount}`
  drawRightText(page, right, PAGE_WIDTH - MARGIN, footerY + 12, 8, font, muted)
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
}

/**
 * @param {object} request - attendance request (manual booking)
 * @param {{ paymentUrl?: string }} [opts]
 * @returns {Promise<Buffer>}
 */
async function renderManualInvoicePdf(request, opts = {}) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const cents = resolveRequestChargeCents(request)
  const amountLabel = invoiceMoneyLabel(cents)
  const unitLabel = invoiceMoneyLabel(BRIEFING_PRICE_CENTS)
  const zeroLabel = invoiceMoneyLabel(0)
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
  const customerPhone = String(request.smePhone || '').trim()

  const tenderRef = String(request.tenderNumber || '').trim()
  const briefingDate = formatDisplayDate(request.briefingDate)
  const briefingTime = String(request.briefingTime || '').trim() || null
  const briefingVenue = String(request.briefingVenue || '').trim() || null
  const structuredLines = Array.isArray(request.briefingLines)
    ? request.briefingLines
    : []
  const briefingCount =
    structuredLines.length > 0
      ? structuredLines.length
      : Math.max(1, Math.round(cents / BRIEFING_PRICE_CENTS) || 1)

  let logoImage = null
  const logoBytes = loadInvoiceLogoBytes()
  if (logoBytes) {
    try {
      logoImage = await pdf.embedPng(logoBytes)
    } catch {
      logoImage = null
    }
  }

  const pages = []
  function addPage() {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    pages.push(page)
    return page
  }

  let page = addPage()
  let y = PAGE_HEIGHT - MARGIN

  async function ensureSpace(needed) {
    if (y - needed >= PAGE_BOTTOM) return
    page = addPage()
    y = PAGE_HEIGHT - MARGIN
    // Continuation header
    page.drawText(`${SUPPLIER.name} — Invoice ${invoiceNumber} (continued)`, {
      x: MARGIN,
      y,
      size: 9,
      font: fontBold,
      color: brand,
    })
    y -= 8
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.6,
      color: rule,
    })
    y -= 18
  }

  // ── Header: horizontal brand logo + text contact | INVOICE meta ────────
  // Logo already includes the TENDERBRIEFING wordmark — do not draw a tiny
  // black mark square or duplicate the company name beside the logo.
  let supplierY = y
  const logoMaxW = 210
  const logoMaxH = 78

  if (logoImage) {
    const scale = Math.min(logoMaxW / logoImage.width, logoMaxH / logoImage.height)
    const lw = logoImage.width * scale
    const lh = logoImage.height * scale
    page.drawImage(logoImage, {
      x: MARGIN,
      y: y - lh,
      width: lw,
      height: lh,
    })
    supplierY = y - lh - 10
  } else {
    page.drawText(SUPPLIER.name, {
      x: MARGIN,
      y: y - 12,
      size: 12,
      font: fontBold,
      color: brand,
    })
    supplierY = y - 26
  }

  for (const line of [
    ...SUPPLIER.addressLines,
    SUPPLIER.email,
    SUPPLIER.phone,
    SUPPLIER.website,
  ]) {
    page.drawText(line, {
      x: MARGIN,
      y: supplierY,
      size: 8,
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
    y -= 12
  }
  if (customerPhone) {
    page.drawText(customerPhone.slice(0, 40), {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: muted,
    })
    y -= 14
  } else {
    y -= 4
  }

  if (structuredLines.length === 0) {
    const refs = []
    if (tenderRef) refs.push(['Tender / RFQ Reference', tenderRef])
    if (briefingDate) refs.push(['Briefing Date', briefingDate])
    if (briefingTime) refs.push(['Briefing Time', briefingTime])
    if (briefingVenue) refs.push(['Briefing Venue', briefingVenue])
    if (request.id) refs.push(['Booking Reference', String(request.id)])

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
        const wrapped = wrapLines(String(value), fontBold, 9, CONTENT_WIDTH - 168)
        rowH.push(Math.max(14, wrapped.length * 11 + 3))
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
        const wrapped = wrapLines(String(value), fontBold, 9, CONTENT_WIDTH - 168)
        let vy = ry
        for (const vl of wrapped) {
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
  }

  // ── Briefings ──────────────────────────────────────────────────────────
  await ensureSpace(28)
  page.drawText(
    structuredLines.length > 0 ? 'BRIEFINGS REQUESTED' : 'DESCRIPTION',
    {
      x: MARGIN,
      y,
      size: 8,
      font: fontBold,
      color: muted,
    }
  )
  y -= 8
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.8,
    color: ruleStrong,
  })
  y -= 16

  if (structuredLines.length > 0) {
    for (let i = 0; i < structuredLines.length; i++) {
      const line = structuredLines[i]
      const n = line.lineNumber || i + 1
      const ref = String(line.tenderNumber || '').trim()
      const desc = String(line.tenderDescription || line.description || '').trim()
      const entity = String(line.procuringEntity || '').trim()
      const dateLabel = formatDisplayDate(line.briefingDate)
      const timeLabel = String(line.briefingTime || '').trim()
      const venueLabel = String(line.briefingVenue || '').trim()
      const descLines = wrapLines(desc, font, 9, CONTENT_WIDTH - 100)
      const blockH =
        16 + // title
        (descLines.length ? descLines.length * 11 + 2 : 0) +
        (entity ? 12 : 0) +
        (dateLabel || timeLabel ? 12 : 0) +
        (venueLabel ? 12 : 0) +
        14

      await ensureSpace(Math.min(blockH, 120))

      page.drawText(`Briefing #${n}`, {
        x: MARGIN,
        y,
        size: 8.5,
        font: fontBold,
        color: brand,
      })
      drawRightText(page, unitLabel, PAGE_WIDTH - MARGIN, y, 9.5, fontBold, ink)
      y -= 11

      page.drawText(ref.slice(0, 90) || '—', {
        x: MARGIN,
        y,
        size: 9.5,
        font: fontBold,
        color: ink,
      })
      y -= 11

      if (desc) {
        y = drawWrapped(
          page,
          desc,
          MARGIN,
          y,
          8.5,
          font,
          ink,
          CONTENT_WIDTH - 8,
          10
        )
        y -= 1
      }
      if (entity) {
        page.drawText(entity.slice(0, 90), {
          x: MARGIN,
          y,
          size: 8,
          font,
          color: muted,
        })
        y -= 10
      }
      if (dateLabel || timeLabel) {
        const when = [dateLabel, timeLabel].filter(Boolean).join(' · ')
        page.drawText(when.slice(0, 90), {
          x: MARGIN,
          y,
          size: 8,
          font,
          color: muted,
        })
        y -= 10
      }
      if (venueLabel) {
        page.drawText(venueLabel.slice(0, 90), {
          x: MARGIN,
          y,
          size: 8,
          font,
          color: muted,
        })
        y -= 10
      }
      y -= 6
    }
  } else {
    await ensureSpace(40)
    page.drawText(SERVICE_DESCRIPTION, {
      x: MARGIN,
      y,
      size: 10,
      font: fontBold,
      color: ink,
    })
    drawRightText(page, amountLabel, PAGE_WIDTH - MARGIN, y, 10, fontBold, ink)
    y -= 12
    if (tenderRef) {
      page.drawText(`RFQ / Tender: ${tenderRef}`.slice(0, 92), {
        x: MARGIN,
        y,
        size: 8,
        font,
        color: muted,
      })
      y -= 12
    }
  }

  // Keep summary + PAY NOW together when possible (avoid a near-empty trailing page).
  await ensureSpace(175)
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.6,
    color: rule,
  })
  y -= 14

  // ── Summary ────────────────────────────────────────────────────────────
  page.drawText('SUMMARY', {
    x: MARGIN,
    y,
    size: 8,
    font: fontBold,
    color: muted,
  })
  y -= 12

  const summaryLine = `${briefingCount} Briefing${
    briefingCount === 1 ? '' : 's'
  } × ${unitLabel}`
  page.drawText(summaryLine, {
    x: MARGIN,
    y,
    size: 10,
    font,
    color: ink,
  })
  drawRightText(page, amountLabel, PAGE_WIDTH - MARGIN, y, 10, font, ink)
  y -= 13

  page.drawText(`Payment status: ${status}`, {
    x: MARGIN,
    y,
    size: 9,
    font,
    color: isPaid ? paidGreen : unpaidAmber,
  })
  y -= 14

  page.drawLine({
    start: { x: PAGE_WIDTH - MARGIN - 200, y: y + 6 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 6 },
    thickness: 1.2,
    color: ruleStrong,
  })
  page.drawText('TOTAL DUE', {
    x: PAGE_WIDTH - MARGIN - 200,
    y,
    size: 12,
    font: fontBold,
    color: ink,
  })
  drawRightText(
    page,
    isPaid ? zeroLabel : amountLabel,
    PAGE_WIDTH - MARGIN,
    y,
    14,
    fontBold,
    brand
  )
  y -= 12
  page.drawText('VAT is not charged.', {
    x: PAGE_WIDTH - MARGIN - 200,
    y,
    size: 8,
    font,
    color: muted,
  })
  y -= 16

  // ── Payment ────────────────────────────────────────────────────────────
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

    const btnLabel = 'PAY NOW'
    const btnPadX = 18
    const btnTextW = fontBold.widthOfTextAtSize(btnLabel, 11)
    const btnW = btnTextW + btnPadX * 2
    const btnH = 26
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
      y: btnY + 8,
      size: 11,
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
    y = btnY - 14

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

  // Keep confirmation on the current page when space allows — never open a near-empty page for it.
  if (y - 28 >= PAGE_BOTTOM) {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rule,
    })
    y -= 9
    drawWrapped(
      page,
      BOOKING_CONFIRMATION,
      MARGIN,
      y,
      7.5,
      font,
      muted,
      CONTENT_WIDTH,
      9.5
    )
  }

  const pageCount = pages.length
  for (let i = 0; i < pageCount; i++) {
    drawPageFooter(pages[i], font, i, pageCount)
  }

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

module.exports = {
  renderManualInvoicePdf,
  BOOKING_CONFIRMATION,
  SERVICE_DESCRIPTION,
  SUPPLIER,
  invoiceMoneyLabel,
}
