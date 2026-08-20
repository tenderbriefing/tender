import { describe, expect, it } from 'vitest'
import {
  hasUpcomingBriefing,
  isBriefingPast,
  resolveBriefingDateTime,
} from '../../lib/procurement/dates'
import {
  filterIndexablePublicTenders,
  filterPlatformVisible,
  isPlatformVisibleToViewer,
  isPublicDetailVisibleToViewer,
} from '../../lib/security/publicTender'
import type { TenderBriefing } from '../../lib/tenderBriefing/types'

function baseTender(overrides: Partial<TenderBriefing> = {}): TenderBriefing {
  return {
    id: 'tb-1',
    ocid: 'ocid-1',
    tenderNumber: 'T-1',
    title: 'Sample',
    description: '',
    department: 'Test Dept',
    buyer: 'Buyer',
    province: 'Gauteng',
    category: '',
    industrySector: '',
    industryConfidence: 0,
    procurementMethod: 'RFQ',
    status: 'active',
    publishedDate: '2026-01-01T00:00:00+02:00',
    closingDate: '2026-12-31T16:00:00+02:00',
    briefingDate: '2026-08-10T10:00:00+02:00',
    briefingTime: '10:00',
    briefingVenue: 'Pretoria',
    briefingCompulsory: true,
    briefingConfidence: 0.9,
    matchedBriefingTerms: [],
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    meetingLink: '',
    documents: [],
    detailUrl: '',
    summary: '',
    requirements: [],
    risks: [],
    keyDates: [],
    recommendedFor: [],
    opportunityScore: 0,
    calendarEvents: [],
    history: [],
    source: 'test',
    visibility: 'public',
    lastSyncedAt: '2026-08-01T00:00:00Z',
    scrapedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

const NOW = new Date('2026-08-03T12:00:00+02:00')

describe('resolveBriefingDateTime / hasUpcomingBriefing', () => {
  it('uses full ISO briefing datetime as-is', () => {
    const d = resolveBriefingDateTime('2026-08-10T10:00:00+02:00', '10:00')
    expect(d?.toISOString()).toBe(new Date('2026-08-10T10:00:00+02:00').toISOString())
  })

  it('interprets date-only + time in Africa/Johannesburg', () => {
    const d = resolveBriefingDateTime('2026-08-10', '14:30')
    expect(d?.toISOString()).toBe(new Date('2026-08-10T14:30:00+02:00').toISOString())
  })

  it('keeps date-only tenders listable until end of SAST day', () => {
    expect(hasUpcomingBriefing('2026-08-03', null, NOW)).toBe(true)
    expect(isBriefingPast('2026-08-02', null, NOW)).toBe(true)
  })

  it('treats missing briefing date as past / not upcoming', () => {
    expect(isBriefingPast('', null, NOW)).toBe(true)
    expect(hasUpcomingBriefing(undefined, undefined, NOW)).toBe(false)
  })
})

describe('filterPlatformVisible — briefing-date cut-off', () => {
  it('hides public compulsory tenders once briefing datetime has passed', () => {
    const upcoming = baseTender({
      id: 'up',
      briefingDate: '2026-08-10T10:00:00+02:00',
    })
    const expired = baseTender({
      id: 'ex',
      briefingDate: '2026-08-01T09:00:00+02:00',
      briefingTime: '09:00',
    })
    const visible = filterPlatformVisible([upcoming, expired], null, { now: NOW })
    expect(visible.map((t) => t.id)).toEqual(['up'])
  })

  it('still requires compulsory briefing for anonymous viewers', () => {
    const optionalUpcoming = baseTender({
      briefingCompulsory: false,
      briefingDate: '2026-08-10T10:00:00+02:00',
    })
    expect(isPlatformVisibleToViewer(optionalUpcoming, null, { now: NOW })).toBe(false)
  })

  it('keeps past briefing visible on public detail pages for anonymous viewers', () => {
    const expired = baseTender({
      briefingDate: '2026-07-01T10:00:00+02:00',
    })
    expect(isPublicDetailVisibleToViewer(expired, null)).toBe(true)
    expect(isPlatformVisibleToViewer(expired, null, { now: NOW })).toBe(false)
  })

  it('keeps past briefing visible to admins (ops) but not to SMEs on public catalogue', () => {
    const expired = baseTender({
      briefingDate: '2026-07-01T10:00:00+02:00',
    })
    const admin = { userType: 'admin' as const, uid: 'admin-1' }
    const sme = { userType: 'sme' as const, uid: 'sme-1' }

    expect(isPlatformVisibleToViewer(expired, admin, { now: NOW })).toBe(true)
    expect(isPlatformVisibleToViewer(expired, sme, { now: NOW })).toBe(false)
    expect(isPlatformVisibleToViewer(expired, null, { now: NOW })).toBe(false)
  })

  it('keeps private RFQs visible to their owner even after briefing date', () => {
    const privateExpired = baseTender({
      visibility: 'private',
      ownerUid: 'sme-1',
      briefingCompulsory: false,
      briefingDate: '2026-07-01T10:00:00+02:00',
    })
    const owner = { userType: 'sme' as const, uid: 'sme-1' }
    const other = { userType: 'sme' as const, uid: 'sme-2' }

    expect(isPlatformVisibleToViewer(privateExpired, owner, { now: NOW })).toBe(true)
    expect(isPlatformVisibleToViewer(privateExpired, other, { now: NOW })).toBe(false)
    expect(isPlatformVisibleToViewer(privateExpired, null, { now: NOW })).toBe(false)
  })

  it('does not use closing date as the public list cut-off', () => {
    const stillBriefing = baseTender({
      briefingDate: '2026-08-20T10:00:00+02:00',
      closingDate: '2026-07-01T16:00:00+02:00', // closing already past
      status: 'active',
    })
    expect(isPlatformVisibleToViewer(stillBriefing, null, { now: NOW })).toBe(true)
  })
})

describe('filterIndexablePublicTenders — SEO historical records', () => {
  it('includes expired compulsory briefings for sitemap/detail indexing', () => {
    const upcoming = baseTender({
      id: 'up',
      briefingDate: '2026-08-10T10:00:00+02:00',
    })
    const expired = baseTender({
      id: 'ex',
      briefingDate: '2026-08-01T09:00:00+02:00',
      briefingTime: '09:00',
    })
    const optional = baseTender({
      id: 'opt',
      briefingCompulsory: false,
      briefingDate: '2026-08-10T10:00:00+02:00',
    })
    const indexable = filterIndexablePublicTenders([upcoming, expired, optional], null)
    expect(indexable.map((t) => t.id).sort()).toEqual(['ex', 'up'])
  })
})
