/**
 * Immediate founder/ops Resend alerts for:
 * - New SME / youth-agent registration
 * - Attendance request created (Book an agent)
 * - Attendance request paid (PayFast ITN success)
 *
 * Primary channel: Resend to FOUNDER_EMAIL_ALLOWLIST.
 * Secondary: admin in-app inbox when storage helpers are available.
 * WhatsApp intentionally not enabled (fail-closed / no new WA traffic).
 *
 * Fail-soft: callers must use *Safe wrappers; business flows must succeed if notify fails.
 * Idempotent keys:
 *   sme-register:{uid} | agent-register:{uid}
 *   attendance-request:{requestId}:created
 *   attendance-request:{requestId}:paid
 */

const { Resend } = require('resend')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

const DEFAULT_FROM = 'TenderBriefing <hello@tenderbriefing.co.za>'
const DEFAULT_FOUNDER = 'info@tenderbriefing.co.za'
const SUPPORT_EMAIL = 'support@tenderbriefing.co.za'
const SITE_URL_DEFAULT = 'https://www.tenderbriefing.co.za'
const IDEMPOTENCY_COLLECTION = 'notifications'
const LOG_PREFIX = '[founderOpsNotify]'

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

function buildRegistrationIdempotencyKey(uid, userType) {
  const t = String(userType || '').toLowerCase()
  const prefix = t === 'youth-agent' || t === 'agent' ? 'agent-register' : 'sme-register'
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

function buildRegistrationSummary(profile = {}) {
  const uid = sliceStr(profile.uid, 128)
  const userType = profile.userType || 'sme'
  const adminPath = '/admin/registrations'
  const founderPath = '/founder'
  const timestamp = profile.createdAt || profile.updatedAt || new Date().toISOString()
  return {
    kind: 'registration',
    uid,
    email: sliceStr(profile.email),
    displayName: sliceStr(profile.displayName || 'Unknown'),
    companyName: sliceStr(profile.companyName || ''),
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

function buildAttendanceSummary(request = {}, phase = 'created') {
  const requestId = sliceStr(request.id || request.requestId, 128)
  const feeCents = request.quotedFee ?? request.paymentAmount ?? null
  const adminPath = '/admin/operations'
  const timestamp =
    phase === 'paid'
      ? request.paidAt || request.updatedAt || new Date().toISOString()
      : request.createdAt || request.updatedAt || new Date().toISOString()
  return {
    kind: 'attendance',
    phase,
    requestId,
    smeName: sliceStr(request.smeName || request.smeCompany || 'SME'),
    smeCompany: sliceStr(request.smeCompany || ''),
    smeEmail: sliceStr(request.smeEmail || ''),
    tenderTitle: sliceStr(request.tenderTitle || 'Untitled tender'),
    tenderNumber: sliceStr(request.tenderNumber || ''),
    briefingDate: sliceStr(request.briefingDate || ''),
    briefingTime: sliceStr(request.briefingTime || ''),
    briefingVenue: sliceStr(request.briefingVenue || ''),
    province: sliceStr(request.province || ''),
    paymentStatus: sliceStr(request.paymentStatus || (phase === 'paid' ? 'paid' : 'pending'), 64),
    feeLabel: formatFee(feeCents, request.currency || 'ZAR'),
    timestamp,
    adminPath,
    adminUrl: `${baseUrl()}${adminPath}`,
    idempotencyKey: buildAttendanceIdempotencyKey(requestId, phase),
  }
}

function buildEmailTemplate(summary) {
  if (summary.kind === 'registration') {
    const subject = `[Signup] New ${summary.roleLabel} — ${summary.displayName}`.slice(0, 180)
    const companyLine = summary.companyName
      ? `<p style="margin:0 0 10px;"><strong>Company:</strong> ${escapeHtml(summary.companyName)}</p>`
      : ''
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
        <div style="background:#0F1E3D;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:18px;">New ${escapeHtml(summary.roleLabel)} registration</h1>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;color:#334155;">
          <p style="margin:0 0 10px;"><strong>Name:</strong> ${escapeHtml(summary.displayName)}</p>
          ${companyLine}
          <p style="margin:0 0 10px;"><strong>Email:</strong> ${escapeHtml(summary.email)}</p>
          <p style="margin:0 0 10px;"><strong>Role:</strong> ${escapeHtml(summary.roleLabel)}</p>
          <p style="margin:0 0 10px;"><strong>When:</strong> ${escapeHtml(summary.timestamp)}</p>
          <p style="margin:0 0 10px;"><strong>UID:</strong> ${escapeHtml(summary.uid)}</p>
          <p style="margin:16px 0 10px;">
            <a href="${escapeHtml(summary.adminUrl)}" style="display:inline-block;background:#0F1E3D;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
              Open registrations
            </a>
          </p>
          <p style="margin:0;font-size:13px;color:#64748b;">
            Founder intel: <a href="${escapeHtml(summary.founderUrl)}">${escapeHtml(summary.founderUrl)}</a>
          </p>
        </div>
      </div>
    `.trim()
    const text = [
      `New ${summary.roleLabel} registration`,
      '',
      `Name: ${summary.displayName}`,
      summary.companyName ? `Company: ${summary.companyName}` : null,
      `Email: ${summary.email}`,
      `Role: ${summary.roleLabel}`,
      `When: ${summary.timestamp}`,
      `UID: ${summary.uid}`,
      `Registrations: ${summary.adminUrl}`,
      `Founder intel: ${summary.founderUrl}`,
    ]
      .filter(Boolean)
      .join('\n')
    return { subject, html, text }
  }

  const isPaid = summary.phase === 'paid'
  const headline = isPaid
    ? 'Attendance request paid'
    : 'New attendance request'
  const subject = isPaid
    ? `[Paid] Agent booking — ${summary.tenderTitle}`.slice(0, 180)
    : `[Request] Agent booking — ${summary.tenderTitle}`.slice(0, 180)
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
        <h1 style="margin:0;font-size:18px;">${escapeHtml(headline)}</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;color:#334155;">
        <p style="margin:0 0 10px;"><strong>SME:</strong> ${escapeHtml(summary.smeName)}${
          summary.smeCompany && summary.smeCompany !== summary.smeName
            ? ` (${escapeHtml(summary.smeCompany)})`
            : ''
        }</p>
        <p style="margin:0 0 10px;"><strong>SME email:</strong> ${escapeHtml(summary.smeEmail || 'n/a')}</p>
        <p style="margin:0 0 10px;"><strong>Tender:</strong> ${escapeHtml(summary.tenderTitle)}</p>
        ${
          summary.tenderNumber
            ? `<p style="margin:0 0 10px;"><strong>Ref:</strong> ${escapeHtml(summary.tenderNumber)}</p>`
            : ''
        }
        ${
          briefingBits
            ? `<p style="margin:0 0 10px;"><strong>Briefing:</strong> ${escapeHtml(briefingBits)}</p>`
            : ''
        }
        <p style="margin:0 0 10px;"><strong>Fee:</strong> ${escapeHtml(summary.feeLabel)}</p>
        <p style="margin:0 0 10px;"><strong>Payment:</strong> ${escapeHtml(summary.paymentStatus)}</p>
        <p style="margin:0 0 10px;"><strong>Request ID:</strong> ${escapeHtml(summary.requestId)}</p>
        <p style="margin:0 0 10px;"><strong>When:</strong> ${escapeHtml(summary.timestamp)}</p>
        <p style="margin:16px 0 10px;">
          <a href="${escapeHtml(summary.adminUrl)}" style="display:inline-block;background:#0F1E3D;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
            Open operations
          </a>
        </p>
      </div>
    </div>
  `.trim()
  const text = [
    headline,
    '',
    `SME: ${summary.smeName}${summary.smeCompany ? ` (${summary.smeCompany})` : ''}`,
    `SME email: ${summary.smeEmail || 'n/a'}`,
    `Tender: ${summary.tenderTitle}`,
    summary.tenderNumber ? `Ref: ${summary.tenderNumber}` : null,
    briefingBits ? `Briefing: ${briefingBits}` : null,
    `Fee: ${summary.feeLabel}`,
    `Payment: ${summary.paymentStatus}`,
    `Request ID: ${summary.requestId}`,
    `When: ${summary.timestamp}`,
    `Operations: ${summary.adminUrl}`,
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
    title = `New ${summary.roleLabel} registration`
    message = `${summary.displayName} · ${summary.email}`.slice(0, 400)
    inboxIdPrefix = `reg-inbox-${summary.uid}`
    data = {
      uid: summary.uid,
      userType: summary.userType,
      adminPath: summary.adminPath,
    }
  } else {
    eventType =
      summary.phase === 'paid' ? 'attendance_request_paid' : 'attendance_request_created'
    title =
      summary.phase === 'paid' ? 'Attendance request paid' : 'New attendance request'
    message =
      `${summary.smeName} · ${summary.tenderTitle} · ${summary.paymentStatus} · ${summary.feeLabel}`.slice(
        0,
        400
      )
    inboxIdPrefix = `att-${summary.phase}-${summary.requestId}`
    data = {
      requestId: summary.requestId,
      paymentStatus: summary.paymentStatus,
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
        })
      } else {
        await markIdempotency(claim.ref, 'failed', {
          error: (email.error || 'notify_incomplete').slice(0, 200),
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

module.exports = {
  founderEmailAllowlist,
  formatFee,
  roleLabel,
  buildRegistrationIdempotencyKey,
  buildAttendanceIdempotencyKey,
  idempotencyDocId,
  buildRegistrationSummary,
  buildAttendanceSummary,
  buildEmailTemplate,
  notifyUserRegistered,
  notifyUserRegisteredSafe,
  notifyAttendanceRequestCreated,
  notifyAttendanceRequestCreatedSafe,
  notifyAttendanceRequestPaid,
  notifyAttendanceRequestPaidSafe,
}
