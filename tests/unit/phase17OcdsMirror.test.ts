/**
 * Phase 17 — eTenders exact data mirror: ingest-first, source vs derived, pagination completeness.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

describe('Phase 17 OCDS mirror', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sync: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let model: any

  beforeEach(() => {
    for (const k of Object.keys(require.cache).filter(
      (x) =>
        x.includes('incrementalSyncService') ||
        x.includes('tenderModel') ||
        x.includes('documentExtractionService') ||
        x.includes('ocdsMirrorReconciliation')
    )) {
      delete require.cache[k]
    }
    sync = require('../../backend/services/incrementalSyncService')
    model = require('../../backend/services/tenderModel')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shouldIncludeTender always returns true (ingest-first)', () => {
    expect(sync.shouldIncludeTender({ briefingCompulsory: false })).toBe(true)
    expect(sync.shouldIncludeTender({ procurementMethod: 'open' })).toBe(true)
    expect(sync.shouldIncludeTender({})).toBe(true)
  })

  it('preserves sourceBriefingCompulsory separately from derived catalogue flag', () => {
    const release = {
      ocid: 'ocds-9t57fa-999001',
      id: 'ocds-9t57fa-999001-2026-10-01',
      date: '2026-10-01T00:00:00Z',
      tender: {
        id: '999001',
        title: 'Widget supply',
        description: 'Supply of widgets',
        procurementMethod: 'open',
        procurementMethodDetails: 'Participation',
        status: 'active',
        briefingSession: {},
        documents: [{ id: 'd1', title: 'RFQ', url: 'https://example.test/a.pdf' }],
        tenderPeriod: { endDate: '2026-11-01T00:00:00Z' },
      },
      buyer: { name: 'Test Dept' },
    }
    const mapped = sync.parseOcdsRelease(release)
    expect(mapped.sourceBriefingCompulsory).toBeNull()
    expect(mapped.briefingCompulsory).toBe(false)
    expect(mapped.derivedBriefingStatus).toBe(model.DERIVED_BRIEFING_STATUS.NOT_COMPULSORY)
    expect(mapped.rawSourceHash).toBeTruthy()
    expect(mapped.rawSourceSnapshot?.tenderId).toBe('999001')
    expect(mapped.rawSourceSnapshot?.documentCount).toBe(1)
  })

  it('does not invent compulsory=true when OCDS sends false', () => {
    const mapped = sync.parseOcdsRelease({
      ocid: 'ocds-9t57fa-999002',
      id: 'r2',
      date: '2026-10-02T00:00:00Z',
      tender: {
        id: '999002',
        title: 'Non-compulsory',
        briefingSession: { compulsory: false, venue: 'Hall A', date: '2026-10-20T10:00:00Z' },
      },
    })
    expect(mapped.sourceBriefingCompulsory).toBe(false)
    expect(mapped.derivedBriefingStatus).toBe(model.DERIVED_BRIEFING_STATUS.REVIEW_REQUIRED)
    expect(mapped.briefingCompulsory).toBe(false)
  })

  it('sets CONFIRMED_COMPULSORY when OCDS compulsory is true', () => {
    const mapped = sync.parseOcdsRelease({
      ocid: 'ocds-9t57fa-999003',
      id: 'r3',
      date: '2026-10-03T00:00:00Z',
      tender: {
        id: '999003',
        title: 'Compulsory',
        briefingSession: {
          compulsory: true,
          venue: 'Pretoria',
          date: '2026-10-25T11:00:00Z',
        },
      },
    })
    expect(mapped.sourceBriefingCompulsory).toBe(true)
    expect(mapped.briefingCompulsory).toBe(true)
    expect(mapped.derivedBriefingStatus).toBe(
      model.DERIVED_BRIEFING_STATUS.CONFIRMED_COMPULSORY
    )
  })

  it('contentHash changes when briefingCompulsory flips', () => {
    const base = model.createEmptyTenderBriefing({
      title: 'T',
      description: 'D',
      closingDate: '2026-11-01',
      briefingDate: '2026-10-20',
      briefingVenue: 'X',
      status: 'active',
      sourceBriefingCompulsory: false,
      briefingCompulsory: false,
      documents: [],
    })
    const a = model.contentHash(base)
    const b = model.contentHash({
      ...base,
      sourceBriefingCompulsory: true,
      briefingCompulsory: true,
      derivedBriefingStatus: model.DERIVED_BRIEFING_STATUS.CONFIRMED_COMPULSORY,
    })
    expect(a).not.toBe(b)
  })

  it('marks fetch incomplete when page budget truncates later days', async () => {
    vi.spyOn(sync, 'fetchOcdsPage').mockImplementation(async (...args: unknown[]) => {
      const from = String(args[0] ?? '')
      // Each day returns a full page so budget drains quickly
      return {
        releases: Array.from({ length: 100 }, (_, i) => ({
          ocid: `ocid-${from}-${i}`,
          tender: { id: `${from}-${i}`, title: `T ${from}` },
        })),
        links: { next: 'https://ocds-api.etenders.gov.za/api/OCDSReleases?PageNumber=2' },
      }
    })

    // maxPages=1 → first day truncated + remaining days truncated
    const result = await sync.fetchReleasesInRange('2026-10-01', '2026-10-03', 1)
    expect(result.incomplete).toBe(true)
    expect(result.truncatedDays.length).toBeGreaterThan(0)
  })

  it('derived PDF compulsory does not rewrite sourceBriefingCompulsory', () => {
    const sourceBriefingCompulsory = false
    const derived = model.deriveBriefingStatus(sourceBriefingCompulsory, {
      briefingCompulsory: true, // PDF heuristic
      briefingVenue: 'Site gate',
      briefingDate: '2026-10-20',
    })
    expect(sourceBriefingCompulsory).toBe(false)
    expect(derived).toBe(model.DERIVED_BRIEFING_STATUS.CONFIRMED_COMPULSORY)
    expect(model.catalogueCompulsoryFromDerived(derived)).toBe(true)
  })

  it('reconciliation flags ETENDERS_RECORD_MISSING_LOCALLY', async () => {
    const recon = require('../../backend/services/ocdsMirrorReconciliationService')
    const missing = recon.compareFields(
      {
        tenderNumber: '1',
        title: 'A',
        description: 'A',
        department: 'D',
        publishedDate: '',
        closingDate: '',
        briefingDate: '',
        briefingTime: '',
        briefingVenue: '',
        sourceBriefingCompulsory: null,
        contactPerson: '',
        contactEmail: '',
        contactPhone: '',
        status: 'active',
        documents: [],
      },
      {
        tenderNumber: '1',
        title: 'B',
        description: 'A',
        department: 'D',
        publishedDate: '',
        closingDate: '',
        briefingDate: '',
        briefingTime: '',
        briefingVenue: '',
        sourceBriefingCompulsory: null,
        contactPerson: '',
        contactEmail: '',
        contactPhone: '',
        status: 'active',
        documents: [],
      }
    )
    expect(missing.some((m: { field: string }) => m.field === 'title')).toBe(true)
    expect(recon.EXCEPTION_ETENDERS_RECORD_MISSING_LOCALLY).toBe(
      'ETENDERS_RECORD_MISSING_LOCALLY'
    )
  })
})
