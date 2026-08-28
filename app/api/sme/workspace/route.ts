import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { emptySmeWorkspace } from '@/lib/sme/workspaceTypes'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export const dynamic = 'force-dynamic'

const COLLECTION = 'smeWorkspace'

type StorageWithBatchTenders = ReturnType<typeof backend.getStorage> & {
  getTendersByIds?: (ids: string[]) => Promise<TenderBriefing[]>
}

async function loadTendersByIds(
  storage: StorageWithBatchTenders,
  ids: string[]
): Promise<TenderBriefing[]> {
  const unique = Array.from(new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean)))
  if (!unique.length) return []
  if (typeof storage.getTendersByIds === 'function') {
    return storage.getTendersByIds(unique)
  }
  const rows = await Promise.all(unique.map((id) => storage.getTenderBriefingById(id)))
  return rows.filter((t): t is TenderBriefing => Boolean(t))
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'))
    if (!user) return unauthorizedResponse()
    if (user.userType !== 'sme' && user.userType !== 'admin') {
      return NextResponse.json({ success: false, error: 'SME access required' }, { status: 403 })
    }

    const uid = user.uid
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

    let workspace = emptySmeWorkspace(uid)
    try {
      const snap = await db.collection(COLLECTION).doc(uid).get()
      if (snap.exists) {
        workspace = { ...workspace, ...(snap.data() as unknown as typeof workspace) }
      }
    } catch {
      /* collection may not exist yet — return empty workspace */
    }

    const storage = backend.getStorage() as StorageWithBatchTenders
    const catalogueStats = require('../../../../backend/services/catalogueStatsService.js') as {
      readCatalogueSummary: () => Promise<Record<string, unknown> | null>
    }

    const [summary, mine, refTenders] = await Promise.all([
      catalogueStats.readCatalogueSummary(),
      storage.getAttendanceRequests({ smeId: uid, limit: 100 }),
      loadTendersByIds(storage, [...workspace.trackedTenderIds, ...workspace.savedTenderIds]),
    ])

    const tenderMap = new Map(refTenders.map((t) => [t.id, t]))
    const requestIds = new Set(mine.map((r) => r.id))
    let completedReports = 0
    if (requestIds.size > 0) {
      const reports = await storage.getBriefingReports({ limit: 200 })
      completedReports = reports.filter((r) => requestIds.has(r.requestId)).length
    }

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
          r.status === 'pending' ||
          r.status === 'assigned' ||
          r.status === 'accepted'
      )
      .map((r) => ({
        id: r.id,
        tenderTitle: r.tenderTitle || tenderMap.get(r.tenderId)?.title,
        briefingDate: r.briefingDate || tenderMap.get(r.tenderId)?.briefingDate,
        status: r.status,
      }))

    return NextResponse.json({
      success: true,
      data: {
        workspace,
        trackedTenders: workspace.trackedTenderIds.map(mapTenderRef),
        savedTenders: workspace.savedTenderIds.map(mapTenderRef),
        upcomingBriefings,
        completedReports,
        closingSoonCount: Number(summary?.closingWithin7Days || 0),
        attendanceRequests: mine.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load workspace',
      },
      { status: 500 }
    )
  }
}
