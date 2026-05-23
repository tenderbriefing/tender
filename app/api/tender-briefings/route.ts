import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const storage = backend.getStorage()
    const { searchParams } = new URL(request.url)

    const allTenders = await storage.getTenderBriefings({
      compulsoryOnly: searchParams.get('compulsoryOnly') === 'true',
      province: searchParams.get('province') || undefined,
      sector: searchParams.get('sector') || undefined,
      status: searchParams.get('status') || undefined,
    })

    const offset = Math.max(0, Number(searchParams.get('offset') || 0))
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(Math.max(1, Number(limitParam)), 500) : null
    const tenders = limit
      ? allTenders.slice(offset, offset + limit)
      : allTenders

    const sync = backend.incrementalSync()
    const syncStatus = await sync.getSyncStatus()

    return NextResponse.json({
      success: true,
      data: tenders,
      count: tenders.length,
      total: allTenders.length,
      offset,
      hasMore: limit ? offset + tenders.length < allTenders.length : false,
      lastUpdated: syncStatus.lastSuccessfulSync,
      syncStatus: {
        isRunning: syncStatus.isRunning,
        apiHealth: syncStatus.apiHealth,
        scraperHealth: syncStatus.scraperHealth,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load tender briefings',
      },
      { status: 500 }
    )
  }
}
