import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import robots from '../../app/robots'
import { organizationJsonLd, websiteJsonLd } from '../../lib/seo/structuredData'
import { SEO_LANDING_PATHS } from '../../lib/seo/landingPages'
import { SITE_URL } from '../../lib/seo/site'
import {
  buildTenderBreadcrumbJsonLd,
  buildTenderPageDescription,
  buildTenderPageTitle,
  buildTenderWebPageJsonLd,
} from '../../lib/seo/tenderSeo'
import type { TenderBriefing } from '../../lib/tenderBriefing/types'

const root = join(__dirname, '../..')

function src(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

function baseTender(overrides: Partial<TenderBriefing> = {}): TenderBriefing {
  return {
    id: 'tb-seo-phase1',
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

describe('SEO Phase 1 — robots.txt', () => {
  it('declares sitemap and blocks authenticated workspaces', () => {
    const rules = robots()
    expect(rules.sitemap).toBe(`${SITE_URL}/sitemap.xml`)
    expect(rules.host).toBe(SITE_URL)
    const ruleList = Array.isArray(rules.rules) ? rules.rules : rules.rules ? [rules.rules] : []
    const disallow = ruleList.flatMap((rule) =>
      Array.isArray(rule.disallow) ? rule.disallow : rule.disallow ? [rule.disallow] : []
    )
    expect(disallow).toEqual(
      expect.arrayContaining(['/sme/dashboard', '/agent/dashboard', '/founder', '/api/'])
    )
  })
})

describe('SEO Phase 1 — sitemap inventory', () => {
  it('includes contact and SEO landing pages in static route source', () => {
    const sitemapSrc = src('app/sitemap.ts')
    expect(sitemapSrc).toMatch(/path: '\/contact'/)
    for (const slug of SEO_LANDING_PATHS) {
      expect(sitemapSrc).toMatch(new RegExp(`SEO_LANDING_PATHS`))
    }
  })

  it('excludes authenticated routes from static sitemap entries', () => {
    const sitemapSrc = src('app/sitemap.ts')
    expect(sitemapSrc).not.toMatch(/\/sme\/dashboard/)
    expect(sitemapSrc).not.toMatch(/\/founder/)
    expect(sitemapSrc).not.toMatch(/\/api\//)
  })

  it('uses bounded indexable tender lookup for detail URLs', () => {
    const sitemapSrc = src('app/sitemap.ts')
    expect(sitemapSrc).toMatch(/getIndexableTenders/)
    expect(sitemapSrc).toMatch(/SITEMAP_TENDER_URL_CAP/)
  })
})

describe('SEO Phase 1 — tender metadata patterns', () => {
  it('builds reference-first title with organisation context in description', () => {
    const tender = baseTender({
      briefingDate: '2026-12-15T10:00:00+02:00',
      closingDate: '2026-12-31T16:00:00+02:00',
    })
    const title = buildTenderPageTitle(tender)
    expect(title).toMatch(/^TND-2026-001 — /)
    expect(buildTenderPageDescription(tender)).toContain('Department of Public Works')
    expect(buildTenderPageDescription(tender)).toContain('Compulsory briefing')
    expect(buildTenderPageDescription(tender)).not.toMatch(/undefined|null|Invalid Date/i)
  })

  it('handles missing optional fields safely', () => {
    const sparse = baseTender({
      tenderNumber: '',
      department: '',
      buyer: '',
      province: '',
      briefingDate: '',
      closingDate: '',
    })
    const description = buildTenderPageDescription(sparse)
    expect(description).not.toMatch(/undefined|null|Invalid Date/i)
    expect(description.length).toBeGreaterThan(20)
  })

  it('uses closed-tender copy while remaining indexable metadata-friendly', () => {
    const closed = baseTender({
      status: 'closed',
      briefingDate: '2026-01-10T10:00:00+02:00',
      closingDate: '2026-02-01T16:00:00+02:00',
    })
    expect(buildTenderPageDescription(closed).toLowerCase()).toContain('closed')
  })

  it('emits canonical tender breadcrumb and WebPage JSON-LD', () => {
    const tender = baseTender()
    const crumbs = buildTenderBreadcrumbJsonLd(tender)
    expect(crumbs.itemListElement).toHaveLength(3)
    expect(crumbs.itemListElement[1].name).toBe('Tenders')
    expect(crumbs.itemListElement[2].item).toBe(`${SITE_URL}/tenders/tb-seo-phase1`)

    const webPage = buildTenderWebPageJsonLd(tender)
    expect(webPage['@type']).toBe('WebPage')
    expect(webPage.url).toBe(`${SITE_URL}/tenders/tb-seo-phase1`)
  })
})

describe('SEO Phase 1 — global structured data', () => {
  it('includes Organization and WebSite schemas without invented contact details', () => {
    const org = organizationJsonLd()
    expect(org['@type']).toBe('Organization')
    expect(org.name).toBe('TenderBriefing')
    expect(org).not.toHaveProperty('telephone')
    expect(org).not.toHaveProperty('aggregateRating')

    const site = websiteJsonLd()
    expect(site['@type']).toBe('WebSite')
    expect(site.potentialAction?.target?.urlTemplate).toContain('/tenders?search=')
  })
})

describe('SEO Phase 1 — public pricing uses canonical R349 helpers', () => {
  it('uses R349 in root layout and SEO helpers', () => {
    expect(src('app/layout.tsx')).toMatch(/BRIEFING_PRICE_LABEL/)
    expect(src('lib/domain/briefingPricing.ts')).toMatch(/34900/)
  })
})

describe('Homepage SEO metadata — R349 public pricing', () => {
  it('uses the Compulsory Tender Briefings title without Government', () => {
    const page = src('app/page.tsx')
    expect(page).toMatch(/HOMEPAGE_SEO_TITLE/)
    expect(src('lib/seo/homepageMetadata.ts')).toMatch(
      /Tender Briefing South Africa \| Compulsory Tender Briefings/
    )
    expect(src('lib/seo/homepageMetadata.ts')).not.toMatch(/Compulsory Government Tender Briefings/)
  })

  it('uses the canonical R349 homepage description for metadata and JSON-LD', () => {
    const homepageMeta = src('lib/seo/homepageMetadata.ts')
    expect(homepageMeta).toMatch(/book a Youth Agent to attend your briefing/)
    expect(homepageMeta).toMatch(/BRIEFING_PRICE_SHORT_LABEL/)

    expect(src('app/page.tsx')).toMatch(/HOMEPAGE_SEO_DESCRIPTION/)
    expect(src('lib/seo/site.ts')).toMatch(/HOMEPAGE_SEO_DESCRIPTION/)
  })

  it('aligns visible homepage pricing copy with metadata', () => {
    const teaser = src('components/home/PricingTeaser.tsx')
    expect(teaser).toMatch(/BRIEFING_PRICE_SHORT_LABEL/)
    expect(teaser).toMatch(/book a Youth Agent to attend your briefing/)
  })
})

describe('SEO Phase 1 — visible tender breadcrumbs and internal links', () => {
  it('renders crawlable breadcrumb links on tender detail pages', () => {
    const page = src('app/tenders/(detail)/[id]/page.tsx')
    expect(page).toMatch(/TenderBreadcrumbs/)
    const crumbs = src('components/seo/TenderBreadcrumbs.tsx')
    expect(crumbs).toMatch(/href="\/tenders"/)
    expect(crumbs).toMatch(/href="\/"/)
  })

  it('links tender detail pages to existing service landing pages', () => {
    const links = src('components/procurement/TenderDetailContextLinks.tsx')
    expect(links).toMatch(/\/compulsory-tender-briefings/)
    expect(links).toMatch(/\/tender-briefing-agent/)
  })
})

describe('SEO Phase 1 — noindex on private workspace routes', () => {
  it('marks agent mobile layout as noindex', () => {
    const layout = src('app/agent/mobile/layout.tsx')
    expect(layout).toMatch(/PRIVATE_ROUTE_ROBOTS/)
  })
})
