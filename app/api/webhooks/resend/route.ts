import { NextRequest, NextResponse } from 'next/server'
import { logEvent, newRequestId } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'

/**
 * Resend email lifecycle webhooks (Svix / Standard Webhooks signatures).
 * Raw body required for cryptographic verification — never trust unsigned payloads.
 *
 * Events processed for Founder ops delivery:
 *   email.sent | email.delivered | email.delivery_delayed
 *   email.bounced | email.complained | email.failed
 */
export async function POST(request: NextRequest) {
  const requestId = newRequestId()
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  let rawBody = ''
  try {
    rawBody = await request.text()
  } catch {
    logEvent({
      event: 'resend_webhook_rejected',
      severity: 'warn',
      requestId,
      outcome: 'failure',
      errorCode: 'malformed_body',
    })
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
  }

  try {
    const delivery = require('../../../../backend/services/founderOpsEmailDeliveryService')
    const verified = delivery.verifyResendWebhook({
      rawBody,
      svixId,
      svixTimestamp,
      svixSignature,
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    })

    if (!verified.ok) {
      logEvent({
        event: 'resend_webhook_rejected',
        severity: 'warn',
        requestId,
        outcome: 'failure',
        errorCode: verified.error || 'verify_failed',
      })
      const status = verified.statusCode || 401
      return NextResponse.json({ error: 'Unauthorized' }, { status })
    }

    const result = await delivery.processVerifiedResendWebhook(verified.payload, {
      providerEventId: svixId,
    })

    logEvent({
      event: result.duplicate
        ? 'resend_webhook_duplicate'
        : result.pending
          ? 'resend_webhook_pending'
          : result.ignored
            ? 'resend_webhook_ignored'
            : 'resend_webhook_processed',
      requestId,
      outcome: result.ok ? 'success' : 'failure',
      errorCode: result.eventType || result.reason || undefined,
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    logEvent({
      event: 'resend_webhook_rejected',
      severity: 'error',
      requestId,
      outcome: 'failure',
      errorCode: error instanceof Error ? error.message.slice(0, 80) : 'handler_error',
    })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
