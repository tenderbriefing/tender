/**
 * Founder-only single-use R75 PayFast live pipeline certification.
 * Does NOT change commercial BRIEFING_PRICE_CENTS (R750).
 */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { getFirestore } = require('../../config/firebaseAdmin')
const { getStorage } = require('../storageAdapter')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const auditLogService = require('../auditLogService')
const { createAttendanceRequest } = require('../agentAssignmentService')
const {
  createPayfastCheckoutForRequest,
  paymentReferenceForRequest,
} = require('./attendancePaymentService')
const {
  LIVE_CERTIFICATION_AMOUNT_CENTS,
  LIVE_CERTIFICATION_PURPOSE,
  LIVE_CERTIFICATION_SOURCE,
  BRIEFING_PRICE_CENTS,
  BRIEFING_PRICE_CURRENCY,
  resolveRequestChargeCents,
  formatBriefingPriceZar,
} = require('../../constants/briefingPricing')
const {
  assertPaymentTransition,
  applyPaymentTransition,
} = require('../domain/lifecycleEnforcement')

const GATE_COLLECTION = 'opsConfig'
const GATE_DOC = 'payfastLiveCertification'

function siteBaseUrl(override) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.tenderbriefing.co.za'
  const base =
    process.env.NODE_ENV === 'production' ? configured : override || configured
  return String(base).replace(/\/$/, '')
}

function generatePaymentToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function defaultGate() {
  return {
    enabled: true,
    createdCount: 0,
    maxCreations: 1,
    requestId: null,
    disabledAt: null,
    disabledReason: null,
  }
}

function jsonGatePath() {
  return path.join(process.cwd(), 'backend', 'data', 'payfast-live-certification-gate.json')
}

function useJsonGate() {
  return String(process.env.STORAGE_ADAPTER || '').toLowerCase() === 'json'
}

function gateRef() {
  return getFirestore().collection(GATE_COLLECTION).doc(GATE_DOC)
}

async function getCertificationGate() {
  if (useJsonGate()) {
    try {
      const raw = fs.readFileSync(jsonGatePath(), 'utf8')
      return { ...defaultGate(), ...JSON.parse(raw) }
    } catch {
      return defaultGate()
    }
  }
  const snap = await gateRef().get()
  if (!snap.exists) return defaultGate()
  return { ...defaultGate(), ...(snap.data() || {}) }
}

async function writeCertificationGate(patch) {
  const current = await getCertificationGate()
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
  if (useJsonGate()) {
    fs.mkdirSync(path.dirname(jsonGatePath()), { recursive: true })
    fs.writeFileSync(jsonGatePath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    return next
  }
  await gateRef().set(next, { merge: true })
  return next
}

async function assertCertificationCreationAllowed() {
  const gate = await getCertificationGate()
  if (gate.enabled === false) {
    throw new Error(
      `PayFast live certification creation is disabled${
        gate.disabledReason ? `: ${gate.disabledReason}` : ''
      }`
    )
  }
  const created = Number(gate.createdCount || 0)
  const max = Number(gate.maxCreations != null ? gate.maxCreations : 1)
  if (created >= max) {
    throw new Error(
      'PayFast live certification already created — single-use path exhausted'
    )
  }
  return gate
}

/**
 * Disable further R75 certification checkouts/creations after successful use.
 * Preserves audit evidence on the gate document.
 */
async function disableCertificationPath({ reason, requestId, actorId } = {}) {
  const now = new Date().toISOString()
  await writeCertificationGate({
    enabled: false,
    disabledAt: now,
    disabledReason: String(reason || 'certification_complete').slice(0, 240),
    requestId: requestId || null,
    disabledBy: actorId || 'system',
  })
  await auditLogService.logEvent({
    type: 'payfast_live_certification_disabled',
    entityId: requestId || GATE_DOC,
    reason: reason || 'certification_complete',
    actorId: actorId || 'system',
  })
  return getCertificationGate()
}

/**
 * Create the single-use founder certification booking (R75 locked server-side).
 */
async function createLiveCertificationBooking(adminUser = {}) {
  await assertCertificationCreationAllowed()

  const paymentToken = generatePaymentToken()
  const now = new Date().toISOString()
  const amount = LIVE_CERTIFICATION_AMOUNT_CENTS

  const request = createAttendanceRequest({
    tenderId: null,
    tenderNumber: 'PAYFAST-LIVE-CERT-R75',
    tenderTitle: 'Founder PayFast live pipeline certification (R75)',
    smeId: `cert-${crypto.createHash('sha256').update(String(adminUser.uid || 'founder')).digest('hex').slice(0, 12)}`,
    smeName: 'TenderBriefing Founder Certification',
    smeCompany: 'TenderBriefing Founder Certification',
    smeEmail: String(adminUser.email || 'info@tenderbriefing.co.za').trim().toLowerCase(),
    smePhone: '',
    briefingDate: '',
    briefingTime: '',
    briefingVenue: '',
    province: 'Gauteng',
    notes: 'Single-use founder PayFast live certification — not a commercial booking',
    catalogueTenderRequired: false,
    bookingKind: 'payfast_live_certification',
  })

  // Server-only certification locks (stripped from untrusted createAttendanceRequest payloads)
  request.source = LIVE_CERTIFICATION_SOURCE
  request.purpose = LIVE_CERTIFICATION_PURPOSE
  request.singleUse = true
  request.expectedAmountCents = amount
  request.certificationAmountCents = amount
  request.serverAuthorizedCertification = true
  request.paymentToken = paymentToken
  request.paymentAmount = amount
  request.briefingPriceCents = amount
  request.quotedFee = amount
  request.currency = BRIEFING_PRICE_CURRENCY
  request.pricingVersion = '2026-10-v75-live-cert'
  request.commercialPriceCents = BRIEFING_PRICE_CENTS
  request.invoiceNumber = `TB-CERT-R75-${now.slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
  request.invoiceIssuedAt = now
  request.invoiceStatus = 'UNPAID'
  request.availableForAssignment = false
  request.createdByAdminId = adminUser.uid || null
  request.createdByAdminEmail = adminUser.email || null
  request.internalNotes =
    'FOUNDER LIVE CERT — R75 PayFast pipeline only. Commercial price remains R750. Do not treat as customer invoice.'

  if (resolveRequestChargeCents(request) !== amount) {
    throw new Error('Certification amount lock failed — refusing to create booking')
  }

  const storage = getStorage()
  await storage.saveAttendanceRequest(sanitizeFirestoreData(request))

  await writeCertificationGate({
    enabled: true,
    maxCreations: 1,
    createdCount: 1,
    requestId: request.id,
    paymentTokenHint: paymentToken.slice(0, 8),
    createdAt: now,
    createdBy: adminUser.uid || null,
    createdByEmail: adminUser.email || null,
    amountCents: amount,
  })

  await auditLogService.logEvent({
    type: 'payfast_live_certification_created',
    entityId: request.id,
    amountCents: amount,
    actorId: adminUser.uid || 'admin',
    commercialPriceCents: BRIEFING_PRICE_CENTS,
  })

  const origin = siteBaseUrl()
  const paymentUrl = `${origin}/pay/${paymentToken}`

  return {
    request,
    paymentUrl,
    amountCents: amount,
    amountLabel: formatBriefingPriceZar(amount),
    commercialPriceCents: BRIEFING_PRICE_CENTS,
    paymentReference: paymentReferenceForRequest(request.id),
  }
}

async function getCertificationRequestById(requestId) {
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  const request = requests.find((r) => r.id === requestId)
  if (!request || request.source !== LIVE_CERTIFICATION_SOURCE) return null
  return request
}

async function getRequestByPaymentToken(token) {
  const raw = String(token || '').trim()
  if (!raw || raw.length < 20) return null
  if (useJsonGate()) {
    const storage = getStorage()
    const all = await storage.getAttendanceRequests()
    const request = all.find(
      (r) => r.paymentToken === raw && r.source === LIVE_CERTIFICATION_SOURCE
    )
    return request || null
  }
  const db = getFirestore()
  const snap = await db
    .collection('attendanceRequests')
    .where('paymentToken', '==', raw)
    .limit(1)
    .get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  const request = { id: doc.id, ...doc.data() }
  if (request.source !== LIVE_CERTIFICATION_SOURCE) return null
  return request
}

/**
 * Token checkout for certification booking — amount locked via resolveRequestChargeCents.
 */
async function createCheckoutForCertificationToken(token, baseUrl) {
  const request = await getRequestByPaymentToken(token)
  if (!request) {
    return { ok: false, error: 'Certification payment link not found', status: 404 }
  }
  if (request.paymentStatus === 'paid') {
    return {
      ok: true,
      alreadyPaid: true,
      amountCents: resolveRequestChargeCents(request),
      formAction: null,
      fields: null,
      request,
    }
  }
  if (request.paymentStatus === 'cancelled') {
    return { ok: false, error: 'Certification payment was cancelled', status: 400 }
  }

  const chargeCents = resolveRequestChargeCents(request)
  if (chargeCents !== LIVE_CERTIFICATION_AMOUNT_CENTS) {
    return {
      ok: false,
      error: 'Certification amount lock invalid — refusing checkout',
      status: 400,
    }
  }

  const checkout = await createPayfastCheckoutForRequest(request, baseUrl)
  if (!checkout.ok) {
    return {
      ok: false,
      error: checkout.error || 'PayFast is not configured',
      configured: checkout.configured !== false,
      status: checkout.configured === false ? 503 : 400,
    }
  }

  assertPaymentTransition(request.paymentStatus, 'pending')
  const patched = applyPaymentTransition(request, 'pending', {
    actorId: 'payfast_live_certification',
    extra: {
      paymentProvider: 'payfast',
      paymentAmount: LIVE_CERTIFICATION_AMOUNT_CENTS,
      briefingPriceCents: LIVE_CERTIFICATION_AMOUNT_CENTS,
      quotedFee: LIVE_CERTIFICATION_AMOUNT_CENTS,
      currency: BRIEFING_PRICE_CURRENCY,
      pricingVersion: request.pricingVersion,
      paymentReference: paymentReferenceForRequest(request.id),
      payfastRedirectUrl: checkout.formAction,
      paymentFailureReason: null,
      // Re-assert locks so ITN path cannot drift
      purpose: LIVE_CERTIFICATION_PURPOSE,
      source: LIVE_CERTIFICATION_SOURCE,
      singleUse: true,
      expectedAmountCents: LIVE_CERTIFICATION_AMOUNT_CENTS,
      certificationAmountCents: LIVE_CERTIFICATION_AMOUNT_CENTS,
      serverAuthorizedCertification: true,
    },
  })

  const storage = getStorage()
  const updated = sanitizeFirestoreData({
    ...request,
    ...patched,
    updatedAt: new Date().toISOString(),
  })
  await storage.saveAttendanceRequest(updated)

  return {
    ok: true,
    alreadyPaid: false,
    request: updated,
    formAction: checkout.formAction,
    fields: checkout.fields,
    redirectUrl: checkout.redirectUrl,
    checkoutId: checkout.checkoutId,
    amountCents: resolveRequestChargeCents(updated),
    paymentUrl: `${siteBaseUrl(baseUrl)}/pay/${request.paymentToken}`,
  }
}

module.exports = {
  LIVE_CERTIFICATION_AMOUNT_CENTS,
  LIVE_CERTIFICATION_PURPOSE,
  LIVE_CERTIFICATION_SOURCE,
  BRIEFING_PRICE_CENTS,
  getCertificationGate,
  assertCertificationCreationAllowed,
  disableCertificationPath,
  createLiveCertificationBooking,
  getCertificationRequestById,
  getRequestByPaymentToken,
  createCheckoutForCertificationToken,
  siteBaseUrl,
}
