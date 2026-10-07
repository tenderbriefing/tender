import { describe, expect, it } from 'vitest'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import {
  buildTendersSearchHref,
  normalizeTenderSearchQuery,
  rankTendersForQuery,
  scoreTenderAgainstQuery,
  tenderMatchesSearchQuery,
  TENDER_SEARCH_MAX_QUERY_LENGTH,
} from '@/lib/procurement/tenderSearch'
import { filterTenders, defaultProcurementFilters } from '@/lib/procurement/filters'
import { isPublicApiRoute } from '@/lib/security/apiRoutePolicy'

function tb(partial: Partial<TenderBriefing> & { id: string; title: string }): TenderBriefing {
  return {
    tenderNumber: partial.tenderNumber || partial.id,
    description: '',
    summary: '',
    department: '',
    buyer: '',
    province: 'Gauteng',
    category: '',
    industrySector: '',
    status: 'active',
    briefingCompulsory: true,
    closingDate: '2026-12-01',
    briefingDate: '2026-11-15',
    ...partial,
  } as TenderBriefing
}

describe('normalizeTenderSearchQuery', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeTenderSearchQuery('  security   services ')).toBe('security services')
  })

  it('returns empty for blank / whitespace', () => {
    expect(normalizeTenderSearchQuery('')).toBe('')
    expect(normalizeTenderSearchQuery('   ')).toBe('')
    expect(normalizeTenderSearchQuery(null)).toBe('')
  })

  it('strips control chars and caps length', () => {
    const long = 'a'.repeat(300)
    expect(normalizeTenderSearchQuery(`sec\u0000urity`).includes('\u0000')).toBe(false)
    expect(normalizeTenderSearchQuery(long).length).toBe(TENDER_SEARCH_MAX_QUERY_LENGTH)
  })

  it('tolerates special characters without throwing', () => {
    expect(normalizeTenderSearchQuery(`RFQ <script>alert(1)</script>`)).toContain('RFQ')
  })
})

describe('rankTendersForQuery', () => {
  const corpus = [
    tb({
      id: 'tb-RFQ-1234',
      tenderNumber: 'RFQ-1234',
      title: 'Supply of CCTV cameras',
      department: 'City of Tshwane',
      category: 'security',
    }),
    tb({
      id: 'tb-SEC-99',
      tenderNumber: 'SEC-99',
      title: 'Guarding services for municipal offices',
      department: 'Eskom Holdings',
      category: 'security',
      province: 'Gauteng',
    }),
    tb({
      id: 'tb-ICT-1',
      tenderNumber: 'ICT-1',
      title: 'Fibre network rollout',
      department: 'SANDF',
      category: 'ict',
      province: 'Western Cape',
    }),
    tb({
      id: 'tb-CLEAN-1',
      tenderNumber: 'CLEAN-1',
      title: 'Office cleaning services',
      department: 'Department of Public Works',
      category: 'cleaning',
      status: 'closed',
    }),
  ]

  it('matches exact tender number strongest', () => {
    const ranked = rankTendersForQuery(corpus, 'RFQ-1234')
    expect(ranked.length).toBeGreaterThan(0)
    expect(ranked[0].tender.tenderNumber).toBe('RFQ-1234')
    expect(ranked[0].matchKind).toBe('tender_number_exact')
  })

  it('matches partial title case-insensitively', () => {
    const ranked = rankTendersForQuery(corpus, 'CCTV')
    expect(ranked.some((r) => r.tender.id === 'tb-RFQ-1234')).toBe(true)
  })

  it('matches organisation', () => {
    const ranked = rankTendersForQuery(corpus, 'city of tshwane')
    expect(ranked.some((r) => r.tender.id === 'tb-RFQ-1234')).toBe(true)
  })

  it('returns multiple matches for a category keyword', () => {
    const ranked = rankTendersForQuery(corpus, 'security')
    expect(ranked.length).toBeGreaterThanOrEqual(2)
  })

  it('returns empty for no results', () => {
    expect(rankTendersForQuery(corpus, 'zzzz-no-such-tender-xyz')).toEqual([])
  })

  it('empty / whitespace query returns empty ranked list', () => {
    expect(rankTendersForQuery(corpus, '')).toEqual([])
    expect(rankTendersForQuery(corpus, '   ')).toEqual([])
  })

  it('mixed-case query works', () => {
    const ranked = rankTendersForQuery(corpus, 'EsKoM')
    expect(ranked.some((r) => r.tender.id === 'tb-SEC-99')).toBe(true)
  })

  it('prefers higher score over closed status noise', () => {
    const ranked = rankTendersForQuery(corpus, 'cleaning')
    expect(ranked[0]?.tender.id).toBe('tb-CLEAN-1')
    const activeSecurity = rankTendersForQuery(
      corpus.filter((t) => t.status === 'active'),
      'security'
    )
    expect(activeSecurity.every((r) => r.tender.status === 'active')).toBe(true)
  })
})

describe('filterTenders search parity', () => {
  const tenders = [
    tb({
      id: 'a',
      tenderNumber: 'ABC-1',
      title: 'Training workshop facilitation',
      department: 'DHET',
    }),
  ]

  it('uses token search for multi-word queries', () => {
    const filtered = filterTenders(tenders, {
      ...defaultProcurementFilters,
      search: 'training facilitation',
      status: '',
    })
    expect(filtered).toHaveLength(1)
  })

  it('tenderMatchesSearchQuery rejects non-matches', () => {
    expect(tenderMatchesSearchQuery(tenders[0], 'security')).toBe(false)
    expect(scoreTenderAgainstQuery(tenders[0], 'training').score).toBeGreaterThan(0)
  })
})

describe('buildTendersSearchHref', () => {
  it('builds shareable URL with q and province', () => {
    expect(buildTendersSearchHref({ q: 'security', province: 'Gauteng' })).toBe(
      '/tenders?q=security&province=Gauteng'
    )
  })

  it('returns bare /tenders for empty query', () => {
    expect(buildTendersSearchHref({ q: '  ' })).toBe('/tenders')
  })
})

describe('search API route policy', () => {
  it('exposes search GET as public', () => {
    expect(isPublicApiRoute('/api/tender-briefings/search', 'GET')).toBe(true)
    expect(isPublicApiRoute('/api/tender-briefings/search', 'POST')).toBe(false)
    expect(isPublicApiRoute('/api/product-events/funnel', 'POST')).toBe(true)
  })
})
