import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

/* eslint-disable @typescript-eslint/no-require-imports */
const smeWorkspace = () =>
  require('../../backend/services/smeWorkspaceService.js') as {
    saveTender: (uid: string, tender: Record<string, unknown>) => Promise<{ workspace: unknown }>
    unsaveTender: (uid: string, tenderId: string) => Promise<{ workspace: unknown }>
    trackTender: (uid: string, tender: Record<string, unknown>) => Promise<{ workspace: unknown }>
    untrackTender: (uid: string, tenderId: string) => Promise<{ workspace: unknown }>
    followDepartment: (uid: string, department: string) => Promise<{ workspace: unknown }>
    followProvince: (uid: string, province: string) => Promise<{ workspace: unknown }>
    unfollowDepartment: (uid: string, department: string) => Promise<{ workspace: unknown }>
    unfollowProvince: (uid: string, province: string) => Promise<{ workspace: unknown }>
  }
/* eslint-enable @typescript-eslint/no-require-imports */

export async function requireSmeUser(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['sme'])
  if (!user) return { user: null, response: unauthorizedResponse('SME sign-in required') }
  return { user, response: null }
}

export async function resolveTender(tenderId: string) {
  const storage = backend.getStorage()
  const tender = await storage.getTenderBriefingById(tenderId)
  if (!tender) {
    return {
      tender: null,
      response: NextResponse.json(
        { success: false, error: 'Tender not found' },
        { status: 404 }
      ),
    }
  }
  return { tender, response: null }
}

export function workspaceSuccess(workspace: unknown, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: true, data: { workspace, ...extra } })
}

export function workspaceError(error: unknown, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: error instanceof Error ? error.message : 'Workspace action failed',
    },
    { status }
  )
}
