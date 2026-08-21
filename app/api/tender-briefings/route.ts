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
const META_TTL_MS = 20000

type CatalogueMeta = {
  at: number
  total: number | null
  publicSync: ReturnType<typeof toPublicSyncStatus>
}

let metaCache: CatalogueMeta | null = null
let metaInflight: Promise<CatalogueMeta & { cache: 'hit' | 'miss' }> | null = null

function asViewer(user: Awaited<ReturnType<typeof verifyApiUser>>): PlatformViewer {
  if (!user) return null
  return { userType: user.userType, uid: user.uid }
}

async function loadCatalogueMeta() {
  if (metaCache && Date.now() - metaCache.at < META_TTL_MS) {
    return { ...metaCache, cache: 'hit' as const }
  }
  if (metaInflight) return metaInflight
  metaInflight = (async () => {
    const storage = backend.getStorage()
    const sync = backend.incrementalSync()
    const catalogueStats = require('../../../backend/services/catalogueStatsService.js') as {
      readCatalogueSummary: () => Promise<Record<string, unknown> | null>
    }
    const [summary, syncStatus] = await Promise.all([
      catalogueStats.readCatalogueSummary(),
      sync.getSyncStatus(),
    ])
    let total =
      summary?.compulsoryBriefings != null ? Number(summary.compulsoryBriefings) : null
    if (total == null && typeof storage.countDocuments === 'function') {
      total = await storage.countDocuments('tenderBriefings', { briefingCompulsory: true })
    }
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
    metaCache = { at: Date.now(), total, publicSync }
    return { ...metaCache, cache: 'miss' as const }
  })().finally(() => {
    metaInflight = null
  })
  return metaInflight
}

export async function GET(request: NextRequest) {
  const started = Date.now()
  const marks: Record<string, number | string> = {}
  try {
    const storage = backend.getStorage()
    const { searchParams } = new URL(request.url)
    const authStarted = Date.now()
    const user = await verifyApiUser(request.headers.get('authorization'))
    marks.authMs = Date.now() - authStarted
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
    let publicSync = toPublicSyncStatus({
      lastSuccessfulSync: null,
      lastUpdated: null,
      apiHealth: 'unknown',
      isRunning: false,
    })

    const pageStarted = Date.now()
    const metaPromise = includeOptional ? Promise.resolve(null) : loadCatalogueMeta()

    if (typeof storage.listTenderBriefingsPage === 'function' && !includeOptional) {
      const [page, meta] = await Promise.all([
        storage.listTenderBriefingsPage({
          pageSize,
          cursor,
          province,
          compulsoryOnly: true,
        }),
        metaPromise,
      ])
      marks.pageMs = Date.now() - pageStarted
      const filterStarted = Date.now()
      pageItems = filterPlatformVisible(page.items, viewer, {
        allowOptionalForAdmin: false,
      })
      marks.filterMs = Date.now() - filterStarted
      nextCursor = page.nextCursor
      scanned = page.scanned
      if (meta) {
        total = meta.total
        publicSync = meta.publicSync
        marks.metaCache = meta.cache
      }
    } else {
      const bounded = await storage.getTenderBriefings({
        province,
        sector: searchParams.get('sector') || undefined,
        status: searchParams.get('status') || undefined,
        limit: 400,
      })
      marks.pageMs = Date.now() - pageStarted
      const visible = filterPlatformVisible(bounded, viewer, {
        allowOptionalForAdmin: includeOptional,
      })
      pageItems = visible.slice(0, pageSize)
      nextCursor = visible.length > pageSize ? visible[pageSize - 1]?.id || null : null
      total = visible.length
      scanned = bounded.length
    }

    const data = user ? pageItems : pageItems.map(toPublicTenderBriefing)

    try {
      const { logHotPath } = require('../../../backend/services/hotPathLog') as {
        logHotPath: (f: Record<string, unknown>) => void
      }
      logHotPath({
        endpoint: 'tender-briefings',
        durationMs: Date.now() - started,
        scanned,
        resultCount: data.length,
        cache: marks.metaCache || 'n/a',
        authMs: marks.authMs,
        pageMs: marks.pageMs,
        filterMs: marks.filterMs || 0,
      })
    } catch {
      /* logging must not fail the public catalogue */
    }

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
