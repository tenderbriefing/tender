import { NextResponse } from 'next/server'
import type { VerifiedApiUser } from '@/lib/auth/verifyApiUser'
import { canAccessYouthAgentWorkspace } from '@/lib/agent/workspace/featureFlag'

export function workspaceForbiddenResponse(message = 'Youth Agent Workspace is not enabled for this account') {
  return NextResponse.json({ success: false, error: message, code: 'WORKSPACE_DISABLED' }, { status: 403 })
}

/** Fail-closed gate: feature flag + role. SME never passes. */
export function assertYouthAgentWorkspaceAccess(user: VerifiedApiUser): NextResponse | null {
  if (!canAccessYouthAgentWorkspace({ uid: user.uid, userType: user.userType })) {
    return workspaceForbiddenResponse()
  }
  return null
}
