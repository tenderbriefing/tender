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

export async function verifyApiUser(
  authorizationHeader: string | null,
  allowedTypes?: ApiUserType[]
): Promise<VerifiedApiUser | null> {
  if (!authorizationHeader?.startsWith('Bearer ')) return null

  const token = authorizationHeader.slice(7).trim()
  if (!token) return null

  try {
    const admin = getFirebaseAdmin()
    const decoded = await admin.auth().verifyIdToken(token)
    if (!decoded.uid) return null

    const userDoc = await admin.firestore().collection('users').doc(decoded.uid).get()
    if (!userDoc.exists) return null

    const data = userDoc.data()!
    const userType = data.userType as ApiUserType
    if (!['sme', 'youth-agent', 'admin'].includes(userType)) return null
    if (allowedTypes && !allowedTypes.includes(userType)) return null

    return {
      uid: decoded.uid,
      email: decoded.email,
      userType,
      displayName: data.displayName,
      companyName: data.companyName,
      province: data.location || data.province,
      rating: data.rating,
    }
  } catch {
    return null
  }
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return Response.json({ success: false, error: message }, { status: 401 })
}

export function forbiddenResponse(message = 'Forbidden') {
  return Response.json({ success: false, error: message }, { status: 403 })
}
