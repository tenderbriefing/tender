import { NextRequest } from 'next/server'
import {
  jsonErr,
  jsonOk,
  requireProcurementAccess,
} from '@/lib/privateTenders/requireProcurementAccess'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gated = await requireProcurementAccess(request, 'withdraw_tender')
    if ('response' in gated) return gated.response
    const body = await request.json().catch(() => ({}))
    const svc = require('../../../../../../backend/services/privateTenderSubmissionService.js')
    const existing = await svc.getSubmissionById(params.id)
    if (!existing || existing.organisationId !== gated.ctx.organisation.id) {
      return jsonErr('Tender not found', 404)
    }
    const tender = await svc.withdrawOrgSubmission(params.id, {
      organisationId: gated.ctx.organisation.id,
      actorUid: gated.ctx.uid,
      actorEmail: gated.ctx.email,
      note: body?.note,
    })
    return jsonOk({ tender })
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return jsonErr(error instanceof Error ? error.message : 'Withdraw failed', status)
  }
}
