const { getStorage } = require('../storageAdapter')
const payfastService = require('../integrations/payfastService')
const workflowAutomationService = require('../workflowAutomationService')
const auditLogService = require('../auditLogService')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const {
  assertPaymentTransition,
  applyPaymentTransition,
} = require('../domain/lifecycleEnforcement')

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
  if (typeof storage.getAttendanceRequestById === 'function') {
    return storage.getAttendanceRequestById(requestId)
  }
  return null
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
    // Idempotent: deliver missing SME confirmation if prior send failed
    try {
      const txEmail = require('../transactionalEmailService')
      await txEmail.sendAttendancePaymentConfirmationSafe(request)
    } catch (err) {
      console.error(
        '[attendancePayment] already-paid confirmation retry failed:',
        err instanceof Error ? err.message.slice(0, 160) : 'unknown'
      )
    }
    return { request, alreadyPaid: true }
  }

  assertPaymentTransition(request.paymentStatus, 'paid')

  const now = new Date().toISOString()
  const patched = applyPaymentTransition(request, 'paid', {
    actorId: source,
    now,
    extra: {
      paymentProvider: 'payfast',
      paymentAmount: EFFECTIVE_FEE_CENTS,
      quotedFee: EFFECTIVE_FEE_CENTS,
      currency: ATTENDANCE_FEE_CURRENCY,
      paymentReference: paymentReferenceForRequest(requestId),
      payfastPaymentId: pfPaymentId || request.payfastPaymentId || null,
      paidAt: now,
      paymentFailureReason: null,
    },
  })

  const updated = await saveRequest({
    id: requestId,
    ...patched,
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

  // Founder/ops alert on successful payment — fail-soft; skip if already paid above
  try {
    const founderOps = require('../founderOpsNotificationService')
    await founderOps.notifyAttendanceRequestPaidSafe(updated)
  } catch (err) {
    console.error(
      '[attendancePayment] founder ops notify failed:',
      err instanceof Error ? err.message.slice(0, 160) : 'unknown'
    )
  }

  // SME payment confirmation email — authoritative ITN/reconcile path only; fail-soft
  try {
    const txEmail = require('../transactionalEmailService')
    const withSla = txEmail.ensureReportSlaFields(updated)
    if (withSla.reportDueAt && !updated.reportDueAt) {
      try {
        const { getStorage } = require('../storageAdapter')
        await getStorage().saveAttendanceRequest({
          id: requestId,
          reportDueAt: withSla.reportDueAt,
          reportSlaStatus: withSla.reportSlaStatus,
          reportSlaFallback: withSla.reportSlaFallback,
          updatedAt: new Date().toISOString(),
        })
      } catch (slaErr) {
        console.error(
          '[attendancePayment] report SLA stamp failed:',
          slaErr instanceof Error ? slaErr.message.slice(0, 160) : 'unknown'
        )
      }
    }
    await txEmail.sendAttendancePaymentConfirmationSafe(updated)
  } catch (err) {
    console.error(
      '[attendancePayment] transactional email failed:',
      err instanceof Error ? err.message.slice(0, 160) : 'unknown'
    )
  }

  return { request: updated, alreadyPaid: false }
}

async function markRequestFailed(requestId, reason = 'Payment failed') {
  const request = await getRequestById(requestId)
  if (!request) throw new Error('Attendance request not found')

  if (request.paymentStatus === 'paid') {
    // Do not downgrade paid → failed
    return request
  }

  assertPaymentTransition(request.paymentStatus, 'failed')
  const patched = applyPaymentTransition(request, 'failed', {
    extra: { paymentFailureReason: reason },
  })

  const updated = await saveRequest({
    id: requestId,
    ...patched,
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

  if (request.paymentStatus === 'paid') {
    throw new Error('Cannot cancel payment after paid')
  }

  assertPaymentTransition(request.paymentStatus, 'cancelled')
  const patched = applyPaymentTransition(request, 'cancelled', {
    extra: { paymentFailureReason: 'Payment cancelled by user' },
  })

  return saveRequest({
    id: requestId,
    ...patched,
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

  // Re-checkout after failed/expired must go through payment lifecycle (e.g. failed→pending).
  assertPaymentTransition(request.paymentStatus, 'pending')
  const patched = applyPaymentTransition(request, 'pending', {
    actorId: smeId,
    extra: {
      paymentProvider: 'payfast',
      paymentReference: paymentReferenceForRequest(requestId),
      payfastRedirectUrl: checkout.formAction,
      paymentFailureReason: null,
    },
  })

  const updated = await saveRequest({
    id: requestId,
    ...patched,
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
/**
 * Authoritative reconciliation when PayFast confirms COMPLETE but ITN failed locally.
 * Requires matching request, m_payment_id, R249 amount, COMPLETE status, no prior paid entitlement.
 */
async function reconcileAuthoritativePayfastPayment({
  requestId,
  pfPaymentId,
  reason = 'itn_signature_mismatch_reconciliation',
  actorId = 'payfast_reconcile',
} = {}) {
  if (!requestId || !pfPaymentId) {
    return { ok: false, reason: 'requestId and pfPaymentId are required' }
  }

  const request = await getRequestById(String(requestId))
  if (!request) {
    return { ok: false, reason: 'Attendance request not found' }
  }

  if (request.paymentStatus === 'paid') {
    if (
      request.payfastPaymentId &&
      String(request.payfastPaymentId) === String(pfPaymentId)
    ) {
      return {
        ok: true,
        alreadyPaid: true,
        duplicate: true,
        requestId: request.id,
        paymentStatus: 'paid',
      }
    }
    return {
      ok: false,
      reason: 'Request already paid under a different PayFast transaction',
      paymentStatus: 'paid',
      existingPfPaymentId: request.payfastPaymentId || null,
    }
  }

  const query = await payfastService.queryTransactionByPfPaymentId(pfPaymentId)
  if (!query.ok) {
    return { ok: false, reason: `PayFast query failed: ${query.reason || 'unknown'}` }
  }
  if (query.status !== 'COMPLETE') {
    return {
      ok: false,
      reason: `PayFast status is ${query.status || 'unknown'}, not COMPLETE`,
      payfastStatus: query.status,
    }
  }

  const expectedRef = paymentReferenceForRequest(request.id)
  if (!query.mPaymentId || String(query.mPaymentId) !== expectedRef) {
    return {
      ok: false,
      reason: 'PayFast m_payment_id does not match attendance request',
      expected: expectedRef,
      got: query.mPaymentId,
    }
  }

  const expectedCents = request.quotedFee || request.paymentAmount || EFFECTIVE_FEE_CENTS
  if (!Number.isFinite(query.amountCents) || Math.abs(query.amountCents - expectedCents) > 1) {
    return {
      ok: false,
      reason: `Amount mismatch: expected ${expectedCents} cents, got ${query.amountCents}`,
    }
  }

  const paidAtProvider = null
  const result = await markRequestPaid(request.id, {
    pfPaymentId: String(query.pfPaymentId),
    checkoutId: query.mPaymentId,
    source: actorId,
  })

  await auditLogService.logEvent({
    type: 'payment_reconciled',
    entityId: request.id,
    provider: 'payfast',
    pfPaymentId: String(query.pfPaymentId),
    mPaymentId: query.mPaymentId,
    amountCents: query.amountCents,
    originalPaymentTimestamp: paidAtProvider,
    reconciliationTimestamp: new Date().toISOString(),
    reason,
    verificationSource: 'payfast_process_query',
    actorId,
  })

  return {
    ok: true,
    requestId: request.id,
    paymentStatus: 'paid',
    alreadyPaid: result.alreadyPaid,
    pfPaymentId: String(query.pfPaymentId),
    amountCents: query.amountCents,
  }
}

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
  reconcileAuthoritativePayfastPayment,
  processPayfastItn,
  processWebhookEvent,
  verifyCheckoutStatus,
  notifyAgentsAfterPayment,
  findRequestByPaymentReference,
  findRequestByCheckoutId,
  /** Alias kept for older require() call sites */
  createYocoCheckoutForRequest: createPayfastCheckoutForRequest,
}
