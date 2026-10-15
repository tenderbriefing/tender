/**
 * Admin-created manual payment bookings for emailed RFQs/tenders
 * that are not in the TenderBriefing catalogue.
 *
 * Reuses attendanceRequests + existing PayFast ITN settlement.
 * Amount is always server-authoritative (BRIEFING_PRICE_CENTS).
 */
const crypto = require('crypto')
const { getFirestore } = require('../../config/firebaseAdmin')
const { getStorage } = require('../storageAdapter')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const auditLogService = require('../auditLogService')
const {
  createAttendanceRequest,
} = require('../agentAssignmentService')
const {
  createPayfastCheckoutForRequest,
  paymentReferenceForRequest,
} = require('./attendancePaymentService')
const {
  briefingPriceSnapshotFields,
  resolveRequestChargeCents,
  formatBriefingPriceZar,
  isAttendanceFree,
  BRIEFING_PRICE_CENTS,
} = require('../../constants/briefingPricing')
const {
  assertPaymentTransition,
  applyPaymentTransition,
} = require('../domain/lifecycleEnforcement')
const { renderManualInvoicePdf } = require('./manualInvoicePdf')

const MANUAL_SOURCE = 'manual_payment_link'
const SERVICE_NAME = 'Tender Briefing Attendance Service'

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

function nextInvoiceNumber() {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `TB-INV-${y}${m}${day}-${suffix}`
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

function guestSmeId(email) {
  const hash = crypto
    .createHash('sha256')
    .update(normalizeEmail(email))
    .digest('hex')
    .slice(0, 16)
  return `manual-${hash}`
}

function paymentUrlFor(request, baseUrl) {
  const origin = siteBaseUrl(baseUrl)
  if (!request?.paymentToken) return null
  return `${origin}/pay/${request.paymentToken}`
}

/** Public customer-safe view — never exposes internal notes or admin ids. */
function toPublicPaymentView(request, baseUrl) {
  if (!request) return null
  const cents = resolveRequestChargeCents(request)
  return {
    bookingId: request.id,
    invoiceNumber: request.invoiceNumber || null,
    invoiceStatus: request.paymentStatus === 'paid' ? 'PAID' : 'UNPAID',
    paymentStatus: request.paymentStatus,
    companyName: request.smeCompany || request.smeName || '',
    customerEmail: request.smeEmail || '',
    tenderReference: request.tenderNumber || '',
    description: SERVICE_NAME,
    tenderDescription: request.tenderTitle || '',
    briefingDate: request.briefingDate || '',
    briefingTime: request.briefingTime || '',
    briefingVenue: request.briefingVenue || '',
    amountCents: cents,
    amountLabel: formatBriefingPriceZar(cents),
    currency: 'ZAR',
    paidAt: request.paidAt || null,
    paymentReference: request.paymentReference || paymentReferenceForRequest(request.id),
    alreadyPaid: request.paymentStatus === 'paid',
    paymentUrl: paymentUrlFor(request, baseUrl),
  }
}

/** Admin list/detail view — includes internal notes and actions metadata. */
function toAdminView(request, baseUrl) {
  if (!request) return null
  const publicView = toPublicPaymentView(request, baseUrl)
  return {
    ...publicView,
    id: request.id,
    source: request.source,
    internalNotes: request.internalNotes || '',
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    createdByAdminId: request.createdByAdminId || null,
    createdByAdminEmail: request.createdByAdminEmail || null,
    payfastPaymentId: request.payfastPaymentId || null,
    assignedAgentId: request.assignedAgentId || request.agentId || null,
    agentName: request.agentName || null,
    status: request.status,
    availableForAssignment:
      request.paymentStatus === 'paid' || request.paymentStatus === 'not_required',
  }
}

async function getRequestByPaymentToken(token) {
  const raw = String(token || '').trim()
  if (!raw || raw.length < 20) return null
  const db = getFirestore()
  const snap = await db
    .collection('attendanceRequests')
    .where('paymentToken', '==', raw)
    .limit(1)
    .get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, ...doc.data() }
}

async function getManualRequestById(requestId) {
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  const request = requests.find((r) => r.id === requestId)
  if (!request || request.source !== MANUAL_SOURCE) return null
  return request
}

async function listManualPaymentRequests({ limit = 100 } = {}) {
  const db = getFirestore()
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 200)
  let snap
  try {
    snap = await db
      .collection('attendanceRequests')
      .where('source', '==', MANUAL_SOURCE)
      .orderBy('createdAt', 'desc')
      .limit(cap)
      .get()
  } catch (err) {
    // Fallback if composite index is not yet deployed
    console.warn(
      '[manualPayment] list query fell back to scan:',
      err instanceof Error ? err.message.slice(0, 120) : 'unknown'
    )
    const storage = getStorage()
    const all = await storage.getAttendanceRequests()
    return all
      .filter((r) => r.source === MANUAL_SOURCE)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, cap)
  }
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Create a manual R750 payment request (no catalogue tender required).
 */
async function createManualPaymentRequest(input, adminUser = {}) {
  const companyName = String(input.companyName || input.customerName || '').trim()
  const customerEmail = normalizeEmail(input.customerEmail || input.email)
  const tenderReference = String(input.tenderReference || input.rfqReference || '').trim()
  const tenderDescription = String(
    input.tenderDescription || input.description || ''
  ).trim()
  const briefingDate = String(input.briefingDate || '').trim()
  const briefingTime = String(input.briefingTime || '').trim()
  const briefingVenue = String(input.briefingVenue || '').trim()
  const internalNotes = String(input.internalNotes || input.notes || '').trim()

  if (!companyName) throw new Error('Customer/company name is required')
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new Error('A valid customer email is required')
  }
  if (!tenderReference) throw new Error('Tender/RFQ reference is required')
  if (!tenderDescription) throw new Error('Tender/RFQ description is required')

  if (isAttendanceFree()) {
    throw new Error('Attendance fee is configured as free — manual payment links are disabled')
  }

  const paymentToken = generatePaymentToken()
  const invoiceNumber = nextInvoiceNumber()
  const now = new Date().toISOString()
  const price = briefingPriceSnapshotFields()

  const request = createAttendanceRequest({
    tenderId: null,
    tenderNumber: tenderReference,
    tenderTitle: tenderDescription,
    smeId: guestSmeId(customerEmail),
    smeName: companyName,
    smeCompany: companyName,
    smeEmail: customerEmail,
    smePhone: String(input.customerPhone || '').trim(),
    briefingDate,
    briefingTime,
    briefingVenue,
    notes: '',
    province: String(input.province || '').trim(),
    department: '',
    source: MANUAL_SOURCE,
    bookingKind: 'manual',
    paymentToken,
    invoiceNumber,
    invoiceIssuedAt: now,
    invoiceStatus: 'UNPAID',
    internalNotes,
    createdByAdminId: adminUser.uid || null,
    createdByAdminEmail: adminUser.email || null,
    catalogueTenderRequired: false,
    serviceName: SERVICE_NAME,
    availableForAssignment: false,
    ...price,
  })

  // Ensure payment defaults were applied (createAttendanceRequest already does this)
  request.paymentToken = paymentToken
  request.invoiceNumber = invoiceNumber
  request.source = MANUAL_SOURCE

  const storage = getStorage()
  await storage.saveAttendanceRequest(sanitizeFirestoreData(request))

  await auditLogService.logEvent({
    type: 'manual_payment_request_created',
    entityId: request.id,
    invoiceNumber,
    actorId: adminUser.uid || 'admin',
    customerEmail,
    tenderReference,
  })

  // Founder/ops notify on create — fail-soft
  try {
    const founderOps = require('../founderOpsNotificationService')
    await founderOps.notifyAttendanceRequestCreatedSafe(request)
  } catch (err) {
    console.error(
      '[manualPayment] founder create notify failed:',
      err instanceof Error ? err.message.slice(0, 160) : 'unknown'
    )
  }

  const origin = siteBaseUrl()
  return {
    request,
    paymentUrl: paymentUrlFor(request, origin),
    invoiceNumber,
    admin: toAdminView(request, origin),
  }
}

/**
 * Token-authenticated PayFast checkout — amount locked server-side.
 */
async function createCheckoutForPaymentToken(token, baseUrl) {
  const request = await getRequestByPaymentToken(token)
  if (!request) {
    return { ok: false, error: 'Payment link not found', status: 404 }
  }
  if (request.source !== MANUAL_SOURCE) {
    return { ok: false, error: 'Invalid payment link', status: 404 }
  }
  if (request.paymentStatus === 'paid') {
    return {
      ok: true,
      alreadyPaid: true,
      request: toPublicPaymentView(request, baseUrl),
      formAction: null,
      fields: null,
    }
  }
  if (request.paymentStatus === 'cancelled') {
    return { ok: false, error: 'This payment request was cancelled', status: 400 }
  }
  if (isAttendanceFree() || request.paymentStatus === 'not_required') {
    return { ok: false, error: 'No payment required for this booking', status: 400 }
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
    actorId: 'payment_token',
    extra: {
      ...briefingPriceSnapshotFields(),
      paymentProvider: 'payfast',
      paymentReference: paymentReferenceForRequest(request.id),
      payfastRedirectUrl: checkout.formAction,
      paymentFailureReason: null,
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
    request: toPublicPaymentView(updated, baseUrl),
    formAction: checkout.formAction,
    fields: checkout.fields,
    redirectUrl: checkout.redirectUrl,
    checkoutId: checkout.checkoutId,
    amountCents: resolveRequestChargeCents(updated),
  }
}

async function buildInvoicePdfBuffer(request, baseUrl) {
  const paymentUrl = paymentUrlFor(request, baseUrl)
  return renderManualInvoicePdf(request, { paymentUrl })
}

async function emailInvoiceAndPaymentLink(requestId, opts = {}) {
  const request = await getManualRequestById(requestId)
  if (!request) throw new Error('Manual payment request not found')

  const origin = siteBaseUrl(opts.baseUrl)
  const paymentUrl = paymentUrlFor(request, origin)
  const pdfBuffer = await buildInvoicePdfBuffer(request, origin)

  const txEmail = require('../transactionalEmailService')
  const result = await txEmail.sendManualPaymentInvoiceEmail(request, {
    paymentUrl,
    pdfBuffer,
    env: opts.env,
    resendClient: opts.resendClient,
    force: opts.force === true,
  })

  return { result, paymentUrl, request: toAdminView(request, origin) }
}

module.exports = {
  MANUAL_SOURCE,
  SERVICE_NAME,
  BRIEFING_PRICE_CENTS,
  generatePaymentToken,
  nextInvoiceNumber,
  paymentUrlFor,
  toPublicPaymentView,
  toAdminView,
  getRequestByPaymentToken,
  getManualRequestById,
  listManualPaymentRequests,
  createManualPaymentRequest,
  createCheckoutForPaymentToken,
  buildInvoicePdfBuffer,
  emailInvoiceAndPaymentLink,
  siteBaseUrl,
}
