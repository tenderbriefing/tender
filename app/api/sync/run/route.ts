import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import { isSyncAuthorized, syncAuthErrorResponse } from '@/lib/sync/authorizeSync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!isSyncAuthorized(request)) {
    return NextResponse.json(syncAuthErrorResponse(), { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sync = backend.incrementalSync()
    const result = await sync.runSync({
      force: body.force === true,
      fullReconciliation: body.fullReconciliation === true,
    })

    const storage = backend.getStorage()

    return NextResponse.json({
      success: result.success,
      storageAdapter: storage.adapterType || process.env.STORAGE_ADAPTER || 'json',
      data: result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    )
  }
}
