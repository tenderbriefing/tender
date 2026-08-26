/**
 * Shared auth + membership gate for /api/procurement/* routes.
 */
import { NextResponse } from 'next/server'
import {
  responseFromVerifyFailure,
  verifyApiUserDetailed,
} from '@/lib/auth/verifyApiUser'
import { isPrivateTenderOrganisationWorkspaceEnabled } from '@/lib/privateTenders/organisationWorkspaceFlag'
import type { OrgPermission } from '@/lib/privateTenders/organisationPermissions'

const memberService = require('../../backend/services/privateOrganisationMemberService.js')
const orgService = require('../../backend/services/privateOrganisationService.js')

export type ProcurementContext = {
  uid: string
  email: string
  userType: string
  membership: {
    id: string
    organisationId: string
    uid: string
    email: string
    role: string
    status: string
  }
  organisation: Record<string, unknown> & { id: string }
}

export async function requireProcurementAccess(
  request: Request,
  permission?: OrgPermission
): Promise<{ ctx: ProcurementContext } | { response: NextResponse }> {
  if (!isPrivateTenderOrganisationWorkspaceEnabled()) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Organisation workspace is not enabled' },
        { status: 404 }
      ),
    }
  }

  const auth = await verifyApiUserDetailed(request.headers.get('authorization'), [
    'sme',
    'admin',
  ])
  if (!auth.ok) {
    return { response: responseFromVerifyFailure(auth) as unknown as NextResponse }
  }

  const membership = await memberService.getActiveMembershipForUser(auth.user.uid)
  if (!membership) {
    return {
      response: NextResponse.json(
        { success: false, error: 'No active organisation membership', code: 'NO_ORG' },
        { status: 403 }
      ),
    }
  }

  if (permission && !memberService.memberHasPermission(membership, permission)) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Insufficient organisation permission' },
        { status: 403 }
      ),
    }
  }

  const organisation = await orgService.getOrganisationById(membership.organisationId)
  if (!organisation || organisation.status === 'suspended') {
    return {
      response: NextResponse.json(
        { success: false, error: 'Organisation unavailable' },
        { status: 403 }
      ),
    }
  }

  return {
    ctx: {
      uid: auth.user.uid,
      email: auth.user.email || membership.email,
      userType: auth.user.userType,
      membership,
      organisation,
    },
  }
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function jsonErr(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, error, ...extra }, { status })
}
