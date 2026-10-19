/**
 * Phase 18 — Secondary official source: Treasury Transparency Portal bulk OCDS.
 *
 * Investigation result (documented):
 * - Portal page: https://data.etenders.gov.za/Home/ReleasesFiles
 * - Policy: monthly OCDS JSON/CSV/XLSX from May 2021 (Creative Commons BY 4.0 / PDDL via OCP)
 * - The ReleasesFiles HTML table is JS-rendered; stable direct file URLs are not
 *   published as a documented machine-readable index in Phase 17/18 audits.
 * - OCP Data Registry hosts yearly JSONL dumps derived from the API, not day-keyed
 *   recovery for specific HTTP-500 calendar days.
 *
 * Therefore this module:
 * 1. Attempts known/configured bulk URL patterns when OCDS_BULK_BASE_URL is set.
 * 2. Otherwise returns { ok: false, reason: 'bulk_source_not_configured' } without
 *    fabricating parity.
 *
 * Precedence: OCDS_RELEASE_API → OCDS_BULK_TRANSPARENCY → UNRESOLVED
 */
const crypto = require('crypto')
const { SOURCE_TYPE } = require('../domain/ocdsDayReconciliation')

const INVESTIGATION = Object.freeze({
  portalUrl: 'https://data.etenders.gov.za/Home/ReleasesFiles',
  policyUrl: 'https://data.etenders.gov.za/Home/LearnMore',
  ocpRegistryUrl: 'https://data.open-contracting.org/en/publication/143',
  finding:
    'Official monthly bulk OCDS downloads exist on the Transparency Portal, but no stable day-keyed machine-readable index was available for automated recovery of Release-API HTTP-500 days during Phase 18. Configure OCDS_BULK_BASE_URL + OCDS_BULK_ENABLED=true only when a verified file URL pattern is known.',
  websiteParity:
    'OCDS (API or bulk) is not guaranteed to equal the visible www.etenders.gov.za opportunity catalogue. PaginatedTenderOpportunities is broken (MVC view error). No additional lawful public structured website feed was confirmed.',
})

function bulkEnabled(env = process.env) {
  return String(env.OCDS_BULK_ENABLED || '').toLowerCase() === 'true'
}

function monthKey(day) {
  return String(day || '').slice(0, 7) // YYYY-MM
}

/**
 * Try to recover releases for a calendar day from configured bulk source.
 * @returns {{ ok: boolean, releases?: object[], sourceUrl?: string, sourceType?: string, note?: string, reason?: string }}
 */
async function tryRecoverDay(day, env = process.env) {
  if (!bulkEnabled(env)) {
    return {
      ok: false,
      reason: 'bulk_source_not_configured',
      note: INVESTIGATION.finding,
      investigation: INVESTIGATION,
    }
  }

  const base = String(env.OCDS_BULK_BASE_URL || '').replace(/\/$/, '')
  if (!base) {
    return {
      ok: false,
      reason: 'bulk_base_url_missing',
      note: INVESTIGATION.finding,
      investigation: INVESTIGATION,
    }
  }

  const month = monthKey(day)
  // Configurable pattern; default assumes `{base}/{YYYY-MM}.json`
  const pattern = String(env.OCDS_BULK_URL_PATTERN || '{base}/{month}.json')
  const url = pattern
    .replace('{base}', base)
    .replace('{month}', month)
    .replace('{day}', day)

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(Number(env.OCDS_BULK_TIMEOUT_MS || 60000)),
    })
    if (!res.ok) {
      return {
        ok: false,
        reason: `bulk_http_${res.status}`,
        sourceUrl: url,
        note: `Bulk fetch failed HTTP ${res.status}`,
      }
    }
    const body = await res.json()
    const releases = Array.isArray(body)
      ? body
      : Array.isArray(body.releases)
        ? body.releases
        : []
    const forDay = releases.filter((r) => String(r?.date || '').slice(0, 10) === day)
    const hash = crypto.createHash('sha256').update(JSON.stringify(forDay)).digest('hex')
    return {
      ok: true,
      releases: forDay,
      sourceUrl: url,
      sourceType: SOURCE_TYPE.OCDS_BULK_TRANSPARENCY,
      rawSourceHash: hash,
      note: `Recovered ${forDay.length} release(s) for ${day} from bulk month ${month}`,
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'bulk_fetch_error',
      sourceUrl: url,
      note: err instanceof Error ? err.message.slice(0, 200) : 'bulk fetch failed',
    }
  }
}

function getInvestigationReport() {
  return { ...INVESTIGATION, bulkEnabledDefault: false }
}

module.exports = {
  tryRecoverDay,
  getInvestigationReport,
  bulkEnabled,
  INVESTIGATION,
}
