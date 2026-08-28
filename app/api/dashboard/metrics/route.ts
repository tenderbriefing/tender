import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

function daysUntil(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
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

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'))
    if (!user) return unauthorizedResponse()

    const storage = backend.getStorage()
    const syncService = backend.incrementalSync()
    const catalogueStats = require('../../backend/services/catalogueStatsService.js') as {
      readCatalogueSummary: () => Promise<Record<string, unknown> | null>
    }

    if (user.userType === 'sme') {
      const [summary, mine] = await Promise.all([
        catalogueStats.readCatalogueSummary(),
        storage.getAttendanceRequests({ smeId: user.uid, limit: 100 }),
      ])
      const requestIds = new Set(mine.map((r) => r.id))
      let completedReports = 0
      if (requestIds.size > 0) {
        const reports = await storage.getBriefingReports({ limit: 200 })
        completedReports = reports.filter((r) => requestIds.has(r.requestId)).length
      }
      const upcoming = mine.filter(
        (r) =>
          (r.status === 'assigned' || r.status === 'accepted' || r.status === 'pending') &&
          isBriefingThisWeek(r.briefingDate)
      ).length

      return NextResponse.json({
        success: true,
        data: {
          role: 'sme',
          activeOpportunities: Number(summary?.totalBriefings || 0),
          attendanceRequests: mine.length,
          upcomingBriefings: upcoming,
          closingSoon: Number(summary?.closingWithin7Days || 0),
          completedReports,
          pendingAttendance: mine.filter((r) => r.status === 'pending').length,
        },
      })
    }

    if (user.userType === 'youth-agent') {
      const uid = user.uid
      const [pendingAvailable, mine, profile] = await Promise.all([
        typeof storage.countDocuments === 'function'
          ? storage.countDocuments('attendanceRequests', { status: 'pending' })
          : storage
              .getAttendanceRequests({ status: 'pending', limit: 200 })
              .then((rows) => rows.length),
        storage.getAttendanceRequests({ agentId: uid, limit: 100 }),
        backend.users().getUserById(uid),
      ])
      const assigned = mine.filter(
        (r) => r.status === 'assigned' || r.status === 'accepted'
      ).length
      const completed = mine.filter((r) => r.status === 'completed').length
      let agentReports = 0
      if (completed > 0) {
        const reports = await storage.getBriefingReports({ limit: 200 })
        agentReports = reports.filter((r) => r.agentId === uid).length
      }

      return NextResponse.json({
        success: true,
        data: {
          role: 'youth-agent',
          availableAssignments: pendingAvailable,
          assignedBriefings: assigned,
          completedReports: agentReports,
          reliabilityScore: profile?.reliabilityScore ?? 100,
          missedBriefings: profile?.missedBriefingCount ?? 0,
          acceptedBriefings: profile?.acceptedBriefingCount ?? assigned,
        },
      })
    }

    const [tenders, requests, reports, syncStatus] = await Promise.all([
      storage.getTenderBriefings(),
      storage.getAttendanceRequests(),
      storage.getBriefingReports(),
      syncService.getSyncStatus(),
    ])

    const compulsoryBriefings = tenders.filter((t) => t.briefingCompulsory).length
    const closingSoon = tenders.filter((t) => {
      const days = t.closingDate ? daysUntil(t.closingDate) : null
      return days !== null && days >= 0 && days <= 7
    }).length

    if (user.userType === 'admin') {
      const agents = await backend.users().getYouthAgents()
      const smeIds = new Set(requests.map((r) => r.smeId))
      return NextResponse.json({
        success: true,
        data: {
          role: 'admin',
          totalTenders: tenders.length,
          compulsoryBriefings,
          pendingRequests: requests.filter((r) => r.status === 'pending').length,
          assignedBriefings: requests.filter(
            (r) => r.status === 'assigned' || r.status === 'accepted'
          ).length,
          completedReports: reports.length,
          activeAgents: agents.length,
          activeSmes: smeIds.size,
          closingSoon,
          syncHealth: syncStatus.apiHealth || 'unknown',
          schedulerHealth: syncStatus.isRunning ? 'running' : 'idle',
          lastSuccessfulSync: syncStatus.lastSuccessfulSync,
        },
      })
    }

    return NextResponse.json({ success: false, error: 'Unknown role' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load metrics',
      },
      { status: 500 }
    )
  }
}
