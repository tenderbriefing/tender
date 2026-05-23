import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'

export async function verifyAdminIdToken(
  authorizationHeader: string | null
): Promise<{ uid: string; email?: string } | null> {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authorizationHeader.slice(7).trim()
  if (!token) return null

  try {
    const admin = getFirebaseAdmin()
    const decoded = await admin.auth().verifyIdToken(token)
    if (!decoded.uid) return null

    const userDoc = await admin.firestore().collection('users').doc(decoded.uid).get()
    const userType = userDoc.data()?.userType

    if (userType !== 'admin') {
      return null
    }

    return { uid: decoded.uid, email: decoded.email }
  } catch {
    return null
  }
}
