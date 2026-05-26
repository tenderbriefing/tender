import { NextResponse } from 'next/server'
import { backend, loadBackendService } from '@/lib/backend/loadServices'
import { toMinimalHealthResponse } from '@/lib/security/publicTender'

export const dynamic = 'force-dynamic'

export async function GET() {
  const adapter = (process.env.STORAGE_ADAPTER || 'json').toLowerCase()

  if (adapter !== 'firestore') {
    return NextResponse.json(
      toMinimalHealthResponse({ status: 'ok', connected: true })
    )
  }

  try {
    const firebaseAdmin = loadBackendService<{
      checkFirestoreConnection: () => Promise<{
        connected: boolean
        projectId?: string
        error?: string
      }>
    }>('firebaseAdmin')

    backend.getStorage()

    const check = await firebaseAdmin.checkFirestoreConnection()

    if (!check.connected) {
      return NextResponse.json(
        toMinimalHealthResponse({ status: 'degraded', connected: false }),
        { status: 503 }
      )
    }

    return NextResponse.json(toMinimalHealthResponse({ status: 'ok', connected: true }))
  } catch {
    return NextResponse.json(
      toMinimalHealthResponse({ status: 'degraded', connected: false }),
      { status: 503 }
    )
  }
}
