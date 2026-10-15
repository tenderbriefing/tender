/**
 * TenderBriefing branded payment invoice PDF (not a tax invoice — not VAT registered).
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
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
const BOOKING_CONFIRMATION =
  'Payment confirms the booking of a TenderBriefing Youth Agent, subject to agent availability and the briefing information supplied.'

function loadLogoBytes() {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'public', 'brand', 'logo.png'))
  } catch {
    try {
      return fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png'))
    } catch {
      return null
    }
  }
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return String(iso)
  }
}

function paymentStatusLabel(request) {
  if (request.paymentStatus === 'paid') return 'PAID'
  return 'UNPAID'
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
  const brandBlue = rgb(0.12, 0.27, 0.45)
  const ink = rgb(0.12, 0.14, 0.16)
  const muted = rgb(0.35, 0.38, 0.42)
  const line = rgb(0.85, 0.88, 0.92)

  let y = PAGE_HEIGHT - MARGIN

  const logoBytes = loadLogoBytes()
  if (logoBytes) {
    try {
      const logo = await pdf.embedPng(logoBytes)
      const logoW = 140
      const logoH = (logo.height / logo.width) * logoW
      page.drawImage(logo, {
        x: MARGIN,
        y: y - logoH,
        width: logoW,
        height: logoH,
      })
      y -= logoH + 16
    } catch {
      page.drawText('TenderBriefing', {
        x: MARGIN,
        y: y - 18,
        size: 18,
        font: fontBold,
        color: brandBlue,
      })
      y -= 36
    }
  } else {
    page.drawText('TenderBriefing', {
      x: MARGIN,
      y: y - 18,
      size: 18,
      font: fontBold,
      color: brandBlue,
    })
    y -= 36
  }

  page.drawText('INVOICE', {
    x: PAGE_WIDTH - MARGIN - 90,
    y: PAGE_HEIGHT - MARGIN - 18,
    size: 16,
    font: fontBold,
    color: brandBlue,
  })

  page.drawText('Not a tax invoice — TenderBriefing is not VAT registered.', {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: muted,
  })
  y -= 20

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: line,
  })
  y -= 28

  const cents = resolveRequestChargeCents(request)
  const amountLabel = formatBriefingPriceZar(cents || BRIEFING_PRICE_CENTS)
  const status = paymentStatusLabel(request)
  const paymentUrl =
    opts.paymentUrl ||
    (request.paymentToken
      ? `https://www.tenderbriefing.co.za/pay/${request.paymentToken}`
      : '')

  const rows = [
    ['Invoice number', request.invoiceNumber || '—'],
    ['Invoice date', formatDate(request.invoiceIssuedAt || request.createdAt)],
    ['Booking / request reference', request.id],
    ['Payment status', status],
    ['Customer / company', request.smeCompany || request.smeName || '—'],
    ['Customer email', request.smeEmail || '—'],
    ['Tender / RFQ reference', request.tenderNumber || '—'],
    ['Description', 'Tender Briefing Attendance Service'],
  ]

  if (request.briefingDate || request.briefingTime) {
    rows.push([
      'Briefing date / time',
      [request.briefingDate, request.briefingTime].filter(Boolean).join(' · ') || '—',
    ])
  }
  if (request.briefingVenue) {
    rows.push(['Briefing venue', request.briefingVenue])
  }

  for (const [label, value] of rows) {
    page.drawText(label, { x: MARGIN, y, size: 9, font, color: muted })
    const text = String(value || '—').slice(0, 78)
    page.drawText(text, {
      x: MARGIN + 180,
      y,
      size: 10,
      font: fontBold,
      color: ink,
    })
    y -= 18
  }

  y -= 12
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: line,
  })
  y -= 28

  page.drawText('Amount', { x: MARGIN, y, size: 11, font, color: muted })
  page.drawText(amountLabel, {
    x: PAGE_WIDTH - MARGIN - 80,
    y,
    size: 12,
    font: fontBold,
    color: ink,
  })
  y -= 22

  page.drawText('Total Due', { x: MARGIN, y, size: 12, font: fontBold, color: ink })
  page.drawText(amountLabel, {
    x: PAGE_WIDTH - MARGIN - 80,
    y,
    size: 14,
    font: fontBold,
    color: brandBlue,
  })
  y -= 36

  // Wrap confirmation wording
  const words = BOOKING_CONFIRMATION.split(' ')
  let lineText = ''
  const maxWidth = PAGE_WIDTH - MARGIN * 2
  for (const word of words) {
    const trial = lineText ? `${lineText} ${word}` : word
    if (font.widthOfTextAtSize(trial, 9) > maxWidth) {
      page.drawText(lineText, { x: MARGIN, y, size: 9, font, color: muted })
      y -= 13
      lineText = word
    } else {
      lineText = trial
    }
  }
  if (lineText) {
    page.drawText(lineText, { x: MARGIN, y, size: 9, font, color: muted })
    y -= 24
  }

  if (status === 'UNPAID' && paymentUrl) {
    page.drawText('Pay online:', { x: MARGIN, y, size: 10, font: fontBold, color: brandBlue })
    y -= 14
    page.drawText(paymentUrl.slice(0, 95), {
      x: MARGIN,
      y,
      size: 8,
      font,
      color: brandBlue,
    })
  }

  page.drawText('TenderBriefing | FIND. TRACK. WIN.', {
    x: MARGIN,
    y: MARGIN,
    size: 8,
    font,
    color: muted,
  })

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

module.exports = {
  renderManualInvoicePdf,
  BOOKING_CONFIRMATION,
}
