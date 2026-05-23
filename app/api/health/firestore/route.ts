import { NextResponse } from 'next/server'
import { backend, loadBackendService } from '@/lib/backend/loadServices'

export const dynamic = 'force-dynamic'

export async function GET() {
  const adapter = (process.env.STORAGE_ADAPTER || 'json').toLowerCase()
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    'tenderbriefing-34679'

  if (adapter !== 'firestore') {
    return NextResponse.json({
      status: 'ok',
      adapter: 'json',
      projectId,
      connected: true,
      message: 'Using local JSON storage (STORAGE_ADAPTER=json)',
    })
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
        {
          status: 'error',
          adapter: 'firestore',
          projectId: check.projectId || projectId,
          connected: false,
          error: check.error,
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      status: 'ok',
      adapter: 'firestore',
      projectId: check.projectId || projectId,
      connected: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        adapter: 'firestore',
        projectId,
        connected: false,
        error: error instanceof Error ? error.message : 'Firestore health check failed',
      },
      { status: 503 }
    )
  }
}
