import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const storageAdapter = require('../../backend/services/storageAdapter')
const activities = require('../../backend/services/dashboardActivitiesService')

const originalGetStorage = storageAdapter.getStorage

type Call = { method: string; filters?: Record<string, unknown> }

function mockStorage(seed: {
  requests?: Record<string, unknown>[]
  reports?: Record<string, unknown>[]
  notifications?: Record<string, unknown>[]
}) {
  const calls: Call[] = []
  const requests = seed.requests || []
  const reports = seed.reports || []
  const notifications = seed.notifications || []

  storageAdapter.getStorage = () =>
    ({
      getAttendanceRequests: async (filters: Record<string, unknown> = {}) => {
        calls.push({ method: 'getAttendanceRequests', filters })
        let items = [...requests]
        if (filters.smeId) items = items.filter((r) => r.smeId === filters.smeId)
        if (filters.agentId) {
          items = items.filter(
            (r) => r.agentId === filters.agentId || r.assignedAgentId === filters.agentId
          )
        }
        if (filters.status) items = items.filter((r) => r.status === filters.status)
        const cap = Number(filters.limit)
        if (Number.isFinite(cap) && cap > 0) items = items.slice(0, cap)
        return items
      },
      getBriefingReports: async (filters: Record<string, unknown> = {}) => {
        calls.push({ method: 'getBriefingReports', filters })
        let items = [...reports]
        if (filters.requestId) items = items.filter((r) => r.requestId === filters.requestId)
        if (Array.isArray(filters.requestIds)) {
          const allowed = new Set(filters.requestIds as string[])
          items = items.filter((r) => allowed.has(String(r.requestId)))
        }
        if (filters.agentId) items = items.filter((r) => r.agentId === filters.agentId)
        const cap = Number(filters.limit)
        if (Number.isFinite(cap) && cap > 0) items = items.slice(0, cap)
        return items
      },
      getNotifications: async (filters: Record<string, unknown> = {}) => {
        calls.push({ method: 'getNotifications', filters })
        let items = [...notifications]
        if (filters.userId) items = items.filter((n) => n.userId === filters.userId)
        const cap = Number(filters.limit)
        if (Number.isFinite(cap) && cap > 0) items = items.slice(0, cap)
        return items
      },
      getSyncStatus: async () => null,
    }) as ReturnType<typeof storageAdapter.getStorage>

  return { calls }
}

afterEach(() => {
  storageAdapter.getStorage = originalGetStorage
  vi.restoreAllMocks()
})

describe('dashboard activities — tenant isolation & bounds', () => {
  it('SME only sees own requests/reports and queries with smeId + limit', async () => {
    const { calls } = mockStorage({
      requests: [
        {
          id: 'r-mine',
          smeId: 'sme-a',
          tenderNumber: 'T-1',
          status: 'pending',
          createdAt: '2026-08-20T10:00:00.000Z',
        },
        {
          id: 'r-other',
          smeId: 'sme-b',
          tenderNumber: 'T-2',
          status: 'pending',
          createdAt: '2026-08-21T10:00:00.000Z',
        },
      ],
      reports: [
        {
          id: 'rep-mine',
          requestId: 'r-mine',
          summary: 'Mine',
          createdAt: '2026-08-22T10:00:00.000Z',
        },
        {
          id: 'rep-other',
          requestId: 'r-other',
          summary: 'Other SME',
          createdAt: '2026-08-23T10:00:00.000Z',
        },
      ],
      notifications: [],
    })

    // Workspace reads hit Firestore — stub to empty
    const firebaseAdmin = require('../../backend/config/firebaseAdmin')
    const originalDb = firebaseAdmin.getFirestore
    firebaseAdmin.getFirestore = () => ({
      collection: () => ({
        doc: () => ({
          collection: () => ({
            limit: () => ({
              get: async () => ({ docs: [] }),
            }),
          }),
        }),
      }),
    })

    try {
      const data = await activities.getActivitiesForUser({
        uid: 'sme-a',
        userType: 'sme',
      })

      expect(data.every((a: { id: string }) => !a.id.includes('r-other'))).toBe(true)
      expect(data.every((a: { id: string }) => !a.id.includes('rep-other'))).toBe(true)
      expect(data.some((a: { id: string }) => a.id === 'req-r-mine')).toBe(true)
      expect(data.some((a: { id: string }) => a.id === 'report-rep-mine')).toBe(true)

      const reqCalls = calls.filter((c) => c.method === 'getAttendanceRequests')
      expect(reqCalls).toHaveLength(1)
      expect(reqCalls[0].filters).toMatchObject({ smeId: 'sme-a', limit: activities.QUERY_LIMIT })

      const reportCalls = calls.filter((c) => c.method === 'getBriefingReports')
      expect(reportCalls).toHaveLength(1)
      expect(reportCalls[0].filters?.requestIds).toEqual(['r-mine'])
      expect(reportCalls[0].filters?.limit).toBe(activities.QUERY_LIMIT)
    } finally {
      firebaseAdmin.getFirestore = originalDb
    }
  })

  it('SME cross-tenant: other SME request never appears even if leaked into reports', async () => {
    const firebaseAdmin = require('../../backend/config/firebaseAdmin')
    const originalDb = firebaseAdmin.getFirestore
    firebaseAdmin.getFirestore = () => ({
      collection: () => ({
        doc: () => ({
          collection: () => ({
            limit: () => ({ get: async () => ({ docs: [] }) }),
          }),
        }),
      }),
    })
    mockStorage({
      requests: [
        {
          id: 'r-a',
          smeId: 'sme-a',
          tenderNumber: 'A',
          createdAt: '2026-08-20T10:00:00.000Z',
        },
      ],
      reports: [
        {
          id: 'leak',
          requestId: 'r-b-foreign',
          summary: 'should not show',
          createdAt: '2026-08-24T10:00:00.000Z',
        },
      ],
    })

    try {
      const data = await activities.getActivitiesForUser({ uid: 'sme-a', userType: 'sme' })
      expect(data.some((a: { id: string }) => a.id.includes('leak'))).toBe(false)
      expect(data.some((a: { description?: string }) => String(a.description || '').includes('should not'))).toBe(
        false
      )
    } finally {
      firebaseAdmin.getFirestore = originalDb
    }
  })

  it('Youth Agent scopes assignedAgentId query and bounds pending available', async () => {
    const { calls } = mockStorage({
      requests: [
        {
          id: 'assigned-1',
          assignedAgentId: 'agent-a',
          status: 'assigned',
          tenderNumber: 'Mine',
          createdAt: '2026-08-20T10:00:00.000Z',
        },
        {
          id: 'assigned-other',
          assignedAgentId: 'agent-b',
          status: 'assigned',
          tenderNumber: 'Other agent',
          createdAt: '2026-08-21T10:00:00.000Z',
        },
        {
          id: 'open-job',
          status: 'pending',
          tenderNumber: 'Open',
          createdAt: '2026-08-22T10:00:00.000Z',
        },
        {
          id: 'pending-taken',
          status: 'pending',
          assignedAgentId: 'agent-b',
          tenderNumber: 'Taken',
          createdAt: '2026-08-23T10:00:00.000Z',
        },
      ],
      reports: [
        {
          id: 'ar-1',
          agentId: 'agent-a',
          requestId: 'assigned-1',
          createdAt: '2026-08-24T10:00:00.000Z',
        },
        {
          id: 'ar-other',
          agentId: 'agent-b',
          requestId: 'assigned-other',
          createdAt: '2026-08-25T10:00:00.000Z',
        },
      ],
    })

    const data = await activities.getActivitiesForUser({
      uid: 'agent-a',
      userType: 'youth-agent',
    })

    expect(data.some((a: { id: string }) => a.id === 'assigned-assigned-1')).toBe(true)
    expect(data.some((a: { id: string }) => a.id === 'available-open-job')).toBe(true)
    expect(data.some((a: { id: string }) => a.id.includes('assigned-other'))).toBe(false)
    expect(data.some((a: { id: string }) => a.id.includes('pending-taken'))).toBe(false)
    expect(data.some((a: { id: string }) => a.id === 'agent-report-ar-1')).toBe(true)
    expect(data.some((a: { id: string }) => a.id.includes('ar-other'))).toBe(false)

    const reqCalls = calls.filter((c) => c.method === 'getAttendanceRequests')
    expect(reqCalls.some((c) => c.filters?.agentId === 'agent-a')).toBe(true)
    expect(reqCalls.some((c) => c.filters?.status === 'pending')).toBe(true)
    expect(reqCalls.every((c) => Number(c.filters?.limit) > 0)).toBe(true)
    expect(reqCalls.every((c) => !('limit' in (c.filters || {}) && c.filters?.limit == null))).toBe(
      true
    )

    const reportCalls = calls.filter((c) => c.method === 'getBriefingReports')
    expect(reportCalls[0].filters).toMatchObject({
      agentId: 'agent-a',
      limit: activities.QUERY_LIMIT,
    })
  })

  it('orders newest first and respects ACTIVITY_LIMIT', async () => {
    const firebaseAdmin = require('../../backend/config/firebaseAdmin')
    const originalDb = firebaseAdmin.getFirestore
    firebaseAdmin.getFirestore = () => ({
      collection: () => ({
        doc: () => ({
          collection: () => ({
            limit: () => ({ get: async () => ({ docs: [] }) }),
          }),
        }),
      }),
    })

    const many = Array.from({ length: 80 }, (_, i) => ({
      id: `r-${i}`,
      smeId: 'sme-a',
      tenderNumber: `T-${i}`,
      createdAt: new Date(Date.UTC(2026, 0, 1 + (i % 28), i % 24)).toISOString(),
    }))
    mockStorage({ requests: many, reports: [], notifications: [] })

    try {
      const data = await activities.getActivitiesForUser({ uid: 'sme-a', userType: 'sme' })
      expect(data.length).toBeLessThanOrEqual(activities.ACTIVITY_LIMIT)
      for (let i = 1; i < data.length; i += 1) {
        expect(new Date(data[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(data[i].createdAt).getTime()
        )
      }
    } finally {
      firebaseAdmin.getFirestore = originalDb
    }
  })

  it('admin remains platform-wide but bounded (no tenant filter)', async () => {
    const { calls } = mockStorage({
      requests: [
        {
          id: 'r1',
          smeId: 'sme-a',
          tenderNumber: 'A',
          createdAt: '2026-08-20T10:00:00.000Z',
        },
        {
          id: 'r2',
          smeId: 'sme-b',
          tenderNumber: 'B',
          createdAt: '2026-08-21T10:00:00.000Z',
        },
      ],
      reports: [
        {
          id: 'rep1',
          requestId: 'r1',
          createdAt: '2026-08-22T10:00:00.000Z',
        },
      ],
    })

    const data = await activities.getActivitiesForUser({ uid: 'admin-1', userType: 'admin' })
    expect(data.some((a: { id: string }) => a.id === 'admin-req-r1')).toBe(true)
    expect(data.some((a: { id: string }) => a.id === 'admin-req-r2')).toBe(true)

    const reqCalls = calls.filter((c) => c.method === 'getAttendanceRequests')
    expect(reqCalls).toHaveLength(1)
    expect(reqCalls[0].filters).toEqual({ limit: activities.ADMIN_QUERY_LIMIT })
    expect(reqCalls[0].filters).not.toHaveProperty('smeId')
    expect(reqCalls[0].filters).not.toHaveProperty('agentId')
  })

  it('returns empty list when SME has no data', async () => {
    const firebaseAdmin = require('../../backend/config/firebaseAdmin')
    const originalDb = firebaseAdmin.getFirestore
    firebaseAdmin.getFirestore = () => ({
      collection: () => ({
        doc: () => ({
          collection: () => ({
            limit: () => ({ get: async () => ({ docs: [] }) }),
          }),
        }),
      }),
    })
    mockStorage({ requests: [], reports: [], notifications: [] })
    try {
      const data = await activities.getActivitiesForUser({ uid: 'sme-empty', userType: 'sme' })
      expect(data).toEqual([])
    } finally {
      firebaseAdmin.getFirestore = originalDb
    }
  })

  it('activities API route requires auth (fail closed)', () => {
    const src = readFileSync(
      join(__dirname, '../../app/api/dashboard/activities/route.ts'),
      'utf8'
    )
    expect(src).toMatch(/verifyApiUser/)
    expect(src).toMatch(/unauthorizedResponse/)
    expect(src).toMatch(/if \(!user\) return unauthorizedResponse\(\)/)
  })

  it('source never calls unbounded getAttendanceRequests() / getBriefingReports()', () => {
    const src = readFileSync(
      join(__dirname, '../../backend/services/dashboardActivitiesService.js'),
      'utf8'
    )
    expect(src).not.toMatch(/getAttendanceRequests\(\s*\)/)
    expect(src).not.toMatch(/getBriefingReports\(\s*\)/)
    expect(src).toMatch(/smeId:\s*uid/)
    expect(src).toMatch(/agentId:\s*uid/)
    expect(src).toMatch(/limit:\s*QUERY_LIMIT|limit:\s*ADMIN_QUERY_LIMIT/)
  })
})
