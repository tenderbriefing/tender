import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
    if (!user) return unauthorizedResponse('Admin sign-in required')

    const whatsappService = require('../../../../backend/services/whatsappService')
    const stats = await whatsappService.getWhatsAppStats(25)
    const config = whatsappService.getConfig()

    return NextResponse.json({
      success: true,
      data: {
        configured: config.configured,
        from: config.from,
        sent: stats.sent,
        failed: stats.failed,
        pending: stats.pending,
        total: stats.total,
        lastSentAt: stats.lastSentAt,
        latest: stats.latest,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load WhatsApp metrics',
      },
      { status: 500 }
    )
  }
}
