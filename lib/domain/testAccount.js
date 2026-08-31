/**
 * Canonical test/smoke account classification for commercial metrics.
 *
 * Real customer KPIs must exclude accounts with isTestAccount === true.
 * Historical bookings/payments for test SMEs are retained; classify, do not delete.
 */

/** Firestore field on users (+ smes/agents mirrors). Server-only / privileged. */
const TEST_ACCOUNT_FIELD = 'isTestAccount'

/** Optional provenance for audits (ops-smoke, phase2-cert, qa-orphan, …). */
const TEST_ACCOUNT_KIND_FIELD = 'testAccountKind'

const ACCOUNT_SCOPES = ['real', 'test', 'all']

/**
 * Evidence-based detection for one-time production backfill.
 * Prefer isTestAccount once written; heuristics only for classification migration.
 */
const OPS_SMOKE_EMAIL_RE =
  /^(ops-smoke(?:-sme|-agent|-admin|-sme-control|-phase[23]-(?:member|cross)-\d+)?|qa-sme-\d+)@tenderbriefing\.co\.za$/i

/** RFC 2606 / IANA reserved domains — never real customer mailboxes. */
const RESERVED_TEST_EMAIL_DOMAIN_RE = /@(?:example\.(?:com|org|net)|test|invalid|localhost)$/i

const SMOKE_COMPANY_RE =
  /(smoke\s*test\s*sme|tenderbriefing\s+phase\s+[23]\s+(?:production\s+cert\s+)?smoke|phase\s+[23]\s+production\s+(cert\s+)?smoke|tb\s+phase\s+[23]\s+smoke)/i

const SMOKE_DISPLAY_RE =
  /^(smoke\s*test\s*(?:sme|youth\s*agent|agent)|ops\s*smoke|phase\s+[23]\s+production\s+(cert\s+)?smoke|tb\s+phase\s+[23]\s+smoke|gcert\b)/i

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

function isTruthyTestFlag(value) {
  return value === true || value === 'true' || value === 1
}

/** True when the persisted profile is already classified as a test account. */
function isTestAccountRecord(record) {
  if (!record || typeof record !== 'object') return false
  return isTruthyTestFlag(record[TEST_ACCOUNT_FIELD])
}

/**
 * Heuristic classification from email / company / display evidence.
 * Used only for migration when isTestAccount is not yet set.
 */
function matchesSmokeEvidence(record = {}) {
  const email = normalizeEmail(record.email)
  if (email && OPS_SMOKE_EMAIL_RE.test(email)) return true
  if (email && RESERVED_TEST_EMAIL_DOMAIN_RE.test(email)) return true
  const company = String(record.companyName || record.legalName || '').trim()
  if (company && SMOKE_COMPANY_RE.test(company)) return true
  const display = String(record.displayName || record.contactPerson || '').trim()
  if (display && SMOKE_DISPLAY_RE.test(display)) return true
  return false
}

/**
 * Effective test classification: explicit flag wins; otherwise smoke evidence.
 * After migration, production rows should always have the explicit flag.
 */
function isEffectiveTestAccount(record) {
  if (isTestAccountRecord(record)) return true
  if (record && Object.prototype.hasOwnProperty.call(record, TEST_ACCOUNT_FIELD)) {
    return false
  }
  return matchesSmokeEvidence(record)
}

function resolveAccountScope(raw) {
  const scope = String(raw || 'real').trim().toLowerCase()
  return ACCOUNT_SCOPES.includes(scope) ? scope : 'real'
}

function filterByAccountScope(records, scope) {
  const resolved = resolveAccountScope(scope)
  if (resolved === 'all') return records
  if (resolved === 'test') return records.filter((r) => isEffectiveTestAccount(r))
  return records.filter((r) => !isEffectiveTestAccount(r))
}

/** Fields written on every smoke-created user/role profile. */
function testAccountWriteFields(kind = 'ops-smoke') {
  return {
    [TEST_ACCOUNT_FIELD]: true,
    [TEST_ACCOUNT_KIND_FIELD]: kind,
  }
}

module.exports = {
  TEST_ACCOUNT_FIELD,
  TEST_ACCOUNT_KIND_FIELD,
  ACCOUNT_SCOPES,
  OPS_SMOKE_EMAIL_RE,
  SMOKE_COMPANY_RE,
  isTestAccountRecord,
  matchesSmokeEvidence,
  isEffectiveTestAccount,
  resolveAccountScope,
  filterByAccountScope,
  testAccountWriteFields,
  normalizeEmail,
}
