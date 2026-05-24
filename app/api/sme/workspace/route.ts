import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { emptySmeWorkspace } from '@/lib/sme/workspaceTypes'

export const dynamic = 'force-dynamic'

const COLLECTION = 'smeWorkspace'

function daysUntil(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'))
    if (!user) return unauthorizedResponse()
    if (user.userType !== 'sme' && user.userType !== 'admin') {
      return NextResponse.json({ success: false, error: 'SME access required' }, { status: 403 })
    }

    const uid = user.userType === 'admin' ? user.uid : user.uid
    const firebaseAdmin = backend.loadBackendService<{
      getFirestore: () => { collection: (name: string) => { doc: (id: string) => { get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }> } } }
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

    const storage = backend.getStorage()
    const [allTenders, requests, reports] = await Promise.all([
      storage.getTenderBriefings(),
      storage.getAttendanceRequests(),
      storage.getBriefingReports(),
    ])

    const tenderMap = new Map(allTenders.map((t) => [t.id, t]))
    const mine = requests.filter((r) => r.smeId === uid)

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

    const completedReports = reports.filter((r) =>
      mine.some((m) => m.id === r.requestId)
    ).length

    const closingSoonCount = allTenders.filter((t) => {
      const days = t.closingDate ? daysUntil(t.closingDate) : null
      return days !== null && days >= 0 && days <= 7
    }).length

    return NextResponse.json({
      success: true,
      data: {
        workspace,
        trackedTenders: workspace.trackedTenderIds.map(mapTenderRef),
        savedTenders: workspace.savedTenderIds.map(mapTenderRef),
        upcomingBriefings,
        completedReports,
        closingSoonCount,
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
