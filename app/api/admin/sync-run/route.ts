import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import { verifyAdminIdToken } from '@/lib/sync/verifyAdmin'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Admin-only sync trigger (Firebase Auth). Does not expose SYNC_SECRET to the browser.
 * Cloud Scheduler should call POST /api/sync/run with x-sync-secret instead.
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdminIdToken(request.headers.get('authorization'))

  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — admin sign-in required' },
      { status: 401 }
    )
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
      triggeredBy: admin.uid,
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
