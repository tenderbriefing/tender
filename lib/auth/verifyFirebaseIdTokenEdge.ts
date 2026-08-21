import { createRemoteJWKSet, jwtVerify } from 'jose'

function resolveFirebaseProjectId(): string {
  // Align with Admin SDK: prefer server FIREBASE_PROJECT_ID, then public project id.
  const id =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    (process.env.NODE_ENV === 'production' ? '' : 'tenderbriefing-34679')
  if (!id) {
    throw new Error('FIREBASE_PROJECT_ID / NEXT_PUBLIC_FIREBASE_PROJECT_ID required')
  }
  return id
}

const JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  )
)

export type VerifiedFirebaseToken = {
  uid: string
  email?: string
}

export async function verifyFirebaseIdTokenEdge(
  token: string
): Promise<VerifiedFirebaseToken> {
  const projectId = resolveFirebaseProjectId()
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  })

  const uid = typeof payload.sub === 'string' ? payload.sub : ''
  if (!uid) throw new Error('Invalid token subject')

  return {
    uid,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  }
}
