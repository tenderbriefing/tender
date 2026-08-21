import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage, type PDFFont } from 'pdf-lib'
import type { StructuredMeetingMinutesReport } from './meetingMinutesTypes'
import { stripSpeakerLabels } from './meetingMinutesTypes'
import fs from 'fs'
import path from 'path'

const PAGE_WIDTH = 595.28 // A4
const PAGE_HEIGHT = 841.89
const MARGIN = 48
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER = 'TenderBriefing | FIND. TRACK. WIN.'

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  if (!words.length) return []
  const lines: string[] = []
  let current = words[0]
  for (let i = 1; i < words.length; i++) {
    const trial = `${current} ${words[i]}`
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      current = trial
    } else {
      lines.push(current)
      current = words[i]
    }
  }
  lines.push(current)
  return lines
}

export type MeetingMinutesPdfInput = {
  report: StructuredMeetingMinutesReport
  logoBytes?: Uint8Array | null
  attendanceImageBytes?: Uint8Array | null
  attendanceMime?: string | null
  reportId: string
}

async function embedAttendance(
  pdf: PDFDocument,
  bytes: Uint8Array,
  mime: string | null | undefined
): Promise<PDFImage | null> {
  try {
    const m = (mime || '').toLowerCase()
    if (m.includes('png') || (!m && bytes[0] === 0x89)) {
      return await pdf.embedPng(bytes)
    }
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

export async function loadDefaultLogoBytes(): Promise<Uint8Array | null> {
  try {
    const p = path.join(process.cwd(), 'public', 'brand', 'logo.png')
    return fs.readFileSync(p)
  } catch {
    return null
  }
}

/**
 * Render a concise ~2-page A4 meeting-minutes PDF with TenderBriefing branding.
 * No speaker labels. Official metadata on cover. Attendance image when available.
 */
export async function renderMeetingMinutesPdf(input: MeetingMinutesPdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const brandBlue = rgb(0.12, 0.27, 0.45)
  const ink = rgb(0.12, 0.14, 0.16)
  const muted = rgb(0.35, 0.38, 0.42)

  let logo: PDFImage | null = null
  if (input.logoBytes) {
    try {
      logo = await pdf.embedPng(input.logoBytes)
    } catch {
      try {
        logo = await pdf.embedJpg(input.logoBytes)
      } catch {
        logo = null
      }
    }
  }

  let attendance: PDFImage | null = null
  if (input.attendanceImageBytes) {
    attendance = await embedAttendance(pdf, input.attendanceImageBytes, input.attendanceMime)
  }

  const r = input.report
  const pages: PDFPage[] = []
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  pages.push(page)
  let y = PAGE_HEIGHT - MARGIN

  const ensureSpace = (need: number) => {
    if (y - need < MARGIN + 36) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      pages.push(page)
      y = PAGE_HEIGHT - MARGIN
    }
  }

  const drawFooter = (p: PDFPage, pageIndex: number, total: number) => {
    p.drawText(FOOTER, {
      x: MARGIN,
      y: 28,
      size: 8,
      font,
      color: muted,
    })
    const label = `Page ${pageIndex} of ${total}`
    const w = font.widthOfTextAtSize(label, 8)
    p.drawText(label, {
      x: PAGE_WIDTH - MARGIN - w,
      y: 28,
      size: 8,
      font,
      color: muted,
    })
  }

  // Header
  if (logo) {
    const maxH = 36
    const scale = maxH / logo.height
    const w = logo.width * scale
    page.drawImage(logo, {
      x: MARGIN,
      y: y - maxH,
      width: w,
      height: maxH,
    })
    y -= maxH + 10
  } else {
    page.drawText('TENDERBRIEFING', {
      x: MARGIN,
      y: y - 16,
      size: 16,
      font: fontBold,
      color: brandBlue,
    })
    y -= 28
  }

  page.drawText('COMPULSORY BRIEFING SESSION REPORT', {
    x: MARGIN,
    y: y - 14,
    size: 13,
    font: fontBold,
    color: ink,
  })
  y -= 28

  const metaLines = [
    `Tender: ${r.cover.tenderTitle}`,
    r.cover.tenderNumber ? `Tender number: ${r.cover.tenderNumber}` : null,
    `Department: ${r.cover.department}`,
    `Briefing date: ${r.cover.briefingDate}`,
    `Venue: ${r.cover.briefingVenue}`,
    `Prepared by: ${r.cover.preparedBy}`,
  ].filter(Boolean) as string[]

  for (const line of metaLines) {
    ensureSpace(14)
    page.drawText(line.slice(0, 110), {
      x: MARGIN,
      y: y - 11,
      size: 9,
      font,
      color: muted,
    })
    y -= 14
  }
  y -= 8

  const section = (title: string, bodyLines: string[]) => {
    if (!bodyLines.length) return
    ensureSpace(28)
    page.drawText(title, {
      x: MARGIN,
      y: y - 12,
      size: 11,
      font: fontBold,
      color: brandBlue,
    })
    y -= 18
    for (const raw of bodyLines) {
      const text = stripSpeakerLabels(raw)
      if (!text) continue
      const wrapped = wrapText(text, font, 9.5, CONTENT_WIDTH)
      for (const line of wrapped) {
        ensureSpace(13)
        page.drawText(line, {
          x: MARGIN,
          y: y - 10,
          size: 9.5,
          font,
          color: ink,
        })
        y -= 13
      }
      y -= 4
    }
    y -= 6
  }

  const bullets = (title: string, items: string[]) => {
    if (!items.length) return
    section(
      title,
      items.map((i) => `• ${stripSpeakerLabels(i)}`)
    )
  }

  section('1. Purpose of the Briefing', [r.purposeOfBriefing])
  bullets('2. What the Department Explained', r.whatDepartmentExplained)
  bullets('3. Priority Deliverables', r.priorityDeliverables)
  bullets('4. Scope / Project Clarifications', r.scopeClarifications)
  bullets('5. Work Expected From the Successful Service Provider', r.workExpected)
  if (r.experienceRequired) section('6. Experience Required', [r.experienceRequired])

  if (r.questionsAndClarifications.length) {
    ensureSpace(28)
    page.drawText('7. Questions and Clarifications', {
      x: MARGIN,
      y: y - 12,
      size: 11,
      font: fontBold,
      color: brandBlue,
    })
    y -= 18
    for (const q of r.questionsAndClarifications) {
      const heading = stripSpeakerLabels(q.heading)
      const summary = stripSpeakerLabels(q.summary)
      if (heading) {
        const hw = wrapText(heading, fontBold, 9.5, CONTENT_WIDTH)
        for (const line of hw) {
          ensureSpace(13)
          page.drawText(line, { x: MARGIN, y: y - 10, size: 9.5, font: fontBold, color: ink })
          y -= 13
        }
      }
      for (const line of wrapText(summary, font, 9.5, CONTENT_WIDTH)) {
        ensureSpace(13)
        page.drawText(line, { x: MARGIN, y: y - 10, size: 9.5, font, color: ink })
        y -= 13
      }
      y -= 6
    }
    y -= 4
  }

  if (r.registrationAndCompliance) {
    section('8. Registration and Compliance', [r.registrationAndCompliance])
  }
  if (r.durationAndTimelines) {
    section('9. Duration and Timelines', [r.durationAndTimelines])
  }

  // Amendments — high commercial priority
  {
    ensureSpace(28)
    page.drawText('Amendments, Clarifications & Changes', {
      x: MARGIN,
      y: y - 12,
      size: 11,
      font: fontBold,
      color: brandBlue,
    })
    y -= 18
    const amendments = Array.isArray(r.amendments) ? r.amendments : []
    if (amendments.length === 0) {
      const msg =
        r.amendmentsNoneMessage ||
        'No material amendments or changes were identified from the briefing recording reviewed.'
      for (const line of wrapText(msg, font, 9.5, CONTENT_WIDTH)) {
        ensureSpace(13)
        page.drawText(line, { x: MARGIN, y: y - 10, size: 9.5, font, color: ink })
        y -= 13
      }
      y -= 6
    } else {
      for (let i = 0; i < amendments.length; i++) {
        const a = amendments[i]
        ensureSpace(40)
        page.drawText(`Item ${i + 1}`, {
          x: MARGIN,
          y: y - 10,
          size: 9,
          font: fontBold,
          color: muted,
        })
        y -= 14
        const blocks: Array<[string, string]> = [
          ['Tender requirement', stripSpeakerLabels(a.tenderRequirement)],
          ['Briefing clarification/change', stripSpeakerLabels(a.briefingChange)],
          ['Bidder implication', stripSpeakerLabels(a.bidderImplication)],
        ]
        for (const [label, value] of blocks) {
          if (!value) continue
          ensureSpace(14)
          page.drawText(`${label}:`, {
            x: MARGIN,
            y: y - 10,
            size: 9,
            font: fontBold,
            color: ink,
          })
          y -= 12
          for (const line of wrapText(value, font, 9.5, CONTENT_WIDTH)) {
            ensureSpace(13)
            page.drawText(line, { x: MARGIN, y: y - 10, size: 9.5, font, color: ink })
            y -= 13
          }
          y -= 2
        }
        y -= 6
      }
    }
  }

  if (r.mainPoints.length) {
    ensureSpace(28)
    page.drawText('10. Main Points to Remember', {
      x: MARGIN,
      y: y - 12,
      size: 11,
      font: fontBold,
      color: brandBlue,
    })
    y -= 18
    // Simple two-column table header
    ensureSpace(16)
    page.drawText('Matter', { x: MARGIN, y: y - 10, size: 9, font: fontBold, color: muted })
    page.drawText('What Was Said', {
      x: MARGIN + 160,
      y: y - 10,
      size: 9,
      font: fontBold,
      color: muted,
    })
    y -= 14
    for (const row of r.mainPoints) {
      const matterLines = wrapText(stripSpeakerLabels(row.matter), font, 9, 150)
      const detailLines = wrapText(stripSpeakerLabels(row.detail), font, 9, CONTENT_WIDTH - 160)
      const rows = Math.max(matterLines.length, detailLines.length)
      ensureSpace(rows * 12 + 4)
      for (let i = 0; i < rows; i++) {
        if (matterLines[i]) {
          page.drawText(matterLines[i], {
            x: MARGIN,
            y: y - 10,
            size: 9,
            font,
            color: ink,
          })
        }
        if (detailLines[i]) {
          page.drawText(detailLines[i], {
            x: MARGIN + 160,
            y: y - 10,
            size: 9,
            font,
            color: ink,
          })
        }
        y -= 12
      }
      y -= 4
    }
    y -= 6
  }

  // Closing
  const closingBits = [
    r.closingDate ? `Tender closing date: ${r.closingDate}` : null,
    r.closingTime ? `Tender closing time: ${r.closingTime}` : null,
    r.briefingCertificateNote,
  ].filter(Boolean) as string[]
  if (closingBits.length) section('Closing', closingBits)

  // Attendance
  ensureSpace(28)
  page.drawText('11. Attendance Evidence', {
    x: MARGIN,
    y: y - 12,
    size: 11,
    font: fontBold,
    color: brandBlue,
  })
  y -= 18
  if (r.attendanceNote) {
    for (const line of wrapText(r.attendanceNote, font, 9, CONTENT_WIDTH)) {
      ensureSpace(12)
      page.drawText(line, { x: MARGIN, y: y - 10, size: 9, font, color: muted })
      y -= 12
    }
    y -= 6
  }

  if (attendance) {
    const maxW = CONTENT_WIDTH
    const maxH = 220
    const scale = Math.min(maxW / attendance.width, maxH / attendance.height, 1)
    const w = attendance.width * scale
    const h = attendance.height * scale
    ensureSpace(h + 8)
    page.drawImage(attendance, {
      x: MARGIN,
      y: y - h,
      width: w,
      height: h,
    })
    y -= h + 8
  } else {
    ensureSpace(14)
    page.drawText('Attendance photograph was not available for embedding in this PDF.', {
      x: MARGIN,
      y: y - 10,
      size: 9,
      font,
      color: muted,
    })
    y -= 14
  }

  const allPages = pdf.getPages()
  allPages.forEach((p, idx) => drawFooter(p, idx + 1, allPages.length))

  const bytes = await pdf.save({ useObjectStreams: false })
  return Buffer.from(bytes)
}

export function sanitizeReportFileName(parts: {
  tenderNumber?: string | null
  reportId: string
}): string {
  const raw = parts.tenderNumber || parts.reportId
  const safe = String(raw)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80)
  return `TenderBriefing_${safe}_Briefing_Report.pdf`
}
