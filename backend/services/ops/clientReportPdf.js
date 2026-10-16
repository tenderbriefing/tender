/**
 * Professional A4 TenderBriefing client report PDF (pdf-lib).
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const fs = require('fs')
const path = require('path')

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 54
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER = 'TenderBriefing  ·  FIND. TRACK. WIN.  ·  www.tenderbriefing.co.za'

function loadLogoBytes() {
  for (const rel of [
    ['public', 'brand', 'invoice-logo.png'],
    ['public', 'brand', 'logo.png'],
  ]) {
    try {
      return fs.readFileSync(path.join(process.cwd(), ...rel))
    } catch {
      /* next */
    }
  }
  return null
}

function wrapText(text, font, size, maxWidth) {
  const words = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  if (!words.length) return []
  const lines = []
  let current = words[0]
  for (let i = 1; i < words.length; i++) {
    const trial = `${current} ${words[i]}`
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) current = trial
    else {
      lines.push(current)
      current = words[i]
    }
  }
  lines.push(current)
  return lines
}

async function embedImage(pdf, bytes, mime) {
  if (!bytes) return null
  try {
    const m = String(mime || '').toLowerCase()
    if (m.includes('png') || bytes[0] === 0x89) return await pdf.embedPng(bytes)
    return await pdf.embedJpg(bytes)
  } catch {
    try {
      return await pdf.embedPng(bytes)
    } catch {
      try {
        return await pdf.embedJpg(bytes)
      } catch {
        return null
      }
    }
  }
}

/**
 * @param {{ draft: object, images?: Array<{ evidenceId: string, bytes: Buffer, mime?: string }> }} input
 */
async function renderClientReportPdf(input) {
  const draft = input.draft || {}
  const cover = draft.cover || {}
  const sections = Array.isArray(draft.sections) ? draft.sections : []
  const conflicts = Array.isArray(draft.sourceConflicts) ? draft.sourceConflicts : []
  const imageMap = new Map(
    (input.images || []).map((img) => [String(img.evidenceId), img])
  )

  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const brand = rgb(0.05, 0.22, 0.38)
  const ink = rgb(0.1, 0.12, 0.14)
  const muted = rgb(0.4, 0.43, 0.47)
  const rule = rgb(0.78, 0.8, 0.82)
  const warn = rgb(0.55, 0.35, 0.05)

  let logo = null
  const logoBytes = loadLogoBytes()
  if (logoBytes) {
    try {
      logo = await pdf.embedPng(logoBytes)
    } catch {
      try {
        logo = await pdf.embedJpg(logoBytes)
      } catch {
        logo = null
      }
    }
  }

  const pages = []
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  pages.push(page)
  let y = PAGE_HEIGHT - MARGIN

  const ensureSpace = (need) => {
    if (y - need < MARGIN + 40) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      pages.push(page)
      y = PAGE_HEIGHT - MARGIN
    }
  }

  const drawText = (text, opts = {}) => {
    const size = opts.size || 10
    const f = opts.bold ? fontBold : font
    const color = opts.color || ink
    const maxW = opts.maxWidth || CONTENT_WIDTH
    const lines = wrapText(text, f, size, maxW)
    for (const line of lines) {
      ensureSpace(size + 4)
      page.drawText(line, { x: opts.x || MARGIN, y, size, font: f, color })
      y -= size + 4
    }
  }

  // ── COVER ──────────────────────────────────────────────────────────────
  if (logo) {
    const maxW = 220
    const maxH = 72
    const scale = Math.min(maxW / logo.width, maxH / logo.height)
    const lw = logo.width * scale
    const lh = logo.height * scale
    page.drawImage(logo, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN - lh,
      width: lw,
      height: lh,
    })
    y = PAGE_HEIGHT - MARGIN - lh - 48
  } else {
    drawText('TENDERBRIEFING', { size: 16, bold: true, color: brand })
    y -= 24
  }

  y -= 20
  drawText(cover.title || 'TENDER BRIEFING REPORT', {
    size: 22,
    bold: true,
    color: brand,
  })
  y -= 16
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1.2,
    color: brand,
  })
  y -= 28

  const coverRows = [
    ['Tender / RFQ', cover.tenderNumber],
    ['Description', cover.tenderDescription],
    ['Issuing institution', cover.issuingInstitution],
    ['Prepared for', cover.preparedFor],
    ['Briefing date', cover.briefingDate],
    ['Prepared by', cover.preparedBy || 'TenderBriefing'],
  ]
  for (const [label, value] of coverRows) {
    ensureSpace(36)
    page.drawText(label, { x: MARGIN, y, size: 9, font, color: muted })
    y -= 14
    drawText(String(value || '—'), { size: 12, bold: true })
    y -= 10
  }

  // New page for content
  page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  pages.push(page)
  y = PAGE_HEIGHT - MARGIN

  if (conflicts.length) {
    ensureSpace(40)
    drawText('SOURCE CONFLICTS — REVIEW REQUIRED', { size: 11, bold: true, color: warn })
    for (const c of conflicts) {
      drawText(c.message || 'Conflict', { size: 9, color: warn })
    }
    y -= 12
  }

  const drawnAttendance = new Set()

  for (const section of sections) {
    // Prefer keeping heading with following content (reduce orphaned headings)
    const hasImages = Array.isArray(section.imageRefs) && section.imageRefs.length > 0
    ensureSpace(hasImages ? 120 : 56)
    drawText(section.title || 'Section', { size: 13, bold: true, color: brand })
    y -= 4
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.6,
      color: rule,
    })
    y -= 14

    if (Array.isArray(section.details)) {
      for (const row of section.details) {
        ensureSpace(28)
        page.drawText(`${row.label}:`, {
          x: MARGIN,
          y,
          size: 9,
          font: fontBold,
          color: muted,
        })
        const labelW = fontBold.widthOfTextAtSize(`${row.label}: `, 9)
        const valLines = wrapText(String(row.value || ''), font, 9, CONTENT_WIDTH - labelW)
        page.drawText(valLines[0] || '', {
          x: MARGIN + labelW,
          y,
          size: 9,
          font,
          color: ink,
        })
        y -= 12
        for (let i = 1; i < valLines.length; i++) {
          page.drawText(valLines[i], {
            x: MARGIN + labelW,
            y,
            size: 9,
            font,
            color: ink,
          })
          y -= 12
        }
      }
      y -= 6
    }

    for (const para of section.paragraphs || []) {
      drawText(para, { size: 10 })
      y -= 6
    }

    for (const bullet of section.bullets || []) {
      ensureSpace(20)
      const lines = wrapText(`•  ${bullet}`, font, 10, CONTENT_WIDTH)
      for (const line of lines) {
        ensureSpace(14)
        page.drawText(line, { x: MARGIN, y, size: 10, font, color: ink })
        y -= 14
      }
      y -= 2
    }

    // Images — attendance only once globally
    for (const ref of section.imageRefs || []) {
      if (section.id === 'proof_of_attendance') {
        if (drawnAttendance.has(ref.evidenceId)) continue
        drawnAttendance.add(ref.evidenceId)
      }
      const imgData = imageMap.get(String(ref.evidenceId))
      if (!imgData?.bytes) {
        drawText(`[Evidence on file: ${ref.fileName || ref.evidenceId}]`, {
          size: 9,
          color: muted,
        })
        continue
      }
      const embedded = await embedImage(pdf, imgData.bytes, imgData.mime)
      if (!embedded) {
        drawText(`[Attachment: ${ref.fileName || ref.evidenceId}]`, {
          size: 9,
          color: muted,
        })
        continue
      }
      const maxW = CONTENT_WIDTH
      const maxH = section.id === 'proof_of_attendance' ? 320 : 220
      const scale = Math.min(maxW / embedded.width, maxH / embedded.height)
      const iw = embedded.width * scale
      const ih = embedded.height * scale
      // Keep caption with image; avoid orphaning image on next page alone
      ensureSpace(ih + 36)
      const imgX = MARGIN + (CONTENT_WIDTH - iw) / 2
      page.drawImage(embedded, {
        x: imgX,
        y: y - ih,
        width: iw,
        height: ih,
      })
      y -= ih + 8
      const caption = String(ref.caption || ref.fileName || 'Evidence')
      const capSize = 8
      const capW = font.widthOfTextAtSize(caption, capSize)
      const capX = Math.max(MARGIN, imgX + (iw - capW) / 2)
      page.drawText(caption, {
        x: Math.min(capX, PAGE_WIDTH - MARGIN - Math.min(capW, CONTENT_WIDTH)),
        y,
        size: capSize,
        font,
        color: muted,
      })
      y -= 16
    }

    y -= 14
  }

  // Footers
  const total = pages.length
  pages.forEach((p, idx) => {
    p.drawLine({
      start: { x: MARGIN, y: MARGIN - 8 },
      end: { x: PAGE_WIDTH - MARGIN, y: MARGIN - 8 },
      thickness: 0.4,
      color: rule,
    })
    p.drawText(FOOTER, {
      x: MARGIN,
      y: MARGIN - 22,
      size: 8,
      font,
      color: muted,
    })
    const right = `Page ${idx + 1} of ${total}`
    const rw = font.widthOfTextAtSize(right, 8)
    p.drawText(right, {
      x: PAGE_WIDTH - MARGIN - rw,
      y: MARGIN - 22,
      size: 8,
      font,
      color: muted,
    })
  })

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

module.exports = {
  renderClientReportPdf,
  loadLogoBytes,
}
