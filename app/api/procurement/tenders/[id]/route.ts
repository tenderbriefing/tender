import { NextRequest } from 'next/server'
import {
  jsonErr,
  jsonOk,
  requireProcurementAccess,
} from '@/lib/privateTenders/requireProcurementAccess'

export const dynamic = 'force-dynamic'

async function loadOwnedSubmission(id: string, organisationId: string) {
  const svc = require('../../../../../backend/services/privateTenderSubmissionService.js')
  const tender = await svc.getSubmissionById(id)
  if (!tender || tender.organisationId !== organisationId) return null
  return tender
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gated = await requireProcurementAccess(request, 'view_tenders')
    if ('response' in gated) return gated.response
    const tender = await loadOwnedSubmission(params.id, gated.ctx.organisation.id)
    if (!tender) return jsonErr('Tender not found', 404)
    return jsonOk({ tender })
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : 'Failed to load tender', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gated = await requireProcurementAccess(request, 'edit_tender')
    if ('response' in gated) return gated.response
    const existing = await loadOwnedSubmission(params.id, gated.ctx.organisation.id)
    if (!existing) return jsonErr('Tender not found', 404)
    const body = await request.json()
    const svc = require('../../../../../backend/services/privateTenderSubmissionService.js')
    const tender = await svc.updateOrgDraft(params.id, body, {
      organisationId: gated.ctx.organisation.id,
      actorUid: gated.ctx.uid,
      actorEmail: gated.ctx.email,
    })
    return jsonOk({ tender })
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return jsonErr(error instanceof Error ? error.message : 'Failed to save draft', status)
  }
}
