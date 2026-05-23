import { NextRequest, NextResponse } from 'next/server'
import { loadIntegrationService } from '@/lib/backend/integrations'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
    return new NextResponse(result.reason || 'Forbidden', { status: 403 })
  }

  return new NextResponse(result.challenge || '', { status: 200 })
}

export async function POST(request: NextRequest) {
  const whatsapp = loadIntegrationService<{
    handleWebhookPayload: (body: unknown) => { ok: boolean }
  }>('whatsapp')

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const result = whatsapp.handleWebhookPayload(body)
  return NextResponse.json(result)
}
