import { describe, expect, it } from 'vitest'
import { PRIVATE_ROUTE_ROBOTS, buildPageMetadata } from '../../lib/seo/metadata'
import { NOINDEX_ROUTE_CLASSES } from '../../lib/seo/indexingPolicy'
import { SITE_URL } from '../../lib/seo/site'
import {
  buildTenderMetadata,
  buildTenderPageDescription,
  buildTenderPageTitle,
  buildTenderBriefingEventJsonLd,
  tenderHasUsefulHistoricalContent,
} from '../../lib/seo/tenderSeo'
import type { TenderBriefing } from '../../lib/tenderBriefing/types'

function baseTender(overrides: Partial<TenderBriefing> = {}): TenderBriefing {
  return {
    id: 'tb-seo-1',
    ocid: 'ocid-1',
    tenderNumber: 'TND-2026-001',
    title: 'Supply and delivery of office furniture',
    description: 'Full scope for office furniture supply across regional offices.',
    department: 'Department of Public Works',
    buyer: 'DPW',
    province: 'Gauteng',
    category: 'Goods',
    industrySector: 'Furniture',
    industryConfidence: 0.9,
    procurementMethod: 'Open tender',
    status: 'active',
    publishedDate: '2026-01-15T00:00:00+02:00',
    closingDate: '2026-09-30T16:00:00+02:00',
    briefingDate: '2026-08-25T10:00:00+02:00',
    briefingTime: '10:00',
    briefingVenue: 'Pretoria CBD',
    briefingCompulsory: true,
    briefingConfidence: 0.9,
    matchedBriefingTerms: [],
    contactPerson: 'Procurement Officer',
    contactEmail: 'procurement@example.gov.za',
    contactPhone: '',
    meetingLink: '',
    documents: [{ id: 'doc-1', title: 'Specification', url: 'https://example.gov.za/spec.pdf' }],
    detailUrl: 'https://example.gov.za/tender/1',
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

describe('SEO metadata — active tender', () => {
  it('produces reference-first title and self-referencing canonical', () => {
    const tender = baseTender()
    const meta = buildTenderMetadata(tender)
    expect(buildTenderPageTitle(tender)).toMatch(/^TND-2026-001 — /)
    expect(buildTenderPageTitle(tender)).not.toBe('Tender | TenderBriefing')
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/tenders/tb-seo-1`)
    expect(meta.robots).toEqual({ index: true, follow: true })
  })

  it('includes meaningful description with tender number and organisation', () => {
    const description = buildTenderPageDescription(baseTender())
    expect(description).toContain('TND-2026-001')
    expect(description).toContain('Department of Public Works')
    expect(description).not.toMatch(/undefined|null|Invalid Date/i)
  })
})

describe('SEO metadata — closed tender', () => {
  it('marks historical closed tenders as indexable with closed copy', () => {
    const closed = baseTender({
      briefingDate: '2026-01-10T10:00:00+02:00',
      closingDate: '2026-02-01T16:00:00+02:00',
      status: 'closed',
    })
    const meta = buildTenderMetadata(closed)
    const description = buildTenderPageDescription(closed)
    expect(description.toLowerCase()).toContain('closed')
    expect(meta.robots).toEqual({ index: true, follow: true })
    expect(buildTenderBriefingEventJsonLd(closed)?.eventStatus).toBe('https://schema.org/EventPast')
  })
})

describe('SEO metadata — invalid tender records', () => {
  it('treats empty compulsory records without useful content as non-indexable', () => {
    const empty = baseTender({
      title: '',
      tenderNumber: '',
      description: '',
      summary: '',
      documents: [],
    })
    expect(tenderHasUsefulHistoricalContent(empty)).toBe(false)
  })

  it('returns noindex metadata for missing tender paths', () => {
    const meta = buildPageMetadata({
      title: 'Tender opportunity not found',
      description: 'Missing',
      path: '/tenders/does-not-exist',
      noIndex: true,
    })
    expect(meta.robots).toEqual({
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    })
  })
})

describe('SEO indexing policy', () => {
  it('documents noindex classes for private operational routes', () => {
    expect(NOINDEX_ROUTE_CLASSES.founderOps.paths).toContain('/founder')
    expect(NOINDEX_ROUTE_CLASSES.agentWorkspace.paths).toContain('/agent/workspace')
    expect(NOINDEX_ROUTE_CLASSES.smeWorkspace.paths).toContain('/sme/dashboard')
  })

  it('uses consistent private robots metadata', () => {
    const robots = PRIVATE_ROUTE_ROBOTS.robots
    expect(robots && typeof robots === 'object' && 'index' in robots && robots.index).toBe(false)
    expect(robots && typeof robots === 'object' && 'follow' in robots && robots.follow).toBe(false)
  })
})

describe('SEO canonical determinism', () => {
  it('normalises canonical URLs from SITE_URL base', () => {
    const meta = buildPageMetadata({
      title: 'Tenders',
      description: 'Browse tenders',
      path: '/tenders',
    })
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/tenders`)
  })
})
