import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Headers } from 'undici'

import type { BriefingIntelligenceReport } from '../../../lib/briefing-intelligence/types'

let fakeAdmin: any
let fakeStore: Record<string, Record<string, any>>

vi.mock('../../../lib/briefing-intelligence/transcriptionService', () => {
  return {
    getTranscriptionProvider: () => {
      return {
        transcribe: vi.fn(async () => {
          return {
            provider: 'mock-provider',
            transcriptText: 'TRANSCRIPT_TEXT',
            transcriptWordCount: 2,
            language: null,
            confidence: null,
            completedAt: new Date().toISOString(),
          }
        }),
        extractIntelligence: vi.fn(async () => {
          throw new Error('OpenAI extraction failed (simulated)')
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

vi.mock('@/lib/services/transactionalEmailService', () => {
  return {
    default: {
      sendViaResend: vi.fn().mockResolvedValue({ sent: false }),
    },
  }
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
import { POST as deliverPost } from '../../../app/api/briefing-intelligence/deliver/route'

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

describe('Extraction failure is fail-closed', () => {
  beforeEach(() => {
    fakeStore = {}
    fakeAdmin = {
      firestore: () => makeFakeFirestore(),
      storage: () => makeFakeStorage(),
    }
  })

  it('sets processing_failed, clears reportContent/transcription, and blocks delivery', async () => {
    const reportId = 'TB-BR-FAIL-1'
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
        attendanceEvidenceRefs: ['workspace-evidence/.../attendance/1.jpg'],
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
    expect(res.status).toBe(500)

    const updated = fakeStore.briefingIntelligenceReports[reportId]
    expect(updated.status).toBe('processing_failed')
    expect(updated.reportContent).toBeNull()
    expect(updated.transcription).toBeNull()

    // Deliver should be blocked because status isn't final.
    const resDeliver = await deliverPost(
      makeJsonRequest('POST', 'http://localhost/api/briefing-intelligence/deliver', 'admin-a', { reportId })
    )
    expect(resDeliver.status).toBe(409)
  })
})

