import { NextRequest } from 'next/server'
import {
  jsonErr,
  jsonOk,
  requireProcurementAccess,
} from '@/lib/privateTenders/requireProcurementAccess'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { membershipId: string } }
) {
  try {
    const gated = await requireProcurementAccess(request, 'manage_members')
    if ('response' in gated) return gated.response
    const memberService = require('../../../../../backend/services/privateOrganisationMemberService.js')
    const existing = await memberService.getMembershipById(params.membershipId)
    if (!existing || existing.organisationId !== gated.ctx.organisation.id) {
      return jsonErr('Membership not found', 404)
    }
    const body = await request.json()
    const membership = await memberService.updateMembership(params.membershipId, {
      role: body.role,
      status: body.status,
    })
    return jsonOk({ membership })
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return jsonErr(error instanceof Error ? error.message : 'Update failed', status)
  }
}
