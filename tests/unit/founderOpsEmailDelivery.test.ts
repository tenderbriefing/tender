import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'
import { Webhook } from 'standardwebhooks'
import fs from 'fs'
import path from 'path'

const require = createRequire(import.meta.url)
const delivery = require('../../backend/services/founderOpsEmailDeliveryService')
const notifyService = require('../../backend/services/founderOpsNotificationService')

const TEST_SECRET = `whsec_${Buffer.from('founder-ops-delivery-test-secret!!').toString('base64')}`

function signPayload(body: string, id = 'msg_evt_1', ts = new Date()) {
  const wh = new Webhook(TEST_SECRET)
  const signature = wh.sign(id, ts, body)
  return {
    id,
    timestamp: String(Math.floor(ts.getTime() / 1000)),
    signature,
  }
}

function mockDb(store: Map<string, Record<string, unknown>>) {
  const docs = new Map(store)

  function makeRef(collection: string, id: string) {
    const key = `${collection}/${id}`
    return {
      id,
      get: vi.fn(async () => ({
        exists: docs.has(key),
        id,
        data: () => docs.get(key) || {},
      })),
      set: vi.fn(async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        const prev = docs.get(key) || {}
        docs.set(key, opts?.merge ? { ...prev, ...data } : { ...data })
      }),
      create: vi.fn(async (data: Record<string, unknown>) => {
        if (docs.has(key)) {
          const err = new Error('ALREADY_EXISTS')
          // @ts-expect-error code
          err.code = 6
          throw err
        }
        docs.set(key, { ...data })
      }),
    }
  }

  const db = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id: string) => makeRef(name, id)),
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn(async () => ({ empty: true, docs: [] })),
          })),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn(async () => {
              const rows = Array.from(docs.entries())
                .filter(([k, v]) => k.startsWith(`${name}/`) && v.founderOpsDelivery)
                .map(([k, v]) => ({
                  id: k.split('/')[1],
                  data: () => v,
                  ref: makeRef(name, k.split('/')[1]),
                }))
              return { empty: rows.length === 0, docs: rows }
            }),
          })),
        })),
        limit: vi.fn(() => ({
          get: vi.fn(async () => ({ empty: true, docs: [] })),
        })),
      })),
      orderBy: vi.fn(() => ({
        startAt: vi.fn(() => ({
          endAt: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(async () => ({ empty: true, docs: [] })),
            })),
          })),
        })),
      })),
    })),
  }

  return { db, docs }
}

describe('founderOpsEmailDeliveryService — state machine', () => {
  it('maps official Resend event names', () => {
    expect(delivery.mapResendEventToStatus('email.sent')).toBe('sent')
    expect(delivery.mapResendEventToStatus('email.delivered')).toBe('delivered')
    expect(delivery.mapResendEventToStatus('email.delivery_delayed')).toBe('delayed')
    expect(delivery.mapResendEventToStatus('email.bounced')).toBe('bounced')
    expect(delivery.mapResendEventToStatus('email.complained')).toBe('complained')
    expect(delivery.mapResendEventToStatus('email.failed')).toBe('failed')
    expect(delivery.mapResendEventToStatus('email.opened')).toBe(null)
  })

  it('blocks out-of-order / terminal overwrites', () => {
    expect(delivery.canTransition('accepted', 'sent')).toBe(true)
    expect(delivery.canTransition('sent', 'delivered')).toBe(true)
    expect(delivery.canTransition('delayed', 'delivered')).toBe(true)
    expect(delivery.canTransition('delivered', 'delayed')).toBe(false)
    expect(delivery.canTransition('delivered', 'sent')).toBe(false)
    expect(delivery.canTransition('bounced', 'delivered')).toBe(false)
    expect(delivery.canTransition('delivered', 'delivered')).toBe(false)
  })
})

describe('Resend webhook signature verification', () => {
  it('rejects missing secret', () => {
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'x' } })
    const headers = signPayload(body)
    const result = delivery.verifyResendWebhook({
      rawBody: body,
      svixId: headers.id,
      svixTimestamp: headers.timestamp,
      svixSignature: headers.signature,
      webhookSecret: '',
    })
    expect(result.ok).toBe(false)
    expect(result.statusCode).toBe(503)
  })

  it('rejects invalid signature', () => {
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'x' } })
    const headers = signPayload(body)
    const result = delivery.verifyResendWebhook({
      rawBody: body,
      svixId: headers.id,
      svixTimestamp: headers.timestamp,
      svixSignature: 'v1,invalid',
      webhookSecret: TEST_SECRET,
    })
    expect(result.ok).toBe(false)
    expect(result.statusCode).toBe(401)
  })

  it('accepts valid signature', () => {
    const body = JSON.stringify({
      type: 'email.delivered',
      created_at: '2026-10-07T04:00:00.000Z',
      data: { email_id: 'msg_abc', to: ['info@tenderbriefing.co.za'] },
    })
    const headers = signPayload(body)
    const result = delivery.verifyResendWebhook({
      rawBody: body,
      svixId: headers.id,
      svixTimestamp: headers.timestamp,
      svixSignature: headers.signature,
      webhookSecret: TEST_SECRET,
    })
    expect(result.ok).toBe(true)
    expect(result.payload.type).toBe('email.delivered')
  })
})

describe('webhook processing + race + idempotency', () => {
  it('stores pending when ledger not yet correlated, then reconciles', async () => {
    const { db, docs } = mockDb(new Map())
    const providerMessageId = 'msg_race_1'

    const first = await delivery.processVerifiedResendWebhook(
      {
        type: 'email.delivered',
        created_at: '2026-10-07T04:00:00.000Z',
        data: { email_id: providerMessageId },
      },
      { providerEventId: 'evt_1', getFirestore: () => db }
    )
    expect(first.pending).toBe(true)
    expect(docs.has(`resendWebhookPending/${providerMessageId}`)).toBe(true)

    const ledgerId = 'founder-ops-idem-sme-register:uid1'
    docs.set(`notifications/${ledgerId}`, {
      type: 'idempotency_marker',
      channel: 'founder_ops_registration',
      status: 'sent',
      emailSent: true,
      founderOpsDelivery: true,
      providerMessageId,
      deliveryStatus: 'accepted',
      eventType: 'SME_REGISTERED',
      subject: 'New SME Registered — TenderBriefing',
      recipient: 'info@tenderbriefing.co.za',
    })
    docs.set(`founderOpsEmailByProviderId/${providerMessageId}`, {
      providerMessageId,
      ledgerDocId: ledgerId,
    })

    const reconciled = await delivery.reconcilePendingForMessage(providerMessageId, {
      getFirestore: () => db,
    })
    expect(reconciled.reconciled).toBe(true)
    expect(docs.get(`notifications/${ledgerId}`)?.deliveryStatus).toBe('delivered')
  })

  it('applies delivered / bounce / complaint / delayed to correlated ledger', async () => {
    const providerMessageId = 'msg_corr_1'
    const ledgerId = 'founder-ops-idem-attendance-request:req1:paid'
    const { db, docs } = mockDb(
      new Map([
        [
          `notifications/${ledgerId}`,
          {
            channel: 'founder_ops_attendance_paid',
            founderOpsDelivery: true,
            providerMessageId,
            deliveryStatus: 'accepted',
            emailSent: true,
          },
        ],
        [
          `founderOpsEmailByProviderId/${providerMessageId}`,
          { providerMessageId, ledgerDocId: ledgerId },
        ],
      ])
    )

    const delivered = await delivery.processVerifiedResendWebhook(
      { type: 'email.delivered', created_at: '2026-10-07T04:01:00.000Z', data: { email_id: providerMessageId } },
      { providerEventId: 'evt_del', getFirestore: () => db }
    )
    expect(delivered.applied).toBe(true)
    expect(docs.get(`notifications/${ledgerId}`)?.deliveryStatus).toBe('delivered')

    // Terminal lock — delayed cannot overwrite delivered
    const delayed = await delivery.processVerifiedResendWebhook(
      {
        type: 'email.delivery_delayed',
        created_at: '2026-10-07T04:02:00.000Z',
        data: { email_id: providerMessageId },
      },
      { providerEventId: 'evt_delay', getFirestore: () => db }
    )
    expect(delayed.applied).toBeFalsy()
    expect(docs.get(`notifications/${ledgerId}`)?.deliveryStatus).toBe('delivered')
  })

  it('bounce updates from accepted', async () => {
    const providerMessageId = 'msg_bounce'
    const ledgerId = 'founder-ops-idem-sme-register:u2'
    const { db, docs } = mockDb(
      new Map([
        [
          `notifications/${ledgerId}`,
          {
            channel: 'founder_ops_registration',
            founderOpsDelivery: true,
            providerMessageId,
            deliveryStatus: 'sent',
          },
        ],
        [
          `founderOpsEmailByProviderId/${providerMessageId}`,
          { providerMessageId, ledgerDocId: ledgerId },
        ],
      ])
    )
    const bounced = await delivery.processVerifiedResendWebhook(
      { type: 'email.bounced', created_at: '2026-10-07T04:03:00.000Z', data: { email_id: providerMessageId } },
      { providerEventId: 'evt_bounce', getFirestore: () => db }
    )
    expect(bounced.applied).toBe(true)
    expect(docs.get(`notifications/${ledgerId}`)?.deliveryStatus).toBe('bounced')
  })

  it('complaint updates from sent', async () => {
    const providerMessageId = 'msg_complaint'
    const ledgerId = 'founder-ops-idem-agent-register:u3'
    const { db, docs } = mockDb(
      new Map([
        [
          `notifications/${ledgerId}`,
          {
            channel: 'founder_ops_registration',
            founderOpsDelivery: true,
            providerMessageId,
            deliveryStatus: 'sent',
          },
        ],
        [
          `founderOpsEmailByProviderId/${providerMessageId}`,
          { providerMessageId, ledgerDocId: ledgerId },
        ],
      ])
    )
    const complained = await delivery.processVerifiedResendWebhook(
      {
        type: 'email.complained',
        created_at: '2026-10-07T04:04:00.000Z',
        data: { email_id: providerMessageId },
      },
      { providerEventId: 'evt_complaint', getFirestore: () => db }
    )
    expect(complained.applied).toBe(true)
    expect(docs.get(`notifications/${ledgerId}`)?.deliveryStatus).toBe('complained')
  })

  it('delayed updates from accepted', async () => {
    const providerMessageId = 'msg_delay'
    const ledgerId = 'founder-ops-idem-attendance-request:req2:created'
    const { db, docs } = mockDb(
      new Map([
        [
          `notifications/${ledgerId}`,
          {
            channel: 'founder_ops_attendance_created',
            founderOpsDelivery: true,
            providerMessageId,
            deliveryStatus: 'accepted',
          },
        ],
        [
          `founderOpsEmailByProviderId/${providerMessageId}`,
          { providerMessageId, ledgerDocId: ledgerId },
        ],
      ])
    )
    const delayed = await delivery.processVerifiedResendWebhook(
      {
        type: 'email.delivery_delayed',
        created_at: '2026-10-07T04:05:00.000Z',
        data: { email_id: providerMessageId },
      },
      { providerEventId: 'evt_d2', getFirestore: () => db }
    )
    expect(delayed.applied).toBe(true)
    expect(docs.get(`notifications/${ledgerId}`)?.deliveryStatus).toBe('delayed')
  })

  it('duplicate webhook event is idempotent', async () => {
    const providerMessageId = 'msg_dup'
    const ledgerId = 'founder-ops-idem-sme-register:u4'
    const { db, docs } = mockDb(
      new Map([
        [
          `notifications/${ledgerId}`,
          {
            channel: 'founder_ops_registration',
            founderOpsDelivery: true,
            providerMessageId,
            deliveryStatus: 'accepted',
          },
        ],
        [
          `founderOpsEmailByProviderId/${providerMessageId}`,
          { providerMessageId, ledgerDocId: ledgerId },
        ],
      ])
    )
    const payload = {
      type: 'email.sent',
      created_at: '2026-10-07T04:06:00.000Z',
      data: { email_id: providerMessageId },
    }
    const a = await delivery.processVerifiedResendWebhook(payload, {
      providerEventId: 'evt_same',
      getFirestore: () => db,
    })
    const b = await delivery.processVerifiedResendWebhook(payload, {
      providerEventId: 'evt_same',
      getFirestore: () => db,
    })
    expect(a.applied).toBe(true)
    expect(b.duplicate).toBe(true)
    expect(docs.get(`notifications/${ledgerId}`)?.deliveryStatus).toBe('sent')
  })

  it('unknown providerMessageId is handled safely (pending, not crash)', async () => {
    const { db } = mockDb(new Map())
    const result = await delivery.processVerifiedResendWebhook(
      {
        type: 'email.delivered',
        created_at: '2026-10-07T04:07:00.000Z',
        data: { email_id: 'msg_unknown_zzz' },
      },
      { providerEventId: 'evt_unk', getFirestore: () => db }
    )
    expect(result.ok).toBe(true)
    expect(result.pending).toBe(true)
  })
})

describe('message ID capture on Founder notify send', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.FOUNDER_EMAIL_ALLOWLIST = 'info@tenderbriefing.co.za'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it('persists providerMessageId and keeps emailSent true', async () => {
    const { db, docs } = mockDb(new Map())
    const send = vi.fn().mockResolvedValue({ data: { id: 'msg_persist_1' }, error: null })
    const set = vi.fn(async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      const key = 'notifications/founder-ops-idem-sme-register:uid-sme-001'
      const prev = docs.get(key) || {}
      docs.set(key, opts?.merge ? { ...prev, ...data } : { ...data })
    })
    const create = vi.fn(async (data: Record<string, unknown>) => {
      docs.set('notifications/founder-ops-idem-sme-register:uid-sme-001', { ...data })
    })
    const get = vi.fn(async () => ({
      exists: false,
      data: () => ({}),
    }))
    const ref = { id: 'founder-ops-idem-sme-register:uid-sme-001', get, set, create }
    const notifyDb = {
      collection: vi.fn((name: string) => {
        if (name === 'notifications') {
          return { doc: vi.fn(() => ref) }
        }
        return db.collection(name)
      }),
    }

    const result = await notifyService.notifyUserRegistered(
      {
        uid: 'uid-sme-001',
        email: 'owner@acme.co.za',
        displayName: 'Ada',
        userType: 'sme',
      },
      {
        getFirestore: () => notifyDb,
        resendClient: { emails: { send } },
        getAdminUserIds: async () => [],
        saveNotification: async (n: Record<string, unknown>) => n,
        env: process.env,
      }
    )

    expect(result.notified).toBe(true)
    expect(result.email?.id).toBe('msg_persist_1')
    const ledger = docs.get('notifications/founder-ops-idem-sme-register:uid-sme-001')
    expect(ledger?.emailSent).toBe(true)
    expect(ledger?.providerMessageId).toBe('msg_persist_1')
    expect(ledger?.emailProvider).toBe('resend')
    expect(ledger?.deliveryStatus).toBe('accepted')
    expect(ledger?.subject).toBe('New SME Registered — TenderBriefing')
  })

  it('observability failure does not throw (fail-soft)', async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: 'msg_x' }, error: null })
    const set = vi.fn().mockResolvedValue(undefined)
    const create = vi.fn().mockResolvedValue(undefined)
    const get = vi.fn().mockResolvedValue({ exists: false, data: () => ({}) })
    const ref = { id: 'founder-ops-idem-sme-register:uid-soft', get, set, create }

    // explode on index collection only after mark
    const boomDb = {
      collection: vi.fn((name: string) => {
        if (name === 'founderOpsEmailByProviderId' || name === 'resendWebhookPending') {
          throw new Error('observability down')
        }
        return {
          doc: vi.fn(() => ref),
        }
      }),
    }

    await expect(
      notifyService.notifyUserRegisteredSafe(
        { uid: 'uid-soft', email: 'a@b.co.za', displayName: 'A', userType: 'sme' },
        {
          getFirestore: () => boomDb,
          resendClient: { emails: { send } },
          getAdminUserIds: async () => [],
          saveNotification: async (n: Record<string, unknown>) => n,
          env: process.env,
        }
      )
    ).resolves.toMatchObject({ notified: true })
  })

  it('duplicate protection still skips second send', async () => {
    const send = vi.fn()
    const get = vi.fn().mockResolvedValue({ exists: true, data: () => ({ status: 'sent' }) })
    const ref = { id: 'x', get, set: vi.fn(), create: vi.fn() }
    const db = { collection: vi.fn(() => ({ doc: vi.fn(() => ref) })) }
    const result = await notifyService.notifyUserRegistered(
      { uid: 'uid-dup', email: 'a@b.co.za', displayName: 'A', userType: 'sme' },
      {
        getFirestore: () => db,
        resendClient: { emails: { send } },
        getAdminUserIds: async () => [],
        saveNotification: async (n: Record<string, unknown>) => n,
        env: process.env,
      }
    )
    expect(result.duplicate).toBe(true)
    expect(send).not.toHaveBeenCalled()
  })
})

describe('authorization surface', () => {
  it('founder email-delivery API requires verifyFounderUser', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/api/founder/email-delivery/route.ts'),
      'utf8'
    )
    expect(src).toContain('verifyFounderUser')
    expect(src).toContain("if ('error' in access) return access.error")
  })

  it('resend webhook route verifies signature and does not log secrets', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/api/webhooks/resend/route.ts'),
      'utf8'
    )
    expect(src).toContain('verifyResendWebhook')
    expect(src).toContain('RESEND_WEBHOOK_SECRET')
    expect(src).not.toMatch(/console\.log\(.*WEBHOOK_SECRET/)
  })

  it('payment service still only notifies founder ops on paid path (authority untouched)', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'backend/services/payments/attendancePaymentService.js'),
      'utf8'
    )
    expect(src).toContain('BRIEFING_PRICE')
    expect(src).toMatch(/34900|getBriefingPriceCents|ATTENDANCE_FEE/)
    const failedFn = src.slice(src.indexOf('async function markRequestFailed'))
    const failedBody = failedFn.slice(0, failedFn.indexOf('async function markRequestCancelled'))
    expect(failedBody).not.toContain('notifyAttendanceRequestPaid')
  })

  it('R349 constant unchanged', () => {
    const pricing = fs.readFileSync(
      path.join(process.cwd(), 'backend/constants/briefingPricing.js'),
      'utf8'
    )
    expect(pricing).toMatch(/BRIEFING_PRICE_CENTS\s*=\s*34900/)
  })
})
