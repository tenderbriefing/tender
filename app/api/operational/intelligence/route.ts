import { NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'

export const dynamic = 'force-dynamic'

function daysUntil(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function isBriefingToday(dateStr?: string) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
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

function isWithinMinutes(iso: string | undefined, minutes: number) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t <= minutes * 60 * 1000
}

export async function GET() {
  try {
    const storage = backend.getStorage()
    const syncService = backend.incrementalSync()
    const firebaseAdmin = backend.loadBackendService<{
      checkFirestoreConnection: () => Promise<{
        connected: boolean
        error?: string
      }>
    }>('firebaseAdmin')

    const [tenders, requests, syncStatus, firestoreCheck] = await Promise.all([
      storage.getTenderBriefings(),
      storage.getAttendanceRequests(),
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
      newTendersLast15Min: tenders.filter(
        (t) => isWithinMinutes(t.lastSyncedAt || t.scrapedAt, 15)
      ).length,
      briefingsToday: tenders.filter((t) => isBriefingToday(t.briefingDate)).length,
      briefingsThisWeek: tenders.filter((t) => isBriefingThisWeek(t.briefingDate)).length,
      compulsoryBriefings: tenders.filter((t) => t.briefingCompulsory).length,
      closingSoon: tenders.filter((t) => {
        const days = t.closingDate ? daysUntil(t.closingDate) : null
        return days !== null && days >= 0 && days <= 7
      }).length,
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
      totalActiveTenders: tenders.filter((t) => t.status === 'active').length,
      pendingAttendanceRequests: requests.filter((r) => r.status === 'pending').length,
    }

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
