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

async function createCheckout({
  amountInCents,
  currency = 'ZAR',
  externalId,
  successUrl,
  cancelUrl,
  metadata = {},
}) {
  const secretKey = env('YOCO_SECRET_KEY')
  if (!secretKey) {
    return { ok: false, skipped: true, reason: 'YOCO_SECRET_KEY not configured' }
  }

  const payload = {
    amount: amountInCents,
    currency,
    metadata: { externalId, ...metadata },
    successUrl,
    cancelUrl,
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
      return { ok: false, error: data.message || `Yoco HTTP ${response.status}` }
    }
    return { ok: true, checkout: data }
  } catch (error) {
    return { ok: false, error: error.message || 'Yoco checkout failed' }
  }
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = env('YOCO_WEBHOOK_SECRET')
  if (!secret) {
    return { ok: false, skipped: true, reason: 'YOCO_WEBHOOK_SECRET not configured' }
  }
  if (!signatureHeader) {
    return { ok: false, reason: 'Missing signature header' }
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

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
  verifyWebhookSignature,
  handleWebhookPayload,
  healthCheck,
}
