import { NextRequest } from 'next/server'
import {
  requireSmeUser,
  resolveTender,
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
    const { tender, response: tenderResponse } = await resolveTender(body.tenderId)
    if (tenderResponse) return tenderResponse

    const result = await smeWorkspace().saveTender(user!.uid, tender)
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
    const tenderId =
      body.tenderId || new URL(request.url).searchParams.get('tenderId')
    if (!tenderId) return workspaceError(new Error('tenderId is required'))

    const result = await smeWorkspace().unsaveTender(user!.uid, tenderId)
    return workspaceSuccess(result.workspace)
  } catch (error) {
    return workspaceError(error)
  }
}
