/**
 * Phase 20 — CTA click → idempotent attendance request → existing /pay checkout.
 * Reuses manual payment token + PayFast path. No parallel settlement logic.
 */
const { SME_CONNECT_STATUS } = require('../domain/ocdsDayReconciliation')
const store = require('./smeConnectRecommendationStore')
const { requireCtaToken } = require('./smeConnectOutreachService')
const { createAttendanceRequest, findActiveRequestForSmeTender } = require('./agentAssignmentService')
const { generatePaymentToken, BRIEFING_PRICE_CENTS } = require('./payments/manualPaymentBookingService')
const {
  multiBriefingPriceSnapshotFields,
  formatBriefingPriceZar,
} = require('../constants/briefingPricing')
const { getStorage } = require('./storageAdapter')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')
const auditLogService = require('./auditLogService')

const SME_CONNECT_SOURCE = 'SME_CONNECT'

function guestSmeId(email) {
  const safe = String(email || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, '')
  return `guest:${safe}`
}

async function loadCandidateFromToken(token) {
  const { verifySmeConnectCtaToken } = requireCtaToken()
  const payload = verifySmeConnectCtaToken(token)
  if (!payload?.candidateId) {
    return { ok: false, error: 'Invalid or expired link', status: 401 }
  }
  const candidate = await store.getRecommendation(payload.candidateId)
  if (!candidate) return { ok: false, error: 'Opportunity not found', status: 404 }
  return { ok: true, candidate, payload }
}

function publicCandidateView(candidate) {
  const price = multiBriefingPriceSnapshotFields(1)
  return {
    candidateId: candidate.id,
    companyName: candidate.smeCompany || candidate.smeName,
    contactName: candidate.contactName || candidate.smeName,
    contactEmail: candidate.contactEmail || candidate.smeEmail,
    tenderNumber: candidate.newTenderNumber || candidate.tenderNumber,
    tenderTitle: candidate.newTenderTitle || candidate.tenderTitle,
    description: candidate.newTenderDescription || candidate.tenderTitle,
    entity: candidate.newTenderEntity || null,
    briefingDate: candidate.briefingDate,
    briefingTime: candidate.briefingTime,
    briefingVenue: candidate.briefingVenue,
    priceCents: price.briefingPriceCents || BRIEFING_PRICE_CENTS,
    priceLabel: formatBriefingPriceZar(price.briefingPriceCents || BRIEFING_PRICE_CENTS),
    status: candidate.status,
  }
}

async function markClicked(candidate) {
  if (
    [
      SME_CONNECT_STATUS.CLICKED,
      SME_CONNECT_STATUS.CONVERTED,
      SME_CONNECT_STATUS.PAID,
    ].includes(candidate.status)
  ) {
    return candidate
  }
  return store.upsertRecommendation({
    ...candidate,
    status: SME_CONNECT_STATUS.CLICKED,
    ctaClickedAt: new Date().toISOString(),
  })
}

/**
 * Idempotent: one request per SME + canonicalTenderId.
 */
async function confirmAndCreateRequest(token, opts = {}) {
  const loaded = await loadCandidateFromToken(token)
  if (!loaded.ok) return loaded

  let candidate = await markClicked(loaded.candidate)
  const tenderId = candidate.canonicalTenderId || candidate.newTenderId || candidate.tenderId
  const email = String(candidate.contactEmail || candidate.smeEmail || '')
    .trim()
    .toLowerCase()
  const smeId = candidate.smeId || guestSmeId(email)
  const companyName = candidate.smeCompany || candidate.smeName || 'SME'
  const contactName = candidate.contactName || candidate.smeName || companyName

  if (!tenderId) return { ok: false, error: 'Missing canonical tender id', status: 400 }
  if (!email) return { ok: false, error: 'Missing contact email', status: 400 }

  const storage = getStorage()

  // Idempotency: existing active request for SME+tender
  const existingActive = await findActiveRequestForSmeTender(smeId, tenderId)
  if (existingActive) {
    if (!existingActive.paymentToken) {
      existingActive.paymentToken = generatePaymentToken()
      await storage.saveAttendanceRequest(sanitizeFirestoreData(existingActive))
    }
    candidate = await store.upsertRecommendation({
      ...candidate,
      status:
        existingActive.paymentStatus === 'paid'
          ? SME_CONNECT_STATUS.PAID
          : SME_CONNECT_STATUS.CONVERTED,
      convertedRequestId: existingActive.id,
      convertedAt: new Date().toISOString(),
    })
    return {
      ok: true,
      alreadyExisted: true,
      request: existingActive,
      payPath: `/pay/${existingActive.paymentToken}`,
      candidate: publicCandidateView(candidate),
    }
  }

  // Also check by prior convertedRequestId on candidate
  if (candidate.convertedRequestId) {
    const prior = (await storage.getAttendanceRequests({ limit: 5000 })).find(
      (r) => r.id === candidate.convertedRequestId
    )
    if (prior) {
      return {
        ok: true,
        alreadyExisted: true,
        request: prior,
        payPath: prior.paymentToken ? `/pay/${prior.paymentToken}` : null,
        candidate: publicCandidateView(candidate),
      }
    }
  }

  const price = multiBriefingPriceSnapshotFields(1)
  const paymentToken = generatePaymentToken()
  const now = new Date().toISOString()
  const tenderNumber = candidate.newTenderNumber || candidate.tenderNumber
  const tenderTitle = candidate.newTenderTitle || candidate.tenderTitle
  const description = candidate.newTenderDescription || tenderTitle

  const request = createAttendanceRequest({
    tenderId,
    tenderNumber,
    tenderTitle,
    smeId,
    smeName: contactName,
    smeCompany: companyName,
    smeEmail: email,
    contactPerson: contactName,
    briefingDate: candidate.briefingDate || null,
    briefingTime: candidate.briefingTime || null,
    briefingVenue: candidate.briefingVenue || null,
    department: candidate.newTenderEntity || '',
    province: '',
    source: SME_CONNECT_SOURCE,
    bookingKind: 'sme_connect',
    paymentToken,
    catalogueTenderRequired: true,
    notes: '',
  })

  request.paymentToken = paymentToken
  request.source = SME_CONNECT_SOURCE
  request.matchCandidateId = candidate.id
  request.previousRequestId = candidate.previousRequestId || null
  request.canonicalTenderId = tenderId
  request.outreachId = candidate.id
  request.smeConnectProvenance = {
    source: SME_CONNECT_SOURCE,
    matchCandidateId: candidate.id,
    previousRequestId: candidate.previousRequestId || null,
    canonicalTenderId: tenderId,
    outreachId: candidate.id,
  }
  request.unitPriceCents = BRIEFING_PRICE_CENTS
  request.briefingPriceCents = price.briefingPriceCents
  request.paymentAmount = price.paymentAmount
  request.quotedFee = price.quotedFee
  request.currency = price.currency
  request.pricingVersion = price.pricingVersion
  request.briefingCount = 1
  request.briefingLines = [
    {
      tenderNumber,
      tenderDescription: description,
      procuringEntity: candidate.newTenderEntity || '',
      briefingDate: candidate.briefingDate || '',
      briefingTime: candidate.briefingTime || '',
      briefingVenue: candidate.briefingVenue || '',
      unitPriceCents: BRIEFING_PRICE_CENTS,
    },
  ]
  request.opsStage = 'payment_required'
  request.representedEntity = companyName
  request.createdAt = request.createdAt || now

  await storage.saveAttendanceRequest(sanitizeFirestoreData(request))

  candidate = await store.upsertRecommendation({
    ...candidate,
    status: SME_CONNECT_STATUS.CONVERTED,
    convertedRequestId: request.id,
    convertedAt: now,
    checkoutStartedAt: now,
  })

  await auditLogService.logEvent({
    type: 'sme_connect.converted',
    entityId: candidate.id,
    requestId: request.id,
    tenderId,
    actorHint: opts.actor || 'cta',
  })

  return {
    ok: true,
    alreadyExisted: false,
    request,
    payPath: `/pay/${paymentToken}`,
    candidate: publicCandidateView(candidate),
  }
}

/**
 * Fail-soft: when a SME_CONNECT request is paid, advance candidate → PAID.
 * Does not alter PayFast settlement — called after markRequestPaid succeeds.
 */
async function markCandidatePaidForRequest(request) {
  if (!request || request.source !== SME_CONNECT_SOURCE) {
    return { applied: false, reason: 'not_sme_connect' }
  }
  const candidateId = request.matchCandidateId || request.outreachId
  if (!candidateId) return { applied: false, reason: 'missing_candidate' }
  const candidate = await store.getRecommendation(candidateId)
  if (!candidate) return { applied: false, reason: 'candidate_not_found' }
  if (candidate.status === SME_CONNECT_STATUS.PAID) {
    return { applied: false, reason: 'already_paid', candidateId }
  }
  const saved = await store.upsertRecommendation({
    ...candidate,
    status: SME_CONNECT_STATUS.PAID,
    paidAt: request.paidAt || new Date().toISOString(),
    convertedRequestId: request.id || candidate.convertedRequestId,
  })
  return { applied: true, candidateId: saved.id }
}

module.exports = {
  SME_CONNECT_SOURCE,
  loadCandidateFromToken,
  publicCandidateView,
  markClicked,
  confirmAndCreateRequest,
  markCandidatePaidForRequest,
}
