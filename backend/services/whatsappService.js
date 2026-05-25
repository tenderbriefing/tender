/**
 * Twilio WhatsApp — centralized delivery layer for TenderBriefing.
 * Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (Cloud Run / Secret Manager).
 */
const crypto = require('crypto')
const { getFirestore } = require('../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

const NOTIFICATIONS_COLLECTION = 'notifications'
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const MAX_PER_RECIPIENT_PER_MINUTE = 3
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000

const rateLimitBuckets = new Map()

function env(name) {
  return (process.env[name] || '').trim()
}

function isConfigured() {
  return Boolean(
    env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && env('TWILIO_WHATSAPP_FROM')
  )
}

function getConfig() {
  return {
    configured: isConfigured(),
    from: env('TWILIO_WHATSAPP_FROM') ? maskFrom(env('TWILIO_WHATSAPP_FROM')) : null,
    missing: [
      !env('TWILIO_ACCOUNT_SID') && 'TWILIO_ACCOUNT_SID',
      !env('TWILIO_AUTH_TOKEN') && 'TWILIO_AUTH_TOKEN',
      !env('TWILIO_WHATSAPP_FROM') && 'TWILIO_WHATSAPP_FROM',
    ].filter(Boolean),
  }
}

function maskFrom(from) {
  const s = String(from)
  if (s.length < 8) return 'whatsapp:***'
  return `${s.slice(0, 12)}***`
}

/**
 * Validate and normalize to E.164 digits (no whatsapp: prefix).
 */
function validateWhatsAppNumber(raw) {
  if (!raw || typeof raw !== 'string') {
    return { ok: false, error: 'Phone number is required' }
  }
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`
  if (!digits.startsWith('+')) {
    if (digits.startsWith('0') && digits.length >= 9) {
      digits = `+27${digits.slice(1)}`
    } else if (digits.length >= 9) {
      digits = `+${digits}`
    }
  }
  const normalized = digits.replace(/\s/g, '')
  if (!/^\+[1-9]\d{8,14}$/.test(normalized)) {
    return { ok: false, error: 'Invalid WhatsApp number format (use E.164, e.g. +27821234567)' }
  }
  return { ok: true, e164: normalized }
}

function toTwilioWhatsAppAddress(e164) {
  const addr = e164.startsWith('whatsapp:') ? e164 : `whatsapp:${e164}`
  return addr
}

function fromAddress() {
  const from = env('TWILIO_WHATSAPP_FROM') || 'whatsapp:+14155238886'
  return from.startsWith('whatsapp:') ? from : `whatsapp:${from}`
}

function checkInMemoryRateLimit(e164) {
  const now = Date.now()
  const key = e164
  const bucket = rateLimitBuckets.get(key) || []
  const recent = bucket.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= MAX_PER_RECIPIENT_PER_MINUTE) {
    return { ok: false, error: 'Rate limit exceeded for recipient' }
  }
  recent.push(now)
  rateLimitBuckets.set(key, recent)
  return { ok: true }
}

function idempotencyDocId(idempotencyKey) {
  const safe = String(idempotencyKey).replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 120)
  return `wa-idem-${safe}`
}

async function hasRecentIdempotency(idempotencyKey) {
  if (!idempotencyKey) return false
  try {
    const db = getFirestore()
    const ref = db.collection(NOTIFICATIONS_COLLECTION).doc(idempotencyDocId(idempotencyKey))
    const doc = await ref.get()
    if (!doc.exists) return false
    const data = doc.data()
    const since = Date.now() - IDEMPOTENCY_TTL_MS
    const at = new Date(data.sentAt || data.createdAt || 0).getTime()
    return data.status === 'sent' && at >= since
  } catch {
    return false
  }
}

async function markIdempotencySent(idempotencyKey) {
  if (!idempotencyKey) return
  const db = getFirestore()
  await db
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(idempotencyDocId(idempotencyKey))
    .set(
      sanitizeFirestoreData({
        channel: 'whatsapp',
        type: 'idempotency_marker',
        idempotencyKey,
        status: 'sent',
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }),
      { merge: true }
    )
}

async function saveDeliveryLog(entry) {
  const db = getFirestore()
  const docId =
    entry.id || `wa-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  const payload = sanitizeFirestoreData({
    ...entry,
    id: docId,
    channel: 'whatsapp',
    createdAt: entry.createdAt || new Date().toISOString(),
  })
  await db.collection(NOTIFICATIONS_COLLECTION).doc(docId).set(payload, { merge: true })
  return payload
}

function logStructured(level, fields) {
  const safe = { ...fields }
  delete safe.authToken
  delete safe.body
  console.log(
    JSON.stringify({
      service: 'whatsappService',
      level,
      at: new Date().toISOString(),
      ...safe,
    })
  )
}

/**
 * Send a WhatsApp message via Twilio REST API.
 * @param {string} to - E.164 or local ZA number
 * @param {string} body - Message text
 * @param {object} [options]
 * @param {string} [options.idempotencyKey]
 * @param {string} [options.type]
 * @param {string} [options.recipientRole]
 * @param {string} [options.recipientId]
 * @param {object} [options.metadata]
 */
async function sendWhatsAppMessage(to, body, options = {}) {
  const validated = validateWhatsAppNumber(to)
  if (!validated.ok) {
    return { ok: false, error: validated.error, skipped: true }
  }

  const e164 = validated.e164
  const idempotencyKey = options.idempotencyKey || null

  if (idempotencyKey && (await hasRecentIdempotency(idempotencyKey))) {
    logStructured('info', { event: 'duplicate_skipped', idempotencyKey, to: maskPhone(e164) })
    return { ok: true, duplicate: true, skipped: true }
  }

  const rate = checkInMemoryRateLimit(e164)
  if (!rate.ok) {
    await saveDeliveryLog({
      type: options.type || 'generic',
      recipientRole: options.recipientRole || 'unknown',
      recipientId: options.recipientId || null,
      message: body,
      status: 'failed',
      error: rate.error,
      idempotencyKey,
      metadata: options.metadata || {},
      to: e164,
    })
    return { ok: false, error: rate.error }
  }

  const pendingLog = await saveDeliveryLog({
    type: options.type || 'generic',
    recipientRole: options.recipientRole || 'unknown',
    recipientId: options.recipientId || null,
    message: body,
    status: 'pending',
    idempotencyKey,
    metadata: options.metadata || {},
    to: e164,
  })

  if (!isConfigured()) {
    const updated = await saveDeliveryLog({
      ...pendingLog,
      status: 'skipped',
      error: 'Twilio WhatsApp not configured',
    })
    logStructured('warn', { event: 'not_configured', to: maskPhone(e164) })
    return { ok: false, skipped: true, reason: 'not_configured', log: updated }
  }

  const accountSid = env('TWILIO_ACCOUNT_SID')
  const authToken = env('TWILIO_AUTH_TOKEN')
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const params = new URLSearchParams({
    From: fromAddress(),
    To: toTwilioWhatsAppAddress(e164),
    Body: String(body).slice(0, 1600),
  })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const errMsg = data.message || `Twilio HTTP ${response.status}`
      const failed = await saveDeliveryLog({
        ...pendingLog,
        status: 'failed',
        error: errMsg,
        metadata: {
          ...(options.metadata || {}),
          twilioCode: data.code,
          twilioStatus: data.status,
        },
      })
      logStructured('error', {
        event: 'send_failed',
        to: maskPhone(e164),
        code: data.code,
        status: response.status,
      })
      return { ok: false, error: errMsg, log: failed }
    }

    const sent = await saveDeliveryLog({
      ...pendingLog,
      status: 'sent',
      sentAt: new Date().toISOString(),
      error: null,
      metadata: {
        ...(options.metadata || {}),
        twilioSid: data.sid,
        twilioStatus: data.status,
      },
    })
    if (idempotencyKey) await markIdempotencySent(idempotencyKey)
    logStructured('info', {
      event: 'sent',
      to: maskPhone(e164),
      sid: data.sid,
      type: options.type,
    })
    return { ok: true, sid: data.sid, log: sent }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Twilio request failed'
    const failed = await saveDeliveryLog({
      ...pendingLog,
      status: 'failed',
      error: errMsg,
    })
    logStructured('error', { event: 'send_exception', to: maskPhone(e164), error: errMsg })
    return { ok: false, error: errMsg, log: failed }
  }
}

function maskPhone(e164) {
  if (!e164 || e164.length < 6) return '***'
  return `${e164.slice(0, 4)}***${e164.slice(-2)}`
}

async function getWhatsAppStats(limit = 50) {
  try {
    const db = getFirestore()
    const snap = await db
      .collection(NOTIFICATIONS_COLLECTION)
      .where('channel', '==', 'whatsapp')
      .limit(200)
      .get()
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

    const sent = items.filter((i) => i.status === 'sent').length
    const failed = items.filter((i) => i.status === 'failed').length
    const pending = items.filter((i) => i.status === 'pending' || i.status === 'skipped').length

    return {
      sent,
      failed,
      pending,
      total: items.length,
      latest: items.slice(0, limit),
      lastSentAt: items.find((i) => i.sentAt)?.sentAt || null,
    }
  } catch (error) {
    return {
      sent: 0,
      failed: 0,
      pending: 0,
      total: 0,
      latest: [],
      error: error.message,
    }
  }
}

async function healthCheck() {
  const config = getConfig()
  if (!config.configured) {
    return {
      id: 'twilio-whatsapp',
      name: 'Twilio WhatsApp',
      status: 'missing',
      missing: config.missing,
      setupNotes: 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in Secret Manager.',
      lastChecked: new Date().toISOString(),
    }
  }
  return {
    id: 'twilio-whatsapp',
    name: 'Twilio WhatsApp',
    status: 'configured',
    from: config.from,
    lastChecked: new Date().toISOString(),
  }
}

module.exports = {
  isConfigured,
  getConfig,
  validateWhatsAppNumber,
  sendWhatsAppMessage,
  saveDeliveryLog,
  getWhatsAppStats,
  healthCheck,
  toTwilioWhatsAppAddress,
  fromAddress,
}
