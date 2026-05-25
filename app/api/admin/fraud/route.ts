import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  try {
    const fraudDetection = require('../../../../backend/services/trust/fraudDetectionService')
    const aiOps = require('../../../../backend/services/aiOpsExecutiveService')
    const [alerts, ext] = await Promise.all([
      fraudDetection.listFraudAlerts(50),
      aiOps.getAiOpsExtension(),
    ])
    return NextResponse.json({
      success: true,
      data: { alerts, operationalRisk: ext.operationalRisk, trust: ext.trust },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fraud load failed' },
      { status: 500 }
    )
  }
}
