import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const workflow = require('../../../../backend/services/workflowAutomationService')
    const whatsappService = require('../../../../backend/services/whatsappService')
    const pushNotificationService = require('../../../../backend/services/pushNotificationService')

    const [telemetry, waStats] = await Promise.all([
      workflow.getWorkflowTelemetry({ limit: 30 }),
      whatsappService.getWhatsAppStats(30),
    ])

    return NextResponse.json({
      success: true,
      data: {
        workflow: telemetry,
        whatsapp: {
          configured: whatsappService.isConfigured(),
          ...waStats,
        },
        push: pushNotificationService.getStatus(),
        jobs: [
          'tender_closing_reminders',
          'briefing_reminders',
          'missed_briefing_detection',
          'retry_failed_whatsapp',
          'sla_escalations',
          'smart_dispatch',
        ],
        checkedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 500 }
    )
  }
}
