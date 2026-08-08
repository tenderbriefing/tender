/**
 * Resilient HTTP client for the eTenders OCDS API.
 *
 * Node/undici defaults to a 10s TCP connect timeout. From Cloud Run
 * (africa-south1) that host can be slow to accept TLS, which surfaces as:
 *   fetch failed (Connect Timeout Error (... timeout: 10000ms))
 *
 * We raise the connect timeout, keep a bounded overall request budget, and
 * retry idempotent GETs on transient network / gateway failures.
 */

const { Agent, fetch: undiciFetch } = require('undici')

const DEFAULT_OCDS_API_BASE = 'https://ocds-api.etenders.gov.za/api/OCDSReleases'

/** TCP connect budget — above undici's 10s default, below Cloud Run route max. */
const CONNECT_TIMEOUT_MS = 25_000
/** Full request abort (headers + body) after connect succeeds. */
const REQUEST_TIMEOUT_MS = 120_000
/** Bounded retries for idempotent GETs (total attempts = 1 + retries). */
const MAX_ATTEMPTS = 3
const BACKOFF_BASE_MS = 1_000
const BACKOFF_MAX_MS = 8_000
const RETRYABLE_STATUS = new Set([429, 502, 503, 504])

const RETRYABLE_ERROR_CODES = new Set([
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETDOWN',
  'ENETUNREACH',
  'EHOSTDOWN',
  'EHOSTUNREACH',
  'EAI_AGAIN',
])

let sharedDispatcher = null

function getOcdsApiBase() {
  const fromEnv = String(process.env.OCDS_API_BASE || '').trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  return DEFAULT_OCDS_API_BASE
}

function createOcdsDispatcher(options = {}) {
  const connectTimeoutMs = options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS
  const requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS
  return new Agent({
    connect: { timeout: connectTimeoutMs },
    headersTimeout: requestTimeoutMs,
    bodyTimeout: requestTimeoutMs,
  })
}

function getSharedDispatcher() {
  if (!sharedDispatcher) {
    sharedDispatcher = createOcdsDispatcher()
  }
  return sharedDispatcher
}

/** Test helper — reset pooled agent between unit tests. */
function resetSharedDispatcher() {
  const previous = sharedDispatcher
  sharedDispatcher = null
  if (previous && typeof previous.destroy === 'function') {
    previous.destroy().catch(() => {})
  }
}

function collectErrorSignals(error) {
  const parts = []
  let current = error
  let depth = 0
  while (current && depth < 5) {
    if (current.code) parts.push(String(current.code))
    if (current.name) parts.push(String(current.name))
    if (current.message) parts.push(String(current.message))
    current = current.cause
    depth += 1
  }
  return parts.join(' ').toLowerCase()
}

function isRetryableFetchError(error) {
  if (!error) return false

  let current = error
  let depth = 0
  while (current && depth < 5) {
    if (current.code && RETRYABLE_ERROR_CODES.has(String(current.code))) return true
    current = current.cause
    depth += 1
  }

  const signals = collectErrorSignals(error)
  return (
    signals.includes('connect timeout') ||
    signals.includes('headers timeout') ||
    signals.includes('body timeout') ||
    signals.includes('fetch failed') ||
    signals.includes('network') ||
    signals.includes('socket') ||
    signals.includes('econnreset') ||
    signals.includes('etimedout') ||
    signals.includes('enotfound')
  )
}

function isRetryableStatus(status) {
  return RETRYABLE_STATUS.has(Number(status))
}

function formatFetchError(error) {
  const cause = error?.cause?.message || error?.cause?.code
  return cause ? `${error.message} (${cause})` : error?.message || String(error)
}

function backoffMs(attempt, baseMs = BACKOFF_BASE_MS, maxMs = BACKOFF_MAX_MS) {
  const exp = Math.min(maxMs, baseMs * 2 ** (attempt - 1))
  const jitter = Math.floor(Math.random() * Math.min(250, exp * 0.1))
  return exp + jitter
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * GET with connect-timeout override + bounded backoff retries.
 * Inject `fetchImpl` / `sleepFn` / `dispatcher` in tests.
 */
async function fetchWithRetry(url, options = {}) {
  const fetchImpl = options.fetchImpl || undiciFetch
  const dispatcher = options.dispatcher ?? getSharedDispatcher()
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS
  const requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS
  const sleepFn = options.sleepFn || sleep
  const headers = options.headers || { Accept: 'application/json' }

  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers,
        dispatcher,
        signal: AbortSignal.timeout(requestTimeoutMs),
      })

      if (isRetryableStatus(response.status) && attempt < maxAttempts) {
        // Drain body so the socket can be reused; ignore drain failures.
        await response.arrayBuffer().catch(() => {})
        await sleepFn(backoffMs(attempt))
        continue
      }

      return response
    } catch (error) {
      lastError = error
      if (!isRetryableFetchError(error) || attempt >= maxAttempts) {
        if (attempt > 1 && isRetryableFetchError(error)) {
          const detail = formatFetchError(error)
          throw Object.assign(
            new Error(`OCDS fetch failed after ${attempt} attempts: ${detail}`),
            { cause: error }
          )
        }
        throw error
      }
      await sleepFn(backoffMs(attempt))
    }
  }

  const detail = formatFetchError(lastError)
  throw Object.assign(new Error(`OCDS fetch failed after ${maxAttempts} attempts: ${detail}`), {
    cause: lastError,
  })
}

module.exports = {
  DEFAULT_OCDS_API_BASE,
  CONNECT_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  MAX_ATTEMPTS,
  getOcdsApiBase,
  createOcdsDispatcher,
  getSharedDispatcher,
  resetSharedDispatcher,
  isRetryableFetchError,
  isRetryableStatus,
  formatFetchError,
  backoffMs,
  fetchWithRetry,
}
