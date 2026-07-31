import { NextRequest, NextResponse } from 'next/server'
import { loadIntegrationService } from '@/lib/backend/integrations'
import { logEvent, newRequestId } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'

function whatsappEnabled(): boolean {
  return (
    String(process.env.WHATSAPP_WEBHOOK_ENABLED || '').toLowerCase() === 'true' &&
    Boolean(process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_APP_SECRET)
  )
}

export async function GET(request: NextRequest) {
  const requestId = newRequestId()
  if (!whatsappEnabled() && process.env.NODE_ENV === 'production') {
    logEvent({
      event: 'webhook_rejected',
      severity: 'warn',
      requestId,
      outcome: 'denied',
      errorCode: 'whatsapp_disabled',
    })
    return new NextResponse('WhatsApp webhook disabled', { status: 503 })
  }

  const whatsapp = loadIntegrationService<{
    verifyWebhook: (
      mode: string | null,
      token: string | null,
      challenge: string | null
    ) => { ok: boolean; challenge?: string; reason?: string }
  }>('whatsapp')

  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const result = whatsapp.verifyWebhook(mode, token, challenge)
  if (!result.ok) {
    logEvent({
      event: 'webhook_rejected',
      severity: 'warn',
      requestId,
      outcome: 'denied',
      errorCode: 'whatsapp_verify_failed',
    })
    return new NextResponse(result.reason || 'Forbidden', { status: 403 })
  }

  return new NextResponse(result.challenge || '', { status: 200 })
}

export async function POST(request: NextRequest) {
  const requestId = newRequestId()

  // Production fail-closed until signature/app-secret verification is configured.
  if (process.env.NODE_ENV === 'production' && !whatsappEnabled()) {
    logEvent({
      event: 'webhook_rejected',
      severity: 'warn',
      requestId,
      outcome: 'denied',
      errorCode: 'whatsapp_disabled',
    })
    return NextResponse.json(
      { error: { code: 'whatsapp_disabled', message: 'WhatsApp webhook disabled', requestId } },
      { status: 503 }
    )
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim()
  if (process.env.NODE_ENV === 'production' && !appSecret) {
    logEvent({
      event: 'webhook_rejected',
      severity: 'error',
      requestId,
      outcome: 'denied',
      errorCode: 'whatsapp_unsigned',
    })
    return NextResponse.json(
      {
        error: {
          code: 'whatsapp_unsigned',
          message: 'WhatsApp signature verification not configured',
          requestId,
        },
      },
      { status: 503 }
    )
  }

  // If Meta signature header present, require HMAC validation when secret configured.
  if (appSecret) {
    const signature = request.headers.get('x-hub-signature-256') || ''
    const raw = await request.text()
    const crypto = await import('crypto')
    const expected =
      'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex')
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      logEvent({
        event: 'webhook_rejected',
        severity: 'warn',
        requestId,
        outcome: 'denied',
        errorCode: 'invalid_signature',
      })
      return NextResponse.json(
        { error: { code: 'invalid_signature', message: 'Invalid signature', requestId } },
        { status: 401 }
      )
    }
    let body: unknown = {}
    try {
      body = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { error: { code: 'invalid_json', message: 'Invalid JSON', requestId } },
        { status: 400 }
      )
    }
    const whatsapp = loadIntegrationService<{
      handleWebhookPayload: (body: unknown) => { ok: boolean }
    }>('whatsapp')
    const result = whatsapp.handleWebhookPayload(body)
    logEvent({
      event: 'whatsapp_webhook_processed',
      requestId,
      outcome: result.ok ? 'success' : 'failure',
    })
    return NextResponse.json(result)
  }

  // Non-production without secret: best-effort stub handling only.
  const whatsapp = loadIntegrationService<{
    handleWebhookPayload: (body: unknown) => { ok: boolean }
  }>('whatsapp')

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Invalid JSON', requestId } },
      { status: 400 }
    )
  }

  const result = whatsapp.handleWebhookPayload(body)
  return NextResponse.json(result)
}
