import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  try {
    const performanceAudit = require('../../../../../backend/services/trust/performanceAuditService')
    const agentPerformance = require('../../../../../backend/services/agentPerformanceService')
    const [audits, ranked] = await Promise.all([
      performanceAudit.auditAllAgents(25),
      agentPerformance.rankAllAgents(),
    ])
    return NextResponse.json({ success: true, data: { audits, ranked } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Performance load failed' },
      { status: 500 }
    )
  }
}
