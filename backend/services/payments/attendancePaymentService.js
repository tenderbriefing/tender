const { getStorage } = require('../storageAdapter')
const payfastService = require('../integrations/payfastService')
const workflowAutomationService = require('../workflowAutomationService')
const auditLogService = require('../auditLogService')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')

/** Server-authoritative fee — R249. Prefer ATTENDANCE_FEE_CENTS; never trust client body amounts. */
const ATTENDANCE_FEE_CENTS = Number(
  process.env.ATTENDANCE_FEE_CENTS ||
    process.env.NEXT_PUBLIC_ATTENDANCE_FEE_CENTS ||
    24900
)
const ATTENDANCE_FEE_CURRENCY = 'ZAR'
const CANONICAL_FEE_CENTS = 24900
const EFFECTIVE_FEE_CENTS = Number.isFinite(ATTENDANCE_FEE_CENTS) && ATTENDANCE_FEE_CENTS > 0
  ? Math.round(ATTENDANCE_FEE_CENTS)
  : CANONICAL_FEE_CENTS

function paymentReferenceForRequest(requestId) {
  return `TB-REQ-${requestId}`
}

function siteBaseUrl(override) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.tenderbriefing.co.za'
  // Production PayFast return/cancel/notify must use the public www site URL —
  // never request Origin (could be apex, preview, or spoofed).
  const base =
    process.env.NODE_ENV === 'production' ? configured : override || configured
  return String(base).replace(/\/$/, '')
}

function defaultPaymentFields(requestId) {
  return {
    paymentStatus: 'pending',
    paymentProvider: 'payfast',
    paymentAmount: EFFECTIVE_FEE_CENTS,
    quotedFee: EFFECTIVE_FEE_CENTS,
    currency: ATTENDANCE_FEE_CURRENCY,
    paymentReference: paymentReferenceForRequest(requestId),
    payfastPaymentId: null,
    payfastRedirectUrl: null,
    /** Legacy Yoco fields retained for old records */
    yocoCheckoutId: null,
    yocoRedirectUrl: null,
    paidAt: null,
    paymentFailureReason: null,
  }
}

function isPaidForAgents(paymentStatus) {
  return paymentStatus === 'paid' || paymentStatus === 'not_required'
}

async function getRequestById(requestId) {
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  return requests.find((r) => r.id === requestId) || null
}

async function saveRequest(patch) {
  const storage = getStorage()
  const existing = await getRequestById(patch.id)
  if (!existing) throw new Error('Attendance request not found')
  const updated = sanitizeFirestoreData({
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  })
  await storage.saveAttendanceRequest(updated)
  return updated
}

async function createPayfastCheckoutForRequest(request, baseUrl) {
  const origin = siteBaseUrl(baseUrl)
  const successUrl = `${origin}/sme/requests/payment-success?requestId=${encodeURIComponent(request.id)}`
  const cancelUrl = `${origin}/sme/requests/payment-cancelled?requestId=${encodeURIComponent(request.id)}`
  const notifyUrl = `${origin}/api/webhooks/payfast`

  const nameParts = String(request.smeName || '').trim().split(/\s+/)
  const nameFirst = nameParts[0] || 'SME'
  const nameLast = nameParts.slice(1).join(' ') || 'Owner'

  const result = payfastService.createCheckoutPayload({
    amountCents: EFFECTIVE_FEE_CENTS,
    mPaymentId: paymentReferenceForRequest(request.id),
    itemName: 'Compulsory briefing attendance support',
    itemDescription: `Youth Agent attendance for tender ${request.tenderNumber || request.tenderId || request.id}`,
    returnUrl: successUrl,
    cancelUrl,
    notifyUrl,
    email: request.smeEmail || undefined,
    nameFirst,
    nameLast,
    cellNumber: request.smePhone || undefined,
    customStr1: String(request.id),
    customStr2: String(request.smeId || ''),
    customStr3: String(request.tenderId || ''),
  })

  if (result.skipped || !result.ok) {
    return {
      ok: false,
      configured: !result.skipped,
      error: result.error || result.reason || 'PayFast is not configured',
    }
  }

  return {
    ok: true,
    formAction: result.formAction,
    fields: result.fields,
    /** Client submits formAction+fields; stored for support/debugging */
    redirectUrl: null,
    checkoutId: paymentReferenceForRequest(request.id),
    sandbox: result.sandbox,
  }
}

async function notifyAgentsAfterPayment(request) {
  await workflowAutomationService.dispatchWorkflowEvent('attendance_requested', {
    ...request,
    id: request.id,
    requestId: request.id,
  })
}

async function markRequestPaid(requestId, { checkoutId, pfPaymentId, source = 'webhook' } = {}) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error('Attendance request not found')

  if (request.paymentStatus === 'paid') {
    return { request, alreadyPaid: true }
  }

  const now = new Date().toISOString()
  const updated = await saveRequest({
    id: requestId,
    paymentStatus: 'paid',
    paymentProvider: 'payfast',
    paymentAmount: EFFECTIVE_FEE_CENTS,
    quotedFee: EFFECTIVE_FEE_CENTS,
    currency: ATTENDANCE_FEE_CURRENCY,
    paymentReference: paymentReferenceForRequest(requestId),
    payfastPaymentId: pfPaymentId || request.payfastPaymentId || null,
    paidAt: now,
    paymentFailureReason: null,
  })

  await workflowAutomationService.dispatchWorkflowEvent('request_paid', {
    ...updated,
    id: requestId,
    requestId,
  })
  await auditLogService.logEvent({
    type: 'payment_confirmed',
    entityId: requestId,
    source,
    pfPaymentId: pfPaymentId || null,
    checkoutId: checkoutId || null,
  })

  return { request: updated, alreadyPaid: false }
}

async function markRequestFailed(requestId, reason = 'Payment failed') {
  const request = await getRequestById(requestId)
  if (!request) throw new Error('Attendance request not found')

  const updated = await saveRequest({
    id: requestId,
    paymentStatus: 'failed',
    paymentFailureReason: reason,
  })

  const notificationService = require('../notificationService')
  await notificationService.notify('payment_failed', { ...updated, failureReason: reason })
  await auditLogService.logEvent({
    type: 'payment_failed',
    entityId: requestId,
    reason,
  })

  return updated
}

async function markRequestCancelled(requestId) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error('Attendance request not found')

  return saveRequest({
    id: requestId,
    paymentStatus: 'cancelled',
    paymentFailureReason: 'Payment cancelled by user',
  })
}

async function createCheckoutForExistingRequest(requestId, smeId, baseUrl) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error('Attendance request not found')
  if (request.smeId !== smeId) throw new Error('This request does not belong to your account')
  if (request.paymentStatus === 'paid') {
    throw new Error('This request is already paid')
  }
  if (request.paymentStatus === 'cancelled') {
    throw new Error('This request was cancelled. Submit a new attendance request.')
  }

  const checkout = await createPayfastCheckoutForRequest(request, baseUrl)
  if (!checkout.ok) {
    return { ok: false, error: checkout.error, configured: checkout.configured !== false }
  }

  const updated = await saveRequest({
    id: requestId,
    paymentProvider: 'payfast',
    paymentReference: paymentReferenceForRequest(requestId),
    payfastRedirectUrl: checkout.formAction,
    paymentStatus: 'pending',
    paymentFailureReason: null,
  })

  return {
    ok: true,
    request: updated,
    formAction: checkout.formAction,
    fields: checkout.fields,
    redirectUrl: checkout.redirectUrl,
    checkoutId: checkout.checkoutId,
  }
}

async function findRequestByPaymentReference(mPaymentId) {
  if (!mPaymentId) return null
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  return (
    requests.find((r) => r.paymentReference === mPaymentId) ||
    requests.find((r) => paymentReferenceForRequest(r.id) === mPaymentId) ||
    null
  )
}

async function findRequestByCheckoutId(checkoutId) {
  if (!checkoutId) return null
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  return (
    requests.find((r) => r.yocoCheckoutId === checkoutId) ||
    requests.find((r) => r.payfastPaymentId === checkoutId) ||
    null
  )
}

/**
 * Process PayFast ITN (form-urlencoded fields as object).
 */
async function processPayfastItn(posted) {
  const signatureCheck = payfastService.verifyItnSignature(posted)
  if (!signatureCheck.ok) {
    return { ok: false, handled: false, reason: signatureCheck.reason || 'Invalid signature' }
  }

  const serverValidate = await payfastService.validateItnWithPayfast(posted)
  if (!serverValidate.ok) {
    return {
      ok: false,
      handled: false,
      reason: `PayFast validate failed: ${serverValidate.raw || 'INVALID'}`,
    }
  }

  const expectedMerchantId = String(process.env.PAYFAST_MERCHANT_ID || '').trim()
  const postedMerchantId = String(posted.merchant_id || '').trim()
  if (expectedMerchantId && postedMerchantId && postedMerchantId !== expectedMerchantId) {
    return { ok: false, handled: false, reason: 'Merchant ID mismatch' }
  }
  if (expectedMerchantId && !postedMerchantId) {
    return { ok: false, handled: false, reason: 'Missing merchant_id' }
  }

  const requestId =
    posted.custom_str1 ||
    (String(posted.m_payment_id || '').startsWith('TB-REQ-')
      ? String(posted.m_payment_id).replace(/^TB-REQ-/, '')
      : null)

  let request = requestId ? await getRequestById(String(requestId)) : null
  if (!request && posted.m_payment_id) {
    request = await findRequestByPaymentReference(String(posted.m_payment_id))
  }

  if (!request) {
    return { ok: true, handled: false, reason: 'No matching attendance request' }
  }

  const status = String(posted.payment_status || '').toUpperCase()
  const pfPaymentId = posted.pf_payment_id ? String(posted.pf_payment_id) : null

  if (status === 'COMPLETE') {
    // Replay / duplicate ITN: already paid with same pf_payment_id
    if (
      request.paymentStatus === 'paid' &&
      pfPaymentId &&
      request.payfastPaymentId &&
      String(request.payfastPaymentId) === String(pfPaymentId)
    ) {
      return {
        ok: true,
        handled: true,
        requestId: request.id,
        paymentStatus: 'paid',
        alreadyPaid: true,
        duplicate: true,
      }
    }

    const expectedCents = request.quotedFee || request.paymentAmount || EFFECTIVE_FEE_CENTS
    const paidZar = Number(posted.amount_gross || posted.amount || 0)
    const paidCents = Math.round(paidZar * 100)
    if (paidCents > 0 && Math.abs(paidCents - expectedCents) > 1) {
      await markRequestFailed(
        request.id,
        `Amount mismatch: expected ${expectedCents} cents, got ${paidCents}`
      )
      return { ok: true, handled: true, requestId: request.id, paymentStatus: 'failed' }
    }

    const result = await markRequestPaid(request.id, {
      pfPaymentId,
      checkoutId: posted.m_payment_id,
      source: 'payfast_itn',
    })
    return {
      ok: true,
      handled: true,
      requestId: request.id,
      paymentStatus: 'paid',
      alreadyPaid: result.alreadyPaid,
    }
  }

  if (status === 'FAILED' || status === 'CANCELLED') {
    await markRequestFailed(request.id, `PayFast status: ${status}`)
    return { ok: true, handled: true, requestId: request.id, paymentStatus: 'failed' }
  }

  return { ok: true, handled: false, reason: `Unhandled PayFast status: ${status || 'unknown'}` }
}

/** @deprecated Yoco webhook compatibility — unused after PayFast cutover */
async function processWebhookEvent(body) {
  if (body?.payment_status || body?.pf_payment_id || body?.m_payment_id) {
    return processPayfastItn(body)
  }
  return { ok: true, handled: false, reason: 'Legacy Yoco event ignored' }
}

async function verifyCheckoutStatus() {
  return { ok: false, skipped: true, reason: 'PayFast has no checkout poll API; wait for ITN' }
}

module.exports = {
  ATTENDANCE_FEE_CENTS: EFFECTIVE_FEE_CENTS,
  ATTENDANCE_FEE_CURRENCY,
  paymentReferenceForRequest,
  defaultPaymentFields,
  isPaidForAgents,
  createPayfastCheckoutForRequest,
  createCheckoutForExistingRequest,
  markRequestPaid,
  markRequestFailed,
  markRequestCancelled,
  processPayfastItn,
  processWebhookEvent,
  verifyCheckoutStatus,
  notifyAgentsAfterPayment,
  findRequestByPaymentReference,
  findRequestByCheckoutId,
  /** Alias kept for older require() call sites */
  createYocoCheckoutForRequest: createPayfastCheckoutForRequest,
}
