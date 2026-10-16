/**
 * Editable DOCX export for Phase 11 client reports (docx package).
 */
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
} = require('docx')

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 160 },
    children: [
      new TextRun({
        text: String(text || ''),
        bold: opts.bold === true,
        italics: opts.italics === true,
        size: opts.size || 20,
        color: opts.color || '1A1F24',
        font: 'Calibri',
      }),
    ],
  })
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text: String(text || ''),
        bold: true,
        size: level === HeadingLevel.TITLE ? 36 : 26,
        color: '0D385F',
        font: 'Calibri',
      }),
    ],
  })
}

async function renderClientReportDocx(input) {
  const draft = input.draft || {}
  const cover = draft.cover || {}
  const sections = Array.isArray(draft.sections) ? draft.sections : []
  const conflicts = Array.isArray(draft.sourceConflicts) ? draft.sourceConflicts : []

  const children = []

  children.push(heading('TENDER BRIEFING REPORT', HeadingLevel.TITLE))
  children.push(para(`Tender / RFQ: ${cover.tenderNumber || '—'}`, { bold: true, size: 22 }))
  children.push(para(cover.tenderDescription || '—', { size: 20 }))
  children.push(para(`Issuing institution: ${cover.issuingInstitution || '—'}`))
  children.push(para(`Prepared for: ${cover.preparedFor || '—'}`))
  children.push(para(`Briefing date: ${cover.briefingDate || '—'}`))
  children.push(para(`Prepared by: ${cover.preparedBy || 'TenderBriefing'}`))
  children.push(
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 12, color: '0D385F' },
      },
      spacing: { after: 300 },
      children: [],
    })
  )

  if (conflicts.length) {
    children.push(heading('SOURCE CONFLICTS — REVIEW REQUIRED', HeadingLevel.HEADING_1))
    for (const c of conflicts) {
      children.push(para(c.message || 'Conflict', { color: '8B5A00', italics: true }))
    }
  }

  const drawnAttendance = new Set()
  for (const section of sections) {
    children.push(heading(section.title || 'Section', HeadingLevel.HEADING_1))
    for (const row of section.details || []) {
      children.push(
        para(`${row.label}: ${row.value}`, { size: 20 })
      )
    }
    for (const p of section.paragraphs || []) {
      children.push(para(p))
    }
    for (const b of section.bullets || []) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: `•  ${b}`, size: 20, font: 'Calibri', color: '1A1F24' }),
          ],
        })
      )
    }
    for (const ref of section.imageRefs || []) {
      if (section.id === 'proof_of_attendance') {
        if (drawnAttendance.has(ref.evidenceId)) continue
        drawnAttendance.add(ref.evidenceId)
      }
      children.push(
        para(`[Evidence: ${ref.caption || ref.fileName || ref.evidenceId}]`, {
          italics: true,
          color: '666666',
          size: 18,
        })
      )
    }
  }

  const doc = new Document({
    creator: 'TenderBriefing',
    title: `Tender Briefing Report — ${cover.tenderNumber || ''}`.trim(),
    description: 'TenderBriefing client briefing report',
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'TenderBriefing',
                    bold: true,
                    size: 18,
                    color: '0D385F',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'TenderBriefing · FIND. TRACK. WIN. · Page ',
                    size: 16,
                    color: '666666',
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '666666',
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: '666666',
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '666666',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  })

  return Buffer.from(await Packer.toBuffer(doc))
}

module.exports = {
  renderClientReportDocx,
}
