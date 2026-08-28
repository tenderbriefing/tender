import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TenderBriefing } from '../../lib/tenderBriefing/types'
import {
  getOrganisationBySlug,
  organisationMatchesEntry,
  resolveOrganisationFromTender,
} from '../../lib/seo/organisationRegistry'
import {
  isOrganisationHubIndexable,
  ORG_HUB_MIN_TOTAL,
  ORG_HUB_MIN_TOTAL_WITH_UPCOMING,
  ORG_HUB_MIN_UPCOMING_PAIR,
} from '../../lib/seo/organisationHubs'
import {
  ORG_HUB_BATCH_SCAN,
  ORG_HUB_MATCH_LIMIT,
  ORG_HUB_SCAN_BUDGET,
  resetOrganisationHubScanCache,
  scanCompulsoryPublicTendersForOrganisation,
} from '../../lib/seo/organisationHubScan'
import { loadOrganisationHubData } from '../../lib/seo/organisationHubServer'

const root = join(__dirname, '../..')

function src(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

function tender(
  partial: Partial<TenderBriefing> & { id: string; department?: string; buyer?: string }
): TenderBriefing {
  return {
    title: partial.title || partial.id,
    briefingCompulsory: true,
    visibility: 'public',
    status: 'active',
    ...partial,
  } as TenderBriefing
}

const listTenderBriefingsPage = vi.fn()

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  }
})

vi.mock('@/lib/backend/loadServices', () => ({
  backend: {
    getStorage: () => ({
      listTenderBriefingsPage,
    }),
  },
}))

describe('SEO Phase 2C — organisation alias matching', () => {
  it('matches provincial Public Works department variants', () => {
    expect(
      resolveOrganisationFromTender({ department: 'Limpopo - Public Works' })?.slug
    ).toBe('public-works')
    expect(
      organisationMatchesEntry(
        { department: 'Limpopo - Public Works' },
        getOrganisationBySlug('public-works')!
      )
    ).toBe(true)
  })

  it('keeps PRASA on canonical aliases', () => {
    expect(
      resolveOrganisationFromTender({
        department: 'Passenger Rail Agency of South Africa',
      })?.slug
    ).toBe('prasa')
  })

  it('does not mix unrelated organisations', () => {
    expect(
      organisationMatchesEntry({ department: 'Eskom Holdings' }, getOrganisationBySlug('prasa')!)
    ).toBe(false)
  })
})

describe('SEO Phase 2C — organisation-specific retrieval', () => {
  beforeEach(() => {
    listTenderBriefingsPage.mockReset()
    resetOrganisationHubScanCache()
  })

  it('finds organisation tenders outside the old latest-80 global window', async () => {
    const prasa = getOrganisationBySlug('prasa')!
    const pages: TenderBriefing[][] = [
      Array.from({ length: 80 }, (_, i) =>
        tender({ id: `other-${i}`, department: 'Unrelated Org', buyer: 'Unrelated Org' })
      ),
      [
        tender({
          id: 'tb-prasa-1',
          department: 'Passenger Rail Agency of South Africa',
          buyer: 'Passenger Rail Agency of South Africa',
        }),
        tender({
          id: 'tb-prasa-2',
          department: 'PRASA',
          buyer: 'PRASA',
        }),
      ],
    ]

    let call = 0
    listTenderBriefingsPage.mockImplementation(async () => {
      call += 1
      if (call === 1) {
        return {
          items: pages[0],
          nextCursor: 'cursor-1',
          scanned: ORG_HUB_BATCH_SCAN,
          pageSize: 100,
        }
      }
      return {
        items: pages[1],
        nextCursor: null,
        scanned: ORG_HUB_BATCH_SCAN,
        pageSize: 100,
      }
    })

    const { items, scanned } = await scanCompulsoryPublicTendersForOrganisation(prasa, {
      scanBudget: ORG_HUB_SCAN_BUDGET,
    })

    expect(listTenderBriefingsPage.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(scanned).toBeGreaterThanOrEqual(ORG_HUB_BATCH_SCAN)
    expect(items.map((t) => t.id)).toEqual(['tb-prasa-1', 'tb-prasa-2'])
  })

  it('remains bounded by ORG_HUB_SCAN_BUDGET', async () => {
    const entry = getOrganisationBySlug('dbsa')!
    listTenderBriefingsPage.mockImplementation(async ({ cursor }) => ({
      items: cursor
        ? [tender({ id: 'tb-1', department: 'Development Bank of Southern Africa' })]
        : Array.from({ length: 80 }, (_, i) =>
            tender({ id: `noise-${i}`, department: 'Other Organisation' })
          ),
      nextCursor: cursor ? null : 'cursor-1',
      scanned: ORG_HUB_BATCH_SCAN,
      pageSize: 100,
    }))

    const { scanned } = await scanCompulsoryPublicTendersForOrganisation(entry, {
      scanBudget: 160,
    })

    expect(scanned).toBeLessThanOrEqual(160)
  })

  it('caps retained matches at ORG_HUB_MATCH_LIMIT', async () => {
    const entry = getOrganisationBySlug('hwseta')!
    const batch = Array.from({ length: 100 }, (_, i) =>
      tender({
        id: `tb-hw-${i}`,
        department: 'HWSETA',
        buyer: 'Health and Welfare Sector Education and Training Authority',
      })
    )
    listTenderBriefingsPage.mockResolvedValueOnce({
      items: batch,
      nextCursor: null,
      scanned: ORG_HUB_BATCH_SCAN,
      pageSize: 100,
    })

    const { items } = await scanCompulsoryPublicTendersForOrganisation(entry)
    expect(items.length).toBeLessThanOrEqual(ORG_HUB_MATCH_LIMIT)
  })

  it('loads organisation hub data via per-organisation scan', async () => {
    const entry = getOrganisationBySlug('dbsa')!
    listTenderBriefingsPage.mockImplementation(async ({ cursor }) => {
      if (!cursor) {
        return {
          items: Array.from({ length: 80 }, (_, i) =>
            tender({ id: `noise-${i}`, department: 'Other Organisation' })
          ),
          nextCursor: 'cursor-1',
          scanned: 80,
          pageSize: 100,
        }
      }
      return {
        items: [
          tender({ id: 'tb-dbsa-1', department: 'DBSA' }),
          tender({ id: 'tb-dbsa-2', department: 'Development Bank of Southern Africa' }),
        ],
        nextCursor: null,
        scanned: 80,
        pageSize: 100,
      }
    })

    const data = await loadOrganisationHubData(entry.slug)
    expect(data?.counts.totalPublic).toBe(2)
    expect(data?.entry.slug).toBe('dbsa')
  })
})

describe('SEO Phase 2C — threshold preservation', () => {
  it('noindexes 0–2 qualifying tenders', () => {
    expect(isOrganisationHubIndexable({ upcoming: 0, historical: 0, totalPublic: 0 })).toBe(
      false
    )
    expect(isOrganisationHubIndexable({ upcoming: 1, historical: 0, totalPublic: 1 })).toBe(
      false
    )
    expect(isOrganisationHubIndexable({ upcoming: 2, historical: 0, totalPublic: 2 })).toBe(
      false
    )
  })

  it('indexes at Phase 2B threshold (>=4 total or upcoming pair with >=3 total)', () => {
    expect(isOrganisationHubIndexable({ upcoming: 0, historical: 4, totalPublic: 4 })).toBe(
      true
    )
    expect(
      isOrganisationHubIndexable({
        upcoming: ORG_HUB_MIN_UPCOMING_PAIR,
        historical: 1,
        totalPublic: ORG_HUB_MIN_TOTAL_WITH_UPCOMING,
      })
    ).toBe(true)
    expect(
      isOrganisationHubIndexable({
        upcoming: 1,
        historical: 2,
        totalPublic: ORG_HUB_MIN_TOTAL_WITH_UPCOMING,
      })
    ).toBe(false)
    expect(ORG_HUB_MIN_TOTAL).toBe(4)
  })
})

describe('SEO Phase 2C — wiring safeguards', () => {
  it('uses organisation-specific bounded scan (not shared latest-80)', () => {
    const server = src('lib/seo/organisationHubServer.ts')
    const scan = src('lib/seo/organisationHubScan.ts')
    expect(server).toMatch(/scanCompulsoryPublicTendersForOrganisation/)
    expect(server).not.toMatch(/getSharedCompulsoryScan/)
    expect(scan).toMatch(/ORG_HUB_SCAN_BUDGET/)
    expect(scan).toMatch(/listTenderBriefingsPage/)
    expect(server).not.toMatch(/getAllTenders/)
  })

  it('preserves directory force-dynamic hotfix', () => {
    const page = src('app/tenders/organisations/page.tsx')
    expect(page).toMatch(/force-dynamic/)
    expect(page).not.toMatch(/notFound/)
  })

  it('preserves province/period org-link gating from PR #98', () => {
    const list = src('components/seo/CompulsoryBriefingTenderList.tsx')
    expect(list).toMatch(/indexableOrganisationSlugs/)
    expect(list).toMatch(/indexable\.has\(resolved\.slug\)/)
  })

  it('keeps unsupported slugs out of registry', () => {
    expect(getOrganisationBySlug('transnet')).toBeNull()
    expect(getOrganisationBySlug('city-of-cape-town')).toBeNull()
  })

  it('keeps R349 pricing guard', () => {
    expect(src('lib/domain/briefingPricing.ts')).toMatch(/34900/)
    expect(src('lib/domain/briefingPricing.ts')).toMatch(/20000/)
    expect(src('lib/seo/organisationHubs.ts')).toMatch(/BRIEFING_PRICE_LABEL/)
  })
})
