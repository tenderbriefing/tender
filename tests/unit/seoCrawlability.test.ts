import React from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TenderCatalogueStaticList from '../../components/tenders/TenderCatalogueStaticList'
import ProgrammaticTenderStaticList from '../../components/seo/ProgrammaticTenderStaticList'
import {
  CATALOGUE_PAGE_SIZE,
  CATALOGUE_SCAN_BUDGET,
  PROGRAMMATIC_BROWSE_SCAN_BUDGET,
} from '../../lib/seo/catalogueServerData'
import { buildProgrammaticMetadata } from '../../lib/seo/programmaticPages'
import { buildPageMetadata } from '../../lib/seo/metadata'
import { SITE_URL } from '../../lib/seo/site'
import {
  buildTenderBriefingEventJsonLd,
  buildTenderPageTitle,
} from '../../lib/seo/tenderSeo'
import type { TenderBriefing } from '../../lib/tenderBriefing/types'

const root = join(__dirname, '../..')

function src(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

function sampleTender(id: string, overrides: Partial<TenderBriefing> = {}): TenderBriefing {
  return {
    id,
    ocid: `ocid-${id}`,
    tenderNumber: `T-${id}`,
    title: `Opportunity ${id}`,
    description: 'Supply and delivery of goods and services.',
    department: 'Test Department',
    buyer: 'Buyer',
    province: 'Gauteng',
    category: 'Construction',
    industrySector: 'Construction',
    industryConfidence: 0.9,
    procurementMethod: 'Open',
    status: 'active',
    publishedDate: '2026-01-01T00:00:00+02:00',
    closingDate: '2026-12-31T16:00:00+02:00',
    briefingDate: '2026-09-01T10:00:00+02:00',
    briefingTime: '10:00',
    briefingVenue: 'Johannesburg',
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

describe('catalogue SSR crawlability', () => {
  it('renders standard tender detail links in static HTML without client hydration', () => {
    const tenders = [sampleTender('tb-a'), sampleTender('tb-b')]
    const html = renderToStaticMarkup(
      React.createElement(TenderCatalogueStaticList, { tenders })
    )
    expect(html).toContain('href="/tenders/tb-a"')
    expect(html).toContain('href="/tenders/tb-b"')
    expect(html).toMatch(/<a[^>]+href="\/tenders\/tb-a"/)
  })

  it('renders programmatic browse tender links in static HTML', () => {
    const tenders = [sampleTender('tb-g1', { province: 'Gauteng' })]
    const html = renderToStaticMarkup(
      React.createElement(ProgrammaticTenderStaticList, { tenders })
    )
    expect(html).toContain('href="/tenders/tb-g1"')
  })
})

describe('catalogue server data bounds', () => {
  it('documents single-page catalogue limits aligned with API', () => {
    expect(CATALOGUE_PAGE_SIZE).toBe(40)
    expect(CATALOGUE_SCAN_BUDGET).toBeLessThanOrEqual(400)
    expect(PROGRAMMATIC_BROWSE_SCAN_BUDGET).toBe(CATALOGUE_SCAN_BUDGET)
  })

  it('getCatalogueInitialPage performs one paginated read, not a full catalogue scan', () => {
    const s = src('lib/seo/catalogueServerData.ts')
    expect(s).toMatch(/listTenderBriefingsPage\(/)
    expect(s).not.toMatch(/for \(let i = 0; i < 25/)
    expect(s).toMatch(/scanBudget: CATALOGUE_SCAN_BUDGET/)
  })
})

describe('structured data — compulsory briefing Event only', () => {
  it('emits Event JSON-LD for a valid compulsory briefing site meeting', () => {
    const event = buildTenderBriefingEventJsonLd(sampleTender('evt-1'))
    expect(event).not.toBeNull()
    expect(event?.['@type']).toBe('Event')
    expect(String(event?.name)).toContain('Compulsory tender briefing')
    expect(event?.startDate).toBeTruthy()
    expect(event?.location).toBeTruthy()
  })

  it('omits Event JSON-LD when briefing date is missing', () => {
    expect(buildTenderBriefingEventJsonLd(sampleTender('no-date', { briefingDate: '' }))).toBeNull()
  })

  it('omits Event JSON-LD when location fields are all missing', () => {
    expect(
      buildTenderBriefingEventJsonLd(
        sampleTender('no-loc', {
          briefingVenue: '',
          province: '',
          meetingLink: '',
        })
      )
    ).toBeNull()
  })

  it('omits Event JSON-LD for non-compulsory tenders', () => {
    expect(
      buildTenderBriefingEventJsonLd(sampleTender('opt', { briefingCompulsory: false }))
    ).toBeNull()
  })

  it('does not use closing date as Event startDate', () => {
    const event = buildTenderBriefingEventJsonLd(
      sampleTender('brief', {
        briefingDate: '2026-09-01T10:00:00+02:00',
        closingDate: '2026-12-31T16:00:00+02:00',
      })
    )
    expect(String(event?.startDate)).not.toContain('2026-12-31')
  })
})

describe('canonical determinism for browse pages', () => {
  it('keeps /tenders canonical without query permutations', () => {
    const meta = buildPageMetadata({
      title: 'Tenders',
      description: 'Browse',
      path: '/tenders',
    })
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/tenders`)
  })

  it('gives programmatic province pages their own canonical', () => {
    const meta = buildProgrammaticMetadata({
      slug: 'gauteng',
      title: 'Gauteng',
      metaDescription: 'Gauteng tenders',
      eyebrow: '',
      heroTitle: '',
      heroDescription: '',
      seoCopy: [],
      filter: () => true,
    })
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/tenders/gauteng`)
  })
})

describe('metadata quality guard', () => {
  it('avoids generic titles when tender data exists', () => {
    const title = buildTenderPageTitle(sampleTender('meta-1'))
    expect(title).not.toBe('Tender opportunity')
    expect(title.length).toBeGreaterThan(10)
  })
})
