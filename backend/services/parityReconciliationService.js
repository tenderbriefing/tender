/**
 * Phase 19 — Day-level website vs OCDS vs mirror reconciliation.
 * Deterministic matching only for merges; ambiguous → exception queue.
 */
const {
  DAY_STATUS,
  EXCEPTION_CATEGORY,
  SOURCE_TYPE,
  lookbackRange,
  eachDateInclusive,
  emptyDayRecord,
  normalizeCompareValue,
} = require('../domain/ocdsDayReconciliation')
const { getDayRecord, saveDayRecord, listDayRecords } = require('./ocdsDayStore')
const { probeWebsiteForDay, mapWebsiteRow } = require('./etendersWebsiteSourceService')
const { raiseException } = require('./parityExceptionService')
const { getStorage } = require('./storageAdapter')

function deterministicKey(row) {
  const tn = normalizeCompareValue(row.tenderNumber || row.tender_number || row.TenderNumber)
  if (tn) return `tn:${tn.toLowerCase()}`
  const ocid = normalizeCompareValue(row.ocid)
  if (ocid) return `ocid:${ocid.toLowerCase()}`
  const title = normalizeCompareValue(row.title || row.Title)
  const buyer = normalizeCompareValue(row.department || row.buyer || row.Department)
  const closing = normalizeCompareValue(row.closingDate || row.ClosingDate).slice(0, 10)
  if (title && buyer && closing) return `tbc:${title.toLowerCase()}|${buyer.toLowerCase()}|${closing}`
  return null
}

/**
 * Fuzzy candidates for review only — never auto-merge.
 */
function fuzzyCandidates(websiteRow, localRows) {
  const title = normalizeCompareValue(websiteRow.title || websiteRow.Title).toLowerCase()
  if (!title || title.length < 8) return []
  const hits = []
  for (const local of localRows) {
    const lt = normalizeCompareValue(local.title).toLowerCase()
    if (!lt) continue
    if (lt === title || lt.includes(title.slice(0, 24)) || title.includes(lt.slice(0, 24))) {
      hits.push(local)
    }
  }
  return hits.slice(0, 5)
}

async function reconcileDay(date, opts = {}) {
  const storage = getStorage()
  let record = (await getDayRecord(date)) || emptyDayRecord(date)

  // Website probe (lawful)
  const website = await probeWebsiteForDay(date, { fetchImpl: opts.fetchImpl })
  record.websiteStatus = website.websiteStatus
  record.websiteDiscoverableCount = website.websiteDiscoverableCount
  record.websiteLastCheckedAt = new Date().toISOString()
  record.websiteHttpStatus = website.httpStatus
  record.websiteError = website.error || null

  const ocdsCount = Number(record.sourceCount) || 0
  const allLocal = await storage.getTenderBriefings({ limit: 8000 })
  const dayLocals = (allLocal || []).filter((t) => {
    const pub = String(t.publishedDate || t.sourceRetrievedAt || t.lastSyncedAt || '').slice(0, 10)
    return pub === date
  })
  const mirrorCount = dayLocals.length

  const websiteRows = (website.records || []).map((r) => mapWebsiteRow(r)).filter(Boolean)
  const localByKey = new Map()
  for (const t of dayLocals) {
    const k = deterministicKey(t)
    if (k) localByKey.set(k, t)
  }
  const ocdsKeys = new Set(localByKey.keys())

  let websiteOnlyCount = 0
  let matchedWebsite = 0
  let fieldDifferenceCount = 0
  let unresolvedCount = 0
  const websiteKeys = new Set()

  for (const w of websiteRows) {
    const k = deterministicKey(w)
    if (!k) {
      unresolvedCount += 1
      const fuzzy = fuzzyCandidates(w, dayLocals)
      if (fuzzy.length > 0) {
        await raiseException({
          category: EXCEPTION_CATEGORY.AMBIGUOUS_MATCH,
          date,
          tenderNumber: w.tenderNumber,
          title: w.title,
          detail: `${fuzzy.length} fuzzy candidate(s); not merged`,
          payload: { website: w, candidates: fuzzy.map((f) => f.id || f.tenderNumber) },
        })
      }
      continue
    }
    websiteKeys.add(k)
    const local = localByKey.get(k)
    if (!local) {
      websiteOnlyCount += 1
      await raiseException({
        category: EXCEPTION_CATEGORY.WEBSITE_ONLY,
        date,
        tenderNumber: w.tenderNumber,
        title: w.title,
        detail: 'Website-discoverable row with no deterministic local match',
        payload: { website: w },
      })
    } else {
      matchedWebsite += 1
      for (const field of ['title', 'department', 'closingDate', 'briefingDate', 'briefingVenue']) {
        if (
          w[field] != null &&
          local[field] != null &&
          normalizeCompareValue(w[field]) !== normalizeCompareValue(local[field])
        ) {
          fieldDifferenceCount += 1
        }
      }
    }
  }

  let ocdsOnlyCount = 0
  if (website.websiteDiscoverableCount != null && websiteRows.length > 0) {
    for (const k of ocdsKeys) {
      if (!websiteKeys.has(k)) {
        ocdsOnlyCount += 1
        const local = localByKey.get(k)
        await raiseException({
          category: EXCEPTION_CATEGORY.OCDS_ONLY,
          date,
          tenderNumber: local?.tenderNumber,
          ocid: local?.ocid,
          title: local?.title,
          detail: 'Local/OCDS row not found in website discoverable set',
        })
      }
    }
  } else {
    // Website universe incomplete — do not invent ocdsOnly from missing website feed
    ocdsOnlyCount = 0
    unresolvedCount += website.websiteStatus === DAY_STATUS.SOURCE_UNAVAILABLE ? 1 : 0
  }

  const missingLocallyCount = Number(record.missingLocallyCount) || 0

  let parityStatus = 'INCOMPLETE_WEBSITE_UNIVERSE'
  if (
    website.websiteDiscoverableCount != null &&
    websiteOnlyCount === 0 &&
    missingLocallyCount === 0 &&
    record.status === DAY_STATUS.SUCCESS
  ) {
    parityStatus = 'WEBSITE_ALIGNED'
  } else if (record.status === DAY_STATUS.SUCCESS && missingLocallyCount === 0) {
    parityStatus = 'REACHABLE_OCDS_PARITY'
  } else if (record.status === DAY_STATUS.SOURCE_UNAVAILABLE) {
    parityStatus = 'SOURCE_UNAVAILABLE'
  }

  record.ocdsCount = ocdsCount
  record.mirrorCount = mirrorCount
  record.websiteOnlyCount = websiteOnlyCount
  record.ocdsOnlyCount = ocdsOnlyCount
  record.fieldDifferenceCount = fieldDifferenceCount
  record.unresolvedCount = unresolvedCount
  record.parityStatus = parityStatus
  record.matchedWebsiteCount = matchedWebsite

  await saveDayRecord(record)

  return {
    date,
    websiteDiscoverableCount: record.websiteDiscoverableCount,
    ocdsCount,
    mirrorCount,
    websiteOnlyCount,
    ocdsOnlyCount,
    missingLocallyCount,
    fieldDifferenceCount,
    unresolvedCount,
    parityStatus,
    websiteStatus: record.websiteStatus,
    ocdsStatus: record.status,
    record,
  }
}

async function summarizeParityRange(dateFrom, dateTo) {
  const days = eachDateInclusive(dateFrom, dateTo)
  const records = await listDayRecords({ dateFrom, dateTo, limit: 400 })
  const byDate = new Map(records.map((r) => [r.date, r]))

  const summary = {
    dateFrom,
    dateTo,
    totalCalendarDays: days.length,
    byOcdsStatus: {},
    byWebsiteStatus: {},
    byParityStatus: {},
    successfulReleaseApiDays: 0,
    recoveredDays: 0,
    unresolvedUnavailableDays: 0,
    totalWebsiteDiscoverable: 0,
    websiteDiscoverableKnownDays: 0,
    totalOcdsRecords: 0,
    totalMirrorRecords: 0,
    totalWebsiteOnly: 0,
    totalOcdsOnly: 0,
    totalMissingLocally: 0,
    totalFieldDifferences: 0,
    totalUnresolved: 0,
    days: [],
  }

  for (const day of days) {
    const rec = byDate.get(day) || emptyDayRecord(day)
    const ocdsStatus = rec.status || DAY_STATUS.PENDING
    const websiteStatus = rec.websiteStatus || DAY_STATUS.PENDING
    summary.byOcdsStatus[ocdsStatus] = (summary.byOcdsStatus[ocdsStatus] || 0) + 1
    summary.byWebsiteStatus[websiteStatus] = (summary.byWebsiteStatus[websiteStatus] || 0) + 1
    if (rec.parityStatus) {
      summary.byParityStatus[rec.parityStatus] = (summary.byParityStatus[rec.parityStatus] || 0) + 1
    }
    if (ocdsStatus === DAY_STATUS.SUCCESS && rec.sourceType !== SOURCE_TYPE.OCDS_BULK_TRANSPARENCY) {
      summary.successfulReleaseApiDays += 1
    }
    if (
      ocdsStatus === DAY_STATUS.SUCCESS &&
      rec.sourceType === SOURCE_TYPE.OCDS_BULK_TRANSPARENCY
    ) {
      summary.recoveredDays += 1
    }
    if (ocdsStatus === DAY_STATUS.SOURCE_UNAVAILABLE) summary.unresolvedUnavailableDays += 1
    if (rec.websiteDiscoverableCount != null) {
      summary.websiteDiscoverableKnownDays += 1
      summary.totalWebsiteDiscoverable += Number(rec.websiteDiscoverableCount) || 0
    }
    summary.totalOcdsRecords += Number(rec.ocdsCount ?? rec.sourceCount) || 0
    summary.totalMirrorRecords += Number(rec.mirrorCount) || 0
    summary.totalWebsiteOnly += Number(rec.websiteOnlyCount) || 0
    summary.totalOcdsOnly += Number(rec.ocdsOnlyCount) || 0
    summary.totalMissingLocally += Number(rec.missingLocallyCount) || 0
    summary.totalFieldDifferences += Number(rec.fieldDifferenceCount || rec.fieldMismatchCount) || 0
    summary.totalUnresolved += Number(rec.unresolvedCount) || 0

    summary.days.push({
      date: day,
      ocdsStatus,
      websiteStatus,
      ocdsCount: Number(rec.ocdsCount ?? rec.sourceCount) || 0,
      websiteDiscoverableCount: rec.websiteDiscoverableCount,
      mirrorCount: Number(rec.mirrorCount) || 0,
      websiteOnlyCount: Number(rec.websiteOnlyCount) || 0,
      ocdsOnlyCount: Number(rec.ocdsOnlyCount) || 0,
      missingLocallyCount: Number(rec.missingLocallyCount) || 0,
      fieldDifferenceCount: Number(rec.fieldDifferenceCount || rec.fieldMismatchCount) || 0,
      unresolvedCount: Number(rec.unresolvedCount) || 0,
      recoveryAttemptCount: Number(rec.recoveryAttemptCount || rec.attemptCount) || 0,
      lastChecked: rec.websiteLastCheckedAt || rec.lastAttemptAt || null,
      lastSuccessAt: rec.lastSuccessAt || null,
      nextRetryAt: rec.nextRetryAt || null,
      parityStatus: rec.parityStatus || null,
      httpStatus: rec.httpStatus,
      certified: rec.certified === true,
      error: rec.error || rec.websiteError || null,
    })
  }

  return summary
}

async function reconcileRange({ lookbackDays = 30, dateFrom, dateTo, maxDays = 7 } = {}) {
  let from = dateFrom
  let to = dateTo
  if (!from || !to) {
    const range = lookbackRange(lookbackDays)
    from = from || range.dateFrom
    to = to || range.dateTo
  }
  const days = eachDateInclusive(from, to)
  const results = []
  for (const day of days.slice(-maxDays)) {
    results.push(await reconcileDay(day))
  }
  const summary = await summarizeParityRange(from, to)
  return { results, summary }
}

module.exports = {
  deterministicKey,
  fuzzyCandidates,
  reconcileDay,
  summarizeParityRange,
  reconcileRange,
}
