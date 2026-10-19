const crypto = require('crypto')

const SOURCE_LABEL = 'eTenders OCDS API + selective enrichment'

/** TenderBriefing-derived briefing classification (never overwrites source). */
const DERIVED_BRIEFING_STATUS = Object.freeze({
  CONFIRMED_COMPULSORY: 'CONFIRMED_COMPULSORY',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  NOT_COMPULSORY: 'NOT_COMPULSORY',
})

function createEmptyTenderBriefing(overrides = {}) {
  return {
    id: '',
    ocid: '',
    tenderNumber: '',
    title: '',
    description: '',
    department: '',
    buyer: '',
    province: '',
    category: '',
    industrySector: '',
    industryConfidence: 0,
    procurementMethod: '',
    status: 'active',
    publishedDate: '',
    closingDate: '',
    briefingDate: '',
    briefingTime: '',
    briefingVenue: '',
    /** Catalogue / ops flag — derived; may differ from sourceBriefingCompulsory. */
    briefingCompulsory: false,
    /** Raw OCDS tender.briefingSession.compulsory — null when absent. */
    sourceBriefingCompulsory: null,
    /** TenderBriefing classification after ingest. */
    derivedBriefingStatus: DERIVED_BRIEFING_STATUS.NOT_COMPULSORY,
    briefingConfidence: 0,
    matchedBriefingTerms: [],
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    meetingLink: '',
    documents: [],
    detailUrl: '',
    summary: '',
    requirements: [],
    risks: [],
    keyDates: [],
    recommendedFor: [],
    opportunityScore: 0,
    calendarEvents: [],
    history: [],
    source: SOURCE_LABEL,
    sourceReleaseId: '',
    sourcePublishedAt: '',
    sourceModifiedAt: '',
    ingestedAt: '',
    rawSourceHash: '',
    rawSourceSnapshot: null,
    lastSyncedAt: '',
    scrapedAt: '',
    ...overrides,
  }
}

function documentFingerprint(documents = []) {
  return (documents || [])
    .map((d) => {
      if (!d || typeof d !== 'object') return String(d || '')
      return [d.id || '', d.url || '', d.title || '', d.format || '', d.datePublished || ''].join('~')
    })
    .sort()
    .join(',')
}

/**
 * Content fingerprint for change detection.
 * Includes briefing compulsory + time so OCDS flips are never silently skipped.
 */
function contentHash(tender) {
  const payload = [
    tender.title,
    tender.description,
    tender.closingDate,
    tender.briefingDate,
    tender.briefingTime,
    tender.briefingVenue,
    String(tender.sourceBriefingCompulsory),
    String(tender.briefingCompulsory),
    tender.derivedBriefingStatus || '',
    tender.status,
    tender.procurementMethod || '',
    documentFingerprint(tender.documents),
  ].join('|')
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32)
}

function hashRawRelease(release) {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(release || {})).digest('hex')
  } catch {
    return ''
  }
}

/**
 * Compact auditable snapshot — enough to answer "what did Treasury send?"
 * without storing multi-MB release bodies in Firestore.
 */
function buildRawSourceSnapshot(release) {
  const tender = release?.tender || {}
  const briefing = tender.briefingSession || null
  const docs = Array.isArray(tender.documents) ? tender.documents : []
  return {
    ocid: release?.ocid || null,
    releaseId: release?.id || null,
    releaseDate: release?.date || null,
    tag: release?.tag || null,
    tenderId: tender.id || null,
    title: tender.title || null,
    status: tender.status != null ? tender.status : null,
    procurementMethod: tender.procurementMethod || null,
    procurementMethodDetails: tender.procurementMethodDetails || null,
    mainProcurementCategory: tender.mainProcurementCategory || null,
    tenderPeriod: tender.tenderPeriod || null,
    briefingSession: briefing,
    documentCount: docs.length,
    documentRefs: docs.slice(0, 40).map((d) => ({
      id: d.id || null,
      title: d.title || null,
      url: d.url || null,
      format: d.format || null,
      datePublished: d.datePublished || null,
      dateModified: d.dateModified || null,
    })),
    buyerId: release?.buyer?.id || null,
    buyerName: release?.buyer?.name || null,
  }
}

/**
 * Derive operational briefing status without mutating source fields.
 * @param {null|boolean} sourceCompulsory
 * @param {{ briefingCompulsory?: boolean, briefingVenue?: string, briefingDate?: string, matchedBriefingTerms?: string[] }} hints
 */
function deriveBriefingStatus(sourceCompulsory, hints = {}) {
  if (sourceCompulsory === true || hints.briefingCompulsory === true) {
    return DERIVED_BRIEFING_STATUS.CONFIRMED_COMPULSORY
  }
  if (sourceCompulsory === false && !hints.briefingCompulsory) {
    const hasSessionHints = Boolean(
      hints.briefingVenue ||
        hints.briefingDate ||
        (hints.matchedBriefingTerms && hints.matchedBriefingTerms.length)
    )
    return hasSessionHints
      ? DERIVED_BRIEFING_STATUS.REVIEW_REQUIRED
      : DERIVED_BRIEFING_STATUS.NOT_COMPULSORY
  }
  // source null/unknown
  if (hints.briefingCompulsory === true) {
    return DERIVED_BRIEFING_STATUS.CONFIRMED_COMPULSORY
  }
  if (
    hints.briefingVenue ||
    hints.briefingDate ||
    (hints.matchedBriefingTerms && hints.matchedBriefingTerms.length)
  ) {
    return DERIVED_BRIEFING_STATUS.REVIEW_REQUIRED
  }
  return DERIVED_BRIEFING_STATUS.NOT_COMPULSORY
}

function catalogueCompulsoryFromDerived(derivedStatus) {
  return derivedStatus === DERIVED_BRIEFING_STATUS.CONFIRMED_COMPULSORY
}

module.exports = {
  SOURCE_LABEL,
  DERIVED_BRIEFING_STATUS,
  createEmptyTenderBriefing,
  contentHash,
  hashRawRelease,
  buildRawSourceSnapshot,
  deriveBriefingStatus,
  catalogueCompulsoryFromDerived,
  documentFingerprint,
}
