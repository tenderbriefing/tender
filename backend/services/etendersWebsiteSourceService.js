/**
 * Phase 19 — Lawful public eTenders website probe.
 * Never bypasses auth/CAPTCHA. Never labels website data as OCDS.
 * Ingests only when a verified public structured payload is returned.
 */
const {
  SOURCE_TYPE,
  DAY_STATUS,
  ATTEMPT_RESULT,
  emptyRecoveryAttempt,
} = require('../domain/ocdsDayReconciliation')

const DEFAULT_ENDPOINTS = [
  {
    id: 'paginated_tender_opportunities',
    url: 'https://www.etenders.gov.za/Home/PaginatedTenderOpportunities',
    method: 'GET',
  },
  {
    id: 'transparency_releases_files',
    url: 'https://data.etenders.gov.za/Home/ReleasesFiles',
    method: 'GET',
  },
]

function classifyBody(text) {
  const sample = String(text || '').slice(0, 2000)
  const trimmed = sample.trim()
  if (!trimmed) return { kind: 'empty', structured: false }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed.startsWith('[') ? trimmed : sample)
      return { kind: 'json', structured: true, parsed }
    } catch {
      return { kind: 'json_invalid', structured: false }
    }
  }
  if (/An error occurred while processing your request/i.test(sample)) {
    return { kind: 'mvc_error', structured: false }
  }
  if (/<!DOCTYPE html|<html/i.test(sample)) {
    return { kind: 'html', structured: false }
  }
  return { kind: 'unknown', structured: false }
}

/**
 * Probe public endpoints. Does not invent records.
 * @returns {{ websiteStatus, websiteDiscoverableCount, httpStatus, attempts, records, investigation }}
 */
async function probeWebsiteForDay(date, { fetchImpl = fetch, endpoints = DEFAULT_ENDPOINTS } = {}) {
  const attempts = []
  let websiteDiscoverableCount = null
  let websiteStatus = DAY_STATUS.SOURCE_UNAVAILABLE
  let httpStatus = null
  let records = []
  let lastError = null

  for (const ep of endpoints) {
    const attemptedAt = new Date().toISOString()
    try {
      const res = await fetchImpl(ep.url, {
        method: ep.method || 'GET',
        headers: { Accept: 'application/json, text/html;q=0.8, */*;q=0.5' },
        redirect: 'follow',
      })
      httpStatus = res.status
      const text = await res.text()
      const body = classifyBody(text)

      let result = ATTEMPT_RESULT.SOURCE_UNAVAILABLE
      let recordCount = 0
      let errorClass = body.kind

      if (res.status >= 500 || res.status === 429) {
        result = ATTEMPT_RESULT.SOURCE_UNAVAILABLE
        errorClass = `http_${res.status}`
      } else if (body.structured && body.parsed) {
        const list = Array.isArray(body.parsed)
          ? body.parsed
          : Array.isArray(body.parsed.releases)
            ? body.parsed.releases
            : Array.isArray(body.parsed.data)
              ? body.parsed.data
              : Array.isArray(body.parsed.items)
                ? body.parsed.items
                : null
        if (list) {
          // Only accept as discoverable if list looks like tender-shaped rows
          const sample = list[0]
          const looksLikeTender =
            sample &&
            typeof sample === 'object' &&
            (sample.tenderNumber ||
              sample.tender_number ||
              sample.ocid ||
              sample.title ||
              sample.TenderNumber)
          if (looksLikeTender) {
            recordCount = list.length
            websiteDiscoverableCount = list.length
            records = list
            result =
              list.length === 0 ? ATTEMPT_RESULT.ZERO_RECORD_SUCCESS : ATTEMPT_RESULT.SUCCESS
            websiteStatus =
              list.length === 0 ? DAY_STATUS.SUCCESS : DAY_STATUS.SUCCESS
            errorClass = null
          } else {
            result = ATTEMPT_RESULT.SOURCE_UNAVAILABLE
            errorClass = 'json_not_tender_shaped'
          }
        } else {
          result = ATTEMPT_RESULT.SOURCE_UNAVAILABLE
          errorClass = 'json_no_list'
        }
      } else {
        result = ATTEMPT_RESULT.SOURCE_UNAVAILABLE
        lastError = `${ep.id}:${body.kind}`
      }

      attempts.push(
        emptyRecoveryAttempt({
          date,
          source: SOURCE_TYPE.ETENDERS_WEBSITE,
          sourceType: SOURCE_TYPE.ETENDERS_WEBSITE,
          endpoint: ep.url,
          attemptedAt,
          httpStatus: res.status,
          recordCount,
          result,
          errorClass,
          retryCount: 0,
          notes: ep.id,
        })
      )

      // First successful structured feed wins; do not mix silently
      if (result === ATTEMPT_RESULT.SUCCESS || result === ATTEMPT_RESULT.ZERO_RECORD_SUCCESS) {
        break
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      attempts.push(
        emptyRecoveryAttempt({
          date,
          source: SOURCE_TYPE.ETENDERS_WEBSITE,
          sourceType: SOURCE_TYPE.ETENDERS_WEBSITE,
          endpoint: ep.url,
          attemptedAt,
          httpStatus: null,
          recordCount: 0,
          result: ATTEMPT_RESULT.SOURCE_UNAVAILABLE,
          errorClass: 'network',
          notes: String(lastError).slice(0, 200),
        })
      )
    }
  }

  return {
    date,
    websiteStatus,
    websiteDiscoverableCount,
    httpStatus,
    attempts,
    records,
    error: lastError,
    investigation: getInvestigationReport(),
  }
}

function getInvestigationReport() {
  return {
    websiteParity:
      'OCDS (API or bulk) is not guaranteed to equal the visible www.etenders.gov.za opportunity catalogue. PaginatedTenderOpportunities is broken (MVC view error). No additional lawful public structured website feed was confirmed.',
    endpoints: DEFAULT_ENDPOINTS.map((e) => e.url),
    ingestPolicy:
      'Website records are only ingested when a verified public structured tender-shaped payload is returned. HTML/MVC errors never invent counts.',
    sourceLabel: SOURCE_TYPE.ETENDERS_WEBSITE,
  }
}

/**
 * Map a website-shaped row to a partial tender for canonical merge.
 * Returns null if row cannot be deterministically keyed.
 */
function mapWebsiteRow(row, { retrievedAt = new Date().toISOString() } = {}) {
  if (!row || typeof row !== 'object') return null
  const tenderNumber = String(
    row.tenderNumber || row.tender_number || row.TenderNumber || row.id || ''
  ).trim()
  const title = String(row.title || row.Title || row.name || '').trim()
  if (!tenderNumber && !title) return null
  return {
    tenderNumber: tenderNumber || null,
    title: title || null,
    description: row.description || row.Description || null,
    department: row.department || row.buyer || row.Department || row.buyerName || null,
    publishedDate: row.publishedDate || row.PublicationDate || row.datePublished || null,
    closingDate: row.closingDate || row.ClosingDate || row.tenderPeriod?.endDate || null,
    briefingDate: row.briefingDate || row.BriefingDate || null,
    briefingTime: row.briefingTime || row.BriefingTime || null,
    briefingVenue: row.briefingVenue || row.BriefingVenue || null,
    status: row.status || row.Status || null,
    ingestSourceType: SOURCE_TYPE.ETENDERS_WEBSITE,
    sourceRetrievedAt: retrievedAt,
    detailUrl: row.url || row.detailUrl || row.DetailUrl || null,
  }
}

module.exports = {
  DEFAULT_ENDPOINTS,
  probeWebsiteForDay,
  getInvestigationReport,
  mapWebsiteRow,
  classifyBody,
}
