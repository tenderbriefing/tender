import { backend } from '@/lib/backend/loadServices'
import { emptySmeWorkspace } from '@/lib/sme/workspaceTypes'
import type { SmeDashboardBootstrapData } from '@/lib/sme/dashboardBootstrapTypes'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import type { VerifiedApiUser } from '@/lib/auth/verifyApiUser'

const WORKSPACE_COLLECTION = 'smeWorkspace'
const ATTENDANCE_LIMIT = 100

type StorageWithBatchTenders = ReturnType<typeof backend.getStorage> & {
  getTendersByIds?: (ids: string[]) => Promise<TenderBriefing[]>
}

function isBriefingThisWeek(dateStr?: string) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return d >= now && d <= weekEnd
}

async function loadTendersByIds(
  storage: StorageWithBatchTenders,
  ids: string[]
): Promise<TenderBriefing[]> {
  const unique = Array.from(
    new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))
  )
  if (!unique.length) return []
  if (typeof storage.getTendersByIds === 'function') {
    return storage.getTendersByIds(unique)
  }
  const rows = await Promise.all(unique.map((id) => storage.getTenderBriefingById(id)))
  return rows.filter((t): t is TenderBriefing => Boolean(t))
}

/**
 * Single SME-scoped dashboard payload for above-the-fold render.
 * One auth context; independent reads run concurrently; attendance requests fetched once.
 */
export async function loadSmeDashboardBootstrap(
  user: VerifiedApiUser
): Promise<SmeDashboardBootstrapData> {
  const uid = user.uid
  const storage = backend.getStorage() as StorageWithBatchTenders
  const firebaseAdmin = backend.loadBackendService<{
    getFirestore: () => {
      collection: (name: string) => {
        doc: (id: string) => {
          get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>
        }
      }
    }
  }>('firebaseAdmin')
  const db = firebaseAdmin.getFirestore()
  const catalogueStats = require('../../backend/services/catalogueStatsService.js') as {
    readCatalogueSummary: () => Promise<Record<string, unknown> | null>
  }
  const { getActivitiesForUser } = require('../../backend/services/dashboardActivitiesService') as {
    getActivitiesForUser: (u: VerifiedApiUser) => Promise<SmeDashboardBootstrapData['recentActivities']>
  }

  let workspace = emptySmeWorkspace(uid)
  const workspacePromise = db
    .collection(WORKSPACE_COLLECTION)
    .doc(uid)
    .get()
    .then((snap) => {
      if (snap.exists) {
        workspace = { ...workspace, ...(snap.data() as unknown as typeof workspace) }
      }
    })
    .catch(() => {
      /* collection may not exist yet */
    })

  const [summary, mine, recentActivities] = await Promise.all([
    catalogueStats.readCatalogueSummary(),
    storage.getAttendanceRequests({ smeId: uid, limit: ATTENDANCE_LIMIT }),
    getActivitiesForUser(user),
    workspacePromise,
  ])

  const requestIds = mine.map((r) => r.id).filter(Boolean)
  const refTenders = await loadTendersByIds(storage, [
    ...workspace.trackedTenderIds,
    ...workspace.savedTenderIds,
  ])

  let completedReports = 0
  if (requestIds.length > 0) {
    const reports = await storage.getBriefingReports({
      requestIds: requestIds.slice(0, 30),
      limit: 50,
    })
    const allowed = new Set(requestIds)
    completedReports = (reports || []).filter((r) => allowed.has(r.requestId)).length
  }

  const tenderMap = new Map(refTenders.map((t) => [t.id, t]))
  const mapTenderRef = (id: string) => {
    const t = tenderMap.get(id)
    return {
      id,
      title: t?.title,
      tenderNumber: t?.tenderNumber,
      closingDate: t?.closingDate,
    }
  }

  const upcomingBriefings = mine
    .filter(
      (r) =>
        r.status === 'pending' || r.status === 'assigned' || r.status === 'accepted'
    )
    .map((r) => ({
      id: r.id,
      tenderTitle: r.tenderTitle || tenderMap.get(r.tenderId)?.title,
      briefingDate: r.briefingDate || tenderMap.get(r.tenderId)?.briefingDate,
      status: r.status,
    }))

  const metrics = {
    role: 'sme' as const,
    activeOpportunities: Number(summary?.totalBriefings || 0),
    attendanceRequests: mine.length,
    upcomingBriefings: mine.filter(
      (r) =>
        (r.status === 'assigned' || r.status === 'accepted' || r.status === 'pending') &&
        isBriefingThisWeek(r.briefingDate)
    ).length,
    closingSoon: Number(summary?.closingWithin7Days || 0),
    completedReports,
    pendingAttendance: mine.filter((r) => r.status === 'pending').length,
  }

  return {
    metrics,
    workspace: {
      workspace,
      trackedTenders: workspace.trackedTenderIds.map(mapTenderRef),
      savedTenders: workspace.savedTenderIds.map(mapTenderRef),
      upcomingBriefings,
      completedReports,
      closingSoonCount: Number(summary?.closingWithin7Days || 0),
      attendanceRequests: mine.length,
    },
    recentActivities,
  }
}
