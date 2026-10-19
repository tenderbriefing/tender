/**
 * Phase 18 — durable day replay, retries, idempotency, HTTP-500 handling.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'

const require = createRequire(import.meta.url)

const dayFile = path.join(
  process.cwd(),
  'backend/data/ocds-day-reconciliation.json'
)
const syncFile = path.join(process.cwd(), 'backend/data/sync-state.json')
const tendersFile = path.join(process.cwd(), 'backend/data/tenders.json')

describe('Phase 18 OCDS day replay', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let domain: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let store: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let replay: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let backfill: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sync: any

  beforeEach(() => {
    process.env.STORAGE_ADAPTER = 'json'
    process.env.RATE_LIMIT_BACKEND = 'memory'
    for (const f of [dayFile, syncFile]) {
      if (fs.existsSync(f)) fs.unlinkSync(f)
    }
    fs.mkdirSync(path.dirname(tendersFile), { recursive: true })
    if (!fs.existsSync(tendersFile)) fs.writeFileSync(tendersFile, '[]\n', 'utf8')

    for (const k of Object.keys(require.cache).filter(
      (x) =>
        x.includes('ocdsDay') ||
        x.includes('ocdsBackfill') ||
        x.includes('ocdsBulk') ||
        x.includes('ocdsHistorical') ||
        x.includes('smeConnect') ||
        x.includes('incrementalSync') ||
        x.includes('storageAdapter') ||
        x.includes('tenderPipeline') ||
        x.includes('tenderModel')
    )) {
      delete require.cache[k]
    }

    domain = require('../../backend/domain/ocdsDayReconciliation')
    store = require('../../backend/services/ocdsDayStore')
    replay = require('../../backend/services/ocdsDayReplayService')
    backfill = require('../../backend/services/ocdsBackfillController')
    sync = require('../../backend/services/incrementalSyncService')

    const audit = require('../../backend/services/auditLogService')
    audit.logEvent = async () => {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
    for (const f of [dayFile]) {
      if (fs.existsSync(f)) fs.unlinkSync(f)
    }
  })

  it('HTTP 500 day never becomes SUCCESS', async () => {
    vi.spyOn(sync, 'fetchOcdsPage').mockRejectedValue(new Error('OCDS API error 500'))
    const { record } = await replay.replayDay('2026-10-01', { allowBulkFallback: false })
    expect(record.status).toBe(domain.DAY_STATUS.SOURCE_UNAVAILABLE)
    expect(record.status).not.toBe(domain.DAY_STATUS.SUCCESS)
    expect(record.httpStatus).toBe(500)
    expect(record.nextRetryAt).toBeTruthy()
    expect(record.certified).toBe(false)
  })

  it('legitimate zero-record day is SUCCESS', async () => {
    vi.spyOn(sync, 'fetchOcdsPage').mockResolvedValue({ releases: [], links: {} })
    const { record } = await replay.replayDay('2026-10-02', { allowBulkFallback: false })
    expect(record.status).toBe(domain.DAY_STATUS.SUCCESS)
    expect(record.sourceCount).toBe(0)
    expect(record.httpStatus).toBe(200)
    expect(record.certified).toBe(true)
  })

  it('persists releases idempotently without duplicates', async () => {
    const release = {
      ocid: 'ocds-9t57fa-180001',
      id: 'ocds-9t57fa-180001-2026-10-03',
      date: '2026-10-03T00:00:00Z',
      tender: {
        id: '180001',
        title: 'Phase 18 idempotency tender',
        description: 'Test',
        procurementMethod: 'open',
        procurementMethodDetails: 'Request for Bid(Open-Tender)',
        status: 'active',
        documents: [],
        tenderPeriod: { endDate: '2026-11-01T00:00:00Z' },
      },
      buyer: { name: 'Test Dept' },
    }
    vi.spyOn(sync, 'fetchOcdsPage').mockResolvedValue({
      releases: [release],
      links: {},
    })

    await replay.replayDay('2026-10-03', { allowBulkFallback: false, skipDocuments: true })
    await replay.replayDay('2026-10-03', { force: true, allowBulkFallback: false, skipDocuments: true })

    const storage = require('../../backend/services/storageAdapter').getStorage()
    const all = await storage.getTenderBriefings({})
    const hits = all.filter((t: { tenderNumber?: string }) => t.tenderNumber === '180001')
    expect(hits.length).toBe(1)
    expect(hits[0].sourceBriefingCompulsory).toBeNull()
  })

  it('skips already-certified SUCCESS days unless force', async () => {
    await store.saveDayRecord({
      ...domain.emptyDayRecord('2026-10-04'),
      status: domain.DAY_STATUS.SUCCESS,
      certified: true,
      sourceCount: 0,
      missingLocallyCount: 0,
      lastSuccessAt: new Date().toISOString(),
    })
    const spy = vi.spyOn(sync, 'fetchOcdsPage')
    const out = await replay.replayDay('2026-10-04')
    expect(out.skipped).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('backfill tick resumes via cursor after interruption', async () => {
    vi.spyOn(sync, 'fetchOcdsPage').mockResolvedValue({ releases: [], links: {} })
    await backfill.planBackfill({
      dateFrom: '2026-10-05',
      dateTo: '2026-10-07',
      cursorId: 'test-cursor',
    })
    const tick1 = await backfill.runBackfillTick({
      cursorId: 'test-cursor',
      maxDaysPerTick: 1,
      allowBulkFallback: false,
    })
    expect(tick1.done).toBe(false)
    expect(tick1.moreRemaining).toBe(true)
    expect(tick1.cursor.nextIndex).toBe(1)

    const tick2 = await backfill.runBackfillTick({
      cursorId: 'test-cursor',
      maxDaysPerTick: 5,
      allowBulkFallback: false,
    })
    expect(tick2.done).toBe(true)
    expect(tick2.cursor.status).toBe('completed')
  })

  it('retry delay increases with attempt count', () => {
    const a1 = domain.nextRetryDelayMs(1, { OCDS_DAY_RETRY_BASE_MS: 1000, OCDS_DAY_RETRY_MAX_MS: 100000 })
    const a3 = domain.nextRetryDelayMs(3, { OCDS_DAY_RETRY_BASE_MS: 1000, OCDS_DAY_RETRY_MAX_MS: 100000 })
    expect(a3).toBeGreaterThan(a1)
  })

  it('classifies missing local vs normalization differences', () => {
    const missing = domain.classifyFieldDiffs(
      { tenderNumber: '1', title: 'A', documents: [] },
      null
    )
    expect(missing[0].class).toBe(domain.DIFF_CLASS.MISSING_LOCAL_RECORD)

    const norm = domain.classifyFieldDiffs(
      {
        tenderNumber: '1',
        title: 'A',
        description: 'D',
        department: 'X',
        publishedDate: '',
        closingDate: '2026-11-01',
        briefingDate: '',
        briefingTime: '',
        briefingVenue: '',
        sourceBriefingCompulsory: null,
        status: 'active',
        documents: [],
      },
      {
        tenderNumber: '1',
        title: 'B',
        description: 'D',
        department: 'X',
        publishedDate: '',
        closingDate: '2026-11-01',
        briefingDate: '',
        briefingTime: '',
        briefingVenue: '',
        sourceBriefingCompulsory: null,
        status: 'active',
        documents: [],
      }
    )
    expect(norm.some((d: { field: string }) => d.field === 'title')).toBe(true)
    expect(norm[0].class).toBe(domain.DIFF_CLASS.SOURCE_NORMALIZATION_DIFFERENCE)
  })

  it('historical backfill sets source fields without inventing compulsory true', async () => {
    const storage = require('../../backend/services/storageAdapter').getStorage()
    await storage.upsertTenders([
      {
        id: 'tb-hist-1',
        ocid: 'ocds-9t57fa-hist1',
        tenderNumber: 'hist1',
        title: 'Historical',
        briefingCompulsory: false,
        // no sourceBriefingCompulsory
      },
    ])
    const hist = require('../../backend/services/ocdsHistoricalBackfillService')
    const result = await hist.backfillHistoricalSourceFields({ limit: 50, scanLimit: 200 })
    expect(result.written).toBeGreaterThanOrEqual(1)
    const all = await storage.getTenderBriefings({})
    const row = all.find((t: { id: string }) => t.id === 'tb-hist-1')
    expect(row.sourceBriefingCompulsory).toBeNull()
    expect(row.derivedBriefingStatus).toBeTruthy()
    expect(row.sourceType).toBeTruthy()
  })

  it('bulk source reports not configured by default', async () => {
    const bulk = require('../../backend/services/ocdsBulkSourceService')
    delete process.env.OCDS_BULK_ENABLED
    const r = await bulk.tryRecoverDay('2026-10-01')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('bulk_source_not_configured')
    expect(bulk.getInvestigationReport().portalUrl).toContain('data.etenders.gov.za')
  })

  it('SME Connect boundary emits event without customer notify', async () => {
    const sme = require('../../backend/services/smeConnectEventBoundary')
    const event = await sme.emitSmeConnectBriefingIngested({
      day: '2026-10-06',
      sourceCount: 2,
      persistedCount: 2,
    })
    expect(event.customerNotified).toBe(false)
    expect(event.recommendationsQueued).toBe(false)
    expect(event.type).toBe(sme.SME_CONNECT_EVENT)
  })
})
