import { NextRequest } from 'next/server'

/**
 * Authorize OCDS sync triggers.
 * - Development: allow manual sync without secret
 * - Production: require matching x-sync-secret header
 */
export function isSyncAuthorized(request: NextRequest): boolean {
  const isProduction = process.env.NODE_ENV === 'production'
  const configuredSecret = process.env.SYNC_SECRET

  if (!isProduction) {
    return true
  }

  if (!configuredSecret) {
    console.error(
      '[TenderBriefing] SYNC_SECRET is not set — rejecting sync in production'
    )
    return false
  }

  const provided = request.headers.get('x-sync-secret')
  return provided === configuredSecret
}

export function syncAuthErrorResponse() {
  return {
    success: false,
    error: 'Unauthorized — valid x-sync-secret header required in production',
  }
}
