import { NextResponse } from 'next/server'
import { getIntegrationsHealth } from '@/lib/backend/integrations'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const health = await getIntegrationsHealth()
    return NextResponse.json(health)
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Integrations health check failed',
      },
      { status: 500 }
    )
  }
}
