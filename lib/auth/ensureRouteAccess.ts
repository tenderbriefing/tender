import type { NextRequest } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
  type ApiUserType,
  type VerifiedApiUser,
} from '@/lib/auth/verifyApiUser'

type RouteAccessOptions = {
  allowedTypes?: ApiUserType[]
  /** Agent routes: URL :id must match signed-in uid */
  matchAgentIdParam?: string
}

export async function ensureRouteAccess(
  request: NextRequest | Request,
  options: RouteAccessOptions = {}
): Promise<VerifiedApiUser | Response> {
  const user = await verifyApiUser(
    request.headers.get('authorization'),
    options.allowedTypes
  )
  if (!user) return unauthorizedResponse()

  if (options.matchAgentIdParam && user.userType === 'youth-agent') {
    if (user.uid !== options.matchAgentIdParam) {
      return forbiddenResponse('You can only act on your own agent account')
    }
  }

  return user
}

export function isAccessDenied(result: VerifiedApiUser | Response): result is Response {
  return result instanceof Response
}
