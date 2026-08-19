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

function buildMinimalPdf(lines: string[]) {
  const content = lines
    .map((line, i) => `BT /F1 11 Tf 50 ${750 - i * 16} Td (${escapePdfText(line)}) Tj ET`)
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

  const summaryLines: string[] = [
    'TenderBriefing — Briefing Intelligence Report',
    `Report ID: ${reportId}`,
    `Tender: ${report.reportContent?.coverHeader?.tenderTitle || tender?.title || ''}`,
    `Reference: ${report.reportContent?.coverHeader?.tenderReference || tender?.tenderNumber || ''}`,
    `Briefing date: ${report.reportContent?.coverHeader?.briefingDate || ''}`,
    '',
    'Executive summary:',
    report.reportContent?.executiveSummary?.summary || '—',
    '',
    'Key takeaway:',
    report.reportContent?.executiveSummary?.keyTakeaway || '—',
  ]

  const pdfBuffer = buildMinimalPdf(summaryLines)

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

