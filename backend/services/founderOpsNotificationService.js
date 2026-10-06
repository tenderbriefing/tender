/**
 * Founder operational email notifications (Resend).
 *
 * Canonical events:
 *   SME_REGISTERED | YOUTH_AGENT_REGISTERED | PAYMENT_CONFIRMED | BRIEFING_CONFIRMED
 *
 * Primary channel: Resend → info@tenderbriefing.co.za (FOUNDER_EMAIL_ALLOWLIST).
 * Secondary: admin in-app inbox when storage helpers are available.
 *
 * Fail-soft: callers must use *Safe wrappers; business flows must succeed if notify fails.
 * Idempotent keys (notifications ledger):
 *   sme-register:{uid} | agent-register:{uid}
 *   attendance-request:{requestId}:created  (BRIEFING_CONFIRMED)
 *   attendance-request:{requestId}:paid     (PAYMENT_CONFIRMED)
 *
 * Observational only — never mutates payment/booking/registration state.
 */

const { Resend } = require('resend')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

const DEFAULT_FROM = 'TenderBriefing <hello@tenderbriefing.co.za>'
const DEFAULT_FOUNDER = 'info@tenderbriefing.co.za'
const SUPPORT_EMAIL = 'support@tenderbriefing.co.za'
const SITE_URL_DEFAULT = 'https://www.tenderbriefing.co.za'
const IDEMPOTENCY_COLLECTION = 'notifications'
const LOG_PREFIX = '[founderOpsNotify]'

const EVENT_TYPES = Object.freeze({
  SME_REGISTERED: 'SME_REGISTERED',
  YOUTH_AGENT_REGISTERED: 'YOUTH_AGENT_REGISTERED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  BRIEFING_CONFIRMED: 'BRIEFING_CONFIRMED',
})

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function founderEmailAllowlist(env = process.env) {
  const raw =
    env.FOUNDER_EMAIL_ALLOWLIST ||
    env.NEXT_PUBLIC_FOUNDER_EMAIL_ALLOWLIST ||
    DEFAULT_FOUNDER
  return String(raw)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

function baseUrl(env = process.env) {
  return (
    env.NEXT_PUBLIC_SITE_URL ||
    env.SITE_URL ||
    SITE_URL_DEFAULT
  ).replace(/\/$/, '')
}

function fromAddress(env = process.env) {
  return (env.RESEND_FROM_EMAIL || '').trim() || DEFAULT_FROM
}

function getResendClient(env = process.env, ResendCtor = Resend) {
  const apiKey = (env.RESEND_API_KEY || '').trim()
  if (!apiKey) return null
  return new ResendCtor(apiKey)
}

function formatFee(cents, currency = 'ZAR') {
  if (cents == null || cents === '' || Number.isNaN(Number(cents))) return 'n/a'
  const amount = Number(cents) / 100
  const cur = String(currency || 'ZAR').toUpperCase()
  if (cur === 'ZAR') return `R${amount.toFixed(2)}`
  return `${cur} ${amount.toFixed(2)}`
}

function roleLabel(userType) {
  const t = String(userType || '').toLowerCase()
  if (t === 'sme') return 'SME'
  if (t === 'youth-agent' || t === 'agent') return 'Youth agent'
  return t || 'user'
}

function isYouthAgentType(userType) {
  const t = String(userType || '').toLowerCase()
  return t === 'youth-agent' || t === 'agent'
}

function buildRegistrationIdempotencyKey(uid, userType) {
  const prefix = isYouthAgentType(userType) ? 'agent-register' : 'sme-register'
  return `${prefix}:${String(uid || '').trim()}`
}

function buildAttendanceIdempotencyKey(requestId, phase) {
  return `attendance-request:${String(requestId || '').trim()}:${phase}`
}

function idempotencyDocId(idempotencyKey) {
  const safe = String(idempotencyKey)
    .replace(/[^a-zA-Z0-9:_-]/g, '_')
    .slice(0, 120)
  return `founder-ops-idem-${safe}`
}

function sliceStr(value, max = 200) {
  return String(value || '').trim().slice(0, max)
}

function optionalLine(label, value) {
  const v = sliceStr(value)
  return v ? `${label}: ${v}` : null
}

function optionalHtml(label, value) {
  const v = sliceStr(value)
  if (!v) return ''
  return `<p style="margin:0 0 10px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(v)}</p>`
}

function resolveRegistrationEventType(userType) {
  return isYouthAgentType(userType)
    ? EVENT_TYPES.YOUTH_AGENT_REGISTERED
    : EVENT_TYPES.SME_REGISTERED
}

function buildRegistrationSummary(profile = {}) {
  const uid = sliceStr(profile.uid, 128)
  const userType = profile.userType || 'sme'
  const eventType = resolveRegistrationEventType(userType)
  const founderPath = isYouthAgentType(userType)
    ? `/founder/agents/${encodeURIComponent(uid)}`
    : `/founder/smes/${encodeURIComponent(uid)}`
  const adminPath = '/admin/registrations'
  const timestamp = profile.createdAt || profile.updatedAt || new Date().toISOString()
  return {
    kind: 'registration',
    eventType,
    uid,
    email: sliceStr(profile.email),
    displayName: sliceStr(profile.displayName || profile.name || 'Unknown'),
    companyName: sliceStr(profile.companyName || ''),
    phoneNumber: sliceStr(
      profile.phoneNumber || profile.whatsAppNumber || profile.phone || ''
    ),
    province: sliceStr(profile.province || ''),
    location: sliceStr(profile.location || profile.city || ''),
    userType,
    roleLabel: roleLabel(userType),
    timestamp,
    adminPath,
    adminUrl: `${baseUrl()}${adminPath}`,
    founderPath,
    founderUrl: `${baseUrl()}${founderPath}`,
    idempotencyKey: buildRegistrationIdempotencyKey(uid, userType),
  }
}

function resolveFeeCents(request = {}) {
  const amount = Number(request.paymentAmount)
  if (Number.isFinite(amount) && amount > 0) return Math.round(amount)
  const snap = Number(request.briefingPriceCents)
  if (Number.isFinite(snap) && snap > 0) return Math.round(snap)
  const quoted = Number(request.quotedFee)
  if (Number.isFinite(quoted) && quoted > 0) return Math.round(quoted)
  return null
}

function buildAttendanceSummary(request = {}, phase = 'created') {
  const requestId = sliceStr(request.id || request.requestId, 128)
  const feeCents = resolveFeeCents(request)
  const founderPath = `/founder/briefings/${encodeURIComponent(requestId)}`
  const adminPath = '/admin/operations'
  const timestamp =
    phase === 'paid'
      ? request.paidAt || request.updatedAt || new Date().toISOString()
      : request.createdAt || request.updatedAt || new Date().toISOString()
  const eventType =
    phase === 'paid' ? EVENT_TYPES.PAYMENT_CONFIRMED : EVENT_TYPES.BRIEFING_CONFIRMED
  const assignedAgentName = sliceStr(
    request.assignedAgentName ||
      request.agentName ||
      request.youthAgentName ||
      ''
  )
  const assignedAgentId = sliceStr(
    request.assignedAgentId || request.agentId || '',
    128
  )
  return {
    kind: 'attendance',
    eventType,
    phase,
    requestId,
    smeName: sliceStr(request.smeName || request.smeCompany || 'SME'),
    smeCompany: sliceStr(request.smeCompany || ''),
    smeEmail: sliceStr(request.smeEmail || ''),
    tenderTitle: sliceStr(request.tenderTitle || 'Untitled tender'),
    tenderNumber: sliceStr(request.tenderNumber || ''),
    briefingDate: sliceStr(request.briefingDate || ''),
    briefingTime: sliceStr(request.briefingTime || ''),
    briefingVenue: sliceStr(request.briefingVenue || request.briefingLocation || ''),
    province: sliceStr(request.province || ''),
    paymentStatus: sliceStr(
      request.paymentStatus || (phase === 'paid' ? 'paid' : 'pending'),
      64
    ),
    paymentReference: sliceStr(
      request.paymentReference || request.payfastPaymentId || request.pfPaymentId || '',
      128
    ),
    feeCents,
    feeLabel: formatFee(feeCents, request.currency || 'ZAR'),
    assignedAgentName,
    assignedAgentId,
    timestamp,
    adminPath,
    adminUrl: `${baseUrl()}${adminPath}`,
    founderPath,
    founderUrl: `${baseUrl()}${founderPath}`,
    idempotencyKey: buildAttendanceIdempotencyKey(requestId, phase),
  }
}

function buildEmailTemplate(summary) {
  if (summary.kind === 'registration') {
    const isAgent = isYouthAgentType(summary.userType)
    const subject = isAgent
      ? 'New Youth Agent Registered — TenderBriefing'
      : 'New SME Registered — TenderBriefing'
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
        <div style="background:#0F1E3D;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:18px;">${escapeHtml(subject.replace(' — TenderBriefing', ''))}</h1>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;color:#334155;">
          <p style="margin:0 0 10px;"><strong>Name:</strong> ${escapeHtml(summary.displayName)}</p>
          ${optionalHtml('Company', summary.companyName)}
          <p style="margin:0 0 10px;"><strong>Email:</strong> ${escapeHtml(summary.email)}</p>
          ${optionalHtml('Phone', summary.phoneNumber)}
          ${optionalHtml('Province', summary.province)}
          ${optionalHtml('Location', summary.location)}
          <p style="margin:0 0 10px;"><strong>Role:</strong> ${escapeHtml(summary.roleLabel)}</p>
          <p style="margin:0 0 10px;"><strong>When:</strong> ${escapeHtml(summary.timestamp)}</p>
          <p style="margin:0 0 10px;"><strong>UID:</strong> ${escapeHtml(summary.uid)}</p>
          <p style="margin:16px 0 10px;">
            <a href="${escapeHtml(summary.founderUrl)}" style="display:inline-block;background:#0F1E3D;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
              Open Founder record
            </a>
          </p>
          <p style="margin:0;font-size:13px;color:#64748b;">
            Admin: <a href="${escapeHtml(summary.adminUrl)}">${escapeHtml(summary.adminUrl)}</a>
          </p>
        </div>
      </div>
    `.trim()
    const text = [
      subject,
      '',
      `Name: ${summary.displayName}`,
      optionalLine('Company', summary.companyName),
      `Email: ${summary.email}`,
      optionalLine('Phone', summary.phoneNumber),
      optionalLine('Province', summary.province),
      optionalLine('Location', summary.location),
      `Role: ${summary.roleLabel}`,
      `When: ${summary.timestamp}`,
      `UID: ${summary.uid}`,
      `Founder: ${summary.founderUrl}`,
      `Admin: ${summary.adminUrl}`,
    ]
      .filter(Boolean)
      .join('\n')
    return { subject, html, text }
  }

  if (summary.phase === 'paid') {
    const amountPart =
      summary.feeLabel && summary.feeLabel !== 'n/a' ? summary.feeLabel : 'amount unresolved'
    const subject = `Payment Received — ${amountPart} — TenderBriefing`.slice(0, 180)
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
        <div style="background:#0F1E3D;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:18px;">Payment received</h1>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;color:#334155;">
          <p style="margin:0 0 10px;"><strong>SME:</strong> ${escapeHtml(summary.smeName)}${
            summary.smeCompany && summary.smeCompany !== summary.smeName
              ? ` (${escapeHtml(summary.smeCompany)})`
              : ''
          }</p>
          ${optionalHtml('SME email', summary.smeEmail)}
          <p style="margin:0 0 10px;"><strong>Tender:</strong> ${escapeHtml(summary.tenderTitle)}</p>
          ${optionalHtml('Ref', summary.tenderNumber)}
          <p style="margin:0 0 10px;"><strong>Amount:</strong> ${escapeHtml(summary.feeLabel)}</p>
          <p style="margin:0 0 10px;"><strong>Payment status:</strong> ${escapeHtml(summary.paymentStatus)}</p>
          ${optionalHtml('Payment / reference ID', summary.paymentReference)}
          <p style="margin:0 0 10px;"><strong>Booking ID:</strong> ${escapeHtml(summary.requestId)}</p>
          <p style="margin:0 0 10px;"><strong>When:</strong> ${escapeHtml(summary.timestamp)}</p>
          <p style="margin:16px 0 10px;">
            <a href="${escapeHtml(summary.founderUrl)}" style="display:inline-block;background:#0F1E3D;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
              Open briefing
            </a>
          </p>
        </div>
      </div>
    `.trim()
    const text = [
      subject,
      '',
      `SME: ${summary.smeName}${summary.smeCompany ? ` (${summary.smeCompany})` : ''}`,
      optionalLine('SME email', summary.smeEmail),
      `Tender: ${summary.tenderTitle}`,
      optionalLine('Ref', summary.tenderNumber),
      `Amount: ${summary.feeLabel}`,
      `Payment status: ${summary.paymentStatus}`,
      optionalLine('Payment / reference ID', summary.paymentReference),
      `Booking ID: ${summary.requestId}`,
      `When: ${summary.timestamp}`,
      `Founder: ${summary.founderUrl}`,
    ]
      .filter(Boolean)
      .join('\n')
    return { subject, html, text }
  }

  // BRIEFING_CONFIRMED (attendance request created / booking confirmed)
  const subject = 'Briefing Confirmed — TenderBriefing'
  const briefingBits = [
    summary.briefingDate,
    summary.briefingTime,
    summary.briefingVenue,
    summary.province,
  ]
    .filter(Boolean)
    .join(' · ')
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
      <div style="background:#0F1E3D;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:18px;">Briefing confirmed</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;color:#334155;">
        <p style="margin:0 0 10px;"><strong>SME:</strong> ${escapeHtml(summary.smeName)}${
          summary.smeCompany && summary.smeCompany !== summary.smeName
            ? ` (${escapeHtml(summary.smeCompany)})`
            : ''
        }</p>
        ${optionalHtml('SME email', summary.smeEmail)}
        <p style="margin:0 0 10px;"><strong>Tender:</strong> ${escapeHtml(summary.tenderTitle)}</p>
        ${optionalHtml('Ref', summary.tenderNumber)}
        ${
          briefingBits
            ? `<p style="margin:0 0 10px;"><strong>Briefing:</strong> ${escapeHtml(briefingBits)}</p>`
            : ''
        }
        ${optionalHtml('Assigned Youth Agent', summary.assignedAgentName)}
        ${optionalHtml('Agent ID', summary.assignedAgentId)}
        <p style="margin:0 0 10px;"><strong>Booking ID:</strong> ${escapeHtml(summary.requestId)}</p>
        <p style="margin:0 0 10px;"><strong>Payment:</strong> ${escapeHtml(summary.paymentStatus)}</p>
        <p style="margin:0 0 10px;"><strong>When:</strong> ${escapeHtml(summary.timestamp)}</p>
        <p style="margin:16px 0 10px;">
          <a href="${escapeHtml(summary.founderUrl)}" style="display:inline-block;background:#0F1E3D;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
            Open briefing
          </a>
        </p>
      </div>
    </div>
  `.trim()
  const text = [
    subject,
    '',
    `SME: ${summary.smeName}${summary.smeCompany ? ` (${summary.smeCompany})` : ''}`,
    optionalLine('SME email', summary.smeEmail),
    `Tender: ${summary.tenderTitle}`,
    optionalLine('Ref', summary.tenderNumber),
    briefingBits ? `Briefing: ${briefingBits}` : null,
    optionalLine('Assigned Youth Agent', summary.assignedAgentName),
    optionalLine('Agent ID', summary.assignedAgentId),
    `Booking ID: ${summary.requestId}`,
    `Payment: ${summary.paymentStatus}`,
    `When: ${summary.timestamp}`,
    `Founder: ${summary.founderUrl}`,
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html, text }
}

async function claimIdempotency(db, idempotencyKey, channel) {
  const ref = db.collection(IDEMPOTENCY_COLLECTION).doc(idempotencyDocId(idempotencyKey))
  const existing = await ref.get()
  if (existing.exists) {
    const status = existing.data()?.status
    if (status === 'sent' || status === 'claimed') {
      return { claimed: false, duplicate: true, ref }
    }
  }

  const payload = sanitizeFirestoreData({
    type: 'idempotency_marker',
    channel,
    idempotencyKey,
    status: 'claimed',
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

async function markIdempotency(ref, status, extra = {}) {
  await ref.set(
    sanitizeFirestoreData({
      status,
      updatedAt: new Date().toISOString(),
      ...extra,
    }),
    { merge: true }
  )
}

function assertNoSecrets(summary) {
  const blob = JSON.stringify(summary || {}).toLowerCase()
  const forbidden = ['password', 'idtoken', 'refresh_token', 'private_key', 'api_key', 'secret']
  for (const key of forbidden) {
    if (blob.includes(`"${key}"`) || blob.includes(`:${key}`)) {
      throw new Error(`forbidden_field_in_founder_payload:${key}`)
    }
  }
}

async function sendResendEmail(summary, { env = process.env, resendClient = null } = {}) {
  const recipients = founderEmailAllowlist(env)
  if (!recipients.length) {
    return { sent: false, skipped: true, error: 'No founder recipients' }
  }

  const client = resendClient || getResendClient(env)
  if (!client) {
    console.warn(
      `${LOG_PREFIX} RESEND_API_KEY not set — skipping founder email for`,
      summary.idempotencyKey
    )
    return { sent: false, skipped: true, error: 'RESEND_API_KEY not configured' }
  }

  assertNoSecrets(summary)
  const template = buildEmailTemplate(summary)
  const { data, error } = await client.emails.send({
    from: fromAddress(env),
    to: recipients,
    subject: template.subject,
    html: template.html,
    text: template.text,
    replyTo: SUPPORT_EMAIL,
    headers: {
      'X-Entity-Ref-ID': summary.idempotencyKey,
    },
  })

  if (error) {
    const message =
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'Resend send failed'
    return { sent: false, error: message.slice(0, 200) }
  }

  return { sent: true, id: data?.id || null, recipients }
}

async function saveAdminInboxNotifications(summary, { getAdminUserIds, saveNotification } = {}) {
  if (typeof getAdminUserIds !== 'function' || typeof saveNotification !== 'function') {
    return []
  }
  const adminIds = await getAdminUserIds()
  const saved = []

  let eventType
  let title
  let message
  let inboxIdPrefix
  let data

  if (summary.kind === 'registration') {
    eventType = 'user_registered'
    title =
      summary.eventType === EVENT_TYPES.YOUTH_AGENT_REGISTERED
        ? 'New Youth Agent Registered'
        : 'New SME Registered'
    message = `${summary.displayName} · ${summary.email}`.slice(0, 400)
    inboxIdPrefix = `reg-inbox-${summary.uid}`
    data = {
      uid: summary.uid,
      userType: summary.userType,
      eventType: summary.eventType,
      founderPath: summary.founderPath,
      adminPath: summary.adminPath,
    }
  } else if (summary.phase === 'paid') {
    eventType = 'attendance_request_paid'
    title = 'Payment Received'
    message =
      `${summary.smeName} · ${summary.tenderTitle} · ${summary.feeLabel} · ${summary.paymentStatus}`.slice(
        0,
        400
      )
    inboxIdPrefix = `att-paid-${summary.requestId}`
    data = {
      requestId: summary.requestId,
      paymentStatus: summary.paymentStatus,
      eventType: summary.eventType,
      founderPath: summary.founderPath,
      adminPath: summary.adminPath,
      phase: summary.phase,
    }
  } else {
    eventType = 'attendance_request_created'
    title = 'Briefing Confirmed'
    message =
      `${summary.smeName} · ${summary.tenderTitle} · ${summary.paymentStatus}`.slice(0, 400)
    inboxIdPrefix = `att-created-${summary.requestId}`
    data = {
      requestId: summary.requestId,
      paymentStatus: summary.paymentStatus,
      eventType: summary.eventType,
      founderPath: summary.founderPath,
      adminPath: summary.adminPath,
      phase: summary.phase,
    }
  }

  for (const userId of adminIds) {
    if (!userId) continue
    const entry = await saveNotification({
      id: `${inboxIdPrefix}-${userId}`.slice(0, 120),
      eventType,
      userId,
      channel: 'inbox',
      title,
      message,
      data,
      createdAt: new Date().toISOString(),
      read: false,
    })
    saved.push(entry)
  }
  return saved
}

function defaultGetFirestore() {
  const { getFirestore } = require('../config/firebaseAdmin')
  return getFirestore()
}

function defaultGetAdminUserIds() {
  return async () => {
    const db = defaultGetFirestore()
    const snapshot = await db.collection('users').where('userType', '==', 'admin').get()
    return snapshot.docs.map((d) => d.id)
  }
}

function defaultSaveNotification(deps) {
  const storage = deps.storage || require('./storageAdapter').getStorage()
  return typeof storage.saveNotification === 'function'
    ? (n) => storage.saveNotification(n)
    : null
}

async function notifyWithSummary(summary, channel, deps = {}) {
  const result = {
    notified: false,
    duplicate: false,
    email: null,
    inboxCount: 0,
    error: null,
    eventType: summary?.eventType || null,
  }

  try {
    if (!summary?.idempotencyKey) {
      result.error = 'missing_idempotency_key'
      return result
    }
    if (summary.kind === 'registration' && !summary.uid) {
      result.error = 'missing_uid'
      return result
    }
    if (summary.kind === 'attendance' && !summary.requestId) {
      result.error = 'missing_request_id'
      return result
    }

    const getDb = deps.getFirestore || defaultGetFirestore

    let claim = { claimed: true, duplicate: false, ref: null }
    try {
      const db = getDb()
      claim = await claimIdempotency(db, summary.idempotencyKey, channel)
      if (claim.duplicate) {
        result.duplicate = true
        return result
      }
    } catch (err) {
      console.error(
        `${LOG_PREFIX} idempotency claim failed:`,
        err instanceof Error ? err.message.slice(0, 160) : 'unknown'
      )
    }

    const email = await sendResendEmail(summary, {
      env: deps.env || process.env,
      resendClient: deps.resendClient || null,
    })
    result.email = {
      sent: Boolean(email.sent),
      skipped: Boolean(email.skipped),
      error: email.error || null,
      id: email.id || null,
    }

    try {
      const inbox = await saveAdminInboxNotifications(summary, {
        getAdminUserIds: deps.getAdminUserIds || defaultGetAdminUserIds(),
        saveNotification:
          deps.saveNotification || defaultSaveNotification(deps),
      })
      result.inboxCount = inbox.length
    } catch (err) {
      console.error(
        `${LOG_PREFIX} inbox notify failed:`,
        err instanceof Error ? err.message.slice(0, 160) : 'unknown'
      )
    }

    result.notified = Boolean(email.sent) || result.inboxCount > 0

    if (claim.ref) {
      if (email.sent || result.inboxCount > 0) {
        await markIdempotency(claim.ref, 'sent', {
          emailSent: Boolean(email.sent),
          inboxCount: result.inboxCount,
          eventType: summary.eventType || null,
        })
      } else {
        await markIdempotency(claim.ref, 'failed', {
          error: (email.error || 'notify_incomplete').slice(0, 200),
          eventType: summary.eventType || null,
        })
      }
    }

    if (!result.notified && email.error && !email.skipped) {
      result.error = email.error
    }

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'founder ops notify failed'
    console.error(`${LOG_PREFIX} Unexpected error:`, message.slice(0, 200))
    result.error = message.slice(0, 200)
    return result
  }
}

async function notifyUserRegistered(profile, deps = {}) {
  const summary = buildRegistrationSummary(profile)
  return notifyWithSummary(summary, 'founder_ops_registration', deps)
}

async function notifyAttendanceRequestCreated(request, deps = {}) {
  const summary = buildAttendanceSummary(request, 'created')
  return notifyWithSummary(summary, 'founder_ops_attendance_created', deps)
}

async function notifyAttendanceRequestPaid(request, deps = {}) {
  const summary = buildAttendanceSummary(request, 'paid')
  return notifyWithSummary(summary, 'founder_ops_attendance_paid', deps)
}

/**
 * Unified Founder operational notification entrypoint.
 * @param {{ eventType: string, entityId?: string, data?: object }} input
 */
async function sendFounderOperationalNotification(input = {}, deps = {}) {
  const eventType = String(input.eventType || '').trim()
  const data = input.data && typeof input.data === 'object' ? input.data : {}
  const entityId = sliceStr(input.entityId || data.uid || data.id || data.requestId, 128)

  switch (eventType) {
    case EVENT_TYPES.SME_REGISTERED:
      return notifyUserRegistered(
        { ...data, uid: data.uid || entityId, userType: 'sme' },
        deps
      )
    case EVENT_TYPES.YOUTH_AGENT_REGISTERED:
      return notifyUserRegistered(
        { ...data, uid: data.uid || entityId, userType: 'youth-agent' },
        deps
      )
    case EVENT_TYPES.PAYMENT_CONFIRMED:
      return notifyAttendanceRequestPaid(
        { ...data, id: data.id || data.requestId || entityId },
        deps
      )
    case EVENT_TYPES.BRIEFING_CONFIRMED:
      return notifyAttendanceRequestCreated(
        { ...data, id: data.id || data.requestId || entityId },
        deps
      )
    default:
      return {
        notified: false,
        duplicate: false,
        email: null,
        inboxCount: 0,
        error: `unsupported_event_type:${eventType || 'missing'}`,
        eventType: eventType || null,
      }
  }
}

async function notifyUserRegisteredSafe(profile, deps = {}) {
  try {
    return await notifyUserRegistered(profile, deps)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'notify failed'
    console.error(`${LOG_PREFIX} Safe registration send caught:`, message.slice(0, 200))
    return { notified: false, duplicate: false, email: null, inboxCount: 0, error: message.slice(0, 200) }
  }
}

async function notifyAttendanceRequestCreatedSafe(request, deps = {}) {
  try {
    return await notifyAttendanceRequestCreated(request, deps)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'notify failed'
    console.error(`${LOG_PREFIX} Safe attendance-created send caught:`, message.slice(0, 200))
    return { notified: false, duplicate: false, email: null, inboxCount: 0, error: message.slice(0, 200) }
  }
}

async function notifyAttendanceRequestPaidSafe(request, deps = {}) {
  try {
    return await notifyAttendanceRequestPaid(request, deps)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'notify failed'
    console.error(`${LOG_PREFIX} Safe attendance-paid send caught:`, message.slice(0, 200))
    return { notified: false, duplicate: false, email: null, inboxCount: 0, error: message.slice(0, 200) }
  }
}

async function sendFounderOperationalNotificationSafe(input, deps = {}) {
  try {
    return await sendFounderOperationalNotification(input, deps)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'notify failed'
    console.error(`${LOG_PREFIX} Safe operational send caught:`, message.slice(0, 200))
    return {
      notified: false,
      duplicate: false,
      email: null,
      inboxCount: 0,
      error: message.slice(0, 200),
      eventType: input?.eventType || null,
    }
  }
}

module.exports = {
  EVENT_TYPES,
  founderEmailAllowlist,
  formatFee,
  roleLabel,
  buildRegistrationIdempotencyKey,
  buildAttendanceIdempotencyKey,
  idempotencyDocId,
  buildRegistrationSummary,
  buildAttendanceSummary,
  buildEmailTemplate,
  sendFounderOperationalNotification,
  sendFounderOperationalNotificationSafe,
  notifyUserRegistered,
  notifyUserRegisteredSafe,
  notifyAttendanceRequestCreated,
  notifyAttendanceRequestCreatedSafe,
  notifyAttendanceRequestPaid,
  notifyAttendanceRequestPaidSafe,
}
