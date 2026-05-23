import { NextRequest, NextResponse } from 'next/server'
import { loadIntegrationService } from '@/lib/backend/integrations'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const yoco = loadIntegrationService<{
    verifyWebhookSignature: (
      rawBody: string,
      signature: string | null
    ) => { ok: boolean; skipped?: boolean; reason?: string }
    handleWebhookPayload: (body: unknown) => { ok: boolean }
  }>('yoco')

  const rawBody = await request.text()
  const signature =
    request.headers.get('x-yoco-signature') ||
    request.headers.get('yoco-signature')

  const verified = yoco.verifyWebhookSignature(rawBody, signature)
  if (!verified.ok && !verified.skipped) {
    return NextResponse.json(
      { ok: false, error: verified.reason || 'Unauthorized' },
      { status: 401 }
    )
  }

  let body: unknown = {}
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const result = yoco.handleWebhookPayload(body)
  return NextResponse.json(result)
}
