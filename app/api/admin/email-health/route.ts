import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser } from '@/lib/auth/verifyApiUser'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/email-health
 * Executive email delivery metrics from the notification ledger.
 */
export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = getFirebaseAdmin()
    const db = admin.firestore()
    const start = new Date()
    start.setUTCHours(0, 0, 0, 0)
    const startIso = start.toISOString()

    const snap = await db
      .collection('notifications')
      .where('type', '==', 'transactional_email')
      .where('updatedAt', '>=', startIso)
      .limit(500)
      .get()

    const rows: Record<string, unknown>[] = snap.docs.map((d: { data: () => unknown }) => {
      const data = d.data()
      return (data || {}) as Record<string, unknown>
    })
    const sent = rows.filter((r: Record<string, unknown>) => r.status === 'sent')
    const failed = rows.filter((r: Record<string, unknown>) => r.status === 'failed')
    const claimed = rows.filter((r: Record<string, unknown>) => r.status === 'claimed')

    const byEvent: Record<string, number> = {}
    for (const r of sent) {
      const key = String(r.eventType || r.templateId || 'unknown')
      byEvent[key] = (byEvent[key] || 0) + 1
    }

    return NextResponse.json({
      success: true,
      data: {
        sentToday: sent.length,
        failedToday: failed.length,
        pendingRetry: claimed.length,
        byEvent,
        welcomeEmails:
          (byEvent.sme_welcome || 0) + (byEvent.youth_agent_welcome || 0),
        bookingConfirmations: byEvent.attendance_payment_confirmed || 0,
        agentAssignments: byEvent.agent_assignment || 0,
        reportNotifications: byEvent.briefing_report_ready || 0,
        overdueReports: byEvent.admin_report_overdue || 0,
        sampleFailures: failed.slice(0, 10).map((r: Record<string, unknown>) => ({
          eventType: r.eventType,
          entityId: r.entityId,
          lastError: r.lastError,
          updatedAt: r.updatedAt,
        })),
      },
    })
  } catch (error) {
    console.error('[admin/email-health]', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Email health failed',
      },
      { status: 500 }
    )
  }
}
