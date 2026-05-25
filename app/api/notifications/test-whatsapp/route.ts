import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
    if (!user) return unauthorizedResponse('Admin sign-in required')

    const body = await request.json()
    const phone = body.phone || body.to
    const message =
      body.message ||
      'TenderBriefing test: WhatsApp notifications are configured correctly.'

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'phone is required (E.164, e.g. +27821234567)' },
        { status: 400 }
      )
    }

    const whatsappService = require('../../../../backend/services/whatsappService')
    const validated = whatsappService.validateWhatsAppNumber(phone)
    if (!validated.ok) {
      return NextResponse.json(
        { success: false, error: validated.error },
        { status: 400 }
      )
    }

    const result = await whatsappService.sendWhatsAppMessage(phone, message, {
      type: 'admin_test',
      recipientRole: 'admin',
      recipientId: user.uid,
      metadata: { source: 'test-whatsapp-api', adminId: user.uid },
      idempotencyKey: `admin_test:${user.uid}:${Date.now()}`,
    })

    if (result.duplicate) {
      return NextResponse.json({
        success: true,
        data: { duplicate: true, message: 'Duplicate prevented (idempotency)' },
      })
    }

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || result.reason || 'Send failed',
          skipped: result.skipped === true,
          configured: whatsappService.isConfigured(),
        },
        { status: result.skipped ? 503 : 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        sid: result.sid,
        sentAt: result.log?.sentAt || new Date().toISOString(),
        status: result.log?.status || 'sent',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Test send failed',
      },
      { status: 500 }
    )
  }
}
