import { backend } from '@/lib/backend/loadServices'
import { toPublicTenderStats, type PublicTenderStats } from '@/lib/security/publicTender'
import type { AdminDashboardStats, SyncStatus } from '@/lib/tenderBriefing/types'

function daysUntil(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export async function buildPublicProcurementStats(): Promise<AdminDashboardStats> {
  const storage = backend.getStorage()
  const syncService = backend.incrementalSync()
  const [tenders, requests, reports, syncStatus] = await Promise.all([
    storage.getTenderBriefings(),
    storage.getAttendanceRequests(),
    storage.getBriefingReports(),
    syncService.getSyncStatus(),
  ])

  const compulsoryPublicTenders = tenders.filter(
    (t) => t.visibility !== 'private' && t.briefingCompulsory === true
  )

  const departmentCounts: Record<string, number> = {}
  const provinces = new Set<string>()

  for (const tender of compulsoryPublicTenders) {
    if (tender.department) {
      departmentCounts[tender.department] = (departmentCounts[tender.department] || 0) + 1
    }
    if (tender.province) provinces.add(tender.province)
  }

  const topDepartments = Object.entries(departmentCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    totalBriefings: compulsoryPublicTenders.length,
    compulsoryBriefings: compulsoryPublicTenders.length,
    activeSmes: new Set(requests.map((r) => r.smeId)).size,
    activeYouthAgents: new Set(
      requests.map((r) => r.assignedAgentId || r.agentId).filter(Boolean)
    ).size,
    smeAttendanceRequests: requests.length,
    acceptedBriefings: requests.filter(
      (r) => r.status === 'assigned' || r.status === 'accepted'
    ).length,
    pendingBriefings: requests.filter((r) => r.status === 'pending').length,
    completedBriefingReports: reports.length,
    provincesRepresented: Array.from(provinces).sort(),
    topDepartments,
    closingWithin7Days: compulsoryPublicTenders.filter((t) => {
      const days = t.closingDate ? daysUntil(t.closingDate) : null
      return days !== null && days >= 0 && days <= 7
    }).length,
    syncStatus: syncStatus as unknown as SyncStatus,
  }
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
