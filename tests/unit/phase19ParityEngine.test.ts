/**
 * Phase 19 — recovery, provenance, briefing classification, SME matching, website probe.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'

const require = createRequire(import.meta.url)

const dayFile = path.join(process.cwd(), 'backend/data/ocds-day-reconciliation.json')
const syncFile = path.join(process.cwd(), 'backend/data/sync-state.json')
const tendersFile = path.join(process.cwd(), 'backend/data/tenders.json')
const attendanceFile = path.join(process.cwd(), 'backend/data/attendance-requests.json')

describe('Phase 19 parity engine', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let domain: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let briefing: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let canonical: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let website: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matching: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parity: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recovery: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let store: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sync: any

  beforeEach(() => {
    process.env.STORAGE_ADAPTER = 'json'
    process.env.RATE_LIMIT_BACKEND = 'memory'
    for (const f of [dayFile, syncFile]) {
      if (fs.existsSync(f)) fs.unlinkSync(f)
    }
    fs.mkdirSync(path.dirname(tendersFile), { recursive: true })
    fs.writeFileSync(tendersFile, '[]\n', 'utf8')
    fs.writeFileSync(attendanceFile, '[]\n', 'utf8')

    for (const k of Object.keys(require.cache).filter(
      (x) =>
        x.includes('ocdsDay') ||
        x.includes('ocdsSource') ||
        x.includes('ocdsBulk') ||
        x.includes('parity') ||
        x.includes('canonical') ||
        x.includes('briefingClassification') ||
        x.includes('smeConnect') ||
        x.includes('etendersWebsite') ||
        x.includes('incrementalSync') ||
        x.includes('storageAdapter') ||
        x.includes('tenderPipeline') ||
        x.includes('tenderModel')
    )) {
      delete require.cache[k]
    }

    domain = require('../../backend/domain/ocdsDayReconciliation')
    briefing = require('../../backend/services/briefingClassificationService')
    canonical = require('../../backend/services/canonicalTenderService')
    website = require('../../backend/services/etendersWebsiteSourceService')
    matching = require('../../backend/services/smeConnectMatchingService')
    parity = require('../../backend/services/parityReconciliationService')
    recovery = require('../../backend/services/ocdsSourceRecoveryService')
    store = require('../../backend/services/ocdsDayStore')
    sync = require('../../backend/services/incrementalSyncService')

    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = async () => {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('HTTP 500 recovery attempt never becomes SUCCESS', async () => {
    vi.spyOn(sync, 'fetchOcdsPage').mockRejectedValue(new Error('OCDS API error 500'))
    vi.spyOn(sync, 'fetchReleasesInRange').mockRejectedValue(new Error('OCDS API error 500'))
    const replay = require('../../backend/services/ocdsDayReplayService')
    vi.spyOn(replay, 'replayDay').mockResolvedValue({
      record: {
        ...domain.emptyDayRecord('2026-10-01'),
        status: domain.DAY_STATUS.SOURCE_UNAVAILABLE,
        httpStatus: 500,
        certified: false,
      },
    })

    const fetchImpl = vi.fn(async () => ({
      status: 500,
      text: async () => 'error',
    }))

    const out = await recovery.recoverUnavailableDay('2026-10-01', {
      force: true,
      allowBulkFallback: false,
      fetchImpl,
    })
    expect(out.recovered).toBe(false)
    expect(out.record.status).toBe(domain.DAY_STATUS.SOURCE_UNAVAILABLE)
    expect(out.record.status).not.toBe(domain.DAY_STATUS.SUCCESS)
    expect(out.attempts.some((a: { result: string }) => a.result === 'SOURCE_UNAVAILABLE')).toBe(
      true
    )
  })

  it('weak tokens alone do not classify as compulsory', () => {
    const result = briefing.classifyBriefing({
      title: 'Site meeting for contractors',
      description: 'A briefing will be held',
      sourceBriefingCompulsory: null,
      documents: [],
    })
    expect(result.classification).toBe(domain.BRIEFING_CLASSIFICATION.UNKNOWN)
    expect(result.classification).not.toBe(domain.BRIEFING_CLASSIFICATION.CONFIRMED_COMPULSORY)
    expect(result.classification).not.toBe(domain.BRIEFING_CLASSIFICATION.LIKELY_COMPULSORY)
  })

  it('strong compulsory phrase confirms classification', () => {
    const result = briefing.classifyBriefing({
      title: 'Works tender',
      description: 'A compulsory briefing will be held at the venue',
      sourceBriefingCompulsory: null,
      documents: [],
    })
    expect(result.classification).toBe(domain.BRIEFING_CLASSIFICATION.CONFIRMED_COMPULSORY)
  })

  it('does not overwrite stronger OCDS provenance with website', async () => {
    const existing = {
      tenderNumber: 'TN-1',
      title: 'OCDS Title',
      department: 'Dept A',
      sources: [],
      fieldProvenance: {
        title: {
          sourceType: domain.SOURCE_TYPE.OCDS_RELEASE_API,
          confidence: domain.SOURCE_CONFIDENCE.AUTHORITATIVE_STRUCTURED,
          retrievedAt: '2026-10-01T00:00:00Z',
        },
      },
    }
    const { tender, conflictsOpened } = await canonical.mergeIntoCanonical(
      existing,
      { tenderNumber: 'TN-1', title: 'Website Title', department: 'Dept A' },
      {
        type: domain.SOURCE_TYPE.ETENDERS_WEBSITE,
        confidence: domain.SOURCE_CONFIDENCE.OFFICIAL_PUBLIC,
        retrievedAt: '2026-10-02T00:00:00Z',
      }
    )
    expect(tender.title).toBe('OCDS Title')
    expect(conflictsOpened).toBeGreaterThanOrEqual(1)
    expect(tender.sources.some((s: { type: string }) => s.type === 'ETENDERS_WEBSITE')).toBe(true)
  })

  it('ambiguous fuzzy match raises exception and does not merge keys', () => {
    const key = parity.deterministicKey({ title: 'Only Title' })
    expect(key).toBeNull()
    const fuzzy = parity.fuzzyCandidates(
      { title: 'HVAC maintenance contract northern region' },
      [
        { id: 'a', title: 'HVAC maintenance contract northern' },
        { id: 'b', title: 'HVAC maintenance contract northern area' },
      ]
    )
    expect(fuzzy.length).toBeGreaterThan(0)
  })

  it('website MVC error does not invent discoverable count', async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      text: async () =>
        '<html><body>An error occurred while processing your request.</body></html>',
    }))
    const out = await website.probeWebsiteForDay('2026-10-01', { fetchImpl })
    expect(out.websiteDiscoverableCount).toBeNull()
    expect(out.websiteStatus).toBe(domain.DAY_STATUS.SOURCE_UNAVAILABLE)
  })

  it('SME matching scores paid history and never notifies', async () => {
    const storage = require('../../backend/services/storageAdapter').getStorage()
    await storage.saveAttendanceRequest({
      id: 'req-1',
      paymentStatus: 'paid',
      smeId: 'sme-1',
      smeCompany: 'Ingenuity Engineers',
      smeName: 'Ingenuity Engineers',
      tenderTitle: 'HVAC maintenance RFQ',
      department: 'Public Works',
      province: 'Gauteng',
      tenderNumber: 'OLD-1',
    })

    const scored = matching.scoreTenderAgainstPaidRequest(
      {
        id: 'tb-new',
        title: 'HVAC replacement and maintenance',
        description: 'HVAC works',
        department: 'Public Works',
        province: 'Gauteng',
        briefingClassification: 'CONFIRMED_COMPULSORY',
      },
      {
        paymentStatus: 'paid',
        smeId: 'sme-1',
        smeCompany: 'Ingenuity Engineers',
        tenderTitle: 'HVAC maintenance RFQ',
        department: 'Public Works',
        province: 'Gauteng',
      }
    )
    expect(scored.score).toBeGreaterThan(0.45)
    expect(scored.reasons.length).toBeGreaterThan(0)

    const out = await matching.matchTenderToPaidSmes(
      {
        id: 'tb-new',
        tenderNumber: 'NEW-1',
        title: 'HVAC replacement and maintenance',
        description: 'HVAC works for facilities',
        department: 'Public Works',
        province: 'Gauteng',
        briefingClassification: 'CONFIRMED_COMPULSORY',
      },
      { minScore: 0.4 }
    )
    expect(out.candidates.every((c: { customerNotified: boolean }) => c.customerNotified === false)).toBe(
      true
    )
  })

  it('apiRoutePolicy allows parity daily sync route', async () => {
    const { isPublicApiRoute } = await import('@/lib/security/apiRoutePolicy')
    expect(isPublicApiRoute('/api/sync/ocds-parity-daily', 'POST')).toBe(true)
    expect(isPublicApiRoute('/api/sync/ocds-parity-daily', 'GET')).toBe(false)
  })
})
