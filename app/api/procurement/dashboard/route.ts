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
    const svc = require('../../../../backend/services/privateTenderSubmissionService.js')
    const dashboard = await svc.getOrgDashboardCounts(gated.ctx.organisation.id)
    return jsonOk(dashboard)
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : 'Failed to load dashboard', 500)
  }
}
