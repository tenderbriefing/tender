import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/verifyApiUser'
import { isBriefingFollowUpUpdatesEnabled } from '@/lib/privateTenders/briefingOpsFlags'
import type { AttendanceRequest } from '@/lib/tenderBriefing/types'

export const dynamic = 'force-dynamic'

/**
 * Phase 3G — SME briefing-service history (bookings + approved follow-ups).
 * Not a bid-management workspace.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), ['sme', 'admin'])
    if (!user) return unauthorizedResponse()
    if (user.userType !== 'sme' && user.userType !== 'admin') return forbiddenResponse()

    const { backend } = await import('@/lib/backend/loadServices')
    const storage = backend.getStorage()
    const smeId = user.userType === 'admin'
      ? new URL(request.url).searchParams.get('smeId') || user.uid
      : user.uid

    const requests = await storage.getAttendanceRequests({ smeId })
    const history = (requests || []).map((r) => {
      const snap = (r as { briefingSnapshot?: { briefingDate?: string; briefingVenue?: string } })
        .briefingSnapshot
      const row = r as AttendanceRequest & {
        source?: string
        privateTenderId?: string | null
        organisationId?: string | null
        createdAt?: string
        tenderNumber?: string
      }
      return {
        id: row.id,
        tenderId: row.tenderId,
        tenderTitle: row.tenderTitle,
        tenderNumber: row.tenderNumber,
        briefingDate: row.briefingDate || snap?.briefingDate,
        briefingVenue: row.briefingVenue || snap?.briefingVenue,
        bookingDate: row.createdAt,
        paymentStatus: row.paymentStatus,
        status: row.status,
        source: row.source || (row.privateTenderId ? 'private_tender' : 'public_tender'),
        privateTenderId: row.privateTenderId || null,
        organisationId: row.organisationId || null,
        pricingVersion: row.pricingVersion || null,
        briefingPriceCents: row.briefingPriceCents || row.paymentAmount || null,
      }
    })

    let followUps: unknown[] = []
    if (isBriefingFollowUpUpdatesEnabled()) {
      try {
        const svc = require('../../../../backend/services/briefingFollowUpUpdateService.js')
        followUps = await svc.listFollowUpUpdates({ smeId, approvedOnly: true })
      } catch {
        followUps = []
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        briefings: history,
        followUps,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load briefing history',
      },
      { status: 500 }
    )
  }
}
