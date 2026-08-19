import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Headers } from 'undici'

import type { BriefingIntelligenceReport, BriefingReportContent } from '../../../lib/briefing-intelligence/types'

let fakeAdmin: any
let fakeStore: Record<string, Record<string, any>>

// Capture arguments to ensure processing receives the expected inputs.
let transcribeCalls: string[] = []
let extractCalls: Array<{ transcript: string; tenderContext: any }> = []

const makeMockContent = (verified: boolean): BriefingReportContent =>
  ({
    coverHeader: {
      reportId: 'TB-BR-MOCK',
      tenderTitle: 'Tender title',
      tenderReference: 'TN-1',
      issuingEntity: 'Dept',
      briefingDate: '2026-08-10',
      briefingVenue: 'Johannesburg',
      reportDate: '2026-08-19T00:00:00.000Z',
    },
    tenderDetails: {
      description: null,
      closingDate: null,
      estimatedValue: null,
      category: null,
      province: null,
    },
    executiveSummary: { summary: 'summary', keyTakeaway: 'key' },
    keyRequirements: [],
    clarifications: [],
    questionsAndAnswers: [],
    changesAndAddenda: [],
    complianceRisks: [],
    keyDates: [],
    recommendedActions: [],
    attendanceInfo: { estimatedAttendees: null, agentArrivalTime: null, briefingDuration: null },
    attendanceVerification: { verified, method: 'mock-method', notes: 'notes', redactedAttendeeCount: null },
    agentFieldObservations: {
      siteInspection: null,
      docsDistributed: null,
      importantAnnouncement: null,
      generalNotes: null,
    },
    sourceAndVerification: {
      audioRecorded: true,
      transcriptionProvider: null,
      aiModel: null,
      processingDate: null,
      confidenceScore: null,
    },
    importantNotice: 'notice',
    reportCertification: {
      certifiedBy: 'sys',
      certificationDate: '2026-08-19T00:00:00.000Z',
      reportVersion: '1.0',
    },
  }) as any

// Mock transcription provider used by the process route.
vi.mock('../../../lib/briefing-intelligence/transcriptionService', () => {
  return {
    getTranscriptionProvider: () => {
      return {
        transcribe: vi.fn(async (audioUrl: string) => {
          transcribeCalls.push(audioUrl)
          return {
            provider: 'mock-provider',
            transcriptText: 'TRANSCRIPT_TEXT',
            transcriptWordCount: 2,
            language: null,
            confidence: null,
            completedAt: new Date().toISOString(),
          }
        }),
        extractIntelligence: vi.fn(async (_transcript: string, tenderContext: any) => {
          extractCalls.push({ transcript: _transcript, tenderContext })
          return makeMockContent(true)
        }),
      }
    },
  }
})

vi.mock('@/lib/briefing-intelligence/auditService', () => {
  return { logBriefingIntelligenceAuditEvent: vi.fn(async () => ({ id: 'audit' })) }
})

vi.mock('@/lib/backend/firebaseAdmin', () => {
  return { getFirebaseAdmin: vi.fn(() => fakeAdmin) }
})

vi.mock('@/lib/auth/verifyApiUser', () => {
  return {
    verifyApiUser: vi.fn(async (authorizationHeader: string | null, allowedTypes?: string[]) => {
      if (!authorizationHeader?.startsWith('Bearer ')) return null
      const token = authorizationHeader.slice(7).trim()
      if (!allowedTypes?.includes('admin')) return null
      if (token !== 'admin-a') return null
      return { uid: 'admin-uid', userType: 'admin' }
    }),
    unauthorizedResponse: (message = 'Unauthorized') =>
      Response.json({ success: false, error: message }, { status: 401 }),
    forbiddenResponse: (message = 'Forbidden') =>
      Response.json({ success: false, error: message }, { status: 403 }),
  }
})

import { POST as processPost } from '../../../app/api/briefing-intelligence/process/route'

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
  return {
    bucket() {
      return {
        file(_path: string) {
          return {
            async save(_contents: any, _opts?: any) {
              // noop for test
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
    url,
  } as any
}

describe('Attendance verification requires evidence', () => {
  beforeEach(() => {
    transcribeCalls = []
    extractCalls = []
    fakeStore = {}
    fakeAdmin = {
      firestore: () => makeFakeFirestore(),
      storage: () => makeFakeStorage(),
    }
  })

  it('forces attendanceVerification.verified=false when attendanceEvidenceRefs is empty', async () => {
    const reportId = 'TB-BR-VER-1'
    const requestId = 'req-1'
    const tenderId = 'tender-1'

    fakeStore.briefingIntelligenceReports = {
      [reportId]: {
        id: reportId,
        reportId,
        requestId,
        tenderId,
        agentId: 'agent-a-uid',
        smeId: 'sme-a-uid',
        status: 'evidence_uploaded',
        evidenceSubmittedAt: new Date().toISOString(),
        processingStartedAt: null,
        draftReadyAt: null,
        agentReviewedAt: null,
        finalizedAt: null,
        deliveredAt: null,
        slaDeadline: null,
        slaBreached: false,
        audioFileRef: `workspace-evidence/${requestId}/agent-a-uid/briefing-intelligence/${reportId}/audio/audio.mp3`,
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
      } satisfies BriefingIntelligenceReport,
    }

    fakeStore.attendanceRequests = {
      [requestId]: { tenderId, smeId: 'sme-a-uid' },
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

    const res = await processPost(
      makeJsonRequest('POST', 'http://localhost/api/briefing-intelligence/process', 'admin-a', { reportId })
    )
    expect(res.status).toBe(200)
    expect(transcribeCalls).toEqual(['https://signed.example/audio.mp3'])

    const updated = fakeStore.briefingIntelligenceReports[reportId]
    expect(updated.status).toBe('draft_report')
    expect(updated.reportContent.attendanceVerification.verified).toBe(false)
    expect(updated.reportContent.attendanceVerification.method).toBe('attendance_proof_missing')

    expect(extractCalls.length).toBe(1)
    expect(extractCalls[0].tenderContext.tenderTitle).toBe('Tender title')
    expect(extractCalls[0].tenderContext.tenderReference).toBe('TN-1')
  })
})

