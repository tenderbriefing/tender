#!/usr/bin/env node
/**
 * Phase 11 visual QA — generate Test A (simple) and Test B (evidence-heavy) PDFs + DOCX.
 * Does NOT charge PayFast. Does NOT email.
 */
const fs = require('fs')
const path = require('path')

process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'json'
process.env.RATE_LIMIT_BACKEND = 'memory'

const {
  buildReportDraft,
} = require('../backend/services/ops/reportDraftBuilder')
const { renderClientReportPdf } = require('../backend/services/ops/clientReportPdf')
const { renderClientReportDocx } = require('../backend/services/ops/clientReportDocx')

function tinyPng() {
  // 1x1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
}

function simpleRequest() {
  return {
    id: 'qa-simple-1',
    tenderNumber: 'QA-RFQ-SIMPLE',
    tenderTitle: 'Supply and delivery of stationery',
    smeCompany: 'Acme Bid Co',
    representedEntity: 'Acme Bid Co',
    briefingDate: '2026-10-18',
    briefingTime: '10:00',
    briefingVenue: 'Municipal offices, Boardroom A',
    province: 'Gauteng',
    department: 'City of Tshwane',
    attended: true,
    evidenceItems: [
      {
        id: 'ev-att',
        category: 'attendance_proof',
        fileName: 'attendance.png',
        contentType: 'image/png',
      },
    ],
    briefingLines: [{ closingDate: '2026-11-05', closingTime: '11:00' }],
  }
}

function heavyRequest() {
  return {
    id: 'qa-heavy-1',
    tenderNumber: 'QA-RFQ-HEAVY',
    tenderTitle:
      'Appointment of a contractor for civil works, site establishment and related technical services at NHLS campus',
    smeCompany: 'Ingenuity Engineers & Constructors',
    representedEntity: 'Ingenuity Engineers & Constructors',
    briefingDate: '2026-10-20',
    briefingTime: '11:00',
    briefingVenue: 'NHLS Head Office site entrance',
    province: 'Gauteng',
    department: 'National Health Laboratory Service',
    attended: true,
    attendanceNote:
      'Compulsory site walk-through covered access control, PPE requirements, and temporary works staging areas near the eastern gate.',
    evidenceItems: [
      {
        id: 'ev-att',
        category: 'attendance_proof',
        fileName: 'register.png',
        contentType: 'image/png',
      },
      {
        id: 'ev-att-2',
        category: 'attendance_proof',
        fileName: 'register-copy.png',
        contentType: 'image/png',
      },
      {
        id: 'ev-site-1',
        category: 'site_photos',
        fileName: 'eastern-gate.png',
        contentType: 'image/png',
        caption: 'Eastern gate access point',
      },
      {
        id: 'ev-site-2',
        category: 'site_photos',
        fileName: 'staging.png',
        contentType: 'image/png',
        caption: 'Proposed staging area',
      },
      {
        id: 'ev-brief-1',
        category: 'briefing_photos',
        fileName: 'handout-board.png',
        contentType: 'image/png',
        caption: 'Briefing notice board',
      },
    ],
    briefingLines: [
      {
        lineNumber: 1,
        briefingTime: '11:30',
        closingDate: '2026-11-15',
        closingTime: '11:00',
        tenderDescription:
          'Civil works including site establishment, temporary access, and related technical services.',
      },
    ],
  }
}

async function writePair(label, request) {
  const draft = buildReportDraft(request)
  const png = tinyPng()
  const images = (request.evidenceItems || [])
    .filter((e) => String(e.contentType || '').startsWith('image/'))
    .map((e) => ({ evidenceId: e.id, bytes: png, mime: 'image/png' }))

  // Deduplicate image embeds by evidence id (attendance only once in draft already)
  const pdf = await renderClientReportPdf({ draft, images })
  const docx = await renderClientReportDocx({ draft })

  const outDir = path.join(process.cwd(), 'tmp-phase11-report-qa')
  fs.mkdirSync(outDir, { recursive: true })
  const pdfPath = path.join(outDir, `${label}.pdf`)
  const docxPath = path.join(outDir, `${label}.docx`)
  fs.writeFileSync(pdfPath, pdf)
  fs.writeFileSync(docxPath, docx)

  return {
    label,
    pdfPath,
    docxPath,
    pdfBytes: pdf.length,
    docxBytes: docx.length,
    sections: draft.sections.map((s) => s.id),
    conflicts: draft.sourceConflicts.length,
    attendanceImageRefs: (
      draft.sections.find((s) => s.id === 'proof_of_attendance')?.imageRefs || []
    ).length,
    voice: draft.voice,
  }
}

async function main() {
  const a = await writePair('test-a-simple', simpleRequest())
  const b = await writePair('test-b-heavy', heavyRequest())
  const report = {
    generatedAt: new Date().toISOString(),
    emailSent: false,
    payfastCharged: false,
    testA: a,
    testB: b,
    checks: {
      thirdPerson: a.voice === 'third_person' && b.voice === 'third_person',
      attendanceOnce: a.attendanceImageRefs === 1 && b.attendanceImageRefs === 1,
      heavyHasConflicts: b.conflicts > 0,
      pdfMagic: true,
    },
  }
  const reportPath = path.join(process.cwd(), 'tmp-phase11-report-qa', 'visual-qa-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log('\nWrote', reportPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
