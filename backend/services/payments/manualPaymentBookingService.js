/**
 * Admin-created manual payment bookings for emailed RFQs/tenders
 * that are not in the TenderBriefing catalogue.
 *
 * Supports one or many structured briefing lines on a single invoice.
 * Reuses attendanceRequests + existing PayFast ITN settlement.
 * Amount is always server-authoritative: briefingCount × BRIEFING_PRICE_CENTS.
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
  multiBriefingPriceSnapshotFields,
  resolveRequestChargeCents,
  formatBriefingPriceZar,
  isAttendanceFree,
  BRIEFING_PRICE_CENTS,
  countStructuredBriefingLines,
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

/**
 * Build structured briefing lines from admin payload.
 * Never trusts client quantity, unit price, or total — only line content.
 */
function normalizeBriefingLinesFromInput(input = {}) {
  let raw = []
  if (Array.isArray(input.briefings) && input.briefings.length > 0) {
    raw = input.briefings
  } else if (Array.isArray(input.briefingLines) && input.briefingLines.length > 0) {
    raw = input.briefingLines
  } else {
    // Legacy flat single-briefing fields
    raw = [
      {
        tenderNumber: input.tenderReference || input.rfqReference || input.tenderNumber,
        tenderDescription: input.tenderDescription || input.description,
        procuringEntity: input.procuringEntity || input.department || '',
        briefingDate: input.briefingDate,
        briefingTime: input.briefingTime,
        briefingVenue: input.briefingVenue,
        notes: '',
      },
    ]
  }

  const unit = BRIEFING_PRICE_CENTS
  const lines = []
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i] || {}
    const tenderNumber = String(
      line.tenderNumber || line.tenderReference || line.rfqReference || ''
    ).trim()
    const tenderDescription = String(
      line.tenderDescription || line.description || line.tenderTitle || ''
    ).trim()
    if (!tenderNumber) {
      throw new Error(`Briefing #${i + 1}: Tender / RFQ number is required`)
    }
    if (!tenderDescription) {
      throw new Error(`Briefing #${i + 1}: Tender / RFQ description is required`)
    }
    lines.push({
      id: `bl-${i + 1}-${crypto.randomBytes(3).toString('hex')}`,
      lineNumber: i + 1,
      tenderNumber,
      tenderDescription,
      procuringEntity: String(line.procuringEntity || line.department || '').trim(),
      briefingDate: String(line.briefingDate || '').trim(),
      briefingTime: String(line.briefingTime || '').trim(),
      briefingVenue: String(line.briefingVenue || '').trim(),
      province: String(line.province || input.province || '').trim(),
      closingDate: String(line.closingDate || '').trim(),
      closingTime: String(line.closingTime || '').trim(),
      contactPerson: String(line.contactPerson || line.briefingContactPerson || '').trim(),
      contactPhone: String(line.contactPhone || line.briefingContactPhone || '').trim(),
      contactEmail: String(line.contactEmail || line.briefingContactEmail || '').trim(),
      notes: String(line.notes || line.internalNotes || '').trim(),
      unitPriceCents: unit,
      paymentAuthorized: false,
      fulfilmentStatus: 'awaiting_payment',
      agentId: null,
      agentName: null,
      attended: false,
      completed: false,
    })
  }
  if (lines.length < 1) {
    throw new Error('At least one briefing is required')
  }
  return lines
}

/** Mark child lines payment-authorized after parent ITN settlement — not attended/completed. */
function authorizeBriefingLinesAfterPayment(briefingLines) {
  if (!Array.isArray(briefingLines) || briefingLines.length < 1) return briefingLines || []
  return briefingLines.map((line) => ({
    ...line,
    paymentAuthorized: true,
    fulfilmentStatus:
      line.fulfilmentStatus === 'confirmed' || line.fulfilmentStatus === 'assigned'
        ? line.fulfilmentStatus
        : 'awaiting_assignment',
    // Explicitly preserve operational truth — payment ≠ attendance
    attended: line.attended === true,
    completed: line.completed === true,
  }))
}

/** Public customer-safe view — never exposes internal notes or admin ids. */
function toPublicPaymentView(request, baseUrl) {
  if (!request) return null
  const cents = resolveRequestChargeCents(request)
  const lines = Array.isArray(request.briefingLines) ? request.briefingLines : []
  const briefingCount = countStructuredBriefingLines(request) || (lines.length || 1)
  return {
    bookingId: request.id,
    invoiceNumber: request.invoiceNumber || null,
    invoiceStatus: request.paymentStatus === 'paid' ? 'PAID' : 'UNPAID',
    paymentStatus: request.paymentStatus,
    companyName: request.smeCompany || request.smeName || '',
    contactPerson: request.contactPerson || '',
    customerEmail: request.smeEmail || '',
    customerPhone: request.smePhone || '',
    tenderReference: request.tenderNumber || '',
    description: SERVICE_NAME,
    tenderDescription: request.tenderTitle || '',
    briefingDate: request.briefingDate || '',
    briefingTime: request.briefingTime || '',
    briefingVenue: request.briefingVenue || '',
    briefingCount,
    unitPriceCents: BRIEFING_PRICE_CENTS,
    unitPriceLabel: formatBriefingPriceZar(BRIEFING_PRICE_CENTS),
    briefingLines: lines.map((l) => ({
      lineNumber: l.lineNumber,
      tenderNumber: l.tenderNumber,
      tenderDescription: l.tenderDescription,
      procuringEntity: l.procuringEntity || '',
      briefingDate: l.briefingDate || '',
      briefingTime: l.briefingTime || '',
      briefingVenue: l.briefingVenue || '',
      unitPriceCents: BRIEFING_PRICE_CENTS,
      unitPriceLabel: formatBriefingPriceZar(BRIEFING_PRICE_CENTS),
      fulfilmentStatus: l.fulfilmentStatus || null,
      paymentAuthorized: Boolean(l.paymentAuthorized),
    })),
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
  const {
    deriveManualOpsStage,
    manualOpsLabel,
    deriveUrgencyFlags,
  } = require('../../domain/manualBriefingOps')
  const publicView = toPublicPaymentView(request, baseUrl)
  const lines = Array.isArray(request.briefingLines) ? request.briefingLines : []
  const opsStage = deriveManualOpsStage(request)
  const urgencyFlags = deriveUrgencyFlags(request)
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
    agentPayoutCents: request.agentPayoutCents || null,
    status: request.status,
    representedEntity:
      request.representedEntity || request.registerAttendOnBehalfOf || publicView.companyName,
    registerAttendOnBehalfOf:
      request.registerAttendOnBehalfOf || request.representedEntity || publicView.companyName,
    linkedSmeId: request.linkedSmeId || null,
    province: request.province || lines[0]?.province || '',
    documents: Array.isArray(request.documents) ? request.documents : [],
    loaStatus: request.loaStatus || (Array.isArray(request.documents) && request.documents.some((d) => d.kind === 'loa') ? 'received' : 'missing'),
    opsStage,
    opsStageLabel: manualOpsLabel(opsStage),
    urgencyFlags,
    availableForAssignment:
      request.paymentStatus === 'paid' || request.paymentStatus === 'not_required',
    briefingLinesAdmin: lines.map((l) => ({
      id: l.id,
      lineNumber: l.lineNumber,
      tenderNumber: l.tenderNumber,
      tenderDescription: l.tenderDescription,
      procuringEntity: l.procuringEntity || '',
      briefingDate: l.briefingDate || '',
      briefingTime: l.briefingTime || '',
      briefingVenue: l.briefingVenue || '',
      province: l.province || '',
      closingDate: l.closingDate || '',
      closingTime: l.closingTime || '',
      contactPerson: l.contactPerson || '',
      contactPhone: l.contactPhone || '',
      contactEmail: l.contactEmail || '',
      notes: l.notes || '',
      unitPriceCents: l.unitPriceCents || BRIEFING_PRICE_CENTS,
      paymentAuthorized: Boolean(l.paymentAuthorized),
      fulfilmentStatus: l.fulfilmentStatus || 'awaiting_payment',
      agentId: l.agentId || null,
      agentName: l.agentName || null,
      attended: l.attended === true,
      completed: l.completed === true,
    })),
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
 * Create a manual payment request for one or more briefing lines.
 * Client-supplied totals / quantities / unit prices are ignored.
 */
function normalizeManualDocuments(input = {}) {
  const {
    MANUAL_DOCUMENT_KINDS,
  } = require('../../domain/manualBriefingOps')
  const raw = Array.isArray(input.documents) ? input.documents : []
  const out = []
  for (const doc of raw) {
    if (!doc || typeof doc !== 'object') continue
    const kind = String(doc.kind || 'other').trim().toLowerCase()
    if (!MANUAL_DOCUMENT_KINDS.includes(kind)) continue
    const name = String(doc.name || doc.fileName || '').trim()
    const storagePath = String(doc.storagePath || doc.path || '').trim()
    const url = String(doc.url || doc.downloadUrl || '').trim()
    if (!name && !storagePath && !url) continue
    out.push({
      id: String(doc.id || `doc-${crypto.randomBytes(4).toString('hex')}`),
      kind,
      name: name || `${kind}-document`,
      storagePath: storagePath || null,
      url: url || null,
      contentType: String(doc.contentType || '').trim() || null,
      sizeBytes: Number.isFinite(Number(doc.sizeBytes)) ? Number(doc.sizeBytes) : null,
      uploadedAt: String(doc.uploadedAt || new Date().toISOString()),
    })
  }
  return out
}

async function createManualPaymentRequest(input, adminUser = {}) {
  const companyName = String(input.companyName || input.customerName || '').trim()
  const customerEmail = normalizeEmail(input.customerEmail || input.email)
  const contactPerson = String(input.contactPerson || input.customerContact || '').trim()
  const customerPhone = String(input.customerPhone || input.phone || input.phoneNumber || '').trim()
  const internalNotes = String(input.internalNotes || input.notes || '').trim()
  const representedEntity = String(
    input.representedEntity ||
      input.onBehalfOf ||
      input.registerAttendOnBehalfOf ||
      ''
  ).trim()
  const linkedSmeId = String(input.linkedSmeId || input.smeId || '').trim() || null

  if (!companyName) throw new Error('Customer/company name is required')
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new Error('A valid customer email is required')
  }

  if (isAttendanceFree()) {
    throw new Error('Attendance fee is configured as free — manual payment links are disabled')
  }

  const briefingLines = normalizeBriefingLinesFromInput(input)
  const briefingCount = briefingLines.length
  const price = multiBriefingPriceSnapshotFields(briefingCount)
  const first = briefingLines[0]
  const documents = normalizeManualDocuments(input)
  const hasLoa = documents.some((d) => d.kind === 'loa')

  const paymentToken = generatePaymentToken()
  const invoiceNumber = nextInvoiceNumber()
  const now = new Date().toISOString()

  const request = createAttendanceRequest({
    tenderId: null,
    tenderNumber: first.tenderNumber,
    tenderTitle:
      briefingCount === 1
        ? first.tenderDescription
        : `${briefingCount} tender briefings`,
    smeId: linkedSmeId || guestSmeId(customerEmail),
    smeName: contactPerson || companyName,
    smeCompany: companyName,
    smeEmail: customerEmail,
    smePhone: customerPhone,
    contactPerson,
    briefingDate: first.briefingDate,
    briefingTime: first.briefingTime,
    briefingVenue: first.briefingVenue,
    notes: '',
    province: String(input.province || first.province || '').trim(),
    department: first.procuringEntity || '',
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
    briefingLines,
    briefingCount,
    unitPriceCents: BRIEFING_PRICE_CENTS,
  })

  // createAttendanceRequest strips fee fields — re-apply server total after create.
  request.paymentToken = paymentToken
  request.invoiceNumber = invoiceNumber
  request.source = MANUAL_SOURCE
  request.briefingLines = briefingLines
  request.briefingCount = briefingCount
  request.unitPriceCents = BRIEFING_PRICE_CENTS
  request.briefingPriceCents = price.briefingPriceCents
  request.paymentAmount = price.paymentAmount
  request.quotedFee = price.quotedFee
  request.currency = price.currency
  request.pricingVersion = price.pricingVersion
  request.contactPerson = contactPerson
  request.representedEntity = representedEntity || companyName
  request.registerAttendOnBehalfOf = representedEntity || companyName
  request.linkedSmeId = linkedSmeId
  request.documents = documents
  request.loaStatus = hasLoa ? 'received' : 'missing'
  request.opsStage = 'payment_required'

  const storage = getStorage()
  await storage.saveAttendanceRequest(sanitizeFirestoreData(request))

  await auditLogService.logEvent({
    type: 'manual_payment_request_created',
    entityId: request.id,
    invoiceNumber,
    actorId: adminUser.uid || 'admin',
    customerEmail,
    briefingCount,
    amountCents: price.paymentAmount,
    tenderReference: first.tenderNumber,
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
 * Token-authenticated PayFast checkout — amount locked server-side from briefing lines.
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

  const chargeCents = resolveRequestChargeCents(request)
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
      briefingPriceCents: chargeCents,
      paymentAmount: chargeCents,
      quotedFee: chargeCents,
      unitPriceCents: BRIEFING_PRICE_CENTS,
      briefingCount: countStructuredBriefingLines(request) || 1,
      currency: 'ZAR',
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
    amountCents: chargeCents,
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
  normalizeBriefingLinesFromInput,
  authorizeBriefingLinesAfterPayment,
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
