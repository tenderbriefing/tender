import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import { verifyApiUser } from '@/lib/auth/verifyApiUser'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import {
  filterPlatformVisible,
  toPublicSyncStatus,
  toPublicTenderBriefing,
  type PlatformViewer,
} from '@/lib/security/publicTender'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const DEFAULT_PAGE = 40

function asViewer(user: Awaited<ReturnType<typeof verifyApiUser>>): PlatformViewer {
  if (!user) return null
  return { userType: user.userType, uid: user.uid }
}

export async function GET(request: NextRequest) {
  const started = Date.now()
  try {
    const storage = backend.getStorage()
    const { searchParams } = new URL(request.url)
    const user = await verifyApiUser(request.headers.get('authorization'))
    const viewer = asViewer(user)
    const includeOptional =
      viewer?.userType === 'admin' && searchParams.get('includeOptional') === 'true'

    const limitParam = searchParams.get('limit')
    const pageSize = limitParam
      ? Math.min(Math.max(1, Number(limitParam)), 100)
      : DEFAULT_PAGE
    const cursor = searchParams.get('cursor') || undefined
    const province = searchParams.get('province') || undefined

    let pageItems: TenderBriefing[] = []
    let nextCursor: string | null = null
    let scanned = 0
    let total: number | null = null

    if (typeof storage.listTenderBriefingsPage === 'function' && !includeOptional) {
      const page = await storage.listTenderBriefingsPage({
        pageSize,
        cursor,
        province,
        compulsoryOnly: true,
      })
      pageItems = filterPlatformVisible(page.items, viewer, {
        allowOptionalForAdmin: false,
      })
      nextCursor = page.nextCursor
      scanned = page.scanned
      if (typeof storage.countDocuments === 'function') {
        total = await storage.countDocuments('tenderBriefings', { briefingCompulsory: true })
      }
    } else {
      const bounded = await storage.getTenderBriefings({
        province,
        sector: searchParams.get('sector') || undefined,
        status: searchParams.get('status') || undefined,
        limit: 400,
      })
      const visible = filterPlatformVisible(bounded, viewer, {
        allowOptionalForAdmin: includeOptional,
      })
      pageItems = visible.slice(0, pageSize)
      nextCursor = visible.length > pageSize ? visible[pageSize - 1]?.id || null : null
      total = visible.length
      scanned = bounded.length
    }

    const data = user ? pageItems : pageItems.map(toPublicTenderBriefing)

    const sync = backend.incrementalSync()
    const syncStatus = await sync.getSyncStatus()
    const publicSync = toPublicSyncStatus({
      lastSuccessfulSync:
        typeof syncStatus.lastSuccessfulSync === 'string'
          ? syncStatus.lastSuccessfulSync
          : null,
      lastUpdated:
        typeof syncStatus.lastUpdated === 'string' ? syncStatus.lastUpdated : null,
      apiHealth:
        typeof syncStatus.apiHealth === 'string' ? syncStatus.apiHealth : 'unknown',
      isRunning: Boolean(syncStatus.isRunning),
    })

    const { logHotPath } = require('../../../../backend/services/hotPathLog') as {
      logHotPath: (f: Record<string, unknown>) => void
    }
    logHotPath({
      endpoint: 'tender-briefings',
      durationMs: Date.now() - started,
      scanned,
      resultCount: data.length,
      cache: 'n/a',
    })

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      total,
      offset: 0,
      cursor: cursor || null,
      nextCursor,
      hasMore: Boolean(nextCursor),
      lastUpdated: publicSync.lastUpdated,
      syncStatus: publicSync,
      policy: {
        compulsoryBriefingsOnly: !includeOptional,
        upcomingBriefingsOnly: viewer?.userType !== 'admin',
        paginated: true,
        pageSize,
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
