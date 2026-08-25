import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'

const require = createRequire(import.meta.url)
const notifyService = require('../../backend/services/founderOpsNotificationService')

function sampleProfile(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'uid-sme-001',
    email: 'owner@acme.co.za',
    displayName: 'Ada Acme',
    companyName: 'Acme Civils',
    userType: 'sme',
    createdAt: '2026-08-06T17:30:00.000Z',
    ...overrides,
  }
}

function sampleRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-abc123',
    smeName: 'Ada Acme',
    smeCompany: 'Acme Civils',
    smeEmail: 'owner@acme.co.za',
    tenderTitle: 'Hospital cleaning Gauteng',
    tenderNumber: 'GT-2026-88',
    briefingDate: '2026-08-12',
    briefingTime: '10:00',
    briefingVenue: 'Civic Centre',
    province: 'Gauteng',
    paymentStatus: 'pending',
    quotedFee: 34900,
    currency: 'ZAR',
    createdAt: '2026-08-06T18:00:00.000Z',
    ...overrides,
  }
}

describe('founderOpsNotificationService helpers', () => {
  it('builds registration idempotency keys by role', () => {
    expect(notifyService.buildRegistrationIdempotencyKey('uid-1', 'sme')).toBe(
      'sme-register:uid-1'
    )
    expect(notifyService.buildRegistrationIdempotencyKey('uid-2', 'youth-agent')).toBe(
      'agent-register:uid-2'
    )
  })

  it('builds attendance idempotency keys for created and paid', () => {
    expect(notifyService.buildAttendanceIdempotencyKey('req-1', 'created')).toBe(
      'attendance-request:req-1:created'
    )
    expect(notifyService.buildAttendanceIdempotencyKey('req-1', 'paid')).toBe(
      'attendance-request:req-1:paid'
    )
  })

  it('formats ZAR fees and role labels', () => {
    expect(notifyService.formatFee(34900, 'ZAR')).toBe('R349.00')
    expect(notifyService.formatFee(24900, 'ZAR')).toBe('R249.00') // historical amount formatting
    expect(notifyService.roleLabel('sme')).toBe('SME')
    expect(notifyService.roleLabel('youth-agent')).toBe('Youth agent')
  })

  it('reads founder recipients from FOUNDER_EMAIL_ALLOWLIST', () => {
    expect(
      notifyService.founderEmailAllowlist({
        FOUNDER_EMAIL_ALLOWLIST: 'info@tenderbriefing.co.za, ops@tenderbriefing.co.za',
      })
    ).toEqual(['info@tenderbriefing.co.za', 'ops@tenderbriefing.co.za'])
    expect(notifyService.founderEmailAllowlist({})).toEqual(['info@tenderbriefing.co.za'])
  })

  it('builds safe registration and attendance summaries with admin links', () => {
    const reg = notifyService.buildRegistrationSummary(sampleProfile())
    expect(reg.idempotencyKey).toBe('sme-register:uid-sme-001')
    expect(reg.adminPath).toBe('/admin/registrations')
    expect(reg.founderPath).toBe('/founder')
    expect(reg.email).toBe('owner@acme.co.za')
    expect(reg.companyName).toBe('Acme Civils')

    const created = notifyService.buildAttendanceSummary(sampleRequest(), 'created')
    expect(created.idempotencyKey).toBe('attendance-request:req-abc123:created')
    expect(created.feeLabel).toBe('R349.00')
    expect(created.adminPath).toBe('/admin/operations')
    expect(created.paymentStatus).toBe('pending')

    const paid = notifyService.buildAttendanceSummary(
      sampleRequest({ paymentStatus: 'paid', paidAt: '2026-08-06T18:05:00.000Z' }),
      'paid'
    )
    expect(paid.idempotencyKey).toBe('attendance-request:req-abc123:paid')
    expect(paid.paymentStatus).toBe('paid')
  })
})

describe('notifyUserRegistered / notifyAttendance*', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.FOUNDER_EMAIL_ALLOWLIST = 'info@tenderbriefing.co.za'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.tenderbriefing.co.za'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  function mockDb(existing: null | { status: string } = null) {
    const set = vi.fn().mockResolvedValue(undefined)
    const create = vi.fn().mockResolvedValue(undefined)
    const get = vi.fn().mockResolvedValue({
      exists: Boolean(existing),
      data: () => existing || {},
    })
    const ref = { get, set, create }
    return {
      db: {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue(ref),
        }),
      },
      ref,
      set,
      get,
    }
  }

  it('sends Resend email and admin inbox on SME registration', async () => {
    const { db } = mockDb(null)
    const send = vi.fn().mockResolvedValue({ data: { id: 'email_reg_1' }, error: null })
    const saveNotification = vi.fn().mockImplementation(async (n: Record<string, unknown>) => n)

    const result = await notifyService.notifyUserRegistered(sampleProfile(), {
      getFirestore: () => db,
      resendClient: { emails: { send } },
      getAdminUserIds: async () => ['admin-1'],
      saveNotification,
      env: process.env,
    })

    expect(result.duplicate).toBe(false)
    expect(result.notified).toBe(true)
    expect(result.email?.sent).toBe(true)
    expect(result.inboxCount).toBe(1)
    expect(send).toHaveBeenCalledTimes(1)
    const emailArgs = send.mock.calls[0][0]
    expect(emailArgs.to).toEqual(['info@tenderbriefing.co.za'])
    expect(emailArgs.subject).toMatch(/Signup/i)
    expect(emailArgs.text).toContain('owner@acme.co.za')
    expect(emailArgs.text).toContain('Acme Civils')
    expect(emailArgs.text).toContain('/admin/registrations')
    expect(emailArgs.headers['X-Entity-Ref-ID']).toBe('sme-register:uid-sme-001')
  })

  it('is idempotent for registration — second call does not re-send', async () => {
    const { db } = mockDb({ status: 'sent' })
    const send = vi.fn().mockResolvedValue({ data: { id: 'email_1' }, error: null })
    const saveNotification = vi.fn()

    const result = await notifyService.notifyUserRegistered(sampleProfile(), {
      getFirestore: () => db,
      resendClient: { emails: { send } },
      getAdminUserIds: async () => ['admin-1'],
      saveNotification,
      env: process.env,
    })

    expect(result.duplicate).toBe(true)
    expect(result.notified).toBe(false)
    expect(send).not.toHaveBeenCalled()
    expect(saveNotification).not.toHaveBeenCalled()
  })

  it('notifies on attendance request created', async () => {
    const { db } = mockDb(null)
    const send = vi.fn().mockResolvedValue({ data: { id: 'email_att_1' }, error: null })
    const saveNotification = vi.fn().mockImplementation(async (n: Record<string, unknown>) => n)

    const result = await notifyService.notifyAttendanceRequestCreated(sampleRequest(), {
      getFirestore: () => db,
      resendClient: { emails: { send } },
      getAdminUserIds: async () => ['admin-1'],
      saveNotification,
      env: process.env,
    })

    expect(result.notified).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    const emailArgs = send.mock.calls[0][0]
    expect(emailArgs.subject).toMatch(/Request/i)
    expect(emailArgs.text).toContain('Hospital cleaning Gauteng')
    expect(emailArgs.text).toContain('GT-2026-88')
    expect(emailArgs.text).toContain('Civic Centre')
    expect(emailArgs.text).toContain('pending')
    expect(emailArgs.headers['X-Entity-Ref-ID']).toBe(
      'attendance-request:req-abc123:created'
    )
  })

  it('notifies on attendance request paid with distinct idempotency key', async () => {
    const { db } = mockDb(null)
    const send = vi.fn().mockResolvedValue({ data: { id: 'email_paid_1' }, error: null })
    const saveNotification = vi.fn().mockImplementation(async (n: Record<string, unknown>) => n)

    const result = await notifyService.notifyAttendanceRequestPaid(
      sampleRequest({ paymentStatus: 'paid', paidAt: '2026-08-06T18:05:00.000Z' }),
      {
        getFirestore: () => db,
        resendClient: { emails: { send } },
        getAdminUserIds: async () => ['admin-1'],
        saveNotification,
        env: process.env,
      }
    )

    expect(result.notified).toBe(true)
    const emailArgs = send.mock.calls[0][0]
    expect(emailArgs.subject).toMatch(/Paid/i)
    expect(emailArgs.headers['X-Entity-Ref-ID']).toBe('attendance-request:req-abc123:paid')
    expect(emailArgs.text).toContain('paid')
  })

  it('is idempotent for attendance created', async () => {
    const { db } = mockDb({ status: 'claimed' })
    const send = vi.fn()

    const result = await notifyService.notifyAttendanceRequestCreated(sampleRequest(), {
      getFirestore: () => db,
      resendClient: { emails: { send } },
      getAdminUserIds: async () => [],
      saveNotification: async (n: Record<string, unknown>) => n,
      env: process.env,
    })

    expect(result.duplicate).toBe(true)
    expect(send).not.toHaveBeenCalled()
  })

  it('fails soft when Resend errors — does not throw', async () => {
    const { db } = mockDb(null)
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'rate limited' },
    })

    const result = await notifyService.notifyAttendanceRequestCreated(sampleRequest(), {
      getFirestore: () => db,
      resendClient: { emails: { send } },
      getAdminUserIds: async () => [],
      saveNotification: async (n: Record<string, unknown>) => n,
      env: process.env,
    })

    expect(result.notified).toBe(false)
    expect(result.email?.sent).toBe(false)
    expect(result.error || result.email?.error).toMatch(/rate limited/i)
  })

  it('Safe wrappers never throw even if deps explode', async () => {
    const boomDeps = {
      getFirestore: () => {
        throw new Error('firestore down')
      },
      resendClient: {
        emails: {
          send: async () => {
            throw new Error('boom')
          },
        },
      },
      env: process.env,
    }
    await expect(notifyService.notifyUserRegisteredSafe(sampleProfile(), boomDeps)).resolves.toMatchObject(
      { notified: expect.any(Boolean) }
    )
    await expect(
      notifyService.notifyAttendanceRequestCreatedSafe(sampleRequest(), boomDeps)
    ).resolves.toMatchObject({ notified: expect.any(Boolean) })
    await expect(
      notifyService.notifyAttendanceRequestPaidSafe(sampleRequest(), boomDeps)
    ).resolves.toMatchObject({ notified: expect.any(Boolean) })
  })
})

describe('source wiring — registration and attendance hooks', () => {
  it('bootstrap-profile triggers notifyUserRegisteredSafe after profile create', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/api/auth/bootstrap-profile/route.ts'),
      'utf8'
    )
    expect(src).toContain('founderOpsNotificationService')
    expect(src).toContain('notifyUserRegisteredSafe')
    expect(src.indexOf('notifyUserRegisteredSafe')).toBeGreaterThan(
      src.indexOf('createPlatformProfile')
    )
  })

  it('agentAssignmentService triggers notify on createRequest save', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'backend/services/agentAssignmentService.js'),
      'utf8'
    )
    expect(src).toContain('founderOpsNotificationService')
    expect(src).toContain('notifyAttendanceRequestCreatedSafe')
    expect(src.indexOf('notifyAttendanceRequestCreatedSafe')).toBeGreaterThan(
      src.indexOf('await storage.saveAttendanceRequest(request)')
    )
  })

  it('attendancePaymentService triggers notify on markRequestPaid success', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'backend/services/payments/attendancePaymentService.js'),
      'utf8'
    )
    expect(src).toContain('founderOpsNotificationService')
    expect(src).toContain('notifyAttendanceRequestPaidSafe')
    expect(src.indexOf('notifyAttendanceRequestPaidSafe')).toBeGreaterThan(
      src.indexOf('dispatchWorkflowEvent(')
    )
  })
})
