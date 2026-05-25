const { getStorage } = require('../storageAdapter')
const yocoService = require('../integrations/yocoService')
const workflowAutomationService = require('../workflowAutomationService')
const auditLogService = require('../auditLogService')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')

const ATTENDANCE_FEE_CENTS = Number(process.env.NEXT_PUBLIC_ATTENDANCE_FEE_CENTS || 24900)
const ATTENDANCE_FEE_CURRENCY = 'ZAR'

function paymentReferenceForRequest(requestId) {
  return `TB-REQ-${requestId}`
}

function siteBaseUrl(override) {
  const base =
    override ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.tenderbriefing.co.za'
  return String(base).replace(/\/$/, '')
}

function defaultPaymentFields(requestId) {
  return {
    paymentStatus: 'pending',
    paymentProvider: 'yoco',
    paymentAmount: ATTENDANCE_FEE_CENTS,
    quotedFee: ATTENDANCE_FEE_CENTS,
    currency: ATTENDANCE_FEE_CURRENCY,
    paymentReference: paymentReferenceForRequest(requestId),
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

async function createYocoCheckoutForRequest(request, baseUrl) {
  const origin = siteBaseUrl(baseUrl)
  const successUrl = `${origin}/sme/requests/payment-success?requestId=${encodeURIComponent(request.id)}`
  const cancelUrl = `${origin}/sme/requests/payment-cancelled?requestId=${encodeURIComponent(request.id)}`
  const failureUrl = cancelUrl

  const result = await yocoService.createCheckout({
    amount: ATTENDANCE_FEE_CENTS,
    currency: ATTENDANCE_FEE_CURRENCY,
    successUrl,
    cancelUrl,
    failureUrl,
    metadata: {
      requestId: String(request.id),
      smeId: String(request.smeId || ''),
      tenderId: String(request.tenderId || ''),
      paymentReference: paymentReferenceForRequest(request.id),
    },
  })

  if (result.skipped || !result.ok) {
    return {
      ok: false,
      configured: !result.skipped,
      error: result.error || result.reason || 'Yoco is not configured',
    }
  }

  const checkout = result.checkout || {}
  const checkoutId = checkout.id || checkout.checkoutId
  const redirectUrl = checkout.redirectUrl || checkout.redirect_url

  if (!checkoutId || !redirectUrl) {
    return { ok: false, configured: true, error: 'Yoco checkout response missing redirect URL' }
  }

  return { ok: true, checkoutId, redirectUrl }
}

async function notifyAgentsAfterPayment(request) {
  await workflowAutomationService.dispatchWorkflowEvent('attendance_requested', {
    ...request,
    id: request.id,
    requestId: request.id,
  })
}

async function markRequestPaid(requestId, { checkoutId, source = 'webhook' } = {}) {
  const request = await getRequestById(requestId)
  if (!request) throw new Error('Attendance request not found')

  if (request.paymentStatus === 'paid') {
    return { request, alreadyPaid: true }
  }

  const now = new Date().toISOString()
  const updated = await saveRequest({
    id: requestId,
    paymentStatus: 'paid',
    paymentProvider: 'yoco',
    paymentAmount: ATTENDANCE_FEE_CENTS,
    quotedFee: ATTENDANCE_FEE_CENTS,
    currency: ATTENDANCE_FEE_CURRENCY,
    paymentReference: paymentReferenceForRequest(requestId),
    yocoCheckoutId: checkoutId || request.yocoCheckoutId || null,
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

  const checkout = await createYocoCheckoutForRequest(request, baseUrl)
  if (!checkout.ok) {
    return { ok: false, error: checkout.error, configured: checkout.configured !== false }
  }

  const updated = await saveRequest({
    id: requestId,
    yocoCheckoutId: checkout.checkoutId,
    yocoRedirectUrl: checkout.redirectUrl,
    paymentStatus: 'pending',
    paymentFailureReason: null,
  })

  return {
    ok: true,
    request: updated,
    redirectUrl: checkout.redirectUrl,
    checkoutId: checkout.checkoutId,
  }
}

function resolveRequestIdFromWebhook(body) {
  const metadata = body?.metadata || body?.payload?.metadata || {}
  if (metadata.requestId) return String(metadata.requestId)
  const checkoutId = body?.checkoutId || body?.payload?.checkoutId || body?.id
  if (!checkoutId) return null
  return null
}

async function findRequestByCheckoutId(checkoutId) {
  if (!checkoutId) return null
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  return requests.find((r) => r.yocoCheckoutId === checkoutId) || null
}

async function processWebhookEvent(body) {
  const eventType = String(body?.type || body?.event || '').toLowerCase()
  const checkoutId =
    body?.checkoutId ||
    body?.payload?.checkoutId ||
    body?.id ||
    body?.payload?.id

  let requestId = resolveRequestIdFromWebhook(body)
  let request = requestId ? await getRequestById(requestId) : null
  if (!request && checkoutId) {
    request = await findRequestByCheckoutId(checkoutId)
    requestId = request?.id
  }

  if (!request || !requestId) {
    return { ok: true, handled: false, reason: 'No matching attendance request' }
  }

  const successEvents = [
    'payment.succeeded',
    'checkout.completed',
    'payment_succeeded',
    'checkout_completed',
    'payment.success',
  ]
  const failureEvents = [
    'payment.failed',
    'checkout.failed',
    'payment_failed',
    'checkout_failed',
    'payment.failure',
  ]

  if (successEvents.some((e) => eventType.includes(e.replace('.', '')) || eventType === e)) {
    const result = await markRequestPaid(requestId, { checkoutId, source: 'webhook' })
    return { ok: true, handled: true, requestId, paymentStatus: 'paid', alreadyPaid: result.alreadyPaid }
  }

  if (failureEvents.some((e) => eventType.includes(e.replace('.', '')) || eventType === e)) {
    await markRequestFailed(requestId, body?.failureReason || eventType)
    return { ok: true, handled: true, requestId, paymentStatus: 'failed' }
  }

  if (checkoutId && (body?.status === 'completed' || body?.payload?.status === 'completed')) {
    const result = await markRequestPaid(requestId, { checkoutId, source: 'webhook_status' })
    return { ok: true, handled: true, requestId, paymentStatus: 'paid', alreadyPaid: result.alreadyPaid }
  }

  return { ok: true, handled: false, reason: `Unhandled event type: ${eventType || 'unknown'}` }
}

async function verifyCheckoutStatus(checkoutId) {
  return yocoService.getCheckout(checkoutId)
}

module.exports = {
  ATTENDANCE_FEE_CENTS,
  ATTENDANCE_FEE_CURRENCY,
  paymentReferenceForRequest,
  defaultPaymentFields,
  isPaidForAgents,
  createYocoCheckoutForRequest,
  createCheckoutForExistingRequest,
  markRequestPaid,
  markRequestFailed,
  markRequestCancelled,
  processWebhookEvent,
  verifyCheckoutStatus,
  notifyAgentsAfterPayment,
}
