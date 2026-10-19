/**
 * Phase 17 — OCDS source vs TenderBriefing local mirror reconciliation.
 * Read-only comparison; does not mutate PayFast / ops / delivery.
 */
const {
  fetchReleasesInRange,
  parseOcdsRelease,
  eachDateInclusive,
  MAX_PAGES_FULL,
} = require('./incrementalSyncService')
const { getStorage } = require('./storageAdapter')

const EXCEPTION_ETENDERS_RECORD_MISSING_LOCALLY = 'ETENDERS_RECORD_MISSING_LOCALLY'

function localKey(tender) {
  const ocid = String(tender?.ocid || '').trim()
  if (ocid) return `ocid:${ocid}`
  const num = String(tender?.tenderNumber || '').trim()
  if (num) return `tn:${num}`
  return `id:${tender?.id || ''}`
}

function sourceKey(release) {
  const ocid = String(release?.ocid || '').trim()
  if (ocid) return `ocid:${ocid}`
  const num = String(release?.tender?.id || '').trim()
  if (num) return `tn:${num}`
  return `id:${release?.id || ''}`
}

function compareFields(sourceMapped, local) {
  const fields = [
    ['tenderNumber', sourceMapped.tenderNumber, local.tenderNumber],
    ['title', sourceMapped.title, local.title],
    ['description', sourceMapped.description, local.description],
    ['department', sourceMapped.department, local.department],
    ['publishedDate', sourceMapped.publishedDate, local.publishedDate],
    ['closingDate', sourceMapped.closingDate, local.closingDate],
    ['briefingDate', sourceMapped.briefingDate, local.briefingDate],
    ['briefingTime', sourceMapped.briefingTime, local.briefingTime],
    ['briefingVenue', sourceMapped.briefingVenue, local.briefingVenue],
    ['sourceBriefingCompulsory', sourceMapped.sourceBriefingCompulsory, local.sourceBriefingCompulsory],
    ['contactPerson', sourceMapped.contactPerson, local.contactPerson],
    ['contactEmail', sourceMapped.contactEmail, local.contactEmail],
    ['contactPhone', sourceMapped.contactPhone, local.contactPhone],
    ['status', sourceMapped.status, local.status],
  ]
  const mismatches = []
  for (const [field, sourceVal, localVal] of fields) {
    const s = sourceVal == null ? '' : String(sourceVal)
    const l = localVal == null ? '' : String(localVal)
    if (s !== l) {
      mismatches.push({ field, source: sourceVal ?? null, local: localVal ?? null })
    }
  }
  const sourceDocs = (sourceMapped.documents || []).map((d) => d.url || d.id).filter(Boolean).sort()
  const localDocs = (local.documents || []).map((d) => d.url || d.id).filter(Boolean).sort()
  if (JSON.stringify(sourceDocs) !== JSON.stringify(localDocs)) {
    mismatches.push({
      field: 'documents',
      source: sourceDocs,
      local: localDocs,
    })
  }
  return mismatches
}

/**
 * Reconcile official OCDS releases for [dateFrom, dateTo] against local mirror.
 */
async function reconcileOcdsMirror(opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date()
  let dateTo = opts.dateTo || now.toISOString().slice(0, 10)
  let dateFrom = opts.dateFrom
  if (!dateFrom) {
    const lookback = new Date(now)
    lookback.setDate(lookback.getDate() - Number(opts.lookbackDays || 30))
    dateFrom = lookback.toISOString().slice(0, 10)
  }

  const maxPages = Number(opts.maxPages) || MAX_PAGES_FULL
  const fetchResult = await fetchReleasesInRange(dateFrom, dateTo, maxPages)
  const releases = fetchResult.releases || []

  // Dedupe source by ocid (latest release wins)
  const sourceByKey = new Map()
  for (const release of releases) {
    sourceByKey.set(sourceKey(release), release)
  }

  const storage = getStorage()
  const locals = await storage.getTenderBriefings({})
  const localByKey = new Map()
  for (const t of locals) {
    // Scope: prefer records whose publishedDate/sourcePublishedAt falls in window,
    // or that match a source key in this fetch.
    localByKey.set(localKey(t), t)
  }

  const matched = []
  const missingLocally = []
  const unexpectedLocal = []
  const changed = []
  const fieldMismatchSamples = []
  let documentMismatchCount = 0
  let fieldMismatchCount = 0

  const days = eachDateInclusive(dateFrom, dateTo)
  const inScopeLocal = []
  for (const t of locals) {
    const published = String(t.sourcePublishedAt || t.publishedDate || '').slice(0, 10)
    if (published && published >= dateFrom && published <= dateTo) {
      inScopeLocal.push(t)
    }
  }

  for (const [key, release] of sourceByKey) {
    const local = localByKey.get(key)
    if (!local) {
      const mapped = parseOcdsRelease(release)
      missingLocally.push({
        exceptionCode: EXCEPTION_ETENDERS_RECORD_MISSING_LOCALLY,
        key,
        ocid: release.ocid || null,
        tenderNumber: release.tender?.id || null,
        title: release.tender?.title || null,
        releaseDate: release.date || null,
        reason: 'present_in_ocds_absent_in_local_mirror',
      })
      continue
    }
    matched.push(key)
    const mapped = parseOcdsRelease(release)
    const mismatches = compareFields(mapped, local)
    if (mismatches.length) {
      changed.push(key)
      fieldMismatchCount += mismatches.length
      if (mismatches.some((m) => m.field === 'documents')) documentMismatchCount += 1
      if (fieldMismatchSamples.length < 50) {
        fieldMismatchSamples.push({
          key,
          ocid: local.ocid,
          tenderNumber: local.tenderNumber,
          mismatches,
        })
      }
    }
  }

  const sourceKeys = new Set(sourceByKey.keys())
  for (const t of inScopeLocal) {
    const key = localKey(t)
    if (!sourceKeys.has(key) && String(t.source || '').includes('OCDS')) {
      unexpectedLocal.push({
        key,
        ocid: t.ocid || null,
        tenderNumber: t.tenderNumber || null,
        title: t.title || null,
        reason: 'local_in_date_scope_not_in_this_ocds_fetch',
      })
    }
  }

  return {
    dateFrom,
    dateTo,
    daysRequested: days.length,
    fetchIncomplete: fetchResult.incomplete === true,
    dayErrors: fetchResult.dayErrors || [],
    truncatedDays: fetchResult.truncatedDays || [],
    pagesProcessed: fetchResult.pagesProcessed || 0,
    sourceCount: sourceByKey.size,
    sourceReleaseCount: releases.length,
    localMirrorCount: inScopeLocal.length,
    localTotalCount: locals.length,
    matchedCount: matched.length,
    missingLocallyCount: missingLocally.length,
    unexpectedLocalCount: unexpectedLocal.length,
    changedCount: changed.length,
    documentMismatchCount,
    fieldMismatchCount,
    syncFailureCount: (fetchResult.dayErrors || []).length,
    missingLocally: missingLocally.slice(0, 200),
    unexpectedLocal: unexpectedLocal.slice(0, 100),
    fieldMismatchSamples,
    exceptionCode:
      missingLocally.length > 0 ? EXCEPTION_ETENDERS_RECORD_MISSING_LOCALLY : null,
  }
}

/**
 * Random sample field validation (at least `sampleSize` matched records).
 */
function randomSampleValidation(reconResult, localsByKey, sourceByKey, sampleSize = 25) {
  const matchedKeys = []
  // Reconstruct from missing/matched via recon samples is awkward —
  // caller should pass matched pairs. This helper samples fieldMismatchSamples + extras.
  const pool = []
  for (const [key, release] of sourceByKey) {
    const local = localsByKey.get(key)
    if (local) pool.push({ key, release, local })
  }
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const sample = pool.slice(0, Math.min(sampleSize, pool.length))
  const results = sample.map(({ key, release, local }) => {
    const mapped = parseOcdsRelease(release)
    const mismatches = compareFields(mapped, local)
    const hasBriefing = Boolean(
      mapped.briefingDate || mapped.sourceBriefingCompulsory != null || mapped.briefingVenue
    )
    const hasDocs = (mapped.documents || []).length > 0
    return {
      key,
      ocid: mapped.ocid,
      tenderNumber: mapped.tenderNumber,
      pass: mismatches.length === 0,
      mismatchCount: mismatches.length,
      mismatches,
      traits: {
        hasBriefing,
        hasDocs,
        status: mapped.status,
        sourceCompulsory: mapped.sourceBriefingCompulsory,
        derivedStatus: local.derivedBriefingStatus || null,
      },
    }
  })
  return {
    sampleSize: results.length,
    passCount: results.filter((r) => r.pass).length,
    failCount: results.filter((r) => !r.pass).length,
    results,
  }
}

async function reconcileAndSample(opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date()
  let dateTo = opts.dateTo || now.toISOString().slice(0, 10)
  let dateFrom = opts.dateFrom
  if (!dateFrom) {
    const lookback = new Date(now)
    lookback.setDate(lookback.getDate() - Number(opts.lookbackDays || 30))
    dateFrom = lookback.toISOString().slice(0, 10)
  }

  const maxPages = Number(opts.maxPages) || MAX_PAGES_FULL
  const fetchResult = await fetchReleasesInRange(dateFrom, dateTo, maxPages)
  const releases = fetchResult.releases || []
  const sourceByKey = new Map()
  for (const release of releases) {
    sourceByKey.set(sourceKey(release), release)
  }

  const storage = getStorage()
  const locals = await storage.getTenderBriefings({})
  const localsByKey = new Map()
  for (const t of locals) localsByKey.set(localKey(t), t)

  const missingLocally = []
  const matched = []
  const changed = []
  const fieldMismatchSamples = []
  let documentMismatchCount = 0
  let fieldMismatchCount = 0

  for (const [key, release] of sourceByKey) {
    const local = localsByKey.get(key)
    if (!local) {
      missingLocally.push({
        exceptionCode: EXCEPTION_ETENDERS_RECORD_MISSING_LOCALLY,
        key,
        ocid: release.ocid || null,
        tenderNumber: release.tender?.id || null,
        title: release.tender?.title || null,
        releaseDate: release.date || null,
        reason: 'present_in_ocds_absent_in_local_mirror',
      })
      continue
    }
    matched.push(key)
    const mapped = parseOcdsRelease(release)
    const mismatches = compareFields(mapped, local)
    if (mismatches.length) {
      changed.push(key)
      fieldMismatchCount += mismatches.length
      if (mismatches.some((m) => m.field === 'documents')) documentMismatchCount += 1
      if (fieldMismatchSamples.length < 50) {
        fieldMismatchSamples.push({
          key,
          ocid: local.ocid,
          tenderNumber: local.tenderNumber,
          mismatches,
        })
      }
    }
  }

  const inScopeLocal = locals.filter((t) => {
    const published = String(t.sourcePublishedAt || t.publishedDate || '').slice(0, 10)
    return published && published >= dateFrom && published <= dateTo
  })
  const sourceKeys = new Set(sourceByKey.keys())
  const unexpectedLocal = []
  for (const t of inScopeLocal) {
    const key = localKey(t)
    if (!sourceKeys.has(key) && String(t.source || '').includes('OCDS')) {
      unexpectedLocal.push({
        key,
        ocid: t.ocid || null,
        tenderNumber: t.tenderNumber || null,
        title: t.title || null,
        reason: 'local_in_date_scope_not_in_this_ocds_fetch',
      })
    }
  }

  const recon = {
    dateFrom,
    dateTo,
    daysRequested: eachDateInclusive(dateFrom, dateTo).length,
    fetchIncomplete: fetchResult.incomplete === true,
    dayErrors: fetchResult.dayErrors || [],
    truncatedDays: fetchResult.truncatedDays || [],
    pagesProcessed: fetchResult.pagesProcessed || 0,
    sourceCount: sourceByKey.size,
    sourceReleaseCount: releases.length,
    localMirrorCount: inScopeLocal.length,
    localTotalCount: locals.length,
    matchedCount: matched.length,
    missingLocallyCount: missingLocally.length,
    unexpectedLocalCount: unexpectedLocal.length,
    changedCount: changed.length,
    documentMismatchCount,
    fieldMismatchCount,
    syncFailureCount: (fetchResult.dayErrors || []).length,
    missingLocally: missingLocally.slice(0, 200),
    unexpectedLocal: unexpectedLocal.slice(0, 100),
    fieldMismatchSamples,
    exceptionCode:
      missingLocally.length > 0 ? EXCEPTION_ETENDERS_RECORD_MISSING_LOCALLY : null,
  }

  const sample = randomSampleValidation(
    recon,
    localsByKey,
    sourceByKey,
    Number(opts.sampleSize) || 25
  )
  return { recon, sample }
}

module.exports = {
  EXCEPTION_ETENDERS_RECORD_MISSING_LOCALLY,
  reconcileOcdsMirror,
  reconcileAndSample,
  randomSampleValidation,
  compareFields,
  localKey,
  sourceKey,
}
