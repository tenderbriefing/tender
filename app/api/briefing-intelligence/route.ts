import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import type { BriefingIntelligenceReport, BriefingReport, ReportStatus } from '@/lib/briefing-intelligence/types'

export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

const ALLOWED_STATUSES: ReportStatus[] = [
  'awaiting_evidence',
  'evidence_uploaded',
  'processing',
  'draft_report',
  'agent_review',
  'final',
  'delivered',
  'processing_failed',
]

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin', 'youth-agent', 'sme'])
  if (!user) return unauthorizedResponse('Sign-in required')

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status') || undefined
  const limitParam = searchParams.get('limit') || undefined
  const cursorParam = searchParams.get('cursor') || undefined
  const slaBreachedParam = searchParams.get('slaBreached') || undefined

  const pageSizeRaw = limitParam ? Number(limitParam) : DEFAULT_PAGE_SIZE
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.max(1, Math.min(MAX_PAGE_SIZE, pageSizeRaw)) : DEFAULT_PAGE_SIZE

  const status = statusParam && ALLOWED_STATUSES.includes(statusParam as ReportStatus) ? (statusParam as ReportStatus) : undefined
  const slaBreached =
    slaBreachedParam === 'true'
      ? true
      : slaBreachedParam === 'false'
        ? false
        : undefined

  const admin = getFirebaseAdmin()
  const db = admin.firestore()

  let q: any = db.collection('briefingIntelligenceReports')
  if (user.userType === 'youth-agent') q = q.where('agentId', '==', user.uid)
  if (user.userType === 'sme') q = q.where('smeId', '==', user.uid)
  if (status) q = q.where('status', '==', status)

  q = q.orderBy('createdAt', 'desc')
  if (cursorParam) {
    const cursorSnap = await db.collection('briefingIntelligenceReports').doc(cursorParam).get()
    if (cursorSnap.exists) q = q.startAfter(cursorSnap)
  }

  const snap = await q.limit(pageSize).get()
  const reports: BriefingReport[] = snap.docs.map((d: any) => {
    const base = d.data() as BriefingIntelligenceReport
    const report: BriefingReport = {
      ...base,
      id: d.id,
      reviewNotes: base.agentReviewNotes,
      content: base.reportContent,
      slaDueAt: base.slaDeadline,
      slaDeadlineAt: base.slaDeadline,
      date: base.finalizedAt || base.draftReadyAt || base.evidenceSubmittedAt || base.createdAt,
      tenderTitle: base.reportContent?.coverHeader?.tenderTitle || null,
      tenderNumber: base.reportContent?.coverHeader?.tenderReference || null,
      tender:
        base.reportContent?.coverHeader?.tenderTitle || base.reportContent?.coverHeader?.tenderReference
          ? {
              title: base.reportContent?.coverHeader?.tenderTitle || null,
              tenderNumber: base.reportContent?.coverHeader?.tenderReference || null,
            }
          : undefined,
    }
    return report
  })

  const filteredReports =
    typeof slaBreached === 'boolean' ? reports.filter((r) => r.slaBreached === slaBreached) : reports

  const last = filteredReports[filteredReports.length - 1]
  const nextCursor = filteredReports.length === pageSize ? last?.id || null : null

  return NextResponse.json({
    success: true,
    data: filteredReports,
    pageInfo: {
      pageSize,
      cursor: cursorParam || null,
      nextCursor,
      status: status || null,
    },
  })
}

