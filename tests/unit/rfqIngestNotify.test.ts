import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const notifyService = require('../../backend/services/procurement/rfqIngestNotificationService')

function sampleDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ingest-abc123',
    subject: 'RFQ: Cleaning services Gauteng',
    fromEmail: 'buyer@example.gov.za',
    forwardedByEmail: 'sme@acme.co.za',
    source: 'manual_upload',
    status: 'pending_review',
    createdAt: '2026-08-06T17:00:00.000Z',
    rawEmailText: 'Please quote for hospital cleaning. Briefing 12 Aug at Civic Centre. '.repeat(20),
    extraction: {
      title: 'Hospital cleaning services',
      confidence: 0.82,
      readiness: {
        confidence: 0.82,
        dispatchEligible: false,
        dispatchReadiness: 'needs_review',
        missingFields: ['briefingDate', 'province'],
      },
    },
    ...overrides,
  }
}

describe('rfqIngestNotificationService helpers', () => {
  it('builds a deterministic idempotency key', () => {
    expect(notifyService.buildIdempotencyKey('ingest-abc123')).toBe('rfq-ingest:ingest-abc123')
  })

  it('maps source labels for manual vs webhook', () => {
    expect(notifyService.sourceLabel('manual_upload')).toBe('manual')
    expect(notifyService.sourceLabel('mailbox_webhook')).toBe('webhook')
    expect(notifyService.sourceLabel('email_forward')).toBe('email_forward')
  })

  it('bounds preview length and builds safe summary without dumping full body', () => {
    const summary = notifyService.buildIngestNotifySummary(sampleDoc())
    expect(summary.idempotencyKey).toBe('rfq-ingest:ingest-abc123')
    expect(summary.title).toBe('Hospital cleaning services')
    expect(summary.submitterEmail).toBe('sme@acme.co.za')
    expect(summary.source).toBe('manual')
    expect(summary.missingFields).toEqual(['briefingDate', 'province'])
    expect(summary.confidence).toBe(0.82)
    expect(summary.inboxPath).toBe('/admin/procurement-inbox')
    expect(summary.preview.length).toBeLessThanOrEqual(notifyService.PREVIEW_MAX + 1)
    expect(summary.preview).not.toContain('secret')
    const longBody = sampleDoc({ rawEmailText: 'x'.repeat(5000) })
    expect(notifyService.buildIngestNotifySummary(longBody).preview.length).toBeLessThanOrEqual(
      notifyService.PREVIEW_MAX + 1
    )
  })

  it('reads founder recipients from FOUNDER_EMAIL_ALLOWLIST', () => {
    expect(
      notifyService.founderEmailAllowlist({
        FOUNDER_EMAIL_ALLOWLIST: 'info@tenderbriefing.co.za, ops@tenderbriefing.co.za',
      })
    ).toEqual(['info@tenderbriefing.co.za', 'ops@tenderbriefing.co.za'])
    expect(notifyService.founderEmailAllowlist({})).toEqual(['info@tenderbriefing.co.za'])
  })
})

describe('notifyRfqIngested', () => {
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
    const get = vi.fn().mockResolvedValue({
      exists: Boolean(existing),
      data: () => existing || {},
    })
    const ref = { get, set }
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

  it('sends Resend email and admin inbox on ingest success', async () => {
    const { db } = mockDb(null)
    const send = vi.fn().mockResolvedValue({ data: { id: 'email_1' }, error: null })
    const saveNotification = vi.fn().mockImplementation(async (n: Record<string, unknown>) => n)

    const result = await notifyService.notifyRfqIngested(sampleDoc(), {
      getFirestore: () => db,
      resendClient: { emails: { send } },
      getAdminUserIds: async () => ['admin-1', 'admin-2'],
      saveNotification,
      env: process.env,
    })

    expect(result.duplicate).toBe(false)
    expect(result.notified).toBe(true)
    expect(result.email?.sent).toBe(true)
    expect(result.inboxCount).toBe(2)
    expect(send).toHaveBeenCalledTimes(1)
    const emailArgs = send.mock.calls[0][0]
    expect(emailArgs.to).toEqual(['info@tenderbriefing.co.za'])
    expect(emailArgs.subject).toMatch(/RFQ inbox/i)
    expect(emailArgs.text).toContain('sme@acme.co.za')
    expect(emailArgs.text).toContain('manual')
    expect(emailArgs.text).toContain('/admin/procurement-inbox')
    expect(emailArgs.headers['X-Entity-Ref-ID']).toBe('rfq-ingest:ingest-abc123')
    expect(saveNotification).toHaveBeenCalledTimes(2)
  })

  it('is idempotent — second call with same ingest id does not re-send', async () => {
    const { db } = mockDb({ status: 'sent' })
    const send = vi.fn().mockResolvedValue({ data: { id: 'email_1' }, error: null })
    const saveNotification = vi.fn()

    const result = await notifyService.notifyRfqIngested(sampleDoc(), {
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

  it('fails soft when Resend errors — returns error, does not throw', async () => {
    const { db } = mockDb(null)
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'rate limited' },
    })

    const result = await notifyService.notifyRfqIngested(sampleDoc(), {
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

  it('notifyRfqIngestedSafe never throws even if deps explode', async () => {
    const result = await notifyService.notifyRfqIngestedSafe(sampleDoc(), {
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
    })
    expect(result).toMatchObject({ notified: expect.any(Boolean) })
  })
})

describe('emailIngestionService triggers notify on success', () => {
  it('calls notifyRfqIngestedSafe after successful ingest write', async () => {
    // Smoke: module wiring — ingestEmail requires the notify module after set.
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(
      path.join(process.cwd(), 'backend/services/procurement/emailIngestionService.js'),
      'utf8'
    )
    expect(src).toContain("require('./rfqIngestNotificationService')")
    expect(src).toContain('notifyRfqIngestedSafe')
    expect(src.indexOf('notifyRfqIngestedSafe')).toBeGreaterThan(src.indexOf('await ref.set(doc)'))
  })
})
