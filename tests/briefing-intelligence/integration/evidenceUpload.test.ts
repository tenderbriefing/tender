import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FormData, File, Headers } from 'undici'

import type { BriefingIntelligenceReport } from '../../../lib/briefing-intelligence/types'

;(globalThis as any).File = File

type User = { uid: string; userType: 'admin' | 'youth-agent' | 'sme' }

let fakeAdmin: any
let fakeStore: Record<string, Record<string, any>>

const logMock = vi.fn().mockResolvedValue({ id: 'audit-event-id' })

vi.mock('@/lib/briefing-intelligence/auditService', () => {
  return { logBriefingIntelligenceAuditEvent: (..._args: any[]) => logMock() }
})

vi.mock('@/lib/backend/firebaseAdmin', () => {
  return {
    getFirebaseAdmin: vi.fn(() => fakeAdmin),
  }
})

vi.mock('@/lib/auth/verifyApiUser', () => {
  const verifyApiUser = vi.fn(
    async (authorizationHeader: string | null, allowedTypes?: Array<User['userType']>) => {
      if (!authorizationHeader?.startsWith('Bearer ')) return null
      const token = authorizationHeader.slice(7).trim()
      const user = tokenToUser[token] || null
      if (!user) return null
      if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(user.userType)) return null
      return user
    }
  )

  const unauthorizedResponse = (message = 'Unauthorized') =>
    Response.json({ success: false, error: message }, { status: 401 })
  const forbiddenResponse = (message = 'Forbidden') =>
    Response.json({ success: false, error: message }, { status: 403 })

  return { verifyApiUser, unauthorizedResponse, forbiddenResponse }
})

const tokenToUser: Record<string, User> = {
  'ya-a': { uid: 'agent-a-uid', userType: 'youth-agent' },
  'sme-a': { uid: 'sme-a-uid', userType: 'sme' },
  'admin-a': { uid: 'admin-uid', userType: 'admin' },
  'ya-b': { uid: 'agent-b-uid', userType: 'youth-agent' },
}

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
  const saves: Array<{ path: string; size?: number }> = []
  return {
    saves,
    bucket() {
      return {
        file(path: string) {
          return {
            async save(contentsOrBuffer: any, _opts?: any) {
              saves.push({ path, size: contentsOrBuffer?.byteLength })
            },
          }
        },
      }
    },
  }
}

import { POST as evidencePost } from '../../../app/api/briefing-intelligence/evidence/route'

function makeFakeRequest(params: {
  token: string
  form: FormData
}) {
  return {
    headers: new Headers({ authorization: `Bearer ${params.token}` }),
    formData: async () => params.form,
  } as any
}

function fileWithSize(name: string, type: string, sizeBytes: number) {
  const f = new File([new Uint8Array([1])], name, { type })
  Object.defineProperty(f, 'size', { value: sizeBytes })
  return f
}

describe('Briefing Intelligence evidence upload', () => {
  beforeEach(() => {
    fakeStore = {}
    fakeAdmin = {
      firestore: () => makeFakeFirestore(),
      storage: () => makeFakeStorage(),
    }
    logMock.mockClear()
  })

  it('YA can upload evidence for own assignment', async () => {
    const requestId = 'req-1'
    const agentId = 'agent-a-uid'
    const smeId = 'sme-a-uid'
    const tenderId = 'tender-1'

    fakeStore.attendanceRequests = {
      [requestId]: {
        agentId,
        assignedAgentId: null,
        notifiedAgents: [],
        smeId,
        tenderId,
      },
    }
    fakeStore.briefingIntelligenceReports = {}

    const form = new FormData()
    form.set('requestId', requestId)
    form.set('audio', new File([new Uint8Array([1, 2, 3])], 'voice.mp3', { type: 'audio/mpeg' }))
    form.append('attendanceImages', new File([new Uint8Array([9])], 'img1.jpg', { type: 'image/jpeg' }))

    const res = await evidencePost(makeFakeRequest({ token: 'ya-a', form }) as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)

    const reportId = json.data.reportId as string
    const report = (fakeStore.briefingIntelligenceReports as Record<string, BriefingIntelligenceReport>)[
      reportId
    ]
    expect(report).toBeTruthy()
    expect(report.agentId).toBe(agentId)
    expect(report.requestId).toBe(requestId)
    expect(report.smeId).toBe(smeId)
    expect(report.status).toBe('evidence_uploaded')
    expect(report.attendanceEvidenceRefs.length).toBe(1)
    expect(report.audioFileRef).toMatch(/workspace-evidence\/.+\/briefing-intelligence\/.+\/audio\//)
    expect(logMock).toHaveBeenCalled()
  })

  it('auto-resolves tender from booking (ignores agent tender fields)', async () => {
    const requestId = 'req-tender-resolve'
    const agentId = 'agent-a-uid'
    const smeId = 'sme-a-uid'
    const tenderIdFromBooking = 'tender-expected'

    fakeStore.attendanceRequests = {
      [requestId]: {
        agentId,
        assignedAgentId: null,
        notifiedAgents: [],
        smeId,
        tenderId: tenderIdFromBooking,
      },
    }
    fakeStore.briefingIntelligenceReports = {}

    const form = new FormData()
    form.set('requestId', requestId)
    form.set('audio', new File([new Uint8Array([1, 2, 3])], 'voice.mp3', { type: 'audio/mpeg' }))
    form.append('attendanceImages', new File([new Uint8Array([9])], 'img1.jpg', { type: 'image/jpeg' }))

    // These should not affect tender resolution.
    form.set('tenderId', 'tender-from-agent-ui')
    form.set('tenderContext', JSON.stringify({ tenderId: 'tender-from-agent-ui' }))
    form.set('tenderDocument', new File([new Uint8Array([7])], 'tender.pdf', { type: 'application/pdf' }))

    const res = await evidencePost(makeFakeRequest({ token: 'ya-a', form }) as any)
    expect(res.status).toBe(200)
    const json = await res.json()

    const reportId = json.data.reportId as string
    const report = (fakeStore.briefingIntelligenceReports as Record<string, BriefingIntelligenceReport>)[
      reportId
    ]
    expect(report.tenderId).toBe(tenderIdFromBooking)
  })

  it('requires audio file', async () => {
    const requestId = 'req-audio-missing'
    fakeStore.attendanceRequests = {
      [requestId]: {
        agentId: 'agent-a-uid',
        assignedAgentId: null,
        notifiedAgents: [],
        smeId: 'sme-a-uid',
        tenderId: 'tender-1',
      },
    }

    const form = new FormData()
    form.set('requestId', requestId)
    form.append('attendanceImages', new File([new Uint8Array([9])], 'img1.jpg', { type: 'image/jpeg' }))

    const res = await evidencePost(makeFakeRequest({ token: 'ya-a', form }) as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/audio file is required/i)
  })

  it("YA cannot upload evidence for someone else's assignment", async () => {
    const requestId = 'req-2'
    const agentId = 'agent-a-uid'
    const smeId = 'sme-a-uid'
    const tenderId = 'tender-1'

    fakeStore.attendanceRequests = {
      [requestId]: {
        agentId: 'agent-b-uid',
        assignedAgentId: 'agent-b-uid',
        notifiedAgents: [],
        smeId,
        tenderId,
      },
    }

    const form = new FormData()
    form.set('requestId', requestId)
    form.set('audio', new File([new Uint8Array([1, 2, 3])], 'voice.mp3', { type: 'audio/mpeg' }))
    form.append('attendanceImages', new File([new Uint8Array([9])], 'img1.jpg', { type: 'image/jpeg' }))

    const res = await evidencePost(makeFakeRequest({ token: 'ya-a', form }) as any)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/not assigned/i)
  })

  it('rejects invalid audio file types', async () => {
    const requestId = 'req-3'
    fakeStore.attendanceRequests = {
      [requestId]: {
        agentId: 'agent-a-uid',
        assignedAgentId: null,
        notifiedAgents: [],
        smeId: 'sme-a-uid',
        tenderId: 'tender-1',
      },
    }

    const form = new FormData()
    form.set('requestId', requestId)
    form.set('audio', new File([new Uint8Array([1])], 'voice.txt', { type: 'audio/unknown' }))
    form.append('attendanceImages', new File([new Uint8Array([9])], 'img1.jpg', { type: 'image/jpeg' }))

    const res = await evidencePost(makeFakeRequest({ token: 'ya-a', form }) as any)
    expect(res.status).toBe(415)
    const json = await res.json()
    expect(json.error).toMatch(/unsupported audio file type/i)
  })

  it('requires at least one attendance image/PDF', async () => {
    const requestId = 'req-4'
    fakeStore.attendanceRequests = {
      [requestId]: {
        agentId: 'agent-a-uid',
        assignedAgentId: null,
        notifiedAgents: [],
        smeId: 'sme-a-uid',
        tenderId: 'tender-1',
      },
    }

    const form = new FormData()
    form.set('requestId', requestId)
    form.set('audio', new File([new Uint8Array([1, 2, 3])], 'voice.mp3', { type: 'audio/mpeg' }))

    const res = await evidencePost(makeFakeRequest({ token: 'ya-a', form }) as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/at least 1 attendance image/i)
  })

  it('enforces audio size limit', async () => {
    const requestId = 'req-5'
    fakeStore.attendanceRequests = {
      [requestId]: {
        agentId: 'agent-a-uid',
        assignedAgentId: null,
        notifiedAgents: [],
        smeId: 'sme-a-uid',
        tenderId: 'tender-1',
      },
    }

    const hugeAudio = fileWithSize('voice.mp3', 'audio/mpeg', 100 * 1024 * 1024 + 1)

    const form = new FormData()
    form.set('requestId', requestId)
    form.set('audio', hugeAudio)
    form.append('attendanceImages', new File([new Uint8Array([9])], 'img1.jpg', { type: 'image/jpeg' }))

    const res = await evidencePost(makeFakeRequest({ token: 'ya-a', form }) as any)
    expect(res.status).toBe(413)
    const json = await res.json()
    expect(json.error).toMatch(/audio file exceeds 100mb/i)
  })
})

