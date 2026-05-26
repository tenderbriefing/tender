import { NextRequest, NextResponse } from 'next/server'
import { loadIntegrationService } from '@/lib/backend/integrations'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const yoco = loadIntegrationService<{
    verifyWebhookSignature: (
      rawBody: string,
      signature: string | null
    ) => { ok: boolean; skipped?: boolean; reason?: string }
  }>('yoco')

  const rawBody = await request.text()
  const signature =
    request.headers.get('x-yoco-signature') ||
    request.headers.get('yoco-signature') ||
    request.headers.get('webhook-signature')

  const verified = yoco.verifyWebhookSignature(rawBody, signature)
  if (!verified.ok) {
    console.warn('[yoco webhook] signature verification failed:', verified.reason)
    return NextResponse.json(
      { ok: false, error: verified.reason || 'Unauthorized' },
      { status: 401 }
    )
  }

  if (verified.skipped && process.env.NODE_ENV !== 'production') {
    console.warn(
      '[yoco webhook] YOCO_WEBHOOK_SECRET not configured — dev-only processing'
    )
  }

  let body: Record<string, unknown> = {}
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const paymentService = require('../../../../backend/services/payments/attendancePaymentService')
    const result = await paymentService.processWebhookEvent(body)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[yoco webhook] handler error:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { ok: false, error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
