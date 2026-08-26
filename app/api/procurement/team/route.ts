import { NextRequest } from 'next/server'
import {
  jsonErr,
  jsonOk,
  requireProcurementAccess,
} from '@/lib/privateTenders/requireProcurementAccess'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const gated = await requireProcurementAccess(request, 'view_tenders')
    if ('response' in gated) return gated.response
    const memberService = require('../../../../backend/services/privateOrganisationMemberService.js')
    const members = await memberService.listMembers(gated.ctx.organisation.id)
    return jsonOk({ members })
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : 'Failed to list team', 500)
  }
}
