import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import {
  evaluateFounderAccess,
  isFounderIntelligenceEnabled,
  type FounderAccessDenial,
} from '@/lib/founder/access'
import type { VerifiedApiUser } from '@/lib/auth/verifyApiUser'
import { verifyApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth/verifyApiUser'

export type FounderUser = VerifiedApiUser & { founderAccess: true }

export async function verifyFounderUser(
  authorizationHeader: string | null
): Promise<{ user: FounderUser } | { error: Response; reason: FounderAccessDenial }> {
  const enabled = isFounderIntelligenceEnabled()
  if (!enabled) {
    return {
      error: forbiddenResponse('Founder User Intelligence is not enabled'),
      reason: 'flag_disabled',
    }
  }

  const user = await verifyApiUser(authorizationHeader, ['admin'])
  if (!user) {
    return { error: unauthorizedResponse('Sign in required'), reason: 'unauthorized' }
  }

  const admin = getFirebaseAdmin()
  const doc = await admin.firestore().collection('users').doc(user.uid).get()
  const data = doc.exists ? doc.data() || {} : {}
  const founderAccess = data.founderAccess === true

  const decision = evaluateFounderAccess({
    enabled: true,
    authenticated: true,
    userType: user.userType,
    email: user.email || data.email,
    founderAccess,
  })

  if (!decision.ok) {
    return {
      error: forbiddenResponse('Founder access required'),
      reason: decision.reason,
    }
  }

  // Audit founder access (best-effort)
  try {
    await admin.firestore().collection('founderAccessLogs').add({
      uid: user.uid,
      email: user.email || data.email || null,
      at: new Date().toISOString(),
      action: 'api_access',
    })
  } catch {
    /* non-blocking */
  }

  return { user: { ...user, founderAccess: true } }
}
