import { createRemoteJWKSet, jwtVerify } from 'jose'

const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  'tenderbriefing-34679'

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
)

export type VerifiedFirebaseToken = {
  uid: string
  email?: string
}

export async function verifyFirebaseIdTokenEdge(
  token: string
): Promise<VerifiedFirebaseToken> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  })

  const uid = typeof payload.sub === 'string' ? payload.sub : ''
  if (!uid) throw new Error('Invalid token subject')

  return {
    uid,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  }
}
