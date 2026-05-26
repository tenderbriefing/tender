import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import { requireAdmin, isGuardResponse } from '@/lib/auth/apiGuards'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request)
  if (isGuardResponse(guard)) return guard

  try {
    const storage = backend.getStorage()
    const audit = backend.auditLog()
    const { searchParams } = new URL(request.url)
    const filters = {
      type: searchParams.get('type') || undefined,
      entityId: searchParams.get('entityId') || undefined,
      limit: Number(searchParams.get('limit') || 200),
    }

    const logs =
      typeof storage.getAuditLogs === 'function'
        ? await storage.getAuditLogs(filters)
        : await audit.getAuditLogs(filters)

    return NextResponse.json({
      success: true,
      data: logs,
      storageAdapter: storage.adapterType || process.env.STORAGE_ADAPTER || 'json',
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load audit logs',
      },
      { status: 500 }
    )
  }
}
