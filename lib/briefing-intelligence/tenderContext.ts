import type { Firestore } from 'firebase-admin/firestore'
import type { TenderContext } from '@/lib/briefing-intelligence/transcriptionService'

function toStringOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s ? s : null
}

export async function fetchAttendanceAndTenderContext(params: {
  db: Firestore
  requestId: string
  tenderId: string
  reportId: string
}): Promise<TenderContext> {
  const { db, requestId, tenderId, reportId } = params

  const [reqSnap, tenderSnap] = await Promise.all([
    db.collection('attendanceRequests').doc(requestId).get(),
    db.collection('tenderBriefings').doc(tenderId).get(),
  ])

  const req = reqSnap.data() as any
  const tender = tenderSnap.data() as any

  return {
    reportId,
    tenderTitle: String(tender?.title || tender?.tenderTitle || req?.tenderTitle || ''),
    tenderReference: String(
      tender?.tenderNumber || tender?.tenderReference || req?.tenderNumber || req?.tenderReference || ''
    ),
    issuingEntity: String(
      tender?.department || tender?.issuer || tender?.issuingEntity || req?.department || ''
    ),
    briefingDate: String(tender?.briefingDate || req?.briefingDate || ''),
    briefingVenue: String(tender?.briefingVenue || req?.briefingVenue || ''),
    description: toStringOrNull(tender?.description || tender?.detail || tender?.summary || null),
    closingDate: toStringOrNull(tender?.closingDate || null),
    estimatedValue: toStringOrNull(tender?.estimatedValue || tender?.estimatedValueLabel || null),
    category: toStringOrNull(tender?.industrySector || tender?.category || null),
    province: toStringOrNull(tender?.province || req?.province || null),
  }
}
