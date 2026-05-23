const { env, hasEnv, checkRequired, integrationResult, statusFromConfig } = require('./integrationConfig')

const REQUIRED_ENV = [
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_VERIFY_TOKEN',
]

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

function getConfig() {
  return checkRequired(REQUIRED_ENV)
}

function getStatus() {
  const config = getConfig()
  return integrationResult({
    id: 'whatsapp',
    name: 'WhatsApp Business API',
    status: statusFromConfig(config.configured),
    requiredEnv: REQUIRED_ENV,
    missing: config.missing,
    setupNotes:
      'Create a Meta Business app, add WhatsApp product, and set webhook URL to /api/webhooks/whatsapp.',
  })
}

async function graphRequest(path, body) {
  const token = env('WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = env('WHATSAPP_PHONE_NUMBER_ID')
  if (!token || !phoneNumberId) {
    return { ok: false, skipped: true, reason: 'WhatsApp credentials not configured' }
  }

  const url = `${GRAPH_BASE}/${phoneNumberId}${path}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { ok: false, error: data.error?.message || `WhatsApp API HTTP ${response.status}` }
  }
  return { ok: true, data }
}

async function sendTextMessage(to, text) {
  if (!hasEnv('WHATSAPP_ACCESS_TOKEN') || !hasEnv('WHATSAPP_PHONE_NUMBER_ID')) {
    return { ok: false, skipped: true, reason: 'WhatsApp not configured' }
  }
  return graphRequest('/messages', {
    messaging_product: 'whatsapp',
    to: String(to).replace(/\D/g, ''),
    type: 'text',
    text: { body: text },
  })
}

async function sendTemplateMessage(to, templateName, languageCode = 'en', components = []) {
  if (!hasEnv('WHATSAPP_ACCESS_TOKEN') || !hasEnv('WHATSAPP_PHONE_NUMBER_ID')) {
    return { ok: false, skipped: true, reason: 'WhatsApp not configured' }
  }
  return graphRequest('/messages', {
    messaging_product: 'whatsapp',
    to: String(to).replace(/\D/g, ''),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  })
}

function verifyWebhook(mode, token, challenge) {
  if (mode !== 'subscribe') {
    return { ok: false, reason: 'Invalid hub.mode' }
  }
  const expected = env('WHATSAPP_VERIFY_TOKEN')
  if (!expected) {
    return { ok: false, reason: 'WHATSAPP_VERIFY_TOKEN not configured' }
  }
  if (token !== expected) {
    return { ok: false, reason: 'Verify token mismatch' }
  }
  return { ok: true, challenge }
}

function handleWebhookPayload(body) {
  return {
    ok: true,
    received: true,
    entries: Array.isArray(body?.entry) ? body.entry.length : 0,
  }
}

async function healthCheck() {
  const status = getStatus()
  return status
}

module.exports = {
  REQUIRED_ENV,
  getConfig,
  getStatus,
  sendTextMessage,
  sendTemplateMessage,
  verifyWebhook,
  handleWebhookPayload,
  healthCheck,
}
