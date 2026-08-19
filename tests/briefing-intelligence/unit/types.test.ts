import { describe, it, expect, vi } from 'vitest'

// --- Mock Firebase Admin + API auth ---
let fakeAdmin: any
const fakeLog = vi.fn().mockResolvedValue({ id: 'audit-event-id' })

vi.mock('@/lib/backend/firebaseAdmin', () => {
  return {
    getFirebaseAdmin: vi.fn(() => fakeAdmin),
  }
})

vi.mock('@/lib/briefing-intelligence/auditService', () => {
  return {
    logBriefingIntelligenceAuditEvent: vi.fn(async () => fakeLog()),
  }
})

vi.mock('@/lib/services/transactionalEmailService', () => {
  return {
    sendViaResend: vi.fn().mockResolvedValue({ sent: false }),
  }
})

type MockUser = { uid: string; userType: 'admin' | 'youth-agent' | 'sme' }
let mockUser: MockUser | null = null

vi.mock('@/lib/auth/verifyApiUser', () => {
  return {
    verifyApiUser: vi.fn(async (_authorizationHeader: string | null, allowedTypes?: string[]) => {
      if (!mockUser) return null
      if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(mockUser.userType)) return null
      return mockUser
    }),
    unauthorizedResponse: (message = 'Unauthorized') =>
      Response.json({ success: false, error: message }, { status: 401 }),
    forbiddenResponse: (message = 'Forbidden') =>
      Response.json({ success: false, error: message }, { status: 403 }),
  }
})

import { OpenAITranscriptionProvider } from '../../../lib/briefing-intelligence/transcriptionService'

import { POST as deliverPost } from '../../../app/api/briefing-intelligence/deliver/route'
import { PATCH as reviewPatch } from '../../../app/api/briefing-intelligence/review/route'

function makeFakeFirestore(initial: Record<string, Record<string, any>>) {
  const store = initial
  return {
    collection(name: string) {
      if (!store[name]) store[name] = {}
      return {
        doc(id: string) {
          return {
            async get() {
              const exists = store[name]?.[id] !== undefined
              return {
                exists,
                data: () => store[name][id],
              }
            },
            async set(patch: any, options?: { merge?: boolean }) {
              const merge = Boolean(options?.merge)
              store[name][id] = merge ? { ...(store[name][id] || {}), ...patch } : patch
            },
          }
        },
      }
    },
  }
}

function makeFakeStorage() {
  const saves: Array<{ path: string }> = []
  return {
    _saves: saves,
    bucket() {
      return {
        file(path: string) {
          return {
            async save(_bufferOrContents: any) {
              saves.push({ path })
            },
            async getSignedUrl() {
              return ['https://signed.example/audio.mp3']
            },
          }
        },
      }
    },
  }
}

describe('Briefing Intelligence type validators', () => {
  it('valid review + deliver status transitions succeed', async () => {
    const reportId = 'TB-BR-123456'
    const requestId = 'req-1'
    const agentId = 'agent-a'
    const smeId = 'sme-a'
    const tenderId = 'tender-1'

    const store: Record<string, Record<string, any>> = {
      briefingIntelligenceReports: {
        [reportId]: {
          id: reportId,
          reportId,
          requestId,
          tenderId,
          agentId,
          smeId,
          status: 'draft_report',
          evidenceSubmittedAt: new Date().toISOString(),
          pdfStorageRef: null,
          deliveredAt: null,
          deliveryEmailId: null,
        },
      },
      tenderBriefings: {
        [tenderId]: { title: 'Tender title', tenderNumber: 'TN-1', department: 'Dept', issuer: 'Issuer' },
      },
      users: {
        [smeId]: { email: '' }, // force fail-soft email skip
      },
    }

    const storage = makeFakeStorage()
    fakeAdmin = {
      firestore: () => makeFakeFirestore(store),
      storage: () => storage,
    }

    // draft_report -> agent_review
    mockUser = { uid: agentId, userType: 'youth-agent' }
    const res1 = await reviewPatch(
      new Request('http://localhost/api/briefing-intelligence/review', {
        method: 'POST',
        headers: { authorization: 'Bearer y' },
        body: JSON.stringify({ reportId, notes: 'hello' }),
      }) as any
    )
    expect(res1.status).toBe(200)
    expect(store.briefingIntelligenceReports[reportId].status).toBe('agent_review')

    // agent_review -> final (approve)
    const res2 = await reviewPatch(
      new Request('http://localhost/api/briefing-intelligence/review', {
        method: 'POST',
        headers: { authorization: 'Bearer y' },
        body: JSON.stringify({ reportId, notes: 'approved', approve: true }),
      }) as any
    )
    expect(res2.status).toBe(200)
    expect(store.briefingIntelligenceReports[reportId].status).toBe('final')

    // final -> delivered (admin)
    mockUser = { uid: 'admin-1', userType: 'admin' }
    const res3 = await deliverPost(
      new Request('http://localhost/api/briefing-intelligence/deliver', {
        method: 'POST',
        headers: { authorization: 'Bearer a' },
        body: JSON.stringify({ reportId }),
      }) as any
    )
    expect(res3.status).toBe(200)
    expect(store.briefingIntelligenceReports[reportId].status).toBe('delivered')
    expect(store.briefingIntelligenceReports[reportId].pdfStorageRef).toMatch(
      new RegExp(`^briefing-intelligence/${reportId}/pdf/${reportId}\\.pdf$`)
    )
  })

  it('rejects review when report is not on a reviewable step', async () => {
    const reportId = 'TB-BR-654321'
    const store: Record<string, Record<string, any>> = {
      briefingIntelligenceReports: {
        [reportId]: {
          id: reportId,
          reportId,
          requestId: 'req-1',
          tenderId: 'tender-1',
          agentId: 'agent-a',
          smeId: 'sme-a',
          status: 'evidence_uploaded',
          agentReviewNotes: null,
          evidenceSubmittedAt: new Date().toISOString(),
          pdfStorageRef: null,
          deliveredAt: null,
          deliveryEmailId: null,
        },
      },
      tenderBriefings: {},
      users: {},
    }

    fakeAdmin = {
      firestore: () => makeFakeFirestore(store),
      storage: () => makeFakeStorage(),
    }

    mockUser = { uid: 'agent-a', userType: 'youth-agent' }
    const res = await reviewPatch(
      new Request('http://localhost/api/briefing-intelligence/review', {
        method: 'POST',
        headers: { authorization: 'Bearer ya' },
        body: JSON.stringify({ reportId, notes: 'x' }),
      }) as any
    )

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('rejects invalid extracted report content via runtime schema validation', async () => {
    const provider = new OpenAITranscriptionProvider({ apiKey: 'sk-test' })

    const tenderContext = {
      tenderTitle: 'Tender title',
      tenderReference: 'TN-1',
      issuingEntity: 'Dept',
      briefingDate: '2026-08-10',
      briefingVenue: 'Johannesburg',
      description: 'A tender description',
      closingDate: null,
      estimatedValue: null,
      category: null,
      province: null,
    }

    // Invalid: coverHeader missing required `reportDate`.
    const invalidExtracted = {
      coverHeader: {
        reportId: 'TB-BR-ABCDEF',
        tenderTitle: 'Tender title',
        tenderReference: 'TN-1',
        issuingEntity: 'Dept',
        briefingDate: '2026-08-10',
        briefingVenue: 'Johannesburg',
      },
    }

    const fetchMock = vi.fn(async (_url: string) => {
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(invalidExtracted) } }],
        }),
      }
    })
    ;(globalThis as any).fetch = fetchMock

    await expect(provider.extractIntelligence('transcript text', tenderContext as any)).rejects.toThrow(
      /schema validation/i
    )
  })
})

