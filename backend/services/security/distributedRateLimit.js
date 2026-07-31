/**
 * Shared (cross-instance) rate limiter using Firestore transactions.
 * Prefer Cloud Armor at the edge for volumetric DDoS; this protects app-level abuse.
 *
 * Admin SDK writes (bypasses client rules). Collection: rateLimitBuckets/{bucketKey}
 */

const { logEvent } = require('../observabilityBridge')

function getDb() {
  try {
    const adminCfg = require('../../config/firebaseAdmin')
    if (typeof adminCfg.getFirestore === 'function') return adminCfg.getFirestore()
    if (adminCfg.db) return adminCfg.db
    if (adminCfg.firestore) return adminCfg.firestore()
  } catch {
    /* fall through */
  }
  return null
}

/**
 * @param {string} key
 * @param {number} limit
 * @param {number} windowMs
 * @returns {Promise<{ allowed: boolean, retryAfterSec?: number }>}
 */
async function checkDistributedRateLimit(key, limit, windowMs) {
  if (process.env.RATE_LIMIT_BACKEND === 'memory') {
    // Explicit memory mode for unit tests / single-instance local
    try {
      const { checkRateLimit } = require('../../../lib/security/rateLimit')
      return checkRateLimit(key, limit, windowMs)
    } catch {
      return memoryFallback(key, limit, windowMs)
    }
  }

  const db = getDb()
  if (!db) {
    if (/payment|booking|attendance|admin|auth|webhook/.test(key)) {
      // Prefer memory fallback over hard fail when Admin SDK not initialized (tests)
      return memoryFallback(key, limit, windowMs)
    }
    return memoryFallback(key, limit, windowMs)
  }

  const ref = db.collection('rateLimitBuckets').doc(encodeURIComponent(key).slice(0, 700))
  const now = Date.now()

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const data = snap.exists ? snap.data() : null
      if (!data || !data.resetAt || data.resetAt <= now) {
        tx.set(ref, { count: 1, resetAt: now + windowMs, updatedAt: now })
        return { allowed: true }
      }
      if (data.count >= limit) {
        return {
          allowed: false,
          retryAfterSec: Math.max(1, Math.ceil((data.resetAt - now) / 1000)),
        }
      }
      tx.update(ref, { count: (data.count || 0) + 1, updatedAt: now })
      return { allowed: true }
    })

    if (!result.allowed) {
      logEvent({
        event: 'rate_limit_exceeded',
        severity: 'warn',
        outcome: 'denied',
        errorCode: key.split(':')[0] || 'rate_limit',
      })
    }
    return result
  } catch (error) {
    logEvent({
      event: 'rate_limit_backend_error',
      severity: 'error',
      outcome: 'failure',
      errorCode: error instanceof Error ? error.message : 'unknown',
    })
    return memoryFallback(key, limit, windowMs)
  }
}

const memoryBuckets = new Map()

function memoryFallback(key, limit, windowMs) {
  const now = Date.now()
  const bucket = memoryBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }
  bucket.count += 1
  return { allowed: true }
}

const POLICIES = {
  'public-tenders': { limit: 120, windowMs: 60_000 },
  'attendance-create': { limit: 10, windowMs: 60_000 },
  'payment-create': { limit: 10, windowMs: 60_000 },
  'pdf-download': { limit: 30, windowMs: 60_000 },
  'webhook-whatsapp': { limit: 120, windowMs: 60_000 },
  'webhook-payfast': { limit: 600, windowMs: 60_000 },
  'admin-mutate': { limit: 60, windowMs: 60_000 },
  'auth-sensitive': { limit: 30, windowMs: 60_000 },
}

async function enforcePolicy(policyName, scopeKey) {
  const policy = POLICIES[policyName] || { limit: 60, windowMs: 60_000 }
  return checkDistributedRateLimit(`${policyName}:${scopeKey}`, policy.limit, policy.windowMs)
}

module.exports = {
  checkDistributedRateLimit,
  enforcePolicy,
  POLICIES,
  memoryFallback,
}
