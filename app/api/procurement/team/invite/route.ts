import { NextRequest } from 'next/server'
import {
  jsonErr,
  jsonOk,
  requireProcurementAccess,
} from '@/lib/privateTenders/requireProcurementAccess'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const gated = await requireProcurementAccess(request, 'manage_members')
    if ('response' in gated) return gated.response
    const body = await request.json()
    const memberService = require('../../../../../backend/services/privateOrganisationMemberService.js')
    const result = await memberService.inviteMember(
      gated.ctx.organisation.id,
      { email: body.email, role: body.role || 'procurement' },
      { invitedByUid: gated.ctx.uid }
    )
    return jsonOk(result, result.created ? 201 : 200)
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return jsonErr(error instanceof Error ? error.message : 'Invite failed', status)
  }
}
