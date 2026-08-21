import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Headers } from 'undici'

let fakeAdmin: any
let fakeStore: Record<string, Record<string, any>>
let lastUserType: string | null = null

vi.mock('@/lib/backend/firebaseAdmin', () => ({
  getFirebaseAdmin: vi.fn(() => fakeAdmin),
}))

vi.mock('@/lib/auth/verifyApiUser', () => ({
  verifyApiUser: vi.fn(async (authorizationHeader: string | null, allowedTypes?: string[]) => {
    if (!authorizationHeader?.startsWith('Bearer ')) return null
    const token = authorizationHeader.slice(7).trim()
    if (token === 'admin-a' && allowedTypes?.includes('admin')) {
      lastUserType = 'admin'
      return { uid: 'admin-uid', userType: 'admin' }
    }
    if (token === 'ya-a' && allowedTypes?.includes('youth-agent')) {
      lastUserType = 'youth-agent'
      return { uid: 'ya-uid', userType: 'youth-agent' }
    }
    // YA token against admin-only route
    if (token === 'ya-a') return null
    return null
  }),
  unauthorizedResponse: (message = 'Unauthorized') =>
    Response.json({ success: false, error: message }, { status: 401 }),
}))

vi.mock('@/lib/briefing-intelligence/transcriptStore', () => ({
  getBriefingTranscriptForReport: vi.fn(async () => ({
    id: 'bt-1',
    fullText: 'secret transcript',
    segments: [],
    language: 'en',
    durationSeconds: 10,
    provider: 'mock',
    model: 'mock',
    status: 'final',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
}))

vi.mock('@/lib/briefing-intelligence/transcriptionJobs', () => ({
  getTranscriptionJobForReport: vi.fn(async () => null),
  createOrResetTranscriptionJob: vi.fn(),
}))

import { GET as transcriptGet } from '../../../app/api/briefing-intelligence/reports/[reportId]/transcript/route'

describe('transcript API access control', () => {
  beforeEach(() => {
    lastUserType = null
    fakeStore = {
      briefingIntelligenceReports: {
        'TB-BR-SEC1': {
          reportId: 'TB-BR-SEC1',
          requestId: 'req-1',
          tenderId: 't-1',
          agentId: 'ya-uid',
          smeId: 'sme-1',
          status: 'draft_report',
          audioFileRef: 'path/a.mp3',
          attendanceEvidenceRefs: ['path/p.jpg'],
        },
      },
    }
    fakeAdmin = {
      firestore: () => ({
        collection: (name: string) => ({
          doc: (id: string) => ({
            get: async () => ({
              exists: Boolean(fakeStore[name]?.[id]),
              data: () => fakeStore[name][id],
            }),
          }),
        }),
      }),
      storage: () => ({
        bucket: () => ({
          file: () => ({
            getSignedUrl: async () => ['https://signed.example/a.mp3'],
          }),
        }),
      }),
    }
  })

  it('denies youth-agent access to transcript endpoint', async () => {
    const res = await transcriptGet(
      {
        headers: new Headers({ authorization: 'Bearer ya-a' }),
      } as any,
      { params: Promise.resolve({ reportId: 'TB-BR-SEC1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('denies unauthenticated access', async () => {
    const res = await transcriptGet(
      { headers: new Headers() } as any,
      { params: Promise.resolve({ reportId: 'TB-BR-SEC1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('allows admin access', async () => {
    const res = await transcriptGet(
      {
        headers: new Headers({ authorization: 'Bearer admin-a' }),
      } as any,
      { params: Promise.resolve({ reportId: 'TB-BR-SEC1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.transcript.fullText).toBe('secret transcript')
  })
})
