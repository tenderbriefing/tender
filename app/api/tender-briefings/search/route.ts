import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser } from '@/lib/auth/verifyApiUser'
import { checkRateLimit, clientIpFromRequest } from '@/lib/security/rateLimit'
import type { PlatformViewer } from '@/lib/security/publicTender'
import {
  normalizeTenderSearchQuery,
  TENDER_SEARCH_DEFAULT_LIMIT,
  TENDER_SEARCH_MAX_QUERY_LENGTH,
} from '@/lib/procurement/tenderSearch'
import { searchCatalogueTenders } from '@/lib/seo/tenderSearchServer'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function asViewer(user: Awaited<ReturnType<typeof verifyApiUser>>): PlatformViewer {
  if (!user) return null
  return { userType: user.userType, uid: user.uid }
}

/**
 * Public tender search over upcoming compulsory briefings.
 * Bounded Firestore scan + in-memory ranking — no external search dependency.
 */
export async function GET(request: NextRequest) {
  const started = Date.now()
  const ip = clientIpFromRequest(request)
  const limited = checkRateLimit(`tender-search:${ip}`, 45, 60_000)
  if (!limited.allowed) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const rawQ = searchParams.get('q') || ''
    if (rawQ.length > TENDER_SEARCH_MAX_QUERY_LENGTH + 40) {
      return NextResponse.json({ success: false, error: 'Query too long' }, { status: 400 })
    }
    const q = normalizeTenderSearchQuery(rawQ)
    if (!q) {
      return NextResponse.json({
        success: true,
        data: {
          query: '',
          tenders: [],
          resultCount: 0,
          scanned: 0,
          truncatedScan: false,
          province: null,
        },
      })
    }

    const limitParam = searchParams.get('limit')
    const limit = limitParam
      ? Math.min(Math.max(1, Number(limitParam) || TENDER_SEARCH_DEFAULT_LIMIT), 100)
      : TENDER_SEARCH_DEFAULT_LIMIT
    const province = searchParams.get('province') || undefined

    const user = await verifyApiUser(request.headers.get('authorization'))
    const viewer = asViewer(user)
    const result = await searchCatalogueTenders({
      q,
      province,
      limit,
      viewer,
      forAnonymous: !user,
    })

    try {
      const { logHotPath } = require('../../../../backend/services/hotPathLog') as {
        logHotPath: (f: Record<string, unknown>) => void
      }
      logHotPath({
        endpoint: 'tender-briefings/search',
        durationMs: Date.now() - started,
        scanned: result.scanned,
        resultCount: result.resultCount,
        queryLength: q.length,
        cache: 'n/a',
      })
    } catch {
      /* optional */
    }

    return NextResponse.json({
      success: true,
      data: {
        query: result.query,
        tenders: result.tenders,
        resultCount: result.resultCount,
        scanned: result.scanned,
        truncatedScan: result.truncatedScan,
        province: result.province,
        matchKinds: result.ranked.map((r) => r.matchKind),
      },
    })
  } catch (error) {
    console.error(
      '[tender-search]',
      error instanceof Error ? error.message.slice(0, 160) : 'error'
    )
    return NextResponse.json({ success: false, error: 'Search unavailable' }, { status: 503 })
  }
}
