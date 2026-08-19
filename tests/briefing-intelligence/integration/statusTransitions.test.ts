import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Headers } from 'undici'

import type { BriefingIntelligenceReport } from '../../../lib/briefing-intelligence/types'

let fakeAdmin: any
let fakeStore: Record<string, Record<string, any>>

const tokenToUser: Record<string, { uid: string; userType: 'admin' | 'youth-agent' | 'sme' }> = {
  'ya-a': { uid: 'agent-a-uid', userType: 'youth-agent' },
  'admin-a': { uid: 'admin-uid', userType: 'admin' },
}

const logMock = vi.fn().mockResolvedValue({ id: 'audit-event-id' })

vi.mock('@/lib/briefing-intelligence/auditService', () => {
  return { logBriefingIntelligenceAuditEvent: () => logMock() }
})

vi.mock('@/lib/backend/firebaseAdmin', () => {
  return {
    getFirebaseAdmin: vi.fn(() => fakeAdmin),
  }
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

import { POST as processPost } from '../../../app/api/briefing-intelligence/process/route'
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

function makeFakeStorage() {
  const saves: Array<{ path: string; type: string }> = []
  return {
    saves,
    bucket() {
      return {
        file(path: string) {
          return {
            async save(_buffer: any, _opts?: any) {
              saves.push({ path, type: 'save' })
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

function makeJsonRequest(method: string, url: string, token: string, body: any) {
  return {
    headers: new Headers({ authorization: `Bearer ${token}` }),
    json: async () => body,
    method,
  } as any
}

function makeReviewRequest(token: string, reportId: string, patch: any) {
  return makeJsonRequest('PATCH', 'http://localhost/api/briefing-intelligence/review', token, {
    reportId,
    ...patch,
  })
}

describe('Briefing Intelligence status transitions', () => {
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

  it('valid transitions succeed: evidence_uploaded -> processing -> draft_report -> agent_review -> final', async () => {
    const reportId = 'TB-BR-111111'
    const requestId = 'req-1'
    const tenderId = 'tender-1'
    const agentId = tokenToUser['ya-a'].uid
    const smeId = 'sme-a-uid'

    const seeded: BriefingIntelligenceReport = {
      id: reportId,
      reportId,
      requestId,
      tenderId,
      agentId,
      smeId,
      status: 'evidence_uploaded',
      evidenceSubmittedAt: new Date().toISOString(),
      processingStartedAt: null,
      draftReadyAt: null,
      agentReviewedAt: null,
      finalizedAt: null,
      deliveredAt: null,
      slaDeadline: null,
      slaBreached: false,
      audioFileRef: `workspace-evidence/${requestId}/${agentId}/briefing-intelligence/${reportId}/audio/audio.mp3`,
      audioFileName: 'audio.mp3',
      audioFileSizeMb: 1,
      attendanceEvidenceRefs: [],
      agentObservations: {
        arrivalTime: null,
        briefingStartTime: null,
        briefingEndTime: null,
        approxAttendees: null,
        siteInspection: null,
        docsDistributed: null,
        importantAnnouncement: null,
        shortNote: null,
      },
      transcription: null,
      reportContent: null,
      agentReviewNotes: null,
      pdfStorageRef: null,
      deliveryEmailId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processingAttempts: 0,
      lastError: null,
    }

    fakeStore.briefingIntelligenceReports = { [reportId]: seeded }
    fakeStore.attendanceRequests = {
      [requestId]: { tenderId, smeId },
    }
    fakeStore.tenderBriefings = {
      [tenderId]: {
        title: 'Tender title',
        tenderNumber: 'TN-1',
        department: 'Dept',
        issuer: 'Issuer',
        briefingDate: '2026-08-10',
        briefingVenue: 'Johannesburg',
        description: 'desc',
        closingDate: null,
        estimatedValue: null,
        industrySector: null,
        province: null,
      },
    }

    // Admin: process
    const resProcess = await processPost(
      makeJsonRequest('POST', 'http://localhost/api/briefing-intelligence/process', 'admin-a', {
        reportId,
      })
    )
    expect(resProcess.status).toBe(200)
    const jsonProcess = await resProcess.json()
    expect(jsonProcess.success).toBe(true)

    expect(fakeStore.briefingIntelligenceReports[reportId].status).toBe('draft_report')
    expect(fakeStore.briefingIntelligenceReports[reportId].draftReadyAt).toBeTruthy()
    expect(fakeStore.briefingIntelligenceReports[reportId].reportContent).toBeTruthy()
    expect(fakeStore.briefingIntelligenceReports[reportId].transcription).toBeTruthy()

    // Youth agent: review -> agent_review
    const resReview1 = await reviewPatch(
      makeReviewRequest('ya-a', reportId, { notes: 'agent notes', approve: true })
    )
    expect(resReview1.status).toBe(200)
    expect(fakeStore.briefingIntelligenceReports[reportId].status).toBe('agent_review')

    // Youth agent: review -> final
    const resReview2 = await reviewPatch(makeReviewRequest('ya-a', reportId, { notes: 'final notes', approve: true }))
    expect(resReview2.status).toBe(200)
    expect(fakeStore.briefingIntelligenceReports[reportId].status).toBe('final')
  })

  it('rejects review from evidence_uploaded (cannot skip steps)', async () => {
    const reportId = 'TB-BR-222222'
    const requestId = 'req-2'
    const tenderId = 'tender-2'
    const agentId = tokenToUser['ya-a'].uid
    const smeId = 'sme-a-uid'

    fakeStore.briefingIntelligenceReports = {
      [reportId]: {
        id: reportId,
        reportId,
        requestId,
        tenderId,
        agentId,
        smeId,
        status: 'evidence_uploaded',
        agentReviewNotes: null,
        evidenceSubmittedAt: new Date().toISOString(),
      },
    }
    fakeAdmin = {
      firestore: () => makeFakeFirestore(),
      storage: () => makeFakeStorage(),
    }

    const res = await reviewPatch(makeReviewRequest('ya-a', reportId, { notes: 'x', approve: true }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('cannot jump from draft_report to final in a single review call', async () => {
    const reportId = 'TB-BR-333333'
    fakeStore.briefingIntelligenceReports = {
      [reportId]: {
        id: reportId,
        reportId,
        requestId: 'req-3',
        tenderId: 'tender-3',
        agentId: tokenToUser['ya-a'].uid,
        smeId: 'sme-a-uid',
        status: 'draft_report',
        agentReviewNotes: null,
      },
    }
    fakeAdmin = {
      firestore: () => makeFakeFirestore(),
      storage: () => makeFakeStorage(),
    }

    const res1 = await reviewPatch(makeReviewRequest('ya-a', reportId, { notes: 'draft notes', approve: true }))
    expect(res1.status).toBe(200)
    expect(fakeStore.briefingIntelligenceReports[reportId].status).toBe('agent_review')
    expect(fakeStore.briefingIntelligenceReports[reportId].finalizedAt).toBeUndefined()
  })

  it('processing_failed allows retry: processing_failed -> processing -> draft_report', async () => {
    const reportId = 'TB-BR-444444'
    const requestId = 'req-4'
    const tenderId = 'tender-4'
    const agentId = tokenToUser['ya-a'].uid
    const smeId = 'sme-a-uid'

    fakeStore.briefingIntelligenceReports = {
      [reportId]: {
        id: reportId,
        reportId,
        requestId,
        tenderId,
        agentId,
        smeId,
        status: 'processing_failed',
        evidenceSubmittedAt: new Date().toISOString(),
        processingStartedAt: null,
        draftReadyAt: null,
        audioFileRef: `workspace-evidence/${requestId}/${agentId}/briefing-intelligence/${reportId}/audio/audio.mp3`,
        audioFileName: 'audio.mp3',
        audioFileSizeMb: 1,
        attendanceEvidenceRefs: [],
        agentObservations: {
          arrivalTime: null,
          briefingStartTime: null,
          briefingEndTime: null,
          approxAttendees: null,
          siteInspection: null,
          docsDistributed: null,
          importantAnnouncement: null,
          shortNote: null,
        },
        transcription: null,
        reportContent: null,
        agentReviewNotes: null,
        pdfStorageRef: null,
        deliveryEmailId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        processingAttempts: 1,
        lastError: 'previous failure',
        slaBreached: false,
        slaDeadline: null,
      },
    }
    fakeStore.attendanceRequests = { [requestId]: { tenderId, smeId } }
    fakeStore.tenderBriefings = {
      [tenderId]: {
        title: 'Tender title',
        tenderNumber: 'TN-4',
        department: 'Dept',
        issuer: 'Issuer',
        briefingDate: '2026-08-10',
        briefingVenue: 'Johannesburg',
        description: 'desc',
        closingDate: null,
        estimatedValue: null,
        industrySector: null,
        province: null,
      },
    }

    const resProcess = await processPost(
      makeJsonRequest('POST', 'http://localhost/api/briefing-intelligence/process', 'admin-a', {
        reportId,
      })
    )
    expect(resProcess.status).toBe(200)
    expect(fakeStore.briefingIntelligenceReports[reportId].status).toBe('draft_report')
    expect(fakeStore.briefingIntelligenceReports[reportId].processingAttempts).toBe(2)
  })
})

