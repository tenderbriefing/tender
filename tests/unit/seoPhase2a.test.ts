import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildPageMetadata } from '../../lib/seo/metadata'
import {
  allProvinceSlugs,
  compareBriefingDateAsc,
  isPeriodHubIndexable,
  isProvinceHubIndexable,
  periodHubPath,
  provinceHubPath,
  resolveProvinceSlug,
} from '../../lib/seo/compulsoryBriefingHubs'
import {
  addSastDays,
  formatSastYmd,
  getBriefingPeriodRange,
  isBriefingPeriodSlug,
  weekBoundsSast,
} from '../../lib/seo/compulsoryBriefingPeriods'
import { provinceToSlug, SA_PROVINCES } from '../../lib/procurement/provinces'
import type { TenderBriefing } from '../../lib/tenderBriefing/types'
import { HUB_SCAN_BUDGET, HUB_PAGE_SIZE } from '../../lib/seo/compulsoryBriefingHubs'

const root = join(__dirname, '../..')

function src(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

function baseTender(overrides: Partial<TenderBriefing> = {}): TenderBriefing {
  return {
    id: 'tb-1',
    ocid: 'ocid-1',
    tenderNumber: 'TND-001',
    title: 'Test tender',
    description: 'Scope',
    department: 'DPW',
    buyer: 'DPW',
    province: 'Gauteng',
    category: 'Goods',
    industrySector: 'General',
    industryConfidence: 0.5,
    procurementMethod: 'Open',
    status: 'active',
    publishedDate: '2026-01-01T00:00:00+02:00',
    closingDate: '2026-12-01T16:00:00+02:00',
    briefingDate: '2026-08-31T10:00:00+02:00',
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

describe('SEO Phase 2A — province slug mapping', () => {
  it('maps all nine provinces to stable slugs', () => {
    expect(allProvinceSlugs()).toHaveLength(9)
    expect(provinceToSlug('KwaZulu-Natal')).toBe('kwazulu-natal')
    expect(provinceToSlug('North West')).toBe('north-west')
    expect(provinceToSlug('Western Cape')).toBe('western-cape')
  })

  it('resolves valid province slugs', () => {
    expect(resolveProvinceSlug('gauteng')).toBe('Gauteng')
    expect(resolveProvinceSlug('western-cape')).toBe('Western Cape')
    expect(resolveProvinceSlug('kwazulu-natal')).toBe('KwaZulu-Natal')
  })

  it('rejects unsupported province slugs', () => {
    expect(resolveProvinceSlug('kzn')).toBeNull()
    expect(resolveProvinceSlug('kwazulu-natal-extra')).toBeNull()
    expect(resolveProvinceSlug('')).toBeNull()
  })

  it('uses canonical hub paths', () => {
    expect(provinceHubPath('gauteng')).toBe('/tenders/gauteng/compulsory-briefings')
    expect(periodHubPath('this-week')).toBe('/compulsory-tender-briefings/this-week')
  })

  it('covers every SA province slug', () => {
    for (const province of SA_PROVINCES) {
      const slug = provinceToSlug(province)
      expect(resolveProvinceSlug(slug)).toBe(province)
    }
  })
})

describe('SEO Phase 2A — SAST period boundaries', () => {
  const monday = new Date('2026-08-31T08:00:00+02:00')

  it('defines today in Africa/Johannesburg', () => {
    const range = getBriefingPeriodRange('today', monday)
    expect(formatSastYmd(range.start)).toBe('2026-08-31')
    expect(formatSastYmd(range.end)).toBe('2026-08-31')
  })

  it('defines this week as Monday through Sunday SAST', () => {
    const range = getBriefingPeriodRange('this-week', monday)
    expect(formatSastYmd(range.start)).toBe('2026-08-31')
    expect(formatSastYmd(range.end)).toBe('2026-09-06')
  })

  it('defines next week as the following Monday through Sunday', () => {
    const range = getBriefingPeriodRange('next-week', monday)
    expect(formatSastYmd(range.start)).toBe('2026-09-07')
    expect(formatSastYmd(range.end)).toBe('2026-09-13')
  })

  it('handles month-end boundaries in SAST', () => {
    const ref = new Date('2026-08-31T22:00:00+02:00')
    const range = getBriefingPeriodRange('this-month', ref)
    expect(formatSastYmd(range.start)).toBe('2026-08-01')
    expect(formatSastYmd(range.end)).toBe('2026-08-31')
  })

  it('handles year-end week boundaries', () => {
    const ref = new Date('2025-12-29T10:00:00+02:00')
    const thisWeek = weekBoundsSast(ref, 0)
    expect(formatSastYmd(thisWeek.start)).toBe('2025-12-29')
    expect(formatSastYmd(thisWeek.end)).toBe('2026-01-04')
    expect(addSastDays('2025-12-31', 1)).toBe('2026-01-01')
  })
})

describe('SEO Phase 2A — thin-page indexing policy', () => {
  it('indexes province hubs with at least three records', () => {
    expect(
      isProvinceHubIndexable({ upcoming: 1, historical: 2, totalPublic: 3 })
    ).toBe(true)
  })

  it('indexes province hubs with one upcoming and sufficient historical content', () => {
    expect(
      isProvinceHubIndexable({ upcoming: 1, historical: 1, totalPublic: 2 })
    ).toBe(true)
  })

  it('noindexes province hubs below threshold', () => {
    expect(
      isProvinceHubIndexable({ upcoming: 0, historical: 1, totalPublic: 1 })
    ).toBe(false)
    expect(
      isProvinceHubIndexable({ upcoming: 1, historical: 0, totalPublic: 1 })
    ).toBe(false)
  })

  it('indexes period hubs only when results exist', () => {
    expect(isPeriodHubIndexable(0)).toBe(false)
    expect(isPeriodHubIndexable(1)).toBe(true)
  })

  it('emits noindex,follow metadata for thin hubs', () => {
    const meta = buildPageMetadata({
      title: 'Compulsory Tender Briefings in Limpopo',
      description: 'Test',
      path: '/tenders/limpopo/compulsory-briefings',
      noIndex: true,
      noIndexFollow: true,
    })
    expect(meta.robots).toEqual({
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    })
  })
})

describe('SEO Phase 2A — tender ordering', () => {
  it('sorts upcoming briefings by briefing datetime ascending', () => {
    const early = baseTender({
      id: 'a',
      briefingDate: '2026-09-01T09:00:00+02:00',
      briefingTime: '09:00',
    })
    const late = baseTender({
      id: 'b',
      tenderNumber: 'TND-002',
      briefingDate: '2026-09-02T14:00:00+02:00',
      briefingTime: '14:00',
    })
    expect(compareBriefingDateAsc(early, late)).toBeLessThan(0)
    expect(compareBriefingDateAsc(late, early)).toBeGreaterThan(0)
  })
})

describe('SEO Phase 2A — route and sitemap wiring', () => {
  it('registers province compulsory-briefing routes', () => {
    const page = src('lib/seo/provinceHubRoute.tsx')
    expect(page).toMatch(/resolveProvinceSlug/)
    expect(page).toMatch(/isProvinceHubIndexable/)
    expect(src('app/tenders/gauteng/compulsory-briefings/page.tsx')).toMatch(
      /createProvinceCompulsoryBriefingsPage\('gauteng'\)/
    )
  })

  it('registers period hub routes with static params', () => {
    const page = src('app/compulsory-tender-briefings/[period]/page.tsx')
    expect(page).toMatch(/generateStaticParams/)
    expect(page).toMatch(/isBriefingPeriodSlug/)
    expect(isBriefingPeriodSlug('this-week')).toBe(true)
    expect(isBriefingPeriodSlug('invalid')).toBe(false)
  })

  it('adds indexable province and period hubs to sitemap', () => {
    const sitemap = src('app/sitemap.ts')
    expect(sitemap).toMatch(/listIndexableProvinceHubSlugs/)
    expect(sitemap).toMatch(/listIndexablePeriodHubSlugs/)
    expect(sitemap).toMatch(/provinceHubPath/)
    expect(sitemap).toMatch(/periodHubPath/)
  })

  it('uses bounded hub query budgets', () => {
    expect(HUB_SCAN_BUDGET).toBeLessThanOrEqual(200)
    expect(HUB_PAGE_SIZE).toBeLessThanOrEqual(100)
    const server = src('lib/seo/compulsoryBriefingHubServer.ts')
    expect(server).toMatch(/listTenderBriefingsPage/)
    expect(server).toMatch(/scanBudget/)
  })

  it('includes structured data helpers on hub pages', () => {
    const hub = src('components/seo/CompulsoryBriefingHubPage.tsx')
    expect(hub).toMatch(/collectionPageJsonLd/)
    expect(hub).toMatch(/breadcrumbJsonLd/)
    expect(hub).toMatch(/itemListJsonLd/)
  })

  it('links tender detail pages to indexable province hubs only', () => {
    const links = src('components/procurement/TenderDetailContextLinks.tsx')
    expect(links).toMatch(/getIndexableProvinceHubHref/)
    expect(links).toMatch(/More compulsory briefings in/)
  })
})

describe('SEO Phase 2A — commercial safeguards', () => {
  it('keeps R349 pricing guard in hub CTA copy', () => {
    const hubs = src('lib/seo/compulsoryBriefingHubs.ts')
    expect(hubs).toMatch(/BRIEFING_PRICE_LABEL/)
    expect(src('lib/domain/briefingPricing.ts')).toMatch(/34900/)
  })
})
