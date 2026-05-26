import { NextRequest, NextResponse } from 'next/server'
import { getIntegrationsHealth } from '@/lib/backend/integrations'
import { requireAdmin, isGuardResponse } from '@/lib/auth/apiGuards'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request)
  if (isGuardResponse(guard)) return guard

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
