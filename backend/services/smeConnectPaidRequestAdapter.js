/**
 * Phase 20 — Normalize historical attendanceRequests for SME Connect matching.
 * Does not rewrite Firestore; adapts field-name drift at read time.
 */

const GENERIC_STOPWORDS = new Set([
  'services',
  'service',
  'supply',
  'supplies',
  'maintenance',
  'installation',
  'appointment',
  'panel',
  'tender',
  'tenders',
  'rfq',
  'rfp',
  'bid',
  'bids',
  'provision',
  'provide',
  'providing',
  'request',
  'quotation',
  'quote',
  'contract',
  'contracts',
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'into',
  'onto',
])

function isPaidStatus(value) {
  const s = String(value || '').trim().toLowerCase()
  return s === 'paid'
}

function lineText(line) {
  if (!line || typeof line !== 'object') return ''
  return [
    line.tenderDescription,
    line.description,
    line.tenderTitle,
    line.procuringEntity,
    line.department,
    line.notes,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Flatten a historical request into a matching-friendly shape.
 */
function normalizePaidRequest(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!isPaidStatus(raw.paymentStatus)) return null

  const lines = Array.isArray(raw.briefingLines) ? raw.briefingLines : []
  const lineBlob = lines.map(lineText).join(' ')

  const scopeText = [
    raw.tenderTitle,
    raw.tenderDescription,
    raw.description,
    raw.notes,
    raw.serviceName,
    lineBlob,
  ]
    .filter(Boolean)
    .join(' ')
    .trim()

  const entity =
    String(raw.department || '').trim() ||
    String(lines[0]?.procuringEntity || lines[0]?.department || '').trim() ||
    ''

  const smeEmail = String(raw.smeEmail || '').trim().toLowerCase()
  const smeId = String(raw.smeId || raw.linkedSmeId || '').trim() || null
  const smeCompany = String(raw.smeCompany || raw.representedEntity || '').trim() || null
  const smeName = String(raw.smeName || raw.contactPerson || smeCompany || '').trim() || null

  const eligible =
    Boolean(smeEmail || smeId) &&
    Boolean(scopeText || raw.tenderNumber || entity) &&
    !/@tenderbriefing\.test$/i.test(smeEmail) // exclude synthetic cert SMEs from live matching by default

  return {
    id: raw.id,
    paymentStatus: 'paid',
    paidAt: raw.paidAt || null,
    smeId,
    smeName,
    smeCompany,
    smeEmail: smeEmail || null,
    contactName: String(raw.contactPerson || raw.smeName || '').trim() || smeName,
    tenderNumber: String(raw.tenderNumber || lines[0]?.tenderNumber || '').trim() || null,
    tenderTitle: String(raw.tenderTitle || lines[0]?.tenderDescription || '').trim() || null,
    department: entity || null,
    province: String(raw.province || '').trim() || null,
    scopeText,
    hasDescription: Boolean(raw.tenderDescription || raw.description || lineBlob),
    hasTenderNumber: Boolean(raw.tenderNumber || lines[0]?.tenderNumber),
    hasEntity: Boolean(entity),
    eligibleForMatching: eligible,
    source: raw.source || null,
    bookingKind: raw.bookingKind || null,
    _raw: raw,
  }
}

function tokenizeMeaningful(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !GENERIC_STOPWORDS.has(t))
}

async function loadNormalizedPaidRequests(storage, { includeTestSmes = false, limit = 5000 } = {}) {
  const all = await storage.getAttendanceRequests({ limit })
  const normalized = []
  let total = 0
  let paid = 0
  for (const row of all || []) {
    total += 1
    if (!isPaidStatus(row.paymentStatus)) continue
    paid += 1
    const n = normalizePaidRequest(row)
    if (!n) continue
    if (!includeTestSmes && n.smeEmail && /@tenderbriefing\.test$/i.test(n.smeEmail)) {
      n.eligibleForMatching = false
      n.excludedReason = 'synthetic_cert_sme'
    }
    normalized.push(n)
  }
  return { total, paid, normalized }
}

function auditPaidRequests(normalizedBundle) {
  const { total, paid, normalized } = normalizedBundle
  const paidSmes = new Set(
    normalized.map((r) => r.smeId || r.smeEmail || r.smeCompany).filter(Boolean)
  )
  const eligible = normalized.filter((r) => r.eligibleForMatching)
  return {
    totalRequests: total,
    paidRequests: paid,
    paidSmes: paidSmes.size,
    withTenderDescriptions: normalized.filter((r) => r.hasDescription).length,
    withTenderNumbers: normalized.filter((r) => r.hasTenderNumber).length,
    withProcuringEntities: normalized.filter((r) => r.hasEntity).length,
    withUsableClassificationData: normalized.filter(
      (r) => r.hasDescription || r.tenderTitle || r.hasEntity
    ).length,
    eligibleForMatching: eligible.length,
    excludedSyntheticCert: normalized.filter((r) => r.excludedReason === 'synthetic_cert_sme')
      .length,
    schemaNotes: [
      'Canonical paid field is paymentStatus === "paid"',
      'Scope text adapted from tenderTitle + tenderDescription/description/notes + briefingLines[].tenderDescription',
      'Entity adapted from department or briefingLines[].procuringEntity',
      'No rewrite of historical Firestore documents',
    ],
  }
}

module.exports = {
  GENERIC_STOPWORDS,
  isPaidStatus,
  normalizePaidRequest,
  tokenizeMeaningful,
  loadNormalizedPaidRequests,
  auditPaidRequests,
}
