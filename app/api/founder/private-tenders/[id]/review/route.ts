import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ACTIONS = new Set(['approve', 'reject', 'request_changes', 'under_review'])

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const body = await request.json()
    const action = String(body.action || '').trim()
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    const svc = require('../../../../../../backend/services/privateTenderSubmissionService.js')
    const result = await svc.reviewSubmission(
      params.id,
      action,
      {
        note: body.note || body.rejectionReason || '',
        rejectionReason: body.rejectionReason || body.note || '',
        issueCategory: body.issueCategory || body.category || '',
        actorUid: access.user.uid,
        actorEmail: access.user.email,
      }
    )

    try {
      const emailSvc = require('../../../../../../lib/services/privateTenderEmail.js')
      const sub = result.submission
      if (action === 'approve' && result.created) {
        await emailSvc.sendPrivateTenderPublished({
          to: sub.contactEmail,
          companyName: sub.companyName,
          title: sub.title,
          tenderReference: sub.tenderReference,
          publishedTenderId: result.publishedTenderId,
          submissionId: sub.id,
        })
      } else if (action === 'reject') {
        await emailSvc.sendPrivateTenderRejected({
          to: sub.contactEmail,
          companyName: sub.companyName,
          tenderReference: sub.tenderReference,
          reason: sub.rejectionReason,
          submissionId: sub.id,
        })
      } else if (action === 'request_changes') {
        await emailSvc.sendPrivateTenderChangesRequested({
          to: sub.contactEmail,
          companyName: sub.companyName,
          tenderReference: sub.tenderReference,
          note: sub.changesRequestedNote,
          submissionId: sub.id,
        })
      }
    } catch (err) {
      console.warn(
        '[private-tender] review email failed',
        err instanceof Error ? err.message : err
      )
    }

    try {
      const events = require('../../../../../../backend/services/productEventService.js')
      const actor = {
        uid: access.user.uid,
        userType: access.user.userType || 'admin',
      }
      if (action === 'approve') {
        await events.emitFunnelEventSafe(actor, {
          eventName: 'private_tender_approved',
          feature: 'private_tenders',
          targetEntityType: 'privateTenderSubmission',
          targetEntityId: params.id,
          metadata: {
            submissionId: params.id,
            tenderId: result.publishedTenderId || '',
          },
        })
        if (result.created) {
          await events.emitFunnelEventSafe(actor, {
            eventName: 'private_tender_published',
            feature: 'private_tenders',
            targetEntityType: 'tender',
            targetEntityId: result.publishedTenderId || params.id,
            metadata: {
              submissionId: params.id,
              tenderId: result.publishedTenderId || '',
            },
          })
        }
      } else if (action === 'reject') {
        await events.emitFunnelEventSafe(actor, {
          eventName: 'private_tender_rejected',
          feature: 'private_tenders',
          targetEntityType: 'privateTenderSubmission',
          targetEntityId: params.id,
          metadata: { submissionId: params.id },
        })
      } else if (action === 'request_changes') {
        await events.emitFunnelEventSafe(actor, {
          eventName: 'private_tender_changes_requested',
          feature: 'private_tenders',
          targetEntityType: 'privateTenderSubmission',
          targetEntityId: params.id,
          metadata: { submissionId: params.id },
        })
      }
    } catch {
      /* fail-soft */
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Review failed',
      },
      { status }
    )
  }
}
