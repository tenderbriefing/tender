import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/verifyApiUser'
import { backend } from '@/lib/backend/loadServices'
import { getSiteUrl } from '@/lib/config/runtimeConfig'
import { createPrivateTenderInvite } from '@/lib/security/privateTenderInvite'
import {
  absolutePrivatePaymentUrl,
  privatePaymentWhatsAppMessage,
  whatsappShareHref,
} from '@/lib/booking/sharePath'

export const dynamic = 'force-dynamic'

/**
 * Mint a WhatsApp-shareable private RFQ payment link (signed invite).
 * Admin, owning SME, or original RFQ forwarder may generate.
 */
export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), [
    'sme',
    'admin',
  ])
  if (!user) return unauthorizedResponse()

  try {
    const body = await request.json().catch(() => ({}))
    const tenderId = String(body.tenderId || '').trim()
    if (!tenderId) {
      return NextResponse.json(
        { success: false, error: 'tenderId is required' },
        { status: 400 }
      )
    }

    const storage = backend.getStorage()
    const tender = await storage.getTenderBriefingById(tenderId)
    if (!tender) {
      return NextResponse.json(
        { success: false, error: 'Tender not found' },
        { status: 404 }
      )
    }
    if (tender.visibility !== 'private') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Payment invites are only for private / WhatsApp RFQ opportunities — use /sme/book-agent for public eTenders',
        },
        { status: 400 }
      )
    }

    let allowed = user.userType === 'admin' || tender.ownerUid === user.uid
    if (!allowed && tender.originalEmailId) {
      try {
        const emailIngestion = require('../../../../backend/services/procurement/emailIngestionService')
        const doc = await emailIngestion.getById(tender.originalEmailId)
        if (doc && emailIngestion.canUserAccessEmail(doc, user)) {
          allowed = true
        }
      } catch {
        /* ignore */
      }
    }
    if (!allowed) return forbiddenResponse('Not allowed to share this private opportunity')

    const invite = createPrivateTenderInvite(tender.id)
    const siteUrl = getSiteUrl()
    const paymentUrl = absolutePrivatePaymentUrl(tender.id, {
      invite: invite.token,
      siteUrl,
    })
    const tenderLabel = tender.tenderNumber || tender.title || tender.id
    const message = privatePaymentWhatsAppMessage(paymentUrl, { tenderLabel })
    const whatsappUrl = whatsappShareHref(message)

    return NextResponse.json({
      success: true,
      data: {
        tenderId: tender.id,
        paymentUrl,
        whatsappUrl,
        message,
        expiresAt: invite.expiresAt,
        inviteRequired: true,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payment link',
      },
      { status: 500 }
    )
  }
}
