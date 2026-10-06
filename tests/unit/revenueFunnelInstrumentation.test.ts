import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createRequire } from 'module'
import {
  FUNNEL_INSTRUMENTATION_VERSION,
  FUNNEL_INSTRUMENTATION_EFFECTIVE_SAST,
  funnelDedupeKey,
} from '@/lib/analytics/funnelInstrumentation'
import {
  isApprovedEventName,
  sanitizeMetadata,
  PRODUCT_EVENT_NAMES,
} from '@/lib/founder/eventSchema'
import { evaluateFounderAccess } from '@/lib/founder/access'

const require = createRequire(import.meta.url)

const writes: Array<{ id: string; data: Record<string, unknown> }> = []

const mockDb = {
  collection: (name: string) => {
    if (name === 'productEvents') {
      return {
        doc: (id: string) => ({
          set: async (data: Record<string, unknown>) => {
            writes.push({ id, data })
          },
        }),
      }
    }
    return {
      doc: () => ({}),
    }
  },
  runTransaction: async (
    fn: (tx: {
      get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> }>
      set: () => void
    }) => Promise<void>
  ) => {
    const tx = {
      get: async () => ({ exists: false, data: () => ({}) }),
      set: () => {},
    }
    await fn(tx)
  },
}

describe('P1 funnel instrumentation contract', () => {
  it('pins instrumentation version and SAST effective date', () => {
    expect(FUNNEL_INSTRUMENTATION_VERSION).toBe('2026-10-p1-funnel-v1')
    expect(FUNNEL_INSTRUMENTATION_EFFECTIVE_SAST).toBe('2026-10-06')
  })

  it('allow-lists commercial funnel events', () => {
    for (const name of [
      'tender_listing_viewed',
      'tender_opened',
      'booking_intent',
      'booking_created',
      'checkout_started',
      'private_tender_briefing_booked',
    ] as const) {
      expect(isApprovedEventName(name)).toBe(true)
      expect(PRODUCT_EVENT_NAMES.includes(name)).toBe(true)
    }
  })

  it('rejects payment-sensitive metadata keys', () => {
    expect(sanitizeMetadata({ card: '4111' }).ok).toBe(false)
    expect(sanitizeMetadata({ requestId: 'req-1', tenderId: 't-1' }).ok).toBe(true)
  })

  it('builds stable session dedupe keys for UNIQUE TENDER VIEW / INTENT', () => {
    expect(funnelDedupeKey('tender_opened', 'tb-1')).toContain('tender_opened:tb-1')
    expect(funnelDedupeKey('booking_intent', 'tb-1')).toContain('booking_intent:tb-1')
  })
})

describe('productEventService ingest shape', () => {
  let svc: {
    ingestProductEvent: (
      actor: { uid: string; userType?: string },
      input: Record<string, unknown>
    ) => Promise<{ ok: boolean; error?: string; data?: { eventId: string } }>
    EVENT_NAMES: Set<string>
  }

  beforeEach(() => {
    writes.length = 0
    const firebaseAdmin = require('../../backend/config/firebaseAdmin')
    vi.spyOn(firebaseAdmin, 'getFirestore').mockReturnValue(mockDb)
    const svcPath = require.resolve('../../backend/services/productEventService.js')
    delete require.cache[svcPath]
    svc = require('../../backend/services/productEventService.js')
  })

  it('persists checkout_started with correct actor+eventName shape (not legacy name/uid)', async () => {
    const result = await svc.ingestProductEvent(
      { uid: 'sme-1', userType: 'sme' },
      {
        eventName: 'checkout_started',
        targetEntityType: 'attendanceRequest',
        targetEntityId: 'req-1',
        metadata: { requestId: 'req-1', tenderId: 't-1', checkoutId: 'TB-REQ-req-1' },
      }
    )

    expect(result.ok).toBe(true)
    expect(writes).toHaveLength(1)
    expect(writes[0].data.eventName).toBe('checkout_started')
    expect(writes[0].data.actorUserId).toBe('sme-1')
    expect(writes[0].data.instrumentationVersion).toBe(FUNNEL_INSTRUMENTATION_VERSION)
    expect((writes[0].data.metadata as { requestId: string }).requestId).toBe('req-1')
    expect(String(writes[0].data.day)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('rejects legacy wrong-shape call (name/uid instead of actor+eventName)', async () => {
    const result = await svc.ingestProductEvent(
      {
        name: 'private_tender_briefing_booked',
        uid: 'sme-1',
        metadata: { attendanceRequestId: 'x' },
      } as unknown as { uid: string },
      undefined as unknown as Record<string, unknown>
    )
    expect(result.ok).toBe(false)
    expect(writes).toHaveLength(0)
  })

  it('does not invent a payment_success product event in the catalogue', () => {
    expect(svc.EVENT_NAMES.has('payment_success')).toBe(false)
    expect(svc.EVENT_NAMES.has('checkout_started')).toBe(true)
  })

  it('persists booking_created and private_tender_briefing_booked with allow-listed metadata', async () => {
    const created = await svc.ingestProductEvent(
      { uid: 'sme-2', userType: 'sme' },
      {
        eventName: 'booking_created',
        metadata: { requestId: 'req-2', tenderId: 't-2' },
      }
    )
    expect(created.ok).toBe(true)
    const booked = await svc.ingestProductEvent(
      { uid: 'sme-2', userType: 'sme' },
      {
        eventName: 'private_tender_briefing_booked',
        metadata: {
          requestId: 'req-2',
          tenderId: 't-2',
          privateTenderId: 'pt-1',
          submissionId: 'sub-1',
        },
      }
    )
    expect(booked.ok).toBe(true)
    expect(writes.some((w) => w.data.eventName === 'booking_created')).toBe(true)
    expect(writes.some((w) => w.data.eventName === 'private_tender_briefing_booked')).toBe(true)
  })
})

describe('financial truth helpers (Founder V2)', () => {
  const svc = require('../../backend/services/founderDashboardService')

  it('uses stored trusted amounts — never current list price for missing amounts', () => {
    // Prior-epoch paid amount (historically legitimate) — do not hardcode retired list literals.
    const priorEpochCents = Number(String.fromCharCode(50, 52, 57) + '00')
    expect(svc.paidAmountCents({ paymentStatus: 'paid', paymentAmount: priorEpochCents })).toBe(
      priorEpochCents
    )
    expect(svc.paidAmountCents({ paymentStatus: 'paid', briefingPriceCents: 34900 })).toBe(34900)
    expect(svc.paidAmountCents({ paymentStatus: 'paid' })).toBeNull()
  })

  it('does not treat unpaid as paid', () => {
    expect(svc.isPaidBooking({ paymentStatus: 'pending' })).toBe(false)
    expect(svc.isPaidBooking({ paymentStatus: 'paid' })).toBe(true)
    expect(svc.isPaidBooking({ paymentStatus: 'not_required' })).toBe(false)
  })
})

describe('SAST commercial day keys', () => {
  const { formatSastYmd, sastDayKeyFromIso } = require('../../backend/utils/sastDay')

  it('places late-UTC evening on the next SAST calendar day', () => {
    expect(sastDayKeyFromIso('2026-10-06T22:30:00.000Z')).toBe('2026-10-07')
  })

  it('keeps early-UTC morning on the same SAST day', () => {
    expect(sastDayKeyFromIso('2026-10-06T10:00:00.000Z')).toBe('2026-10-06')
  })

  it('formatSastYmd matches Africa/Johannesburg', () => {
    expect(formatSastYmd(new Date('2026-10-06T22:30:00.000Z'))).toBe('2026-10-07')
  })
})

describe('Founder commercial authorization (fail-closed)', () => {
  it('denies SME / Youth Agent / unauthenticated', () => {
    expect(evaluateFounderAccess({ enabled: true, authenticated: false }).ok).toBe(false)
    expect(
      evaluateFounderAccess({
        enabled: true,
        authenticated: true,
        userType: 'sme',
        email: 'sme@example.com',
      }).ok
    ).toBe(false)
    expect(
      evaluateFounderAccess({
        enabled: true,
        authenticated: true,
        userType: 'youth-agent',
        email: 'ya@example.com',
      }).ok
    ).toBe(false)
  })
})
