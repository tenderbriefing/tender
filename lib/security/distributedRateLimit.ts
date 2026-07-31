/**
 * Server-route distributed rate limit (Firestore-backed via Admin SDK).
 * Edge middleware remains in-memory; Cloud Armor is the edge volumetric control.
 */

import { NextResponse } from 'next/server'
import { logEvent } from '@/lib/observability/logger'

export async function enforceDistributedPolicy(
  policyName: string,
  scopeKey: string
): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  try {
    const {
      enforcePolicy,
    } = require('../../backend/services/security/distributedRateLimit') as {
      enforcePolicy: (
        policyName: string,
        scopeKey: string
      ) => Promise<{ allowed: boolean; retryAfterSec?: number }>
    }
    return await enforcePolicy(policyName, scopeKey)
  } catch {
    // Fall back is handled inside the JS module; if require fails, allow with warn
    logEvent({
      event: 'rate_limit_backend_error',
      severity: 'warn',
      outcome: 'failure',
      errorCode: 'distributed_require_failed',
    })
    return { allowed: true }
  }
}

export function tooManyRequests(retryAfterSec?: number) {
  logEvent({
    event: 'rate_limit_exceeded',
    severity: 'warn',
    outcome: 'denied',
  })
  return NextResponse.json(
    {
      error: {
        code: 'rate_limited',
        message: 'Too many requests — please try again shortly',
      },
    },
    {
      status: 429,
      headers: retryAfterSec ? { 'Retry-After': String(retryAfterSec) } : undefined,
    }
  )
}
