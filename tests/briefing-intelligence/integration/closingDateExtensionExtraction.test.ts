import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FormData, File, Headers } from 'undici'

import type { BriefingIntelligenceReport } from '@/lib/briefing-intelligence/types'

let fakeAdmin: any
let fakeStore: Record<string, Record<string, any>>

const logMock = vi.fn().mockResolvedValue({ id: 'audit-event-id' })

vi.mock('@/lib/briefing-intelligence/auditService', () => {
  return { logBriefingIntelligenceAuditEvent: () => logMock() }
})

vi.mock('@/lib/backend/firebaseAdmin', () => {
  return { getFirebaseAdmin: vi.fn(() => fakeAdmin) }
})

vi.mock('@/lib/auth/verifyApiUser', () => {
  const tokenToUser: Record<string, { uid: string; userType: 'admin' | 'youth-agent' }> = {
    'ya-a': { uid: 'agent-a-uid', userType: 'youth-agent' },
    'admin-a': { uid: 'admin-uid', userType: 'admin' },
  }

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

import { POST as evidencePost } from '../../../app/api/briefing-intelligence/evidence/route'
import { POST as processPost } from '../../../app/api/briefing-intelligence/process/route'

;(globalThis as any).File = File

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
              fakeStore[name][id] = merge
                ? { ...(fakeStore[name][id] || {}), ...patch }
                : patch
            },
          }
        },
      }
    },
  }
}

function makeFakeStorage() {
  return {
    bucket() {
      return {
        file(path: string) {
          return {
            async save(_buffer: any, _opts?: any) {
              // no-op: we assert on firestore mutations, not blob persistence.
            },
            async getSignedUrl() {
              // Include the original path so mock providers can detect fixtures.
              return [`https://signed.example/${path}`]
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
    method: 'POST',
  } as any
}

function makeFakeRequestForEvidence(token: string, form: FormData) {
  return {
    headers: new Headers({ authorization: `Bearer ${token}` }),
    formData: async () => form,
    method: 'POST',
  } as any
}

describe('Briefing Intelligence closing date extraction (fixture)', () => {
  const oldProvider = process.env.BRIEFING_INTELLIGENCE_PROVIDER

  beforeEach(() => {
    process.env.BRIEFING_INTELLIGENCE_PROVIDER = 'mock'
    fakeStore = {}
    fakeAdmin = {
      firestore: () => makeFakeFirestore(),
      storage: () => makeFakeStorage(),
    }
    logMock.mockClear()
  })

  // Keep other tests from being affected.
  afterEach(() => {
    process.env.BRIEFING_INTELLIGENCE_PROVIDER = oldProvider
  })

  it('surfaces closing date extension as a material changes item and does not invent extra amendments', async () => {
    const requestId = 'req-closure-1'
    const agentId = 'agent-a-uid'
    const smeId = 'sme-a-uid'
    const tenderId = 'tender-closure-1'

    // Tender context used by process route.
    fakeStore.attendanceRequests = {
      [requestId]: {
        agentId,
        assignedAgentId: null,
        notifiedAgents: [],
        smeId,
        tenderId,
      },
    }
    fakeStore.tenderBriefings = {
      [tenderId]: {
        title: 'Tender title',
        tenderNumber: 'TN-1',
        department: 'Issuer',
        briefingDate: '2026-09-05',
        briefingVenue: 'Johannesburg',
        closingDate: '12 September 2026',
      },
    }
    fakeStore.briefingIntelligenceReports = {}

    const form = new FormData()
    // requestId: authoritative link to assignment.
    form.set('requestId', requestId)
    // audio marker: mock provider looks for this exact substring.
    form.set(
      'audio',
      new File([new Uint8Array([1, 2, 3])], 'closingdate-extended-12-19.mp3', {
        type: 'audio/mpeg',
      })
    )
    form.append(
      'attendanceImages',
      new File([new Uint8Array([9])], 'att1.jpg', { type: 'image/jpeg' })
    )

    // Evidence upload creates the report record; process route completes extraction.
    const evidenceRes = await evidencePost(makeFakeRequestForEvidence('ya-a', form) as any)
    expect(evidenceRes.status).toBe(200)
    const evidenceJson = await evidenceRes.json()

    const reportId = String(evidenceJson?.data?.reportId || evidenceJson?.data?.id || '')
    expect(reportId).toBeTruthy()

    const reportAfterEvidence = fakeStore.briefingIntelligenceReports[reportId] as BriefingIntelligenceReport
    expect(reportAfterEvidence).toBeTruthy()
    expect(reportAfterEvidence.status).toBe('evidence_uploaded')
    expect(reportAfterEvidence.attendanceEvidenceRefs?.length).toBeGreaterThan(0)

    const processRes = await processPost(
      makeJsonRequest('admin-a', { reportId }) as any
    )
    expect(processRes.status).toBe(200)

    const processed = fakeStore.briefingIntelligenceReports[reportId]
    expect(processed.status).toBe('draft_report')

    // Advertised tender originally stated 12 September 2026.
    expect(fakeStore.tenderBriefings[tenderId].closingDate).toBe('12 September 2026')
    expect(processed.reportContent.tenderDetails.closingDate).toBe('12 September 2026')

    // Closing date extension must be prominent in changesAndAddenda (exactly one).
    expect(processed.reportContent.changesAndAddenda).toHaveLength(1)
    expect(processed.reportContent.changesAndAddenda[0].change).toContain(
      'Closing date extended from 12 September 2026 to 19 September 2026'
    )
    expect(processed.reportContent.changesAndAddenda[0].change).toContain('19 September 2026')

    // No invented additional amendments.
    const changeText = JSON.stringify(processed.reportContent.changesAndAddenda)
    expect(changeText).not.toMatch(/BOQ|revised specification/i)

    // Q&A remains separate from the amendment section.
    expect(processed.reportContent.questionsAndAnswers).toHaveLength(1)
    expect(processed.reportContent.questionsAndAnswers[0].question).toMatch(/closing date/i)
    expect(processed.reportContent.questionsAndAnswers[0].answer).toContain('19 September 2026')
    expect(JSON.stringify(processed.reportContent.questionsAndAnswers)).not.toEqual(changeText)

    // Key dates also reference the revised closing requirement.
    expect(processed.reportContent.keyDates.some((d: { date: string }) => d.date.includes('19 September 2026'))).toBe(
      true
    )
  })
})
