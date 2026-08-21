import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'

export type ApiUserType = 'sme' | 'youth-agent' | 'admin'

export interface VerifiedApiUser {
  uid: string
  email?: string
  userType: ApiUserType
  displayName?: string
  companyName?: string
  province?: string
  rating?: number
}

/** Narrow authz failure reasons for observability (never includes secrets/tokens). */
export type AuthFailureReason =
  | 'missing_token'
  | 'invalid_token'
  | 'expired_token'
  | 'profile_missing'
  | 'role_forbidden'
  | 'suspended'
  | 'firebase_config_mismatch'

export type VerifyApiUserResult =
  | { ok: true; user: VerifiedApiUser }
  | { ok: false; reason: AuthFailureReason }

function expectedFirebaseProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    ''
  ).trim()
}

function classifyTokenError(error: unknown): AuthFailureReason {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code || '')
      : ''
  const message = error instanceof Error ? error.message : String(error || '')
  if (code === 'auth/id-token-expired' || /expired/i.test(message)) return 'expired_token'
  if (
    code === 'auth/argument-error' ||
    /audience|issuer|project/i.test(message) ||
    /Firebase ID token has incorrect/i.test(message)
  ) {
    return 'firebase_config_mismatch'
  }
  return 'invalid_token'
}

/**
 * Verifies Bearer Firebase ID token + Firestore profile.
 * Distinguishes unauthenticated (401) from forbidden role (403).
 */
export async function verifyApiUserDetailed(
  authorizationHeader: string | null,
  allowedTypes?: ApiUserType[]
): Promise<VerifyApiUserResult> {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return { ok: false, reason: 'missing_token' }
  }

  const token = authorizationHeader.slice(7).trim()
  if (!token) return { ok: false, reason: 'missing_token' }

  try {
    const admin = getFirebaseAdmin()
    const decoded = await admin.auth().verifyIdToken(token)
    if (!decoded.uid) return { ok: false, reason: 'invalid_token' }

    const expectedProject = expectedFirebaseProjectId()
    if (expectedProject && decoded.aud && String(decoded.aud) !== expectedProject) {
      return { ok: false, reason: 'firebase_config_mismatch' }
    }

    const userDoc = await admin.firestore().collection('users').doc(decoded.uid).get()
    if (!userDoc.exists) return { ok: false, reason: 'profile_missing' }

    const data = userDoc.data()!
    if (data.suspended === true || data.verificationStatus === 'suspended') {
      return { ok: false, reason: 'suspended' }
    }
    const userType = data.userType as ApiUserType
    if (!['sme', 'youth-agent', 'admin'].includes(userType)) {
      return { ok: false, reason: 'profile_missing' }
    }
    if (allowedTypes && !allowedTypes.includes(userType)) {
      return { ok: false, reason: 'role_forbidden' }
    }

    return {
      ok: true,
      user: {
        uid: decoded.uid,
        email: decoded.email,
        userType,
        displayName: data.displayName,
        companyName: data.companyName,
        province: data.location || data.province,
        rating: data.rating,
      },
    }
  } catch (error) {
    return { ok: false, reason: classifyTokenError(error) }
  }
}

/** @deprecated Prefer verifyApiUserDetailed when 401 vs 403 must be distinguished. */
export async function verifyApiUser(
  authorizationHeader: string | null,
  allowedTypes?: ApiUserType[]
): Promise<VerifiedApiUser | null> {
  const result = await verifyApiUserDetailed(authorizationHeader, allowedTypes)
  return result.ok ? result.user : null
}

export function unauthorizedResponse(
  message = 'UNAUTHENTICATED',
  reason?: AuthFailureReason
) {
  const body: { success: false; error: string; reason?: AuthFailureReason } = {
    success: false,
    error: message,
  }
  if (reason) body.reason = reason
  return Response.json(body, { status: 401 })
}

export function forbiddenResponse(
  message = 'FORBIDDEN',
  reason?: AuthFailureReason
) {
  const body: { success: false; error: string; reason?: AuthFailureReason } = {
    success: false,
    error: message,
  }
  if (reason) body.reason = reason
  return Response.json(body, { status: 403 })
}

/** Map detailed verify result to 401/403 Response, or return the user. */
export function responseFromVerifyFailure(
  result: Extract<VerifyApiUserResult, { ok: false }>
): Response {
  if (result.reason === 'role_forbidden') {
    return forbiddenResponse('FORBIDDEN', result.reason)
  }
  return unauthorizedResponse('UNAUTHENTICATED', result.reason)
}
