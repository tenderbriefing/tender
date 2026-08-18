import { backend } from '@/lib/backend/loadServices'
import { toPublicTenderStats, type PublicTenderStats } from '@/lib/security/publicTender'
import type { AdminDashboardStats, SyncStatus } from '@/lib/tenderBriefing/types'

const STATS_CACHE_TTL_MS = Number(process.env.PROCUREMENT_STATS_CACHE_TTL_MS || 30000)
let statsCache: { at: number; value: AdminDashboardStats } | null = null
let statsInflight: Promise<AdminDashboardStats> | null = null

async function countOrZero(
  storage: {
    countDocuments?: (name: string, eq?: Record<string, unknown>) => Promise<number>
  },
  name: string,
  eq?: Record<string, unknown>
): Promise<number> {
  if (typeof storage.countDocuments !== 'function') return 0
  try {
    return await storage.countDocuments(name, eq)
  } catch {
    return 0
  }
}

async function computePublicProcurementStats(): Promise<AdminDashboardStats> {
  const started = Date.now()
  const storage = backend.getStorage() as {
    countDocuments?: (name: string, eq?: Record<string, unknown>) => Promise<number>
  }
  const syncService = backend.incrementalSync()
  const catalogueStats = require('../../backend/services/catalogueStatsService.js') as {
    readCatalogueSummary: () => Promise<Record<string, unknown> | null>
  }
  const hotPathLog = require('../../backend/services/hotPathLog.js') as {
    logHotPath: (f: Record<string, unknown>) => void
  }

  const [summary, requestCount, pendingCount, assignedCount, reportCount, smeCount, agentCount, syncStatus] =
    await Promise.all([
      catalogueStats.readCatalogueSummary(),
      countOrZero(storage, 'attendanceRequests'),
      countOrZero(storage, 'attendanceRequests', { status: 'pending' }),
      countOrZero(storage, 'attendanceRequests', { status: 'assigned' }),
      countOrZero(storage, 'briefingReports'),
      countOrZero(storage, 'users', { userType: 'sme' }),
      countOrZero(storage, 'users', { userType: 'youth-agent' }),
      syncService.getSyncStatus(),
    ])

  const acceptedAlso = await countOrZero(storage, 'attendanceRequests', { status: 'accepted' })

  const stats: AdminDashboardStats = {
    totalBriefings: Number(summary?.totalBriefings || 0),
    compulsoryBriefings: Number(summary?.compulsoryBriefings || 0),
    activeSmes: smeCount,
    activeYouthAgents: agentCount,
    smeAttendanceRequests: requestCount,
    acceptedBriefings: assignedCount + acceptedAlso,
    pendingBriefings: pendingCount,
    completedBriefingReports: reportCount,
    provincesRepresented: Array.isArray(summary?.provincesRepresented)
      ? (summary?.provincesRepresented as string[])
      : [],
    topDepartments: Array.isArray(summary?.topDepartments)
      ? (summary?.topDepartments as AdminDashboardStats['topDepartments'])
      : [],
    closingWithin7Days: Number(summary?.closingWithin7Days || 0),
    syncStatus: syncStatus as unknown as SyncStatus,
  }

  hotPathLog.logHotPath({
    endpoint: 'stats_summary',
    durationMs: Date.now() - started,
    cache: 'miss',
    hasCatalogueSummary: Boolean(summary),
    requestCount,
    reportCount,
  })

  return stats
}

export async function buildPublicProcurementStats(): Promise<AdminDashboardStats> {
  if (statsCache && Date.now() - statsCache.at < STATS_CACHE_TTL_MS) {
    return statsCache.value
  }
  if (statsInflight) return statsInflight
  statsInflight = computePublicProcurementStats()
    .then((value) => {
      statsCache = { at: Date.now(), value }
      return value
    })
    .finally(() => {
      statsInflight = null
    })
  return statsInflight
}

export function resetPublicProcurementStatsCacheForTests() {
  statsCache = null
  statsInflight = null
}

export async function getPublicProcurementStats(): Promise<PublicTenderStats> {
  try {
    const stats = await buildPublicProcurementStats()
    return toPublicTenderStats(stats)
  } catch {
    return {
      totalBriefings: 0,
      compulsoryBriefings: 0,
      closingWithin7Days: 0,
      provincesRepresented: [],
      topDepartments: [],
    }
  }
}
