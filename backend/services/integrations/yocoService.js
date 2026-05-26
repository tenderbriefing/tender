const crypto = require('crypto')
const { env, hasEnv, checkRequired, integrationResult, statusFromConfig } = require('./integrationConfig')

const REQUIRED_ENV = ['YOCO_SECRET_KEY']
const YOCO_API_BASE = 'https://payments.yoco.com/api'

function getConfig() {
  const secret = checkRequired(['YOCO_SECRET_KEY'])
  return {
    configured: secret.configured,
    missing: secret.missing,
    webhookConfigured: hasEnv('YOCO_WEBHOOK_SECRET'),
  }
}

function getStatus() {
  const config = getConfig()
  return integrationResult({
    id: 'yoco',
    name: 'Yoco Payments',
    status: statusFromConfig(config.configured),
    requiredEnv: [...REQUIRED_ENV, 'YOCO_WEBHOOK_SECRET'],
    missing: config.missing,
    setupNotes:
      'Register webhook POST /api/webhooks/yoco in Yoco dashboard. Use test keys in staging only.',
  })
}

/**
 * Create a Yoco hosted checkout session.
 * @param {object} params
 * @param {number} params.amount - Amount in cents (e.g. 24900 = R249.00)
 * @param {string} [params.currency]
 * @param {string} params.successUrl
 * @param {string} params.cancelUrl
 * @param {string} [params.failureUrl]
 * @param {Record<string, string>} [params.metadata] - Yoco requires string values
 */
async function createCheckout({
  amount,
  currency = 'ZAR',
  successUrl,
  cancelUrl,
  failureUrl,
  metadata = {},
}) {
  const secretKey = env('YOCO_SECRET_KEY')
  if (!secretKey) {
    return { ok: false, skipped: true, reason: 'YOCO_SECRET_KEY not configured' }
  }

  const stringMetadata = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined && value !== null) {
      stringMetadata[key] = String(value)
    }
  }

  const payload = {
    amount,
    currency,
    metadata: stringMetadata,
    successRedirectUrl: successUrl,
    cancelRedirectUrl: cancelUrl,
  }
  if (failureUrl) {
    payload.failureRedirectUrl = failureUrl
  }

  try {
    const response = await fetch(`${YOCO_API_BASE}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, error: data.message || data.error || `Yoco HTTP ${response.status}` }
    }
    return { ok: true, checkout: data }
  } catch (error) {
    return { ok: false, error: error.message || 'Yoco checkout failed' }
  }
}

async function getCheckout(checkoutId) {
  const secretKey = env('YOCO_SECRET_KEY')
  if (!secretKey) {
    return { ok: false, skipped: true, reason: 'YOCO_SECRET_KEY not configured' }
  }
  if (!checkoutId) {
    return { ok: false, error: 'checkoutId required' }
  }

  try {
    const response = await fetch(`${YOCO_API_BASE}/checkouts/${checkoutId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, error: data.message || `Yoco HTTP ${response.status}` }
    }
    return { ok: true, checkout: data }
  } catch (error) {
    return { ok: false, error: error.message || 'Yoco get checkout failed' }
  }
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = env('YOCO_WEBHOOK_SECRET')
  if (!secret) {
    const isProduction = process.env.NODE_ENV === 'production'
    return {
      ok: false,
      skipped: !isProduction,
      reason: isProduction
        ? 'YOCO_WEBHOOK_SECRET required in production'
        : 'YOCO_WEBHOOK_SECRET not configured',
    }
  }
  if (!signatureHeader) {
    return { ok: false, reason: 'Missing signature header' }
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  const provided = String(signatureHeader).replace(/^sha256=/, '')
  let valid = false
  try {
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(provided, 'utf8')
    valid = a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    valid = false
  }

  return { ok: valid, reason: valid ? undefined : 'Invalid webhook signature' }
}

function handleWebhookPayload(body) {
  return {
    ok: true,
    received: true,
    type: body?.type || body?.event || 'unknown',
    payload: body,
  }
}

async function healthCheck() {
  return getStatus()
}

module.exports = {
  REQUIRED_ENV,
  getConfig,
  getStatus,
  createCheckout,
  getCheckout,
  verifyWebhookSignature,
  handleWebhookPayload,
  healthCheck,
}
