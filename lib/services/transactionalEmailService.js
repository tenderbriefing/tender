/**
 * TenderBriefing transactional email service (Resend).
 * Server-authoritative sends with Firestore notification ledger + idempotency.
 * Fail-soft: business flows must succeed even if email fails.
 */
const { Resend } = require('resend')
const { sanitizeFirestoreData } = require('../../backend/utils/sanitizeFirestoreData')
const { renderEmailTemplate } = require('../emails/templates')
const {
  resolveReportDueAt,
  formatMoneyCents,
  formatDateLabel,
  formatDateTimeLabel,
  sliceStr,
  absoluteUrl,
} = require('../emails/utils')

const DEFAULT_FROM = 'TenderBriefing <hello@tenderbriefing.co.za>'
const SUPPORT_EMAIL = 'support@tenderbriefing.co.za'
const DEFAULT_FOUNDER = 'info@tenderbriefing.co.za'
const LEDGER_COLLECTION = 'notifications'
const LOG_PREFIX = '[transactionalEmail]'

function fromAddress(env = process.env) {
  return (env.RESEND_FROM_EMAIL || '').trim() || DEFAULT_FROM
}

function getResendClient(env = process.env, ResendCtor = Resend) {
  const apiKey = (env.RESEND_API_KEY || '').trim()
  if (!apiKey) return null
  return new ResendCtor(apiKey)
}

function founderRecipients(env = process.env) {
  const raw = env.FOUNDER_EMAIL_ALLOWLIST || env.NEXT_PUBLIC_FOUNDER_EMAIL_ALLOWLIST || DEFAULT_FOUNDER
  return String(raw)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

function idempotencyDocId(key) {
  const safe = String(key)
    .replace(/[^a-zA-Z0-9:_-]/g, '_')
    .slice(0, 140)
  return `tx-email-idem-${safe}`
}

const IdempotencyKeys = {
  smeWelcome: (uid) => `SME_WELCOME:${uid}`,
  youthWelcome: (uid) => `YOUTH_AGENT_WELCOME:${uid}`,
  paymentConfirmed: (requestId) => `ATTENDANCE_PAYMENT_CONFIRMED:${requestId}`,
  agentAssigned: (requestId, agentId) => `AGENT_ASSIGNED:${requestId}:${agentId}`,
  smeAllocated: (requestId, agentId) => `SME_AGENT_ALLOCATED:${requestId}:${agentId}`,
  proofReady: (requestId) => `ATTENDANCE_PROOF_READY:${requestId}`,
  reportReady: (requestId) => `BRIEFING_REPORT_READY:${requestId}`,
  reportReminder: (requestId, stage) => `REPORT_REMINDER:${requestId}:${stage}`,
  reportDelay: (requestId) => `REPORT_DELAY_UPDATE:${requestId}`,
  adminOverdue: (requestId) => `ADMIN_REPORT_OVERDUE:${requestId}`,
}

function getDb(deps = {}) {
  if (deps.db) return deps.db
  try {
    const { getFirestore } = require('../../backend/config/firebaseAdmin')
    return getFirestore()
  } catch {
    return null
  }
}

async function claimIdempotency(db, idempotencyKey, meta = {}) {
  if (!db) return { claimed: true, duplicate: false, ref: null, skippedLedger: true }
  const ref = db.collection(LEDGER_COLLECTION).doc(idempotencyDocId(idempotencyKey))
  const existing = await ref.get()
  if (existing.exists) {
    const status = existing.data()?.status
    if (status === 'sent' || status === 'claimed') {
      return { claimed: false, duplicate: true, ref }
    }
  }

  const payload = sanitizeFirestoreData({
    type: 'transactional_email',
    channel: 'email',
    provider: 'resend',
    eventType: meta.eventType || null,
    entityId: meta.entityId || null,
    recipientUserId: meta.recipientUserId || null,
    recipientEmail: meta.recipientEmail || null,
    idempotencyKey,
    status: 'claimed',
    attempts: (existing.exists ? Number(existing.data()?.attempts || 0) : 0) + 1,
    templateId: meta.templateId || null,
    createdAt: existing.exists ? existing.data()?.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  if (!existing.exists && typeof ref.create === 'function') {
    try {
      await ref.create(payload)
      return { claimed: true, duplicate: false, ref }
    } catch {
      return { claimed: false, duplicate: true, ref }
    }
  }

  await ref.set(payload, { merge: true })
  return { claimed: true, duplicate: false, ref }
}

async function finalizeLedger(ref, status, extra = {}) {
  if (!ref) return
  await ref.set(
    sanitizeFirestoreData({
      status,
      updatedAt: new Date().toISOString(),
      ...extra,
    }),
    { merge: true }
  )
}

async function sendViaResend({
  to,
  templateId,
  input,
  idempotencyKey,
  env = process.env,
  resendClient = null,
  deps = {},
  meta = {},
}) {
  const recipient = String(to || '')
    .trim()
    .toLowerCase()
  if (!recipient || !recipient.includes('@')) {
    return { sent: false, skipped: true, error: 'Invalid recipient email' }
  }

  const db = getDb(deps)
  const claim = await claimIdempotency(db, idempotencyKey, {
    ...meta,
    templateId,
    recipientEmail: recipient,
  })
  if (!claim.claimed) {
    return { sent: false, skipped: true, duplicate: true, reason: 'already_sent' }
  }

  const client = resendClient || getResendClient(env)
  if (!client) {
    console.warn(`${LOG_PREFIX} RESEND_API_KEY missing — skip`, idempotencyKey)
    await finalizeLedger(claim.ref, 'failed', {
      lastError: 'RESEND_API_KEY not configured',
      failedAt: new Date().toISOString(),
    })
    return { sent: false, skipped: true, error: 'RESEND_API_KEY not configured' }
  }

  let template
  try {
    template = renderEmailTemplate(templateId, input, env)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Template render failed'
    await finalizeLedger(claim.ref, 'failed', { lastError: message.slice(0, 200), failedAt: new Date().toISOString() })
    return { sent: false, error: message }
  }

  try {
    const { data, error } = await client.emails.send({
      from: fromAddress(env),
      to: [recipient],
      subject: template.subject,
      html: template.html,
      text: template.text,
      replyTo: SUPPORT_EMAIL,
      headers: { 'X-Entity-Ref-ID': idempotencyKey },
    })

    if (error) {
      const message =
        typeof error === 'object' && error && 'message' in error
          ? String(error.message)
          : 'Resend send failed'
      console.error(`${LOG_PREFIX} send failed:`, message.slice(0, 160))
      await finalizeLedger(claim.ref, 'failed', {
        lastError: message.slice(0, 200),
        failedAt: new Date().toISOString(),
      })
      return { sent: false, error: message.slice(0, 200) }
    }

    const providerMessageId = data?.id || null
    await finalizeLedger(claim.ref, 'sent', {
      providerMessageId,
      sentAt: new Date().toISOString(),
      lastError: null,
    })
    console.info(
      `${LOG_PREFIX} sent`,
      JSON.stringify({
        eventType: meta.eventType || templateId,
        entityId: meta.entityId || null,
        recipientUserId: meta.recipientUserId || null,
        providerMessageId,
        idempotencyKey,
      })
    )
    return { sent: true, id: providerMessageId, idempotencyKey }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected send failure'
    console.error(`${LOG_PREFIX} unexpected:`, message.slice(0, 160))
    await finalizeLedger(claim.ref, 'failed', {
      lastError: message.slice(0, 200),
      failedAt: new Date().toISOString(),
    })
    return { sent: false, error: message.slice(0, 200) }
  }
}

function requestEmailFields(request = {}) {
  const due = resolveReportDueAt(request)
  return {
    requestId: sliceStr(request.id || request.requestId, 128),
    smeId: sliceStr(request.smeId, 128),
    smeName: sliceStr(request.smeName || request.smeCompany || 'SME'),
    smeCompany: sliceStr(request.smeCompany || ''),
    smeEmail: sliceStr(request.smeEmail || ''),
    tenderTitle: sliceStr(request.tenderTitle || 'Untitled tender'),
    tenderNumber: sliceStr(request.tenderNumber || ''),
    department: sliceStr(request.department || ''),
    briefingDate: sliceStr(request.briefingDate || ''),
    briefingDateLabel: request.briefingDate ? formatDateLabel(request.briefingDate) : '',
    briefingTime: sliceStr(request.briefingTime || ''),
    briefingVenue: sliceStr(request.briefingVenue || ''),
    paymentAmount: request.paymentAmount ?? request.quotedFee ?? null,
    quotedFee: request.quotedFee ?? null,
    currency: request.currency || 'ZAR',
    paymentReference: sliceStr(request.paymentReference || '', 128),
    paymentLabel: formatMoneyCents(request.paymentAmount ?? request.quotedFee, request.currency || 'ZAR'),
    agentId: sliceStr(request.assignedAgentId || request.agentId || '', 128),
    agentName: sliceStr(request.agentName || '', 120),
    notes: sliceStr(request.notes || '', 400),
    reportDueAt: due ? due.toISOString() : null,
    reportDueAtLabel: due ? formatDateTimeLabel(due.toISOString()) : null,
    contactPerson: sliceStr(request.contactPerson || '', 120),
  }
}

async function sendSmeWelcomeEmail(input, opts = {}) {
  const uid = sliceStr(input.uid || input.userId, 128)
  return sendViaResend({
    to: input.to || input.email,
    templateId: 'sme_welcome',
    input,
    idempotencyKey: IdempotencyKeys.smeWelcome(uid || input.to),
    env: opts.env,
    resendClient: opts.resendClient,
    deps: opts.deps,
    meta: {
      eventType: 'sme_welcome',
      entityId: uid,
      recipientUserId: uid,
    },
  })
}

async function sendYouthAgentWelcomeEmail(input, opts = {}) {
  const uid = sliceStr(input.uid || input.userId, 128)
  return sendViaResend({
    to: input.to || input.email,
    templateId: 'youth_agent_welcome',
    input,
    idempotencyKey: IdempotencyKeys.youthWelcome(uid || input.to),
    env: opts.env,
    resendClient: opts.resendClient,
    deps: opts.deps,
    meta: {
      eventType: 'youth_agent_welcome',
      entityId: uid,
      recipientUserId: uid,
    },
  })
}

async function sendAttendancePaymentConfirmation(request, opts = {}) {
  const fields = requestEmailFields(request)
  if (!fields.smeEmail) return { sent: false, skipped: true, error: 'No SME email on request' }
  return sendViaResend({
    to: fields.smeEmail,
    templateId: 'attendance_payment_confirmed',
    input: fields,
    idempotencyKey: IdempotencyKeys.paymentConfirmed(fields.requestId),
    env: opts.env,
    resendClient: opts.resendClient,
    deps: opts.deps,
    meta: {
      eventType: 'attendance_payment_confirmed',
      entityId: fields.requestId,
      recipientUserId: fields.smeId,
    },
  })
}

async function sendAgentAssignmentEmail(request, agent = {}, opts = {}) {
  const fields = requestEmailFields(request)
  const agentEmail = sliceStr(agent.email || request.agentEmail || '', 200)
  const agentId = sliceStr(agent.id || agent.uid || fields.agentId, 128)
  if (!agentEmail) return { sent: false, skipped: true, error: 'No agent email' }
  return sendViaResend({
    to: agentEmail,
    templateId: 'agent_assignment',
    input: {
      ...fields,
      agentName: sliceStr(agent.displayName || agent.name || fields.agentName),
      displayName: sliceStr(agent.displayName || agent.name || fields.agentName),
    },
    idempotencyKey: IdempotencyKeys.agentAssigned(fields.requestId, agentId),
    env: opts.env,
    resendClient: opts.resendClient,
    deps: opts.deps,
    meta: {
      eventType: 'agent_assignment',
      entityId: fields.requestId,
      recipientUserId: agentId,
    },
  })
}

async function sendAgentAllocatedToSmeEmail(request, opts = {}) {
  const fields = requestEmailFields(request)
  if (!fields.smeEmail) return { sent: false, skipped: true, error: 'No SME email on request' }
  const agentId = fields.agentId || 'unknown'
  return sendViaResend({
    to: fields.smeEmail,
    templateId: 'sme_agent_allocated',
    input: fields,
    idempotencyKey: IdempotencyKeys.smeAllocated(fields.requestId, agentId),
    env: opts.env,
    resendClient: opts.resendClient,
    deps: opts.deps,
    meta: {
      eventType: 'sme_agent_allocated',
      entityId: fields.requestId,
      recipientUserId: fields.smeId,
    },
  })
}

async function sendAttendanceProofAvailableEmail(request, opts = {}) {
  const fields = requestEmailFields(request)
  if (!fields.smeEmail) return { sent: false, skipped: true, error: 'No SME email on request' }
  return sendViaResend({
    to: fields.smeEmail,
    templateId: 'attendance_proof_available',
    input: {
      ...fields,
      attendanceStatus: 'Confirmed',
    },
    idempotencyKey: IdempotencyKeys.proofReady(fields.requestId),
    env: opts.env,
    resendClient: opts.resendClient,
    deps: opts.deps,
    meta: {
      eventType: 'attendance_proof_available',
      entityId: fields.requestId,
      recipientUserId: fields.smeId,
    },
  })
}

async function sendBriefingReportReadyEmail(request, report = {}, opts = {}) {
  const fields = requestEmailFields(request)
  if (!fields.smeEmail) return { sent: false, skipped: true, error: 'No SME email on request' }
  return sendViaResend({
    to: fields.smeEmail,
    templateId: 'briefing_report_ready',
    input: {
      ...fields,
      reportSubmittedAt: report.createdAt || new Date().toISOString(),
      reportSubmittedAtLabel: formatDateTimeLabel(report.createdAt || new Date().toISOString()),
    },
    idempotencyKey: IdempotencyKeys.reportReady(fields.requestId),
    env: opts.env,
    resendClient: opts.resendClient,
    deps: opts.deps,
    meta: {
      eventType: 'briefing_report_ready',
      entityId: fields.requestId,
      recipientUserId: fields.smeId,
    },
  })
}

async function sendAgentReportReminder(request, agent = {}, stage = 'pending', opts = {}) {
  const fields = requestEmailFields(request)
  const agentEmail = sliceStr(agent.email || request.agentEmail || '', 200)
  const agentId = sliceStr(agent.id || agent.uid || fields.agentId, 128)
  if (!agentEmail) return { sent: false, skipped: true, error: 'No agent email' }
  return sendViaResend({
    to: agentEmail,
    templateId: 'agent_report_reminder',
    input: { ...fields, stage, agentName: agent.displayName || agent.name || fields.agentName },
    idempotencyKey: IdempotencyKeys.reportReminder(fields.requestId, stage),
    env: opts.env,
    resendClient: opts.resendClient,
    deps: opts.deps,
    meta: {
      eventType: `agent_report_reminder_${stage}`,
      entityId: fields.requestId,
      recipientUserId: agentId,
    },
  })
}

async function sendReportDelayUpdate(request, opts = {}) {
  const fields = requestEmailFields(request)
  if (!fields.smeEmail) return { sent: false, skipped: true, error: 'No SME email on request' }
  return sendViaResend({
    to: fields.smeEmail,
    templateId: 'report_delay_update',
    input: { ...fields, attendanceStatus: 'Recorded / in progress' },
    idempotencyKey: IdempotencyKeys.reportDelay(fields.requestId),
    env: opts.env,
    resendClient: opts.resendClient,
    deps: opts.deps,
    meta: {
      eventType: 'report_delay_update',
      entityId: fields.requestId,
      recipientUserId: fields.smeId,
    },
  })
}

async function sendAdminReportOverdue(request, extra = {}, opts = {}) {
  const fields = requestEmailFields(request)
  const recipients = founderRecipients(opts.env || process.env)
  if (!recipients.length) return { sent: false, skipped: true, error: 'No founder recipients' }

  // Send to first founder with admin template (idempotent per request)
  return sendViaResend({
    to: recipients[0],
    templateId: 'admin_report_overdue',
    input: {
      ...fields,
      agentName: extra.agentName || fields.agentName,
      agentId: fields.agentId,
      overdueLabel: extra.overdueLabel || '',
    },
    idempotencyKey: IdempotencyKeys.adminOverdue(fields.requestId),
    env: opts.env,
    resendClient: opts.resendClient,
    deps: opts.deps,
    meta: {
      eventType: 'admin_report_overdue',
      entityId: fields.requestId,
      recipientUserId: 'founder',
    },
  })
}

async function safe(fn, ...args) {
  try {
    return await fn(...args)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transactional email failed'
    console.error(`${LOG_PREFIX} safe catch:`, message.slice(0, 160))
    return { sent: false, error: message.slice(0, 200) }
  }
}

const sendSmeWelcomeEmailSafe = (input, opts) => safe(sendSmeWelcomeEmail, input, opts)
const sendYouthAgentWelcomeEmailSafe = (input, opts) => safe(sendYouthAgentWelcomeEmail, input, opts)
const sendAttendancePaymentConfirmationSafe = (request, opts) =>
  safe(sendAttendancePaymentConfirmation, request, opts)
const sendAgentAssignmentEmailSafe = (request, agent, opts) =>
  safe(sendAgentAssignmentEmail, request, agent, opts)
const sendAgentAllocatedToSmeEmailSafe = (request, opts) =>
  safe(sendAgentAllocatedToSmeEmail, request, opts)
const sendAttendanceProofAvailableEmailSafe = (request, opts) =>
  safe(sendAttendanceProofAvailableEmail, request, opts)
const sendBriefingReportReadyEmailSafe = (request, report, opts) =>
  safe(sendBriefingReportReadyEmail, request, report, opts)
const sendAgentReportReminderSafe = (request, agent, stage, opts) =>
  safe(sendAgentReportReminder, request, agent, stage, opts)
const sendReportDelayUpdateSafe = (request, opts) => safe(sendReportDelayUpdate, request, opts)
const sendAdminReportOverdueSafe = (request, extra, opts) =>
  safe(sendAdminReportOverdue, request, extra, opts)

/**
 * Ensure reportDueAt is stamped on assigned/paid requests for SLA jobs.
 * Fallback: scheduled briefing instant + 24h when meetingEndedAt is absent.
 */
function ensureReportSlaFields(request = {}, now = new Date()) {
  const due = resolveReportDueAt(request, now)
  if (!due) {
    return {
      ...request,
      reportSlaStatus: request.reportSlaStatus || 'unknown',
      reportSlaFallback: 'insufficient_briefing_datetime',
    }
  }
  const patch = {
    reportDueAt: request.reportDueAt || due.toISOString(),
    reportSlaFallback: request.meetingEndedAt
      ? 'meeting_ended_plus_24h'
      : 'briefing_scheduled_plus_24h',
  }
  if (request.reportSubmittedAt || request.reportId) {
    patch.reportSlaStatus = 'submitted'
  } else if (now.getTime() > due.getTime()) {
    patch.reportSlaStatus = 'overdue'
  } else {
    patch.reportSlaStatus = 'pending'
  }
  return { ...request, ...patch }
}

module.exports = {
  DEFAULT_FROM,
  SUPPORT_EMAIL,
  IdempotencyKeys,
  fromAddress,
  getResendClient,
  sendViaResend,
  requestEmailFields,
  ensureReportSlaFields,
  resolveReportDueAt,
  sendSmeWelcomeEmail,
  sendYouthAgentWelcomeEmail,
  sendAttendancePaymentConfirmation,
  sendAgentAssignmentEmail,
  sendAgentAllocatedToSmeEmail,
  sendAttendanceProofAvailableEmail,
  sendBriefingReportReadyEmail,
  sendAgentReportReminder,
  sendReportDelayUpdate,
  sendAdminReportOverdue,
  sendSmeWelcomeEmailSafe,
  sendYouthAgentWelcomeEmailSafe,
  sendAttendancePaymentConfirmationSafe,
  sendAgentAssignmentEmailSafe,
  sendAgentAllocatedToSmeEmailSafe,
  sendAttendanceProofAvailableEmailSafe,
  sendBriefingReportReadyEmailSafe,
  sendAgentReportReminderSafe,
  sendReportDelayUpdateSafe,
  sendAdminReportOverdueSafe,
  absoluteUrl,
  renderEmailTemplate,
}
