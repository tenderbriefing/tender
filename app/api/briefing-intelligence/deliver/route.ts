import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import type { BriefingIntelligenceReport } from '@/lib/briefing-intelligence/types'
import { logBriefingIntelligenceAuditEvent } from '@/lib/briefing-intelligence/auditService'
import transactionalEmailService from '@/lib/services/transactionalEmailService'

export const dynamic = 'force-dynamic'

function nowIso() {
  return new Date().toISOString()
}

function escapePdfText(text: string) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .slice(0, 2000)
}

function buildMinimalPdf(lines: string[], opts: { startY: number; lineHeight: number }) {
  const { startY, lineHeight } = opts
  const content = lines
    .map((line, i) => `BT /F1 11 Tf 50 ${startY - i * lineHeight} Td (${escapePdfText(line)}) Tj ET`)
    .join('\n')
  const stream = `stream\n${content}\nendstream`
  const len = Buffer.byteLength(stream, 'utf8')
  return Buffer.from(
    `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length ${len} >>${stream}
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000264 00000 n 
0000000400 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
480
%%EOF`,
    'utf8'
  )
}

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  const body = await request.json()
  const reportId = String(body?.reportId || '')
  if (!reportId) {
    return NextResponse.json({ success: false, error: 'reportId is required' }, { status: 400 })
  }

  const admin = getFirebaseAdmin()
  const db = admin.firestore()
  const reportRef = db.collection('briefingIntelligenceReports').doc(reportId)
  const snap = await reportRef.get()
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
  }

  const report = snap.data() as BriefingIntelligenceReport
  if (report.status === 'delivered') {
    return NextResponse.json({ success: true, data: { reportId, skipped: true } })
  }

  if (report.status !== 'final') {
    return NextResponse.json(
      { success: false, error: `Cannot deliver from status ${report.status}` },
      { status: 409 }
    )
  }

  const now = nowIso()
  const bucket = admin.storage().bucket()
  const pdfPath = `briefing-intelligence/${reportId}/pdf/${reportId}.pdf`

  const tenderSnap = await db.collection('tenderBriefings').doc(report.tenderId).get()
  const tender = tenderSnap.data() as any

  const smeSnap = await db.collection('users').doc(report.smeId).get()
  const sme = smeSnap.data() as any
  const smeEmail = String(sme?.email || '').trim()

  const c = report.reportContent
  const cd = c?.coverHeader
  const td = c?.tenderDetails
  const ed = c?.executiveSummary

  const pdfLines: string[] = []
  pdfLines.push('TenderBriefing — Briefing Intelligence Report')
  pdfLines.push(`Report ID: ${reportId}`)
  pdfLines.push(`Tender: ${cd?.tenderTitle || tender?.title || '—'}`)
  pdfLines.push(`Tender reference: ${cd?.tenderReference || tender?.tenderNumber || '—'}`)
  pdfLines.push(`Issuing entity: ${cd?.issuingEntity || '—'}`)
  pdfLines.push(`Briefing date: ${cd?.briefingDate || '—'} • Venue: ${cd?.briefingVenue || '—'}`)
  pdfLines.push(`Report date: ${cd?.reportDate || '—'}`)
  pdfLines.push('')

  pdfLines.push('Tender Details')
  pdfLines.push(`Description: ${td?.description || '—'}`)
  pdfLines.push(`Closing date: ${td?.closingDate || '—'}`)
  pdfLines.push(`Estimated value: ${td?.estimatedValue || '—'}`)
  pdfLines.push(`Category: ${td?.category || '—'}`)
  pdfLines.push(`Province: ${td?.province || '—'}`)
  pdfLines.push('')

  pdfLines.push('Executive Summary + Key Takeaway')
  pdfLines.push(ed?.summary || '—')
  pdfLines.push(`Key takeaway: ${ed?.keyTakeaway || '—'}`)
  pdfLines.push('')

  pdfLines.push('Key Requirements')
  if (Array.isArray(c?.keyRequirements) && c.keyRequirements.length > 0) {
    for (const r of c.keyRequirements.slice(0, 25)) {
      pdfLines.push(`• [${r.source || 'stated'}] ${r.requirement}`)
    }
  } else {
    pdfLines.push('—')
  }
  pdfLines.push('')

  pdfLines.push('Clarifications')
  if (Array.isArray(c?.clarifications) && c.clarifications.length > 0) {
    for (const cl of c.clarifications.slice(0, 20)) {
      pdfLines.push(`• (${cl.source || 'not_discussed'}) Q: ${cl.question}`)
      pdfLines.push(`  A: ${cl.answer}`)
    }
  } else {
    pdfLines.push('—')
  }
  pdfLines.push('')

  pdfLines.push('Q&A')
  if (Array.isArray(c?.questionsAndAnswers) && c.questionsAndAnswers.length > 0) {
    for (const qa of c.questionsAndAnswers.slice(0, 20)) {
      pdfLines.push(`• Q: ${qa.question}`)
      pdfLines.push(`  A: ${qa.answer}`)
    }
  } else {
    pdfLines.push('—')
  }
  pdfLines.push('')

  pdfLines.push('Changes/Addenda')
  if (Array.isArray(c?.changesAndAddenda) && c.changesAndAddenda.length > 0) {
    for (const ch of c.changesAndAddenda.slice(0, 20)) {
      pdfLines.push(`• Change: ${ch.change}`)
      if (ch.impact) pdfLines.push(`  Impact: ${ch.impact}`)
    }
  } else {
    pdfLines.push('—')
  }
  pdfLines.push('')

  pdfLines.push('Compliance Risks')
  if (Array.isArray(c?.complianceRisks) && c.complianceRisks.length > 0) {
    for (const r of c.complianceRisks.slice(0, 20)) {
      pdfLines.push(`• [${r.severity || 'medium'}] ${r.risk}`)
      if (r.mitigation) pdfLines.push(`  Mitigation: ${r.mitigation}`)
    }
  } else {
    pdfLines.push('—')
  }
  pdfLines.push('')

  pdfLines.push('Key Dates')
  if (Array.isArray(c?.keyDates) && c.keyDates.length > 0) {
    for (const d of c.keyDates.slice(0, 20)) {
      pdfLines.push(`• ${d.date}: ${d.description}`)
    }
  } else {
    pdfLines.push('—')
  }
  pdfLines.push('')

  pdfLines.push('Recommended Actions')
  if (Array.isArray(c?.recommendedActions) && c.recommendedActions.length > 0) {
    for (const a of c.recommendedActions.slice(0, 20)) {
      pdfLines.push(`• (${a.priority || 'medium'}) ${a.action}${a.deadline ? ` — Deadline: ${a.deadline}` : ''}`)
    }
  } else {
    pdfLines.push('—')
  }
  pdfLines.push('')

  pdfLines.push('Attendance Info')
  pdfLines.push(`Estimated attendees: ${c?.attendanceInfo?.estimatedAttendees ?? '—'}`)
  pdfLines.push(`Agent arrival time: ${c?.attendanceInfo?.agentArrivalTime || '—'}`)
  pdfLines.push(`Briefing duration: ${c?.attendanceInfo?.briefingDuration || '—'}`)
  pdfLines.push('')

  pdfLines.push('Attendance Verification')
  pdfLines.push(`Verified: ${c?.attendanceVerification?.verified ? 'Yes' : 'No'}`)
  pdfLines.push(`Method: ${c?.attendanceVerification?.method || '—'}`)
  if (c?.attendanceVerification?.redactedAttendeeCount != null) {
    pdfLines.push(`Redacted attendee count: ${c.attendanceVerification.redactedAttendeeCount}`)
  }
  if (c?.attendanceVerification?.notes) pdfLines.push(`Notes: ${c.attendanceVerification.notes}`)
  pdfLines.push('')

  pdfLines.push('Agent Field Observations')
  const avo = c?.agentFieldObservations
  pdfLines.push(`Site inspection: ${avo?.siteInspection == null ? '—' : avo.siteInspection ? 'Yes' : 'No'}`)
  pdfLines.push(`Docs distributed: ${avo?.docsDistributed == null ? '—' : avo.docsDistributed ? 'Yes' : 'No'}`)
  pdfLines.push(
    `Important announcement: ${avo?.importantAnnouncement == null ? '—' : avo.importantAnnouncement ? 'Yes' : 'No'}`
  )
  if (avo?.generalNotes) pdfLines.push(`General notes: ${avo.generalNotes}`)
  pdfLines.push('')

  pdfLines.push('Source & Verification')
  const sva = c?.sourceAndVerification
  pdfLines.push(`Audio recorded: ${sva?.audioRecorded == null ? '—' : sva.audioRecorded ? 'Yes' : 'No'}`)
  pdfLines.push(`Transcription provider: ${sva?.transcriptionProvider || '—'}`)
  pdfLines.push(`AI model: ${sva?.aiModel || '—'}`)
  pdfLines.push(`Processing date: ${sva?.processingDate || '—'}`)
  pdfLines.push(`Confidence score: ${sva?.confidenceScore ?? '—'}`)
  pdfLines.push('')

  pdfLines.push('Important Notice')
  pdfLines.push(c?.importantNotice || '—')
  pdfLines.push('')

  pdfLines.push('Report Certification')
  const cert = c?.reportCertification
  pdfLines.push(`Certified by: ${cert?.certifiedBy || '—'}`)
  pdfLines.push(`Certification date: ${cert?.certificationDate || '—'}`)
  pdfLines.push(`Version: ${cert?.reportVersion || '—'}`)
  pdfLines.push('')

  pdfLines.push(`Header/footer: TenderBriefing • ${reportId}`)
  pdfLines.push('Page 1 of 1')

  // Single-page PDF to keep server-side generation deterministic & lightweight.
  const cappedLines = pdfLines.slice(0, 46)
  const pdfBuffer = buildMinimalPdf(cappedLines, { startY: 770, lineHeight: 14 })

  await bucket
    .file(pdfPath)
    .save(pdfBuffer, {
      contentType: 'application/pdf',
      metadata: {
        uploadedBy: user.uid,
        reportId,
        requestId: report.requestId,
      },
      resumable: false,
    })

  // Transactional email (fail-soft).
  let emailId: string | null = null
  if (smeEmail) {
    const emailInput = {
      requestId: report.requestId,
      smeId: report.smeId,
      tenderTitle: report.reportContent?.coverHeader?.tenderTitle || tender?.title || 'Untitled tender',
      tenderNumber: report.reportContent?.coverHeader?.tenderReference || tender?.tenderNumber || '',
      briefingDate: report.reportContent?.coverHeader?.briefingDate || null,
      briefingDateLabel: report.reportContent?.coverHeader?.briefingDate || null,
      reportSubmittedAt: now,
      reportSubmittedAtLabel: now,
    }

    try {
      const res = await transactionalEmailService.sendViaResend({
        to: smeEmail,
        templateId: 'briefing_report_ready',
        input: emailInput,
        idempotencyKey: `BI_INTEL_DELIVER:${reportId}`,
      })
      if (res?.sent && res?.id) {
        emailId = String(res.id)
      }
    } catch {
      // Intentionally fail-soft: delivery record should still be created.
      emailId = null
    }
  }

  await reportRef.set(
    {
      status: 'delivered',
      deliveredAt: now,
      pdfStorageRef: pdfPath,
      deliveryEmailId: emailId,
      updatedAt: now,
    },
    { merge: true }
  )

  await logBriefingIntelligenceAuditEvent({
    db,
    eventType: 'delivered',
    reportId,
    requestId: report.requestId,
    agentId: report.agentId,
    smeId: report.smeId,
    actorUid: user.uid,
    actorRole: 'admin',
    nextStatus: 'delivered',
    meta: { pdfPath, emailSent: Boolean(emailId) },
  })

  return NextResponse.json({ success: true, data: { reportId } })
}

