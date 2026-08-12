const crypto = require('crypto')
const { env, hasEnv, checkRequired, integrationResult, statusFromConfig } = require('./integrationConfig')

const REQUIRED_ENV = ['PAYFAST_MERCHANT_ID', 'PAYFAST_MERCHANT_KEY', 'PAYFAST_PASSPHRASE']

/** Field order for hosted checkout signatures (PayFast custom integration attribute order). */
const CHECKOUT_FIELD_ORDER = [
  'merchant_id',
  'merchant_key',
  'return_url',
  'cancel_url',
  'notify_url',
  'name_first',
  'name_last',
  'email_address',
  'cell_number',
  'm_payment_id',
  'amount',
  'item_name',
  'item_description',
  'custom_int1',
  'custom_int2',
  'custom_int3',
  'custom_int4',
  'custom_int5',
  'custom_str1',
  'custom_str2',
  'custom_str3',
  'custom_str4',
  'custom_str5',
  'email_confirmation',
  'confirmation_address',
  'payment_method',
]

function isSandbox() {
  const mode = String(env('PAYFAST_MODE') || process.env.PAYFAST_SANDBOX || '').toLowerCase()
  return mode === 'sandbox' || mode === 'test' || mode === 'true' || mode === '1'
}

function processUrl() {
  return isSandbox()
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process'
}

function validateUrl() {
  return isSandbox()
    ? 'https://sandbox.payfast.co.za/eng/query/validate'
    : 'https://www.payfast.co.za/eng/query/validate'
}

/**
 * PayFast PHP-compatible URL encoding: spaces as +, hex uppercase.
 */
function pfEncode(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/%20/g, '+')
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function getConfig() {
  const required = checkRequired(REQUIRED_ENV)
  return {
    configured: required.configured,
    missing: required.missing,
    sandbox: isSandbox(),
    processUrl: processUrl(),
  }
}

function getStatus() {
  const config = getConfig()
  const merchantEmailConfigured = Boolean(String(env('PAYFAST_MERCHANT_EMAIL') || '').trim())
  return integrationResult({
    id: 'payfast',
    name: 'PayFast Payments',
    status: statusFromConfig(config.configured),
    requiredEnv: [...REQUIRED_ENV, 'PAYFAST_MODE'],
    missing: config.missing,
    merchantEmailConfigured,
    setupNotes: [
      config.sandbox
        ? 'Sandbox mode — register ITN notify_url to /api/webhooks/payfast'
        : 'Live mode — register ITN notify_url https://www.tenderbriefing.co.za/api/webhooks/payfast',
      merchantEmailConfigured
        ? 'PAYFAST_MERCHANT_EMAIL set — same-account email omit guard active'
        : 'PAYFAST_MERCHANT_EMAIL unset — same-account prefill guard inactive',
    ].join('; '),
  })
}

/**
 * Build MD5 signature for outbound checkout fields (attribute order, empty skipped).
 */
function generateSignature(fields, passphrase) {
  const parts = []
  for (const key of CHECKOUT_FIELD_ORDER) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      const value = fields[key]
      if (value === undefined || value === null || String(value).trim() === '') continue
      parts.push(`${key}=${pfEncode(value)}`)
    }
  }
  let paramString = parts.join('&')
  const phrase = passphrase || env('PAYFAST_PASSPHRASE')
  if (phrase) {
    paramString += `&passphrase=${pfEncode(phrase)}`
  }
  return crypto.createHash('md5').update(paramString).digest('hex')
}

/**
 * Verify ITN signature — PayFast ITN algorithm (not checkout):
 * - Use posted key order up to (but not including) `signature`
 * - Include empty string fields (checkout signatures skip empties; ITN does not)
 * - Append passphrase when configured
 * Docs: Instant Transaction Notification → Verify the signature
 */
function verifyItnSignature(posted, passphrase) {
  if (!posted || typeof posted !== 'object') {
    return { ok: false, reason: 'Empty ITN payload' }
  }
  const received = String(posted.signature || '').toLowerCase()
  if (!received) {
    return { ok: false, reason: 'Missing ITN signature' }
  }

  const phrase = passphrase || env('PAYFAST_PASSPHRASE')
  if (!phrase && process.env.NODE_ENV === 'production') {
    return { ok: false, reason: 'PAYFAST_PASSPHRASE required in production' }
  }

  let paramString = ''
  for (const [key, value] of Object.entries(posted)) {
    if (key === 'signature') break
    const raw = value === undefined || value === null ? '' : String(value)
    paramString += `${key}=${pfEncode(raw)}&`
  }
  paramString = paramString.slice(0, -1)
  if (phrase) {
    paramString += `&passphrase=${pfEncode(phrase)}`
  }

  const expected = crypto.createHash('md5').update(paramString).digest('hex')
  const valid = expected === received
  return { ok: valid, reason: valid ? undefined : 'Invalid ITN signature', expected }
}

/**
 * Ask PayFast to confirm ITN payload validity.
 */
async function validateItnWithPayfast(posted) {
  try {
    const body = new URLSearchParams()
    for (const [key, value] of Object.entries(posted)) {
      if (value === undefined || value === null) continue
      body.append(key, String(value))
    }
    const response = await fetch(validateUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const text = (await response.text()).trim()
    return { ok: text.startsWith('VALID'), raw: text }
  } catch (error) {
    return { ok: false, raw: error instanceof Error ? error.message : 'validate failed' }
  }
}

function apiBaseUrl() {
  return 'https://api.payfast.co.za'
}

/**
 * PayFast API signature (alphabetical keys, non-empty only) — not ITN/checkout format.
 */
function generateApiSignature(fields, passphrase) {
  const phrase = passphrase || env('PAYFAST_PASSPHRASE')
  const data = { ...fields }
  if (phrase) data.passphrase = phrase
  const parts = []
  for (const key of Object.keys(data).sort()) {
    const value = data[key]
    if (value === undefined || value === null || String(value) === '') continue
    parts.push(`${key}=${pfEncode(value)}`)
  }
  return crypto.createHash('md5').update(parts.join('&')).digest('hex')
}

/**
 * Authoritative transaction query by pf_payment_id (PayFast process/query API).
 * Never logs secrets. Returns COMPLETE/amount/m_payment_id when available.
 */
async function queryTransactionByPfPaymentId(pfPaymentId) {
  const merchantId = String(env('PAYFAST_MERCHANT_ID') || '').trim()
  const phrase = env('PAYFAST_PASSPHRASE')
  if (!merchantId || !phrase) {
    return { ok: false, reason: 'PayFast merchant credentials not configured' }
  }
  const id = String(pfPaymentId || '').trim()
  if (!/^\d+$/.test(id)) {
    return { ok: false, reason: 'Invalid pf_payment_id' }
  }

  const timestamp = new Date().toISOString().split('.')[0]
  const headerFields = {
    'merchant-id': merchantId,
    version: 'v1',
    timestamp,
  }
  const signature = generateApiSignature(headerFields, phrase)

  try {
    const response = await fetch(`${apiBaseUrl()}/process/query/${id}`, {
      method: 'GET',
      headers: {
        'merchant-id': merchantId,
        version: 'v1',
        timestamp,
        signature,
      },
    })
    const text = await response.text()
    let json
    try {
      json = JSON.parse(text)
    } catch {
      return { ok: false, reason: 'PayFast query returned non-JSON', raw: text.slice(0, 200) }
    }
    const row = json?.data?.response
    if (!response.ok || !row) {
      return {
        ok: false,
        reason: json?.data?.message || json?.status || `HTTP ${response.status}`,
        raw: text.slice(0, 200),
      }
    }
    return {
      ok: true,
      pfPaymentId: String(row.pf_payment_id ?? id),
      mPaymentId: row.m_payment_id != null ? String(row.m_payment_id) : null,
      status: String(row.status || '').toUpperCase(),
      amountCents: Number(row.amount),
      transactionToken: row.transaction_token || null,
    }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'PayFast query failed',
    }
  }
}

/**
 * Build signed PayFast checkout fields for R249 attendance fee.
 */
function createCheckoutPayload({
  amountCents,
  mPaymentId,
  itemName,
  itemDescription,
  returnUrl,
  cancelUrl,
  notifyUrl,
  email,
  nameFirst,
  nameLast,
  cellNumber,
  customStr1,
  customStr2,
  customStr3,
}) {
  const config = getConfig()
  if (!config.configured) {
    return {
      ok: false,
      skipped: true,
      reason: `PayFast not configured (missing: ${config.missing.join(', ')})`,
    }
  }

  const merchantId = env('PAYFAST_MERCHANT_ID')
  const merchantKey = env('PAYFAST_MERCHANT_KEY')
  const amountZar = (Number(amountCents) / 100).toFixed(2)

  const fields = {
    merchant_id: String(merchantId),
    merchant_key: String(merchantKey),
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    m_payment_id: String(mPaymentId),
    amount: amountZar,
    item_name: String(itemName || 'TenderBriefing attendance support').slice(0, 100),
  }

  if (itemDescription) fields.item_description = String(itemDescription).slice(0, 255)
  // PayFast rejects checkout when payer email matches the merchant profile email
  // ("unable to receive payments from the same account"). Omit colliding email so
  // the hosted page can collect a different payer address. Still blocked if the
  // user logs into PayFast with the merchant account.
  const buyerEmail = email ? String(email).trim().slice(0, 100) : ''
  const merchantEmail = String(env('PAYFAST_MERCHANT_EMAIL') || '').trim().toLowerCase()
  if (buyerEmail) {
    if (!merchantEmail && process.env.NODE_ENV === 'production') {
      console.warn(
        '[payfast] PAYFAST_MERCHANT_EMAIL unset — cannot omit colliding merchant buyer email'
      )
    }
    if (merchantEmail && buyerEmail.toLowerCase() === merchantEmail) {
      console.warn(
        '[payfast] omitting email_address: buyer email matches PAYFAST_MERCHANT_EMAIL (same-account risk)'
      )
    } else {
      fields.email_address = buyerEmail
    }
  }
  if (nameFirst) fields.name_first = String(nameFirst).slice(0, 100)
  if (nameLast) fields.name_last = String(nameLast).slice(0, 100)
  if (cellNumber) fields.cell_number = String(cellNumber).replace(/\D/g, '').slice(0, 20)
  if (customStr1) fields.custom_str1 = String(customStr1).slice(0, 255)
  if (customStr2) fields.custom_str2 = String(customStr2).slice(0, 255)
  if (customStr3) fields.custom_str3 = String(customStr3).slice(0, 255)

  fields.signature = generateSignature(fields)

  return {
    ok: true,
    formAction: processUrl(),
    fields,
    sandbox: config.sandbox,
  }
}

async function healthCheck() {
  return getStatus()
}

module.exports = {
  REQUIRED_ENV,
  getConfig,
  getStatus,
  pfEncode,
  generateSignature,
  verifyItnSignature,
  validateItnWithPayfast,
  generateApiSignature,
  queryTransactionByPfPaymentId,
  createCheckoutPayload,
  processUrl,
  validateUrl,
  isSandbox,
  healthCheck,
}
