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
    const result = await smeWorkspace().followDepartment(user!.uid, body.department)
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
    const department =
      body.department || new URL(request.url).searchParams.get('department')
    if (!department) return workspaceError(new Error('department is required'))

    const result = await smeWorkspace().unfollowDepartment(user!.uid, department)
    return workspaceSuccess(result.workspace)
  } catch (error) {
    return workspaceError(error)
  }
}
