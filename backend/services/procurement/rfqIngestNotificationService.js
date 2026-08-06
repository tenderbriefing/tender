/**
 * Immediate founder/ops notification when an RFQ is ingested (manual or webhook pipeline).
 * Primary channel: Resend email to FOUNDER_EMAIL_ALLOWLIST.
 * Secondary: admin in-app inbox (existing notifications collection).
 * WhatsApp intentionally not enabled for this event (fail-closed / no new WA traffic).
 *
 * Fail-soft: callers must catch; ingest must succeed even if notify fails.
 * Idempotent via deterministic key `rfq-ingest:{ingestId}`.
 */

const { Resend } = require('resend')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')

const DEFAULT_FROM = 'TenderBriefing <hello@tenderbriefing.co.za>'
const DEFAULT_FOUNDER = 'info@tenderbriefing.co.za'
const SUPPORT_EMAIL = 'support@tenderbriefing.co.za'
const SITE_URL_DEFAULT = 'https://www.tenderbriefing.co.za'
const PREVIEW_MAX = 280
const IDEMPOTENCY_COLLECTION = 'notifications'

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

function buildIdempotencyKey(ingestId) {
  return `rfq-ingest:${String(ingestId || '').trim()}`
}

function idempotencyDocId(idempotencyKey) {
  const safe = String(idempotencyKey)
    .replace(/[^a-zA-Z0-9:_-]/g, '_')
    .slice(0, 120)
  return `rfq-ingest-idem-${safe}`
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

function sourceLabel(source) {
  const s = String(source || '').toLowerCase()
  if (s === 'manual_upload') return 'manual'
  if (s === 'email_forward') return 'email_forward'
  if (s.includes('webhook') || s === 'mailbox') return 'webhook'
  return s || 'unknown'
}

function boundedPreview(text, max = PREVIEW_MAX) {
  const cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max)}…`
}

/**
 * Build a safe, bounded summary for email / inbox (no full body dump, no secrets).
 */
function buildIngestNotifySummary(doc = {}) {
  const extraction = doc.extraction || {}
  const readiness = extraction.readiness || {}
  const missingFields = Array.isArray(readiness.missingFields)
    ? readiness.missingFields.slice(0, 12)
    : []
  const confidence =
    typeof readiness.confidence === 'number'
      ? readiness.confidence
      : typeof extraction.confidence === 'number'
        ? extraction.confidence
        : null
  const title =
    extraction.title ||
    doc.subject ||
    'Untitled RFQ'
  const submitter =
    doc.forwardedByEmail ||
    doc.fromEmail ||
    'unknown'
  const ingestId = doc.id || ''
  const inboxPath = '/admin/procurement-inbox'
  const inboxUrl = `${baseUrl()}${inboxPath}`
  const source = sourceLabel(doc.source)
  const status = doc.status || 'pending_review'
  const timestamp = doc.createdAt || new Date().toISOString()
  const preview = boundedPreview(doc.rawEmailText || doc.subject || '')

  return {
    ingestId,
    title: String(title).slice(0, 200),
    subject: String(doc.subject || '').slice(0, 200),
    submitterEmail: String(submitter).slice(0, 200),
    timestamp,
    confidence,
    status,
    missingFields,
    dispatchReadiness: readiness.dispatchReadiness || null,
    dispatchEligible: readiness.dispatchEligible === true,
    source,
    sourceRaw: doc.source || null,
    inboxPath,
    inboxUrl,
    preview,
    idempotencyKey: buildIdempotencyKey(ingestId),
  }
}

function buildEmailTemplate(summary) {
  const confPct =
    summary.confidence == null
      ? 'n/a'
      : `${Math.round(Number(summary.confidence) * 100)}%`
  const missing =
    summary.missingFields.length > 0
      ? summary.missingFields.join(', ')
      : 'none'
  const subject = `[RFQ inbox] New ingest — ${summary.title}`.slice(0, 180)

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
      <div style="background:#0F1E3D;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:18px;">New RFQ ingested</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;color:#334155;">
        <p style="margin:0 0 10px;"><strong>Title / subject:</strong> ${escapeHtml(summary.title)}</p>
        <p style="margin:0 0 10px;"><strong>Submitter:</strong> ${escapeHtml(summary.submitterEmail)}</p>
        <p style="margin:0 0 10px;"><strong>When:</strong> ${escapeHtml(summary.timestamp)}</p>
        <p style="margin:0 0 10px;"><strong>Source:</strong> ${escapeHtml(summary.source)}</p>
        <p style="margin:0 0 10px;"><strong>Status:</strong> ${escapeHtml(summary.status)}</p>
        <p style="margin:0 0 10px;"><strong>Confidence:</strong> ${escapeHtml(confPct)}</p>
        <p style="margin:0 0 10px;"><strong>Missing fields:</strong> ${escapeHtml(missing)}</p>
        <p style="margin:0 0 10px;"><strong>Ingest ID:</strong> ${escapeHtml(summary.ingestId)}</p>
        <p style="margin:16px 0 10px;">
          <a href="${escapeHtml(summary.inboxUrl)}" style="display:inline-block;background:#0F1E3D;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
            Open Procurement inbox
          </a>
        </p>
        ${
          summary.preview
            ? `<div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:8px;font-size:13px;color:#64748b;">
                <strong>Preview:</strong> ${escapeHtml(summary.preview)}
              </div>`
            : ''
        }
      </div>
    </div>
  `.trim()

  const text = [
    'New RFQ ingested',
    '',
    `Title / subject: ${summary.title}`,
    `Submitter: ${summary.submitterEmail}`,
    `When: ${summary.timestamp}`,
    `Source: ${summary.source}`,
    `Status: ${summary.status}`,
    `Confidence: ${confPct}`,
    `Missing fields: ${missing}`,
    `Ingest ID: ${summary.ingestId}`,
    `Inbox: ${summary.inboxUrl}`,
    summary.preview ? `\nPreview: ${summary.preview}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, html, text }
}

function getResendClient(env = process.env, ResendCtor = Resend) {
  const apiKey = (env.RESEND_API_KEY || '').trim()
  if (!apiKey) return null
  return new ResendCtor(apiKey)
}

async function claimIdempotency(db, idempotencyKey) {
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
    channel: 'rfq_ingest_notify',
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
      '[rfqIngestNotify] RESEND_API_KEY not set — skipping founder email for',
      summary.ingestId
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
  const confPct =
    summary.confidence == null
      ? 'n/a'
      : `${Math.round(Number(summary.confidence) * 100)}%`
  const missing =
    summary.missingFields.length > 0
      ? summary.missingFields.slice(0, 6).join(', ')
      : 'none'
  const saved = []
  for (const userId of adminIds) {
    if (!userId) continue
    const entry = await saveNotification({
      id: `rfq-ingest-inbox-${summary.ingestId}-${userId}`.slice(0, 120),
      eventType: 'rfq_ingested',
      userId,
      channel: 'inbox',
      title: 'New RFQ ingested',
      message: `${summary.title} · ${summary.submitterEmail} · conf ${confPct} · missing: ${missing}`.slice(
        0,
        400
      ),
      data: {
        ingestId: summary.ingestId,
        source: summary.source,
        inboxPath: summary.inboxPath,
        status: summary.status,
      },
      createdAt: new Date().toISOString(),
      read: false,
    })
    saved.push(entry)
  }
  return saved
}

/**
 * Notify founder/ops of a successful RFQ ingest. Never throws.
 */
async function notifyRfqIngested(doc, deps = {}) {
  const result = {
    notified: false,
    duplicate: false,
    email: null,
    inboxCount: 0,
    error: null,
  }

  try {
    if (!doc?.id) {
      result.error = 'missing_ingest_id'
      return result
    }

    const summary = buildIngestNotifySummary(doc)
    const getDb =
      deps.getFirestore ||
      (() => {
        const { getFirestore } = require('../../config/firebaseAdmin')
        return getFirestore()
      })

    let claim = { claimed: true, duplicate: false, ref: null }
    try {
      const db = getDb()
      claim = await claimIdempotency(db, summary.idempotencyKey)
      if (claim.duplicate) {
        result.duplicate = true
        return result
      }
    } catch (err) {
      // If Firestore idempotency is unavailable, still attempt one-shot notify
      console.error(
        '[rfqIngestNotify] idempotency claim failed:',
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
        getAdminUserIds:
          deps.getAdminUserIds ||
          (async () => {
            const { getFirestore } = require('../../config/firebaseAdmin')
            const db = getFirestore()
            const snapshot = await db.collection('users').where('userType', '==', 'admin').get()
            return snapshot.docs.map((d) => d.id)
          }),
        saveNotification:
          deps.saveNotification ||
          (() => {
            const storage = deps.storage || require('../storageAdapter').getStorage()
            return typeof storage.saveNotification === 'function'
              ? (n) => storage.saveNotification(n)
              : null
          })(),
      })
      result.inboxCount = inbox.length
    } catch (err) {
      console.error(
        '[rfqIngestNotify] inbox notify failed:',
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
    const message = err instanceof Error ? err.message : 'rfq ingest notify failed'
    console.error('[rfqIngestNotify] Unexpected error:', message.slice(0, 200))
    result.error = message.slice(0, 200)
    return result
  }
}

/**
 * Fire-and-forget wrapper for ingest pipeline. Never throws.
 */
async function notifyRfqIngestedSafe(doc, deps = {}) {
  try {
    return await notifyRfqIngested(doc, deps)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'notify failed'
    console.error('[rfqIngestNotify] Safe send caught:', message.slice(0, 200))
    return { notified: false, duplicate: false, email: null, inboxCount: 0, error: message.slice(0, 200) }
  }
}

module.exports = {
  PREVIEW_MAX,
  buildIdempotencyKey,
  idempotencyDocId,
  founderEmailAllowlist,
  sourceLabel,
  boundedPreview,
  buildIngestNotifySummary,
  buildEmailTemplate,
  notifyRfqIngested,
  notifyRfqIngestedSafe,
}
