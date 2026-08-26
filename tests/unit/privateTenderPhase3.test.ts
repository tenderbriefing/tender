/**
 * Phase 3 unit coverage — briefing fields, booking snapshot, recommendations,
 * follow-up updates, AI v2 normalization, flags (fail-closed).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  coerceBriefingFields,
  isPhysicalBriefingBookable,
  normalizeBriefingType,
  buildBriefingSnapshot,
} from '@/lib/privateTenders/briefingFields'
import { buildPrivateTenderBookingSnapshot } from '@/lib/privateTenders/privateBookingSnapshot'
import {
  isPrivateTenderBriefingBookingEnabled,
  isBriefingIntelligenceV2Enabled,
  isBriefingFollowUpUpdatesEnabled,
} from '@/lib/privateTenders/briefingOpsFlags'
import {
  normalizeBriefingIntelligenceV2,
  emptyBriefingIntelligenceV2,
  BRIEFING_INTELLIGENCE_V2_PROMPT_VERSION,
} from '@/lib/briefing-intelligence/briefingIntelligenceV2'
import { BRIEFING_PRICE_CENTS, PRICING_VERSION } from '@/lib/domain/briefingPricing'

const { recommendYouthAgents } = require('../../backend/services/youthAgentAssignmentRecommendations.js')

describe('Phase 3 briefing fields', () => {
  it('normalizes briefing types and physical bookability', () => {
    expect(normalizeBriefingType('PHYSICAL')).toBe('physical')
    expect(normalizeBriefingType('online')).toBe('online')
    expect(normalizeBriefingType('weird', 'none')).toBe('none')
    expect(
      isPhysicalBriefingBookable({
        briefingType: 'physical',
        briefingCompulsory: true,
      })
    ).toBe(true)
    expect(isPhysicalBriefingBookable({ briefingType: 'online' })).toBe(false)
    expect(isPhysicalBriefingBookable({ briefingType: 'none' })).toBe(false)
  })

  it('coerces additive briefing fields with legacy briefingTime alias', () => {
    const fields = coerceBriefingFields({
      briefingType: 'physical',
      briefingDate: '2026-09-10',
      briefingTime: '10:00',
      briefingVenue: 'City Hall',
      province: 'Gauteng',
    })
    expect(fields.briefingStartTime).toBe('10:00')
    expect(fields.briefingProvince).toBe('Gauteng')
    expect(fields.briefingRequired).toBe(true)
  })

  it('builds immutable briefing snapshot', () => {
    const snap = buildBriefingSnapshot({
      briefingType: 'physical',
      briefingDate: '2026-09-10',
      briefingStartTime: '09:30',
      briefingVenue: 'Venue A',
    })
    expect(snap.briefingType).toBe('physical')
    expect(snap.snapshotAt).toMatch(/T/)
  })
})

describe('Phase 3 private booking snapshot', () => {
  it('stamps private tender linkage and R349 pricing', () => {
    const snap = buildPrivateTenderBookingSnapshot({
      id: 'priv-pts-1',
      sourceType: 'private',
      privateSubmissionId: 'pts-1',
      organisationId: 'porg-1',
      tenderNumber: 'REF-1',
      title: 'Private smoke tender',
      briefingDate: '2026-09-10',
      briefingTime: '10:00',
      briefingVenue: 'Hall',
      province: 'Gauteng',
      briefingType: 'physical',
    })
    expect(snap.source).toBe('private_tender')
    expect(snap.privateTenderId).toBe('priv-pts-1')
    expect(snap.privateSubmissionId).toBe('pts-1')
    expect(snap.organisationId).toBe('porg-1')
    expect(snap.briefingPriceCents).toBe(BRIEFING_PRICE_CENTS)
    expect(snap.pricingVersion).toBe(PRICING_VERSION)
    expect(snap.briefingSnapshot?.briefingVenue).toBe('Hall')
  })

  it('marks public tenders without private org linkage', () => {
    const snap = buildPrivateTenderBookingSnapshot({
      id: 'tender-public-1',
      sourceType: 'public',
      title: 'Public tender',
    })
    expect(snap.source).toBe('public_tender')
    expect(snap.organisationId).toBeNull()
  })
})

describe('Phase 3 assignment recommendations', () => {
  it('returns explainable ranked recommendations', () => {
    const { recommendations } = recommendYouthAgents(
      {
        province: 'Gauteng',
        briefingDate: '2026-09-10',
        briefingSnapshot: { briefingMunicipality: 'Johannesburg' },
      },
      [
        {
          id: 'ya-1',
          displayName: 'Agent One',
          province: 'Gauteng',
          city: 'Johannesburg',
          reliabilityScore: 90,
          availability: 'available',
          verificationStatus: 'verified',
        },
        {
          id: 'ya-2',
          displayName: 'Busy Agent',
          province: 'Gauteng',
          reliabilityScore: 95,
        },
        {
          id: 'ya-3',
          displayName: 'Far Agent',
          province: 'Western Cape',
        },
      ],
      [{ briefingDate: '2026-09-10', assignedAgentId: 'ya-2', status: 'assigned' }]
    )
    expect(recommendations[0].agentId).toBe('ya-1')
    expect(recommendations[0].explanation).toMatch(/Recommended because/)
    expect(recommendations.find((r: { agentId: string }) => r.agentId === 'ya-2')).toBeUndefined()
  })
})

describe('Phase 3 AI briefing intelligence v2', () => {
  it('normalizes v2 sections without fabricating', () => {
    const empty = emptyBriefingIntelligenceV2()
    expect(empty.tenderInformation).toEqual([])
    const v2 = normalizeBriefingIntelligenceV2({
      tenderInformation: ['Closing date in tender pack'],
      briefingSpecificInformation: ['Site visit emphasised'],
      amendmentsOrChanges: [
        {
          tenderRequirement: 'Submit Form A',
          briefingChange: 'Form A must be notarised',
          bidderImplication: 'Obtain notary before close',
        },
      ],
      questionsAndAnswers: [{ question: 'Is JV allowed?', answer: 'Yes with letter' }],
      risksOrUncertainties: ['Audio unclear on insurance amount'],
    })
    expect(v2.briefingSpecificInformation[0]).toMatch(/Site visit/)
    expect(v2.amendmentsOrChanges[0].bidderImplication).toMatch(/notary/)
    expect(BRIEFING_INTELLIGENCE_V2_PROMPT_VERSION).toMatch(/v2/)
  })
})

describe('Phase 3 feature flags fail-closed', () => {
  const keys = [
    'PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED',
    'BRIEFING_INTELLIGENCE_V2_ENABLED',
    'BRIEFING_FOLLOW_UP_UPDATES_ENABLED',
  ]
  const prev: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of keys) {
      prev[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k]
      else process.env[k] = prev[k]
    }
  })

  it('defaults to disabled', () => {
    expect(isPrivateTenderBriefingBookingEnabled()).toBe(false)
    expect(isBriefingIntelligenceV2Enabled()).toBe(false)
    expect(isBriefingFollowUpUpdatesEnabled()).toBe(false)
  })

  it('enables when truthy', () => {
    process.env.PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED = 'true'
    process.env.BRIEFING_INTELLIGENCE_V2_ENABLED = '1'
    process.env.BRIEFING_FOLLOW_UP_UPDATES_ENABLED = 'yes'
    expect(isPrivateTenderBriefingBookingEnabled()).toBe(true)
    expect(isBriefingIntelligenceV2Enabled()).toBe(true)
    expect(isBriefingFollowUpUpdatesEnabled()).toBe(true)
  })
})

describe('Phase 3 follow-up update service', () => {
  it('creates and approves follow-up without mutating a report body', async () => {
    process.env.BRIEFING_FOLLOW_UP_UPDATES_ENABLED = 'true'
    const store = new Map()
    const db = {
      collection(name: string) {
        return {
          doc(id: string) {
            return {
              async set(data: Record<string, unknown>, opts?: { merge?: boolean }) {
                const key = `${name}/${id}`
                const prev = store.get(key) || {}
                store.set(key, opts?.merge ? { ...prev, ...data, id } : { ...data, id })
              },
              async get() {
                const data = store.get(`${name}/${id}`)
                return {
                  exists: Boolean(data),
                  id,
                  data: () => (data ? { ...data } : undefined),
                }
              },
            }
          },
          where() {
            return this
          },
          orderBy() {
            return this
          },
          limit() {
            return this
          },
          async get() {
            const docs = []
            for (const entry of Array.from(store.entries())) {
              const [key, value] = entry
              if (key.startsWith(`${name}/`)) {
                docs.push({ id: value.id, data: () => ({ ...value }) })
              }
            }
            return { docs, empty: docs.length === 0 }
          },
        }
      },
    }

    const svc = require('../../backend/services/briefingFollowUpUpdateService.js')
    const created = await svc.createFollowUpUpdate(
      {
        privateTenderId: 'priv-1',
        privateSubmissionId: 'pts-1',
        briefingRequestId: 'req-1',
        organisationId: 'porg-1',
        smeId: 'sme-1',
        updateType: 'clarification',
        title: 'Site access update',
        content: 'Gate opens at 07:30.',
      },
      { actorUid: 'founder-1', actorEmail: 'info@tenderbriefing.co.za' },
      { db }
    )
    expect(created.reviewStatus).toBe('pending_review')
    const approved = await svc.reviewFollowUpUpdate(
      created.id,
      'approve',
      { actorUid: 'founder-1', actorEmail: 'info@tenderbriefing.co.za' },
      { db }
    )
    expect(approved.reviewStatus).toBe('approved')
    expect(approved.title).toBe('Site access update')
    delete process.env.BRIEFING_FOLLOW_UP_UPDATES_ENABLED
  })
})

describe('Phase 3 follow-up IDOR / ownership boundaries', () => {
  it('stores organisationId server-side and does not rewrite ownership on review', async () => {
    process.env.BRIEFING_FOLLOW_UP_UPDATES_ENABLED = 'true'
    const store = new Map()
    const db = {
      collection(name: string) {
        return {
          doc(id: string) {
            return {
              async set(data: Record<string, unknown>, opts?: { merge?: boolean }) {
                const key = `${name}/${id}`
                const prev = store.get(key) || {}
                store.set(key, opts?.merge ? { ...prev, ...data, id } : { ...data, id })
              },
              async get() {
                const data = store.get(`${name}/${id}`)
                return {
                  exists: Boolean(data),
                  id,
                  data: () => (data ? { ...data } : undefined),
                }
              },
            }
          },
          where() {
            return this
          },
          orderBy() {
            return this
          },
          limit() {
            return this
          },
          async get() {
            const docs = []
            for (const entry of Array.from(store.entries())) {
              const [key, value] = entry
              if (key.startsWith(`${name}/`)) {
                docs.push({ id: value.id, data: () => ({ ...value }) })
              }
            }
            return { docs, empty: docs.length === 0 }
          },
        }
      },
    }
    const svc = require('../../backend/services/briefingFollowUpUpdateService.js')
    const created = await svc.createFollowUpUpdate(
      {
        privateTenderId: 'priv-A',
        organisationId: 'porg-A',
        smeId: 'sme-A',
        briefingRequestId: 'req-A',
        updateType: 'clarification',
        title: 'Org A update',
        content: 'Only for org A SME',
      },
      { actorUid: 'founder-1', actorEmail: 'info@tenderbriefing.co.za' },
      { db }
    )
    expect(created.organisationId).toBe('porg-A')
    const approved = await svc.reviewFollowUpUpdate(
      created.id,
      'approve',
      { actorUid: 'founder-1', actorEmail: 'info@tenderbriefing.co.za' },
      { db }
    )
    expect(approved.organisationId).toBe('porg-A')
    expect(approved.smeId).toBe('sme-A')
    delete process.env.BRIEFING_FOLLOW_UP_UPDATES_ENABLED
  })

  it('fails closed when follow-up flag is off', async () => {
    delete process.env.BRIEFING_FOLLOW_UP_UPDATES_ENABLED
    const svc = require('../../backend/services/briefingFollowUpUpdateService.js')
    await expect(
      svc.createFollowUpUpdate(
        { title: 'x', content: 'y' },
        { actorUid: 'f1' },
        { db: { collection: () => ({ doc: () => ({ set: async () => {} }) }) } }
      )
    ).rejects.toThrow(/not enabled/)
  })
})

describe('Phase 3 pipeline KPIs', () => {
  it('counts paid unassigned and private-source rows', () => {
    const { buildBriefingPipelineKpis } = require('../../backend/services/founderDashboardService.js')
    const kpis = buildBriefingPipelineKpis(
      [
        {
          id: 'r1',
          paymentStatus: 'paid',
          status: 'pending',
          assignedAgentId: null,
          source: 'private_tender',
          privateTenderId: 'priv-1',
          briefingDate: '2099-01-01',
        },
        {
          id: 'r2',
          paymentStatus: 'paid',
          status: 'assigned',
          assignedAgentId: 'ya-1',
          source: 'public_tender',
          briefingDate: '2099-01-02',
        },
      ],
      new Map(),
      Date.now()
    )
    expect(kpis.paidUnassigned).toBe(1)
    expect(kpis.privateSourceCount).toBe(1)
  })
})
