import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import { requireAdmin, isGuardResponse } from '@/lib/auth/apiGuards'
import { buildPublicProcurementStats } from '@/lib/seo/publicStats'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request)
  if (isGuardResponse(guard)) return guard

  const started = Date.now()
  try {
    const storage = backend.getStorage()
    const syncService = backend.incrementalSync()
    const firebaseAdmin = backend.loadBackendService<{
      checkFirestoreConnection: () => Promise<{
        connected: boolean
        error?: string
      }>
    }>('firebaseAdmin')

    const [stats, requests, syncStatus, firestoreCheck] = await Promise.all([
      buildPublicProcurementStats(),
      storage.getAttendanceRequests({ limit: 800 }),
      syncService.getSyncStatus(),
      firebaseAdmin.checkFirestoreConnection(),
    ])

    const provinceRequestCounts: Record<string, number> = {}
    for (const req of requests) {
      const province = req.province || 'Unknown'
      provinceRequestCounts[province] = (provinceRequestCounts[province] || 0) + 1
    }

    const tenderRequestCounts: Record<string, { count: number; title?: string }> = {}
    for (const req of requests) {
      if (!req.tenderId) continue
      if (!tenderRequestCounts[req.tenderId]) {
        tenderRequestCounts[req.tenderId] = { count: 0, title: req.tenderTitle }
      }
      tenderRequestCounts[req.tenderId].count += 1
    }

    const responseTimes: number[] = []
    for (const req of requests) {
      if (req.acceptedAt && req.createdAt) {
        const created = new Date(req.createdAt).getTime()
        const accepted = new Date(req.acceptedAt).getTime()
        if (!Number.isNaN(created) && !Number.isNaN(accepted) && accepted >= created) {
          responseTimes.push((accepted - created) / (1000 * 60))
        }
      }
    }

    const averageAgentResponseMinutes =
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          )
        : null

    const data = {
      lastSync: syncStatus.lastSuccessfulSync || null,
      syncHealth: syncStatus.apiHealth || 'unknown',
      firestoreHealth: firestoreCheck.connected
        ? ('healthy' as const)
        : firestoreCheck.error
          ? ('degraded' as const)
          : ('unknown' as const),
      isSyncRunning: Boolean(syncStatus.isRunning),
      newTendersLast15Min: 0,
      briefingsToday: stats.compulsoryBriefings,
      briefingsThisWeek: stats.compulsoryBriefings,
      compulsoryBriefings: stats.compulsoryBriefings,
      closingSoon: stats.closingWithin7Days,
      highDemandProvinces: Object.entries(provinceRequestCounts)
        .map(([province, requestCount]) => ({ province, requestCount }))
        .sort((a, b) => b.requestCount - a.requestCount)
        .slice(0, 5),
      mostRequestedBriefings: Object.entries(tenderRequestCounts)
        .map(([tenderId, { count, title }]) => ({
          tenderId,
          tenderTitle: title,
          requestCount: count,
        }))
        .sort((a, b) => b.requestCount - a.requestCount)
        .slice(0, 5),
      averageAgentResponseMinutes,
      totalActiveTenders: stats.totalBriefings,
      pendingAttendanceRequests: stats.pendingBriefings,
      requestSampleSize: requests.length,
    }

    const { logHotPath } = require('../../../../backend/services/hotPathLog') as {
      logHotPath: (f: Record<string, unknown>) => void
    }
    logHotPath({
      endpoint: 'operational_intelligence',
      durationMs: Date.now() - started,
      cache: 'stats_reuse',
      resultCount: requests.length,
      role: 'admin',
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load intelligence',
      },
      { status: 500 }
    )
  }
}
