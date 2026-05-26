import type { NextRequest } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
  type ApiUserType,
  type VerifiedApiUser,
} from '@/lib/auth/verifyApiUser'

export async function requireApiUser(
  request: NextRequest | Request,
  allowedTypes?: ApiUserType[]
): Promise<VerifiedApiUser | Response> {
  const user = await verifyApiUser(
    request.headers.get('authorization'),
    allowedTypes
  )
  if (!user) return unauthorizedResponse()
  return user
}

export async function requireAdmin(request: NextRequest | Request) {
  return requireApiUser(request, ['admin'])
}

export function isGuardResponse(result: VerifiedApiUser | Response): result is Response {
  return result instanceof Response
}
