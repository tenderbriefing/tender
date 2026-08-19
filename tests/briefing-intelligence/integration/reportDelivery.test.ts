import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Headers } from 'undici'

import type { BriefingIntelligenceReport } from '../../../lib/briefing-intelligence/types'

let fakeAdmin: any
let fakeStore: Record<string, Record<string, any>>

const tokenToUser: Record<string, { uid: string; userType: 'admin' | 'youth-agent' | 'sme' }> = {
  'admin-a': { uid: 'admin-uid', userType: 'admin' },
}

const logMock = vi.fn().mockResolvedValue({ id: 'audit-event-id' })

const sendViaResendMock = vi.fn().mockResolvedValue({ sent: true, id: 'email-1' })

vi.mock('@/lib/services/transactionalEmailService', () => {
  return {
    // deliver route imports this module as a default export
    default: { sendViaResend: (..._args: any[]) => sendViaResendMock(..._args) },
    // also expose named export for compatibility
    sendViaResend: (..._args: any[]) => sendViaResendMock(..._args),
  }
})

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
  const savedPaths: string[] = []
  return {
    savedPaths,
    bucket() {
      return {
        file(path: string) {
          return {
            async save(_buffer: any, _opts?: any) {
              savedPaths.push(path)
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

function makeJsonRequest(token: string, body: any) {
  return {
    headers: new Headers({ authorization: `Bearer ${token}` }),
    json: async () => body,
  } as any
}

describe('Briefing Intelligence report delivery', () => {
  beforeEach(() => {
    fakeStore = {}
    sendViaResendMock.mockClear()
    logMock.mockClear()

    const storage = makeFakeStorage()
    fakeAdmin = {
      firestore: () => makeFakeFirestore(),
      storage: () => storage,
    }

    const reportId = 'TB-BR-DELIV1'
    const pdfPath = `briefing-intelligence/${reportId}/pdf/${reportId}.pdf`

    const report: BriefingIntelligenceReport = {
      id: reportId,
      reportId,
      requestId: 'req-1',
      tenderId: 'tender-1',
      agentId: 'agent-a-uid',
      smeId: 'sme-a-uid',
      status: 'final',
      evidenceSubmittedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      processingStartedAt: null,
      draftReadyAt: new Date().toISOString(),
      agentReviewedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      deliveredAt: null,
      slaDeadline: null,
      slaBreached: false,
      audioFileRef: null,
      audioFileName: null,
      audioFileSizeMb: null,
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
      reportContent: {
        coverHeader: {
          reportId,
          tenderTitle: 'Tender title',
          tenderReference: 'TN-1',
          issuingEntity: 'Dept',
          briefingDate: '2026-08-10',
          briefingVenue: 'Johannesburg',
          reportDate: new Date().toISOString(),
        },
        tenderDetails: {
          description: null,
          closingDate: null,
          estimatedValue: null,
          category: null,
          province: null,
        },
        executiveSummary: { summary: 'sum', keyTakeaway: 'takeaway' },
        keyRequirements: [],
        clarifications: [],
        questionsAndAnswers: [],
        changesAndAddenda: [],
        complianceRisks: [],
        keyDates: [],
        recommendedActions: [],
        attendanceInfo: { estimatedAttendees: null, agentArrivalTime: null, briefingDuration: null },
        attendanceVerification: {
          verified: false,
          method: 'mock',
          notes: null,
          redactedAttendeeCount: null,
        },
        agentFieldObservations: { siteInspection: null, docsDistributed: null, importantAnnouncement: null, generalNotes: null },
        sourceAndVerification: {
          audioRecorded: false,
          transcriptionProvider: null,
          aiModel: null,
          processingDate: null,
          confidenceScore: null,
        },
        importantNotice: 'notice',
        reportCertification: {
          certifiedBy: 'cert',
          certificationDate: new Date().toISOString(),
          reportVersion: 'v1',
        },
      },
      agentReviewNotes: null,
      pdfStorageRef: null,
      deliveryEmailId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processingAttempts: 1,
      lastError: null,
    }

    fakeStore.briefingIntelligenceReports = { [reportId]: report }
    fakeStore.tenderBriefings = { ['tender-1']: { title: 'Tender title', tenderNumber: 'TN-1' } }
    fakeStore.users = { ['sme-a-uid']: { email: 'sme@example.com' } }

    // Keep around for assertions.
    ;(globalThis as any).__test_reportId = reportId
    ;(globalThis as any).__test_pdfPath = pdfPath
  })

  it('delivery is idempotent and sends email + stores PDF on first call only', async () => {
    const reportId = (globalThis as any).__test_reportId as string
    const pdfPath = (globalThis as any).__test_pdfPath as string

    // First delivery.
    const res1 = await deliverPost(makeJsonRequest('admin-a', { reportId }) as any)
    expect(res1.status).toBe(200)
    const json1 = await res1.json()
    expect(json1.success).toBe(true)
    expect(json1.data.reportId).toBe(reportId)

    expect(sendViaResendMock).toHaveBeenCalledTimes(1)
    expect(fakeStore.briefingIntelligenceReports[reportId].status).toBe('delivered')
    expect(fakeStore.briefingIntelligenceReports[reportId].pdfStorageRef).toBe(pdfPath)
    expect(fakeStore.briefingIntelligenceReports[reportId].deliveredAt).toBeTruthy()
    expect(fakeStore.briefingIntelligenceReports[reportId].deliveryEmailId).toBe('email-1')

    // Second delivery: should be skipped.
    const res2 = await deliverPost(makeJsonRequest('admin-a', { reportId }) as any)
    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2.success).toBe(true)
    expect(json2.data.skipped).toBe(true)

    expect(sendViaResendMock).toHaveBeenCalledTimes(1)
    expect(fakeStore.briefingIntelligenceReports[reportId].status).toBe('delivered')
  })
})

