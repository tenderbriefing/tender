import type { NextRequest } from 'next/server'
import {
  verifyApiUserDetailed,
  responseFromVerifyFailure,
  type ApiUserType,
  type VerifiedApiUser,
} from '@/lib/auth/verifyApiUser'

export async function requireApiUser(
  request: NextRequest | Request,
  allowedTypes?: ApiUserType[]
): Promise<VerifiedApiUser | Response> {
  const result = await verifyApiUserDetailed(
    request.headers.get('authorization'),
    allowedTypes
  )
  if (!result.ok) return responseFromVerifyFailure(result)
  return result.user
}

export async function requireAdmin(request: NextRequest | Request) {
  return requireApiUser(request, ['admin'])
}

export function isGuardResponse(result: VerifiedApiUser | Response): result is Response {
  return result instanceof Response
}
