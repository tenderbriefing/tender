import { NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sync = backend.incrementalSync()
    const status = await sync.getSyncStatus()
    return NextResponse.json({ success: true, data: status })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sync status',
      },
      { status: 500 }
    )
  }
}
