import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildPageMetadata } from '../../lib/seo/metadata'
import {
  getOrganisationBySlug,
  normaliseOrganisationLabel,
  resolveOrganisationFromTender,
  ORGANISATION_SEO_REGISTRY,
} from '../../lib/seo/organisationRegistry'
import {
  isOrganisationHubIndexable,
  organisationHubPath,
  organisationHubTitle,
  organisationDirectoryPath,
  ORG_DIRECTORY_MIN_INDEXABLE,
  ORG_HUB_MIN_TOTAL,
} from '../../lib/seo/organisationHubs'

const root = join(__dirname, '../..')

function src(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('SEO Phase 2B — organisation registry', () => {
  it('seeds only approved organisations with stable slugs', () => {
    expect(ORGANISATION_SEO_REGISTRY.length).toBeGreaterThanOrEqual(ORG_DIRECTORY_MIN_INDEXABLE)
    const slugs = ORGANISATION_SEO_REGISTRY.map((e) => e.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(getOrganisationBySlug('prasa')?.shortName).toBe('PRASA')
    expect(getOrganisationBySlug('eskom')?.displayName).toBe('Eskom')
    expect(getOrganisationBySlug('dbsa')?.shortName).toBe('DBSA')
  })

  it('resolves aliases to a single canonical organisation', () => {
    expect(
      resolveOrganisationFromTender({
        department: 'Passenger Rail Agency of South Africa',
      })?.slug
    ).toBe('prasa')
    expect(resolveOrganisationFromTender({ department: 'PRASA' })?.slug).toBe('prasa')
    expect(resolveOrganisationFromTender({ buyer: 'ESKOM' })?.slug).toBe('eskom')
    expect(resolveOrganisationFromTender({ department: 'Unknown Entity XYZ' })).toBeNull()
  })

  it('normalises punctuation and ampersands for matching', () => {
    expect(normaliseOrganisationLabel('Department of Rural Development & Land Reform')).toBe(
      'department of rural development and land reform'
    )
  })

  it('rejects unsupported organisation slugs', () => {
    expect(getOrganisationBySlug('transnet')).toBeNull()
    expect(getOrganisationBySlug('acsa')).toBeNull()
    expect(getOrganisationBySlug('')).toBeNull()
  })

  it('uses canonical hub paths', () => {
    expect(organisationHubPath('prasa')).toBe(
      '/tenders/organisations/prasa/compulsory-briefings'
    )
    expect(organisationDirectoryPath()).toBe('/tenders/organisations')
  })
})

describe('SEO Phase 2B — indexing threshold', () => {
  it('indexes when totalPublic >= 4', () => {
    expect(
      isOrganisationHubIndexable({ upcoming: 0, historical: 4, totalPublic: 4 })
    ).toBe(true)
  })

  it('indexes when upcoming >= 2 and totalPublic >= 3', () => {
    expect(
      isOrganisationHubIndexable({ upcoming: 2, historical: 1, totalPublic: 3 })
    ).toBe(true)
  })

  it('noindexes below threshold', () => {
    expect(
      isOrganisationHubIndexable({ upcoming: 1, historical: 1, totalPublic: 2 })
    ).toBe(false)
    expect(
      isOrganisationHubIndexable({ upcoming: 2, historical: 0, totalPublic: 2 })
    ).toBe(false)
  })

  it('emits noindex,follow metadata for thin organisation hubs', () => {
    const meta = buildPageMetadata({
      title: organisationHubTitle(getOrganisationBySlug('prasa')!),
      description: 'test',
      path: organisationHubPath('prasa'),
      noIndex: true,
      noIndexFollow: true,
    })
    expect(meta.robots).toEqual({
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    })
  })

  it('documents directory minimum of five indexable hubs', () => {
    expect(ORG_DIRECTORY_MIN_INDEXABLE).toBe(5)
    expect(ORG_HUB_MIN_TOTAL).toBe(4)
  })
})

describe('SEO Phase 2B — route and sitemap wiring', () => {
  it('registers organisation hub routes', () => {
    const page = src(
      'app/tenders/organisations/[organisation]/compulsory-briefings/page.tsx'
    )
    expect(page).toMatch(/getOrganisationBySlug/)
    expect(page).toMatch(/notFound/)
    expect(page).toMatch(/isOrganisationHubIndexable/)
    expect(page).toMatch(/generateStaticParams/)
  })

  it('registers organisation directory with threshold gate (no sticky notFound)', () => {
    const page = src('app/tenders/organisations/page.tsx')
    expect(page).toMatch(/shouldShowOrganisationDirectory/)
    expect(page).toMatch(/force-dynamic/)
    expect(page).not.toMatch(/notFound/)
    expect(page).toMatch(/listIndexableOrganisationEntries/)
  })

  it('adds indexable organisation hubs to sitemap', () => {
    const sitemap = src('app/sitemap.ts')
    expect(sitemap).toMatch(/listIndexableOrganisationHubSlugs/)
    expect(sitemap).toMatch(/shouldShowOrganisationDirectory/)
    expect(sitemap).toMatch(/organisationHubPath/)
  })

  it('uses shared bounded scan for organisation hubs', () => {
    const server = src('lib/seo/organisationHubServer.ts')
    expect(server).toMatch(/scanCompulsoryPublicTenders/)
    expect(server).toMatch(/getSharedCompulsoryScan/)
    expect(server).not.toMatch(/getAllTenders/)
  })

  it('links tender detail pages to organisation hubs', () => {
    const links = src('components/procurement/TenderDetailContextLinks.tsx')
    expect(links).toMatch(/getIndexableOrganisationHubHref/)
    expect(links).toMatch(/More compulsory briefing tenders from/)
  })

  it('exposes organisation nav on compulsory landing', () => {
    const nav = src('components/seo/CompulsoryBriefingHubNav.tsx')
    expect(nav).toMatch(/listOrganisationNavEntries/)
    expect(nav).toMatch(/By organisation/)
  })

  it('uses CollectionPage and BreadcrumbList on organisation hubs', () => {
    const hub = src('components/seo/OrganisationCompulsoryBriefingHubPage.tsx')
    expect(hub).toMatch(/collectionPageJsonLd/)
    expect(hub).toMatch(/breadcrumbJsonLd/)
    expect(hub).toMatch(/itemListJsonLd/)
  })
})

describe('SEO Phase 2B — commercial safeguards', () => {
  it('keeps R349 pricing guard in organisation CTA copy', () => {
    expect(src('lib/seo/organisationHubs.ts')).toMatch(/BRIEFING_PRICE_LABEL/)
    expect(src('lib/domain/briefingPricing.ts')).toMatch(/34900/)
    expect(src('lib/domain/briefingPricing.ts')).toMatch(/20000/)
  })
})
