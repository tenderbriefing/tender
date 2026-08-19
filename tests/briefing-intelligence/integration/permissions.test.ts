import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Headers } from 'undici'

let fakeAdmin: any
let fakeStore: Record<string, Record<string, any>>

const tokenToUser: Record<string, { uid: string; userType: 'admin' | 'youth-agent' | 'sme' }> = {
  'ya-a': { uid: 'agent-a-uid', userType: 'youth-agent' },
  'ya-b': { uid: 'agent-b-uid', userType: 'youth-agent' },
  'sme-a': { uid: 'sme-a-uid', userType: 'sme' },
  'sme-b': { uid: 'sme-b-uid', userType: 'sme' },
  'admin-a': { uid: 'admin-uid', userType: 'admin' },
}

const logMock = vi.fn().mockResolvedValue({ id: 'audit-event-id' })

vi.mock('@/lib/briefing-intelligence/auditService', () => {
  return { logBriefingIntelligenceAuditEvent: () => logMock() }
})

vi.mock('@/lib/backend/firebaseAdmin', () => {
  return { getFirebaseAdmin: vi.fn(() => fakeAdmin) }
})

vi.mock('@/lib/auth/verifyApiUser', () => {
  return {
    verifyApiUser: vi.fn(async (authorizationHeader: string | null, allowedTypes?: string[]) => {
      if (!authorizationHeader?.startsWith('Bearer ')) return null
      const token = authorizationHeader.slice(7).trim()
      const user = tokenToUser[token] || null
      if (!user) return null
      if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(user.userType)) return null
      return user
    }),
    unauthorizedResponse: (message = 'Unauthorized') =>
      Response.json({ success: false, error: message }, { status: 401 }),
    forbiddenResponse: (message = 'Forbidden') =>
      Response.json({ success: false, error: message }, { status: 403 }),
  }
})

import { GET as reportGet } from '../../../app/api/briefing-intelligence/[reportId]/route'
import { PATCH as reviewPatch } from '../../../app/api/briefing-intelligence/review/route'

function makeFakeFirestore() {
  return {
    collection(name: string) {
      if (!fakeStore[name]) fakeStore[name] = {}
      return {
        doc(id: string) {
          return {
            async get() {
              const exists = fakeStore[name]?.[id] !== undefined
              return { exists, data: () => fakeStore[name][id] }
            },
            async set(patch: any, options?: { merge?: boolean }) {
              const merge = Boolean(options?.merge)
              fakeStore[name][id] = merge ? { ...(fakeStore[name][id] || {}), ...patch } : patch
            },
          }
        },
      }
    },
  }
}

function makeJsonRequest(token: string, body: any) {
  return {
    headers: new Headers({ authorization: `Bearer ${token}` }),
    json: async () => body,
  } as any
}

function makeGetRequest(token: string) {
  return {
    headers: new Headers({ authorization: `Bearer ${token}` }),
  } as any
}

describe('Briefing Intelligence permissions (IDOR)', () => {
  const reportId = 'TB-BR-PERM1'
  const requestId = 'req-1'
  const tenderId = 'tender-1'
  const agentId = 'agent-a-uid'
  const smeId = 'sme-a-uid'

  beforeEach(() => {
    fakeStore = {}
    logMock.mockClear()

    fakeAdmin = {
      firestore: () => makeFakeFirestore(),
      storage: () => ({}),
    }

    fakeStore.briefingIntelligenceReports = {
      [reportId]: {
        id: reportId,
        reportId,
        requestId,
        tenderId,
        agentId,
        smeId,
        status: 'delivered',
        evidenceSubmittedAt: new Date().toISOString(),
        deliveredAt: '2026-08-19T12:00:00.000Z',
        pdfStorageRef: `briefing-intelligence/${reportId}/pdf/${reportId}.pdf`,
        deliveryEmailId: 'email-abc',
        agentReviewNotes: 'final note',
      },
    }
  })

  it('SME can only see own reports by smeId', async () => {
    const resOwn = await reportGet(makeGetRequest('sme-a') as any, { params: { reportId } })
    expect(resOwn.status).toBe(200)
    const jsonOwn = await resOwn.json()
    expect(jsonOwn.success).toBe(true)

    const resOther = await reportGet(makeGetRequest('sme-b') as any, { params: { reportId } })
    expect(resOther.status).toBe(403)
  })

  it('YA can only see own reports by agentId', async () => {
    const resOwn = await reportGet(makeGetRequest('ya-a') as any, { params: { reportId } })
    expect(resOwn.status).toBe(200)
    const jsonOwn = await resOwn.json()
    expect(jsonOwn.success).toBe(true)

    const resOther = await reportGet(makeGetRequest('ya-b') as any, { params: { reportId } })
    expect(resOther.status).toBe(403)
  })

  it('Admin sees all reports', async () => {
    const res = await reportGet(makeGetRequest('admin-a') as any, { params: { reportId } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('cannot modify delivered reports via youth-agent review', async () => {
    const before = { ...fakeStore.briefingIntelligenceReports[reportId] }

    const res = await reviewPatch(
      makeJsonRequest('ya-a', {
        reportId,
        notes: 'should not change',
        approve: true,
      }) as any
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.skipped).toBe(true)

    expect(fakeStore.briefingIntelligenceReports[reportId]).toEqual(before)
  })
})

