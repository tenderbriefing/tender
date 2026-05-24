import { NextRequest } from 'next/server'
import {
  requireSmeUser,
  workspaceError,
  workspaceSuccess,
} from '@/lib/api/smeWorkspaceRoute'

export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-require-imports */
const smeWorkspace = () => require('../../../../../backend/services/smeWorkspaceService.js')
/* eslint-enable @typescript-eslint/no-require-imports */

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireSmeUser(request)
    if (response) return response

    const body = await request.json()
    const result = await smeWorkspace().followProvince(user!.uid, body.province)
    return workspaceSuccess(result.workspace, { created: result.created })
  } catch (error) {
    return workspaceError(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, response } = await requireSmeUser(request)
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const province =
      body.province || new URL(request.url).searchParams.get('province')
    if (!province) return workspaceError(new Error('province is required'))

    const result = await smeWorkspace().unfollowProvince(user!.uid, province)
    return workspaceSuccess(result.workspace)
  } catch (error) {
    return workspaceError(error)
  }
}
