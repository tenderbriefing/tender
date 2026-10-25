/**
 * Phase 18 — Day-level eTenders reconciliation domain (pure).
 */

const DAY_STATUS = Object.freeze({
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  SOURCE_UNAVAILABLE: 'SOURCE_UNAVAILABLE',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
})

const SOURCE_TYPE = Object.freeze({
  OCDS_RELEASE_API: 'OCDS_RELEASE_API',
  OCDS_BULK_TRANSPARENCY: 'OCDS_BULK_TRANSPARENCY',
  ETENDERS_WEBSITE: 'ETENDERS_WEBSITE',
  UNRESOLVED: 'UNRESOLVED',
})

/** Attempt-ledger results (Phase 19). Day-level DAY_STATUS semantics unchanged. */
const ATTEMPT_RESULT = Object.freeze({
  SUCCESS: 'SUCCESS',
  SOURCE_UNAVAILABLE: 'SOURCE_UNAVAILABLE',
  PARTIAL: 'PARTIAL',
  ZERO_RECORD_SUCCESS: 'ZERO_RECORD_SUCCESS',
  RETRY_PENDING: 'RETRY_PENDING',
  FAILED: 'FAILED',
})

const SOURCE_CONFIDENCE = Object.freeze({
  AUTHORITATIVE_STRUCTURED: 'AUTHORITATIVE_STRUCTURED',
  OFFICIAL_PUBLIC: 'OFFICIAL_PUBLIC',
})

const EXCEPTION_CATEGORY = Object.freeze({
  SOURCE_UNAVAILABLE: 'SOURCE_UNAVAILABLE',
  WEBSITE_ONLY: 'WEBSITE_ONLY',
  OCDS_ONLY: 'OCDS_ONLY',
  AMBIGUOUS_MATCH: 'AMBIGUOUS_MATCH',
  SOURCE_CONFLICT: 'SOURCE_CONFLICT',
  BRIEFING_CLASSIFICATION_REVIEW: 'BRIEFING_CLASSIFICATION_REVIEW',
})

const BRIEFING_CLASSIFICATION = Object.freeze({
  CONFIRMED_COMPULSORY: 'CONFIRMED_COMPULSORY',
  LIKELY_COMPULSORY: 'LIKELY_COMPULSORY',
  NOT_COMPULSORY: 'NOT_COMPULSORY',
  UNKNOWN: 'UNKNOWN',
})

const SME_CONNECT_STATUS = Object.freeze({
  NEW_TENDER: 'NEW_TENDER',
  SME_MATCHING: 'SME_MATCHING',
  MATCH_CANDIDATES: 'MATCH_CANDIDATES',
  HUMAN_APPROVED: 'HUMAN_APPROVED',
  REJECTED: 'REJECTED',
  READY_FOR_OUTREACH: 'READY_FOR_OUTREACH',
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  BOUNCED: 'BOUNCED',
  CLICKED: 'CLICKED',
  CONVERTED: 'CONVERTED',
  PAID: 'PAID',
})

const DIFF_CLASS = Object.freeze({
  MISSING_LOCAL_RECORD: 'MISSING_LOCAL_RECORD',
  SOURCE_NORMALIZATION_DIFFERENCE: 'SOURCE_NORMALIZATION_DIFFERENCE',
  ENRICHMENT_DIFFERENCE: 'ENRICHMENT_DIFFERENCE',
  SOURCE_CHANGED: 'SOURCE_CHANGED',
  LOCAL_STALE: 'LOCAL_STALE',
  UNRESOLVED: 'UNRESOLVED',
})

/** Fields compared for source fidelity (not enrichment-derived). */
const SOURCE_FIDELITY_FIELDS = [
  'tenderNumber',
  'title',
  'description',
  'department',
  'publishedDate',
  'closingDate',
  'briefingDate',
  'briefingTime',
  'briefingVenue',
  'sourceBriefingCompulsory',
  'status',
]

/** Fields that may legitimately differ due to enrichment/pipeline. */
const ENRICHMENT_FIELDS = new Set([
  'briefingCompulsory',
  'derivedBriefingStatus',
  'briefingConfidence',
  'matchedBriefingTerms',
  'summary',
  'province',
  'industrySector',
  'opportunityScore',
])

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())
}

function eachDateInclusive(dateFrom, dateTo) {
  const start = String(dateFrom || '').slice(0, 10)
  const end = String(dateTo || '').slice(0, 10)
  if (!isIsoDate(start) || !isIsoDate(end)) return []
  const days = []
  const cursor = new Date(`${start}T00:00:00.000Z`)
  const last = new Date(`${end}T00:00:00.000Z`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime()) || cursor > last) {
    return []
  }
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function lookbackRange(lookbackDays, now = new Date()) {
  const n = Math.max(1, Number(lookbackDays) || 30)
  const end = new Date(now)
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - (n - 1))
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10),
  }
}

/**
 * Bounded exponential backoff for source retries (ms).
 * attemptCount is 1-based after a failure.
 */
function nextRetryDelayMs(attemptCount, env = process.env) {
  const base = Number(env.OCDS_DAY_RETRY_BASE_MS || 15 * 60 * 1000)
  const max = Number(env.OCDS_DAY_RETRY_MAX_MS || 24 * 60 * 60 * 1000)
  const attempt = Math.max(1, Number(attemptCount) || 1)
  const delay = Math.min(max, base * Math.pow(2, Math.min(attempt - 1, 8)))
  // Jitter ±15%
  const jitter = delay * (0.85 + Math.random() * 0.3)
  return Math.round(jitter)
}

function nextRetryAtIso(attemptCount, now = new Date(), env = process.env) {
  return new Date(now.getTime() + nextRetryDelayMs(attemptCount, env)).toISOString()
}

function emptyDayRecord(date, overrides = {}) {
  return {
    id: String(date),
    date: String(date),
    source: SOURCE_TYPE.OCDS_RELEASE_API,
    sourceType: null,
    sourceUrl: null,
    status: DAY_STATUS.PENDING,
    attemptCount: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
    httpStatus: null,
    sourceCount: 0,
    parsedCount: 0,
    persistedCount: 0,
    matchedCount: 0,
    missingLocallyCount: 0,
    fieldMismatchCount: 0,
    documentMismatchCount: 0,
    error: null,
    nextRetryAt: null,
    durationMs: null,
    truncated: false,
    pagesFetched: 0,
    rawSourceHash: null,
    retrievedAt: null,
    certified: false,
    attemptHistory: [],
    // Phase 19 parity channel (website never upgrades OCDS day SUCCESS)
    websiteStatus: DAY_STATUS.PENDING,
    websiteDiscoverableCount: null,
    websiteLastCheckedAt: null,
    websiteHttpStatus: null,
    websiteError: null,
    ocdsCount: 0,
    mirrorCount: 0,
    websiteOnlyCount: 0,
    ocdsOnlyCount: 0,
    fieldDifferenceCount: 0,
    unresolvedCount: 0,
    parityStatus: null,
    recoveryAttemptCount: 0,
    lastRecoveryAt: null,
    ...overrides,
  }
}

function emptyRecoveryAttempt(partial = {}) {
  return {
    date: partial.date || null,
    source: partial.source || SOURCE_TYPE.OCDS_RELEASE_API,
    endpoint: partial.endpoint || null,
    sourceType: partial.sourceType || partial.source || null,
    attemptedAt: partial.attemptedAt || new Date().toISOString(),
    httpStatus: partial.httpStatus ?? null,
    recordCount: Number(partial.recordCount) || 0,
    result: partial.result || ATTEMPT_RESULT.RETRY_PENDING,
    errorClass: partial.errorClass || null,
    retryCount: Number(partial.retryCount) || 0,
    windowFrom: partial.windowFrom || null,
    windowTo: partial.windowTo || null,
    notes: partial.notes || null,
  }
}

function classifyHttpFailure(error) {
  const message = error instanceof Error ? error.message : String(error || '')
  const match = message.match(/OCDS API error (\d{3})\b/)
  const code = match ? Number(match[1]) : null
  const unavailable =
    code === 429 ||
    code === 500 ||
    code === 502 ||
    code === 503 ||
    code === 504 ||
    /OCDS fetch failed after/.test(message) ||
    /ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed/i.test(message)
  return { httpStatus: code, unavailable, message: message.slice(0, 400) }
}

function normalizeCompareValue(value) {
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value).trim()
}

function documentUrlSet(documents = []) {
  return (documents || [])
    .map((d) => (d && typeof d === 'object' ? d.url || d.id : String(d || '')))
    .filter(Boolean)
    .sort()
}

/**
 * Compare source-mapped tender vs local mirror row.
 * @returns {{ class: string, field?: string, source?: unknown, local?: unknown }[]}
 */
function classifyFieldDiffs(sourceMapped, local) {
  const diffs = []
  if (!local) {
    diffs.push({ class: DIFF_CLASS.MISSING_LOCAL_RECORD })
    return diffs
  }

  for (const field of SOURCE_FIDELITY_FIELDS) {
    const s = normalizeCompareValue(sourceMapped[field])
    const l = normalizeCompareValue(local[field])
    if (s === l) continue
    // Local enrichment must not pretend to be source value for sourceBriefingCompulsory
    if (field === 'sourceBriefingCompulsory' && local.sourceBriefingCompulsory == null && s === '') {
      continue
    }
    if (field === 'description' || field === 'title') {
      // Truncation / whitespace normalization
      if (s.replace(/\s+/g, ' ') === l.replace(/\s+/g, ' ')) continue
    }
    diffs.push({
      class: DIFF_CLASS.SOURCE_NORMALIZATION_DIFFERENCE,
      field,
      source: sourceMapped[field] ?? null,
      local: local[field] ?? null,
    })
  }

  const sourceDocs = documentUrlSet(sourceMapped.documents)
  const localDocs = documentUrlSet(local.documents)
  if (JSON.stringify(sourceDocs) !== JSON.stringify(localDocs)) {
    // Extra local docs from enrichment vs missing source docs
    const missing = sourceDocs.filter((u) => !localDocs.includes(u))
    diffs.push({
      class: missing.length
        ? DIFF_CLASS.SOURCE_NORMALIZATION_DIFFERENCE
        : DIFF_CLASS.ENRICHMENT_DIFFERENCE,
      field: 'documents',
      source: sourceDocs,
      local: localDocs,
    })
  }

  if (
    local.rawSourceHash &&
    sourceMapped.rawSourceHash &&
    local.rawSourceHash !== sourceMapped.rawSourceHash
  ) {
    diffs.push({
      class: DIFF_CLASS.SOURCE_CHANGED,
      field: 'rawSourceHash',
      source: sourceMapped.rawSourceHash,
      local: local.rawSourceHash,
    })
  }

  return diffs
}

function countMissingLocal(diffsList) {
  return diffsList.filter((d) => d.some((x) => x.class === DIFF_CLASS.MISSING_LOCAL_RECORD)).length
}

function isCertifiedSuccess(dayRecord) {
  return (
    dayRecord &&
    dayRecord.status === DAY_STATUS.SUCCESS &&
    dayRecord.certified === true &&
    dayRecord.missingLocallyCount === 0
  )
}

module.exports = {
  DAY_STATUS,
  SOURCE_TYPE,
  ATTEMPT_RESULT,
  SOURCE_CONFIDENCE,
  EXCEPTION_CATEGORY,
  BRIEFING_CLASSIFICATION,
  SME_CONNECT_STATUS,
  DIFF_CLASS,
  SOURCE_FIDELITY_FIELDS,
  ENRICHMENT_FIELDS,
  isIsoDate,
  eachDateInclusive,
  lookbackRange,
  nextRetryDelayMs,
  nextRetryAtIso,
  emptyDayRecord,
  emptyRecoveryAttempt,
  classifyHttpFailure,
  classifyFieldDiffs,
  countMissingLocal,
  isCertifiedSuccess,
  documentUrlSet,
  normalizeCompareValue,
}
