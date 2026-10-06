import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'
import {
  evaluateFounderAccess,
  isFounderEmail,
} from '@/lib/founder/access'

const require = createRequire(import.meta.url)
const intel = require('../../backend/services/founderRevenueIntelligence')

const BOUNDARY = '2026-10-06T00:00:00+02:00'
const AFTER = '2026-10-08T10:00:00+02:00'
const BEFORE = '2026-09-01T10:00:00+02:00'
const NOW = Date.parse('2026-10-10T12:00:00+02:00')

function evt(eventName: string, overrides: Record<string, unknown> = {}) {
  return {
    eventName,
    timestamp: AFTER,
    metadata: {},
    ...overrides,
  }
}

function paid(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    tenderId: 't-1',
    tenderTitle: 'Road works',
    paymentStatus: 'paid',
    paymentAmount: 34900,
    paidAt: AFTER,
    createdAt: AFTER,
    ...overrides,
  }
}

describe('founder revenue intelligence — measurement boundary', () => {
  it('marks pre-boundary periods as Unavailable (not zero)', () => {
    const periodEnd = Date.parse('2026-10-05T23:00:00+02:00')
    const avail = intel.prospectiveAvailability(Date.parse('2026-09-01T00:00:00+02:00'), periodEnd)
    expect(avail.status).toBe('unavailable')
    expect(avail.label).toBe('Unavailable')

    const result = intel.computeRevenueIntelligence({
      period: '30',
      nowMs: periodEnd,
      discoveryEvents: [evt('tender_listing_viewed', { timestamp: BEFORE })],
      detailEvents: [],
      intentEvents: [],
      checkoutEvents: [],
      requests: [],
    })
    const discovery = result.funnel.stages.find((s: { id: string }) => s.id === 'discovery')
    expect(discovery.displayVolume).toBe('Unavailable')
    expect(discovery.volume).toBeNull()
  })

  it('labels all-time as prospective_partial (not fully Measured)', () => {
    const avail = intel.prospectiveAvailability(null, NOW)
    expect(avail.status).toBe('prospective_partial')
    expect(avail.effectiveStartMs).toBe(intel.FUNNEL_BOUNDARY_MS)
  })

  it('does not invent conversion across unavailable stages', () => {
    const result = intel.computeRevenueIntelligence({
      period: '30',
      nowMs: Date.parse('2026-10-05T12:00:00+02:00'),
      requests: [paid({ paidAt: BEFORE })],
      discoveryEvents: [],
      detailEvents: [],
      intentEvents: [],
      checkoutEvents: [],
    })
    const leak = result.leakage.stages.find(
      (l: { from: string; to: string }) => l.from === 'discovery' && l.to === 'tender_detail'
    )
    expect(leak.pctLabel).toBe('Unavailable')
    expect(leak.kind).toBe('measurement_limitation')
  })
})

describe('founder revenue intelligence — checkout dedupe', () => {
  it('counts attempts vs unique requestId and ignores retries for booking KPIs', () => {
    const events = [
      evt('checkout_started', { metadata: { requestId: 'req-1', tenderId: 't-1' } }),
      evt('checkout_started', { metadata: { requestId: 'req-1', tenderId: 't-1' } }),
      evt('checkout_started', { metadata: { requestId: 'req-2', tenderId: 't-1' } }),
      evt('checkout_started', { targetEntityId: 'req-3', metadata: { tenderId: 't-2' } }),
      evt('checkout_started', { metadata: {} }),
    ]
    const stats = intel.uniqueCheckoutStats(events)
    expect(stats.attemptCount).toBe(5)
    expect(stats.uniqueBookingCount).toBe(3)
    expect(stats.missingRequestIdCount).toBe(1)

    const result = intel.computeRevenueIntelligence({
      period: '7',
      nowMs: NOW,
      checkoutEvents: events,
      discoveryEvents: [],
      detailEvents: [],
      intentEvents: [],
      requests: [],
    })
    expect(result.scorecard.checkoutAttempts).toBe(5)
    expect(result.scorecard.uniqueBookingsReachingCheckout).toBe(3)
  })
})

describe('founder revenue intelligence — conversion + zero denominator', () => {
  it('computes measured conversion when volumes exist', () => {
    const conv = intel.conversion(10, 4, 'measured', 'measured')
    expect(conv.rate).toBe(0.4)
    expect(conv.pctLabel).toBe('40%')
    expect(conv.absoluteDrop).toBe(6)
    expect(conv.reason).toBe('measured')
  })

  it('returns Insufficient data for zero denominator', () => {
    const conv = intel.conversion(0, 0, 'measured', 'measured')
    expect(conv.pctLabel).toBe('Insufficient data')
    expect(conv.rate).toBeNull()
    expect(conv.reason).toBe('zero_denominator')
  })
})

describe('founder revenue intelligence — revenue trust hierarchy', () => {
  it('uses paymentAmount → briefingPriceCents → quotedFee', () => {
    expect(intel.paidAmountCents({ paymentAmount: 34900 })).toBe(34900)
    expect(intel.paidAmountCents({ paymentAmount: null, briefingPriceCents: 34900 })).toBe(34900)
    expect(
      intel.paidAmountCents({ paymentAmount: null, briefingPriceCents: null, quotedFee: 27500 })
    ).toBe(27500)
    expect(intel.paidAmountCents({ paymentAmount: 0, briefingPriceCents: 0, quotedFee: 0 })).toBeNull()
  })

  it('never substitutes R349 when amount is unresolved', () => {
    const result = intel.computeRevenueIntelligence({
      period: '7',
      nowMs: NOW,
      requests: [
        paid({ id: 'a', paymentAmount: 34900 }),
        paid({
          id: 'b',
          paymentAmount: null,
          briefingPriceCents: null,
          quotedFee: null,
        }),
      ],
      discoveryEvents: [],
      detailEvents: [],
      intentEvents: [],
      checkoutEvents: [],
    })
    expect(result.scorecard.paidBookings).toBe(2)
    expect(result.scorecard.paidAmountUnresolved).toBe(1)
    expect(result.scorecard.revenueCollectedCents).toBe(34900)
    expect(result.scorecard.averageResolvedRevenueCents).toBe(34900)
  })
})

describe('founder revenue intelligence — funnel aggregation', () => {
  it('aggregates post-boundary stages and ranks leakage by absolute drop', () => {
    const result = intel.computeRevenueIntelligence({
      period: '7',
      nowMs: NOW,
      discoveryEvents: [
        evt('tender_listing_viewed'),
        evt('tender_listing_viewed'),
        evt('tender_listing_viewed'),
        evt('tender_listing_viewed'),
        evt('tender_listing_viewed'),
      ],
      detailEvents: [
        evt('tender_opened', { metadata: { tenderId: 't-1' } }),
        evt('tender_opened', { metadata: { tenderId: 't-1' } }),
        evt('tender_opened', { metadata: { tenderId: 't-2' } }),
      ],
      intentEvents: [evt('booking_intent', { metadata: { tenderId: 't-1' } })],
      checkoutEvents: [
        evt('checkout_started', { metadata: { requestId: 'req-1', tenderId: 't-1' } }),
      ],
      requests: [paid({ id: 'req-1', tenderId: 't-1' })],
      biReports: [{ requestId: 'req-1', status: 'delivered', deliveredAt: AFTER }],
    })

    expect(result.funnel.stages.map((s: { id: string; volume: number | null }) => [s.id, s.volume])).toEqual([
      ['discovery', 5],
      ['tender_detail', 3],
      ['booking_intent', 1],
      ['checkout', 1],
      ['paid', 1],
      ['report_delivered', 1],
    ])
    expect(result.leakage.largest?.from).toBe('discovery')
    expect(result.leakage.largest?.absoluteDrop).toBe(2)
    expect(result.scorecard.reportDeliveredQuality).toBe('partial')
    expect(result.scorecard.paidAwaitingReport).toBe(0)
  })

  it('marks report delivery as partial when using legacy proxies', () => {
    const result = intel.computeRevenueIntelligence({
      period: '7',
      nowMs: NOW,
      requests: [paid({ id: 'req-legacy', reportSubmittedAt: AFTER })],
      biReports: [],
      discoveryEvents: [],
      detailEvents: [],
      intentEvents: [],
      checkoutEvents: [],
    })
    expect(result.scorecard.reportDelivered).toBe(1)
    expect(result.scorecard.reportDeliveredLegacyProxyCount).toBe(1)
    const stage = result.funnel.stages.find((s: { id: string }) => s.id === 'report_delivered')
    expect(stage.availability).toBe('partial')
    expect(stage.quality).toBe('partial')
  })
})

describe('founder revenue intelligence — date/SAST boundary constant', () => {
  it('anchors instrumentation at 2026-10-06 SAST midnight', () => {
    expect(intel.FUNNEL_INSTRUMENTATION_VERSION).toBe('2026-10-p1-funnel-v1')
    expect(intel.FUNNEL_BOUNDARY_SAST).toBe('2026-10-06')
    expect(new Date(intel.FUNNEL_BOUNDARY_MS).toISOString()).toBe(
      new Date(BOUNDARY).toISOString()
    )
  })

  it('excludes product events before effective window inside a mixed period', () => {
    const start = Date.parse('2026-09-20T00:00:00+02:00')
    const avail = intel.prospectiveAvailability(start, NOW)
    expect(avail.status).toBe('prospective_partial')

    const result = intel.computeRevenueIntelligence({
      period: '30',
      nowMs: NOW,
      discoveryEvents: [
        evt('tender_listing_viewed', { timestamp: BEFORE }),
        evt('tender_listing_viewed', { timestamp: AFTER }),
      ],
      detailEvents: [],
      intentEvents: [],
      checkoutEvents: [],
      requests: [],
    })
    const discovery = result.funnel.stages.find((s: { id: string }) => s.id === 'discovery')
    expect(discovery.volume).toBe(1)
    expect(discovery.availability).toBe('prospective_partial')
  })
})

describe('founder authorization remains independent of revenue intel', () => {
  it('still requires founder allow-list for dashboard access', () => {
    expect(isFounderEmail('info@tenderbriefing.co.za')).toBe(true)
    expect(
      evaluateFounderAccess({
        enabled: true,
        authenticated: true,
        userType: 'admin',
        email: 'ops@example.com',
      }).ok
    ).toBe(false)
    expect(
      evaluateFounderAccess({
        enabled: true,
        authenticated: true,
        userType: 'admin',
        email: 'info@tenderbriefing.co.za',
      }).ok
    ).toBe(true)
  })
})

describe('founder revenue intelligence — query failure ≠ zero', () => {
  it('marks discovery Unavailable when productEvents query fails (not 0)', () => {
    const result = intel.computeRevenueIntelligence({
      period: '7',
      nowMs: NOW,
      discoveryLoad: { ok: false, error: 'FAILED_PRECONDITION: index' },
      detailLoad: { ok: true, events: [] },
      intentLoad: { ok: true, events: [] },
      checkoutLoad: { ok: true, events: [] },
      requests: [paid()],
    })
    const discovery = result.funnel.stages.find((s: { id: string }) => s.id === 'discovery')
    expect(discovery.displayVolume).toBe('Unavailable')
    expect(discovery.volume).toBeNull()
    expect(discovery.availabilityLabel).toBe('Measurement unavailable')
    expect(result.dataQuality.failedQueries).toContain('tender_listing_viewed')
    expect(result.dataQuality.zeroMeansMeasured).toBe(false)
    expect(result.measurementStatus).toBe('degraded')
    // Paid from attendanceRequests still measured — analytics is not payment authority
    expect(result.scorecard.paidBookings).toBe(1)
    expect(result.scorecard.revenueCollectedCents).toBe(34900)
  })

  it('does not treat checkout query failure as zero attempts or conversion', () => {
    const result = intel.computeRevenueIntelligence({
      period: '7',
      nowMs: NOW,
      discoveryLoad: { ok: true, events: [] },
      detailLoad: { ok: true, events: [] },
      intentLoad: { ok: true, events: [] },
      checkoutLoad: { ok: false, error: 'permission-denied' },
      requests: [paid()],
    })
    expect(result.scorecard.checkoutAttempts).toBeNull()
    expect(result.scorecard.uniqueBookingsReachingCheckout).toBeNull()
    expect(result.scorecard.checkoutAttemptsDisplay).toBe('Unavailable')
    expect(result.scorecard.paymentConversionPctLabel).toBe('Unavailable')
    const checkout = result.funnel.stages.find((s: { id: string }) => s.id === 'checkout')
    expect(checkout.displayVolume).toBe('Unavailable')
    expect(result.leakage.stages.find((l: { from: string }) => l.from === 'checkout').kind).toBe(
      'measurement_limitation'
    )
  })

  it('loadProductEventsByName returns ok:false on thrown query (not empty success)', async () => {
    const db = {
      collection: () => ({
        where: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                get: async () => {
                  throw new Error('requires an index')
                },
              }),
            }),
          }),
        }),
      }),
    }
    const load = await intel.loadProductEventsByName(db, 'tender_opened', AFTER)
    expect(load.ok).toBe(false)
    expect(load.events).toEqual([])
    expect(load.error).toMatch(/index/i)
  })
})

describe('founder revenue intelligence — cohort truncation', () => {
  it('labels event stages Partial with ≥ volume when event cap is hit', () => {
    const events = Array.from({ length: intel.EVENT_LIMIT }, () =>
      evt('tender_listing_viewed')
    )
    const result = intel.computeRevenueIntelligence({
      period: '7',
      nowMs: NOW,
      discoveryLoad: { ok: true, events, truncated: true },
      detailLoad: { ok: true, events: [] },
      intentLoad: { ok: true, events: [] },
      checkoutLoad: { ok: true, events: [] },
      requests: [],
    })
    const discovery = result.funnel.stages.find((s: { id: string }) => s.id === 'discovery')
    expect(discovery.availability).toBe('partial')
    expect(discovery.displayVolume).toBe(`≥${intel.EVENT_LIMIT}`)
    expect(result.dataQuality.truncatedSources).toContain('tender_listing_viewed')
    expect(result.measurementStatus).toBe('degraded')
  })

  it('labels paid Partial when request cohort is truncated', () => {
    const result = intel.computeRevenueIntelligence({
      period: '7',
      nowMs: NOW,
      requests: [paid()],
      requestsCohortTruncated: true,
      discoveryEvents: [],
      detailEvents: [],
      intentEvents: [],
      checkoutEvents: [],
    })
    const paidStage = result.funnel.stages.find((s: { id: string }) => s.id === 'paid')
    expect(paidStage.availability).toBe('partial')
    expect(paidStage.availabilityLabel).toMatch(/truncated/i)
    expect(result.scorecard.paidBookingsComplete).toBe(false)
    expect(result.dataQuality.requestsCohortTruncated).toBe(true)
  })
})

describe('founder revenue intelligence — Firestore index contract', () => {
  it('requires productEvents eventName+timestamp composite in firestore.indexes.json', () => {
    const { readFileSync } = require('node:fs')
    const { join } = require('node:path')
    const indexes = JSON.parse(
      readFileSync(join(process.cwd(), 'firestore.indexes.json'), 'utf8')
    )
    expect(intel.assertRequiredProductEventsIndex(indexes)).toBe(true)
    expect(intel.REQUIRED_PRODUCT_EVENTS_INDEX.fields).toEqual([
      { fieldPath: 'eventName', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' },
    ])
  })
})

describe('founder revenue intelligence — zero measured activity is distinct', () => {
  it('shows 0 when queries succeed and there truly are no events', () => {
    const result = intel.computeRevenueIntelligence({
      period: '7',
      nowMs: NOW,
      discoveryLoad: { ok: true, events: [] },
      detailLoad: { ok: true, events: [] },
      intentLoad: { ok: true, events: [] },
      checkoutLoad: { ok: true, events: [] },
      requests: [],
    })
    const discovery = result.funnel.stages.find((s: { id: string }) => s.id === 'discovery')
    expect(discovery.displayVolume).toBe('0')
    expect(discovery.volume).toBe(0)
    expect(discovery.availabilityLabel).not.toBe('Measurement unavailable')
    expect(result.dataQuality.zeroMeansMeasured).toBe(true)
    expect(result.measurementStatus).toBe('ok')
  })
})
