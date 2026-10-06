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
    phoneNumber: '+27821234567',
    province: 'Gauteng',
    userType: 'sme',
    createdAt: '2026-08-06T17:30:00.000Z',
    ...overrides,
  }
}

function sampleAgent(overrides: Record<string, unknown> = {}) {
  return sampleProfile({
    uid: 'uid-ya-001',
    email: 'agent@example.co.za',
    displayName: 'Thabo Agent',
    companyName: '',
    userType: 'youth-agent',
    province: 'Western Cape',
    ...overrides,
  })
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
    expect(notifyService.roleLabel('sme')).toBe('SME')
    expect(notifyService.roleLabel('youth-agent')).toBe('Youth agent')
  })

  it('defaults Founder recipient to info@tenderbriefing.co.za', () => {
    expect(notifyService.founderEmailAllowlist({})).toEqual(['info@tenderbriefing.co.za'])
  })

  it('builds registration summaries with optional phone/province and Founder deep links', () => {
    const reg = notifyService.buildRegistrationSummary(sampleProfile())
    expect(reg.eventType).toBe(notifyService.EVENT_TYPES.SME_REGISTERED)
    expect(reg.idempotencyKey).toBe('sme-register:uid-sme-001')
    expect(reg.phoneNumber).toBe('+27821234567')
    expect(reg.province).toBe('Gauteng')
    expect(reg.founderPath).toBe('/founder/smes/uid-sme-001')

    const ya = notifyService.buildRegistrationSummary(sampleAgent())
    expect(ya.eventType).toBe(notifyService.EVENT_TYPES.YOUTH_AGENT_REGISTERED)
    expect(ya.founderPath).toBe('/founder/agents/uid-ya-001')
  })

  it('builds briefing/payment summaries with Founder briefing links', () => {
    const created = notifyService.buildAttendanceSummary(sampleRequest(), 'created')
    expect(created.eventType).toBe(notifyService.EVENT_TYPES.BRIEFING_CONFIRMED)
    expect(created.founderPath).toBe('/founder/briefings/req-abc123')

    const paid = notifyService.buildAttendanceSummary(
      sampleRequest({
        paymentStatus: 'paid',
        paymentAmount: 34900,
        paymentReference: 'ATT-req-abc123',
        paidAt: '2026-08-06T18:05:00.000Z',
      }),
      'paid'
    )
    expect(paid.eventType).toBe(notifyService.EVENT_TYPES.PAYMENT_CONFIRMED)
    expect(paid.feeLabel).toBe('R349.00')
    expect(paid.paymentReference).toBe('ATT-req-abc123')
  })

  it('uses Founder-facing subjects', () => {
    const sme = notifyService.buildEmailTemplate(
      notifyService.buildRegistrationSummary(sampleProfile())
    )
    expect(sme.subject).toBe('New SME Registered — TenderBriefing')

    const ya = notifyService.buildEmailTemplate(
      notifyService.buildRegistrationSummary(sampleAgent())
    )
    expect(ya.subject).toBe('New Youth Agent Registered — TenderBriefing')

    const briefing = notifyService.buildEmailTemplate(
      notifyService.buildAttendanceSummary(sampleRequest(), 'created')
    )
    expect(briefing.subject).toBe('Briefing Confirmed — TenderBriefing')

    const paid = notifyService.buildEmailTemplate(
      notifyService.buildAttendanceSummary(
        sampleRequest({ paymentStatus: 'paid', paymentAmount: 34900 }),
        'paid'
      )
    )
    expect(paid.subject).toBe('Payment Received — R349.00 — TenderBriefing')
  })
})

describe('notifyUserRegistered / notifyAttendance* / sendFounderOperationalNotification', () => {
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

  it('1. SME registration sends exactly one Founder alert', async () => {
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

    expect(result.notified).toBe(true)
    expect(result.eventType).toBe('SME_REGISTERED')
    expect(send).toHaveBeenCalledTimes(1)
    const emailArgs = send.mock.calls[0][0]
    expect(emailArgs.to).toEqual(['info@tenderbriefing.co.za'])
    expect(emailArgs.subject).toBe('New SME Registered — TenderBriefing')
    expect(emailArgs.text).toContain('+27821234567')
    expect(emailArgs.text).toContain('Gauteng')
    expect(emailArgs.text).not.toMatch(/password/i)
    expect(JSON.stringify(emailArgs)).not.toMatch(/password|idToken|private_key/i)
  })

  it('2. Youth Agent registration sends exactly one Founder alert', async () => {
    const { db } = mockDb(null)
    const send = vi.fn().mockResolvedValue({ data: { id: 'email_ya_1' }, error: null })

    const result = await notifyService.sendFounderOperationalNotification(
      {
        eventType: notifyService.EVENT_TYPES.YOUTH_AGENT_REGISTERED,
        entityId: 'uid-ya-001',
        data: sampleAgent(),
      },
      {
        getFirestore: () => db,
        resendClient: { emails: { send } },
        getAdminUserIds: async () => [],
        saveNotification: async (n: Record<string, unknown>) => n,
        env: process.env,
      }
    )

    expect(result.notified).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].subject).toBe('New Youth Agent Registered — TenderBriefing')
    expect(send.mock.calls[0][0].text).toContain('/founder/agents/uid-ya-001')
  })

  it('3. Successful payment sends exactly one Founder alert', async () => {
    const { db } = mockDb(null)
    const send = vi.fn().mockResolvedValue({ data: { id: 'email_paid_1' }, error: null })

    const result = await notifyService.notifyAttendanceRequestPaid(
      sampleRequest({
        paymentStatus: 'paid',
        paymentAmount: 34900,
        paymentReference: 'ATT-req-abc123',
        paidAt: '2026-08-06T18:05:00.000Z',
      }),
      {
        getFirestore: () => db,
        resendClient: { emails: { send } },
        getAdminUserIds: async () => [],
        saveNotification: async (n: Record<string, unknown>) => n,
        env: process.env,
      }
    )

    expect(result.notified).toBe(true)
    expect(result.eventType).toBe('PAYMENT_CONFIRMED')
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].subject).toBe('Payment Received — R349.00 — TenderBriefing')
    expect(send.mock.calls[0][0].text).toContain('ATT-req-abc123')
    expect(send.mock.calls[0][0].headers['X-Entity-Ref-ID']).toBe(
      'attendance-request:req-abc123:paid'
    )
  })

  it('4. Failed/unconfirmed payment has no Founder payment alert API on failed path', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'backend/services/payments/attendancePaymentService.js'),
      'utf8'
    )
    const failedFn = src.slice(src.indexOf('async function markRequestFailed'))
    const failedBody = failedFn.slice(0, failedFn.indexOf('async function markRequestCancelled'))
    expect(failedBody).not.toContain('notifyAttendanceRequestPaid')
    expect(failedBody).not.toContain('PAYMENT_CONFIRMED')
    expect(failedBody).not.toContain('founderOpsNotificationService')
  })

  it('5. Briefing confirmation sends exactly one Founder alert', async () => {
    const { db } = mockDb(null)
    const send = vi.fn().mockResolvedValue({ data: { id: 'email_brief_1' }, error: null })

    const result = await notifyService.notifyAttendanceRequestCreated(sampleRequest(), {
      getFirestore: () => db,
      resendClient: { emails: { send } },
      getAdminUserIds: async () => [],
      saveNotification: async (n: Record<string, unknown>) => n,
      env: process.env,
    })

    expect(result.notified).toBe(true)
    expect(result.eventType).toBe('BRIEFING_CONFIRMED')
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].subject).toBe('Briefing Confirmed — TenderBriefing')
    expect(send.mock.calls[0][0].text).toContain('Civic Centre')
  })

  it('6. Duplicate/retried events do not generate duplicate alerts', async () => {
    const { db } = mockDb({ status: 'sent' })
    const send = vi.fn()

    const reg = await notifyService.notifyUserRegistered(sampleProfile(), {
      getFirestore: () => db,
      resendClient: { emails: { send } },
      getAdminUserIds: async () => [],
      saveNotification: async (n: Record<string, unknown>) => n,
      env: process.env,
    })
    const paid = await notifyService.notifyAttendanceRequestPaid(
      sampleRequest({ paymentStatus: 'paid' }),
      {
        getFirestore: () => db,
        resendClient: { emails: { send } },
        getAdminUserIds: async () => [],
        saveNotification: async (n: Record<string, unknown>) => n,
        env: process.env,
      }
    )
    const created = await notifyService.notifyAttendanceRequestCreated(sampleRequest(), {
      getFirestore: () => db,
      resendClient: { emails: { send } },
      getAdminUserIds: async () => [],
      saveNotification: async (n: Record<string, unknown>) => n,
      env: process.env,
    })

    expect(reg.duplicate).toBe(true)
    expect(paid.duplicate).toBe(true)
    expect(created.duplicate).toBe(true)
    expect(send).not.toHaveBeenCalled()
  })

  it('7–9. Resend failure does not throw for registration/payment/briefing', async () => {
    const { db } = mockDb(null)
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'rate limited' },
    })
    const deps = {
      getFirestore: () => db,
      resendClient: { emails: { send } },
      getAdminUserIds: async () => [],
      saveNotification: async (n: Record<string, unknown>) => n,
      env: process.env,
    }

    await expect(notifyService.notifyUserRegisteredSafe(sampleProfile(), deps)).resolves.toMatchObject({
      notified: false,
    })
    await expect(
      notifyService.notifyAttendanceRequestPaidSafe(sampleRequest({ paymentStatus: 'paid' }), deps)
    ).resolves.toMatchObject({ notified: false })
    await expect(
      notifyService.notifyAttendanceRequestCreatedSafe(sampleRequest(), deps)
    ).resolves.toMatchObject({ notified: false })
  })

  it('11. never includes passwords/secrets in Founder notification payloads', async () => {
    const { db } = mockDb(null)
    const send = vi.fn().mockResolvedValue({ data: { id: 'email_safe' }, error: null })
    const result = await notifyService.notifyUserRegistered(
      sampleProfile({
        password: 'should-never-send',
        idToken: 'tok_secret',
        refreshToken: 'refresh_secret',
      }),
      {
        getFirestore: () => db,
        resendClient: { emails: { send } },
        getAdminUserIds: async () => [],
        saveNotification: async (n: Record<string, unknown>) => n,
        env: process.env,
      }
    )
    expect(result.notified).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    const payload = JSON.stringify(send.mock.calls[0][0])
    expect(payload).not.toMatch(/should-never-send|tok_secret|refresh_secret|private_key/i)
    expect(payload.toLowerCase()).not.toContain('"password"')
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

  it('retries Founder payment alert after prior failed idempotency status', async () => {
    const { db } = mockDb({ status: 'failed' })
    const send = vi.fn().mockResolvedValue({ data: { id: 'retry_paid' }, error: null })
    const result = await notifyService.notifyAttendanceRequestPaid(
      sampleRequest({ paymentStatus: 'paid', paymentAmount: 34900 }),
      {
        getFirestore: () => db,
        resendClient: { emails: { send } },
        getAdminUserIds: async () => [],
        saveNotification: async (n: Record<string, unknown>) => n,
        env: process.env,
      }
    )
    expect(result.duplicate).toBe(false)
    expect(result.notified).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
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
    // Customer welcome remains independent
    expect(src).toContain('sendWelcomeEmailSafe')
  })

  it('10. welcome email path remains wired separately from Founder ops', () => {
    const welcome = fs.readFileSync(
      path.join(process.cwd(), 'lib/services/welcomeEmail.ts'),
      'utf8'
    )
    expect(welcome).toContain('sendWelcomeEmailSafe')
    expect(welcome).not.toContain('founderOpsNotificationService')
  })

  it('agentAssignmentService triggers briefing confirmed notify on createRequest save', () => {
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

  it('12. attendancePaymentService triggers notify only on markRequestPaid success path', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'backend/services/payments/attendancePaymentService.js'),
      'utf8'
    )
    expect(src).toContain('founderOpsNotificationService')
    expect(src).toContain('notifyAttendanceRequestPaidSafe')
    expect(src.indexOf('notifyAttendanceRequestPaidSafe')).toBeGreaterThan(
      src.indexOf('async function markRequestPaid')
    )
    // Fail path must not call Founder payment notify
    const failedFn = src.slice(src.indexOf('async function markRequestFailed'))
    const failedBody = failedFn.slice(0, failedFn.indexOf('async function markRequestCancelled'))
    expect(failedBody).not.toContain('notifyAttendanceRequestPaidSafe')
  })
})
