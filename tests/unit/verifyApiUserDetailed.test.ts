import { describe, it, expect, vi, beforeEach } from 'vitest'

const verifyIdToken = vi.fn()
const getDoc = vi.fn()

vi.mock('@/lib/backend/firebaseAdmin', () => ({
  getFirebaseAdmin: () => ({
    auth: () => ({ verifyIdToken }),
    firestore: () => ({
      collection: () => ({
        doc: () => ({
          get: getDoc,
        }),
      }),
    }),
  }),
}))

import {
  verifyApiUserDetailed,
  unauthorizedResponse,
  forbiddenResponse,
  responseFromVerifyFailure,
} from '@/lib/auth/verifyApiUser'

describe('verifyApiUserDetailed — Youth Agent authz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.FIREBASE_PROJECT_ID = 'tenderbriefing-34679'
  })

  it('returns missing_token without Bearer header', async () => {
    const result = await verifyApiUserDetailed(null, ['youth-agent'])
    expect(result).toEqual({ ok: false, reason: 'missing_token' })
  })

  it('returns invalid_token for unverifiable tokens', async () => {
    verifyIdToken.mockRejectedValueOnce({ code: 'auth/argument-error' })
    const result = await verifyApiUserDetailed('Bearer bad-token', ['youth-agent'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(['invalid_token', 'firebase_config_mismatch']).toContain(result.reason)
    }
  })

  it('returns expired_token for expired ID tokens', async () => {
    verifyIdToken.mockRejectedValueOnce({ code: 'auth/id-token-expired' })
    const result = await verifyApiUserDetailed('Bearer expired', ['youth-agent'])
    expect(result).toEqual({ ok: false, reason: 'expired_token' })
  })

  it('returns profile_missing when Firestore user doc is absent', async () => {
    verifyIdToken.mockResolvedValueOnce({
      uid: 'agent-1',
      email: 'a@test',
      aud: 'tenderbriefing-34679',
    })
    getDoc.mockResolvedValueOnce({ exists: false })
    const result = await verifyApiUserDetailed('Bearer good', ['youth-agent'])
    expect(result).toEqual({ ok: false, reason: 'profile_missing' })
  })

  it('returns role_forbidden for SME on Youth Agent routes', async () => {
    verifyIdToken.mockResolvedValueOnce({
      uid: 'sme-1',
      email: 's@test',
      aud: 'tenderbriefing-34679',
    })
    getDoc.mockResolvedValueOnce({
      exists: true,
      data: () => ({ userType: 'sme' }),
    })
    const result = await verifyApiUserDetailed('Bearer good', ['youth-agent', 'admin'])
    expect(result).toEqual({ ok: false, reason: 'role_forbidden' })
  })

  it('returns ok Youth Agent user for valid token + profile', async () => {
    verifyIdToken.mockResolvedValueOnce({
      uid: 'agent-1',
      email: 'a@test',
      aud: 'tenderbriefing-34679',
    })
    getDoc.mockResolvedValueOnce({
      exists: true,
      data: () => ({ userType: 'youth-agent', displayName: 'Agent' }),
    })
    const result = await verifyApiUserDetailed('Bearer good', ['youth-agent', 'admin'])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.user.uid).toBe('agent-1')
      expect(result.user.userType).toBe('youth-agent')
    }
  })

  it('maps role_forbidden to 403 FORBIDDEN and auth failures to 401', () => {
    const forbidden = responseFromVerifyFailure({ ok: false, reason: 'role_forbidden' })
    expect(forbidden.status).toBe(403)
    const unauth = responseFromVerifyFailure({ ok: false, reason: 'missing_token' })
    expect(unauth.status).toBe(401)
    expect(unauthorizedResponse().status).toBe(401)
    expect(forbiddenResponse().status).toBe(403)
  })

  it('does not trust client-supplied role — only Firestore userType', async () => {
    verifyIdToken.mockResolvedValueOnce({
      uid: 'spoof-1',
      email: 'x@test',
      aud: 'tenderbriefing-34679',
    })
    getDoc.mockResolvedValueOnce({
      exists: true,
      data: () => ({ userType: 'sme' }),
    })
    const result = await verifyApiUserDetailed('Bearer token', ['youth-agent'])
    expect(result).toEqual({ ok: false, reason: 'role_forbidden' })
  })

  it('rejects firebase_config_mismatch when token audience differs from project', async () => {
    verifyIdToken.mockResolvedValueOnce({
      uid: 'agent-1',
      email: 'a@test',
      aud: 'other-project',
    })
    const result = await verifyApiUserDetailed('Bearer good', ['youth-agent'])
    expect(result).toEqual({ ok: false, reason: 'firebase_config_mismatch' })
  })
})
