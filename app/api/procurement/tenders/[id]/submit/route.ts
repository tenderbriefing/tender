import { NextRequest } from 'next/server'
import {
  jsonErr,
  jsonOk,
  requireProcurementAccess,
} from '@/lib/privateTenders/requireProcurementAccess'
import { validatePrivateTenderSubmission } from '@/lib/privateTenders/validation'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gated = await requireProcurementAccess(request, 'submit_tender')
    if ('response' in gated) return gated.response

    const svc = require('../../../../../../backend/services/privateTenderSubmissionService.js')
    const existing = await svc.getSubmissionById(params.id)
    if (!existing || existing.organisationId !== gated.ctx.organisation.id) {
      return jsonErr('Tender not found', 404)
    }

    const validated = validatePrivateTenderSubmission(existing)
    if (!validated.ok) {
      return jsonErr('Validation failed', 400, { issues: validated.issues })
    }

    const result = await svc.submitOrgDraft(params.id, {
      organisationId: gated.ctx.organisation.id,
      actorUid: gated.ctx.uid,
      actorEmail: gated.ctx.email,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    })

    // Notify Founder (fail-soft) — reuse submitted ack to contact + founder if configured
    try {
      const emailSvc = require('../../../../../../lib/services/privateTenderEmail.js')
      if (!result.alreadySubmitted) {
        await emailSvc.sendPrivateTenderSubmittedAck({
          to: result.submission.contactEmail,
          submission: result.submission,
        })
      }
    } catch {
      /* fail-soft */
    }

    return jsonOk({
      tender: result.submission,
      alreadySubmitted: result.alreadySubmitted,
      resubmitted: result.resubmitted,
    })
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return jsonErr(error instanceof Error ? error.message : 'Submit failed', status)
  }
}
