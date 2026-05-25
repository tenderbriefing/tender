import { NextRequest } from 'next/server'

/**
 * Authorize scheduled automation triggers (Cloud Scheduler).
 * Uses SYNC_SECRET or AUTOMATION_SECRET in production.
 */
export function isAutomationAuthorized(request: NextRequest): boolean {
  const isProduction = process.env.NODE_ENV === 'production'
  const secret =
    process.env.AUTOMATION_SECRET || process.env.SYNC_SECRET

  if (!isProduction) return true
  if (!secret) {
    console.error('[TenderBriefing] AUTOMATION_SECRET / SYNC_SECRET missing in production')
    return false
  }

  const provided =
    request.headers.get('x-automation-secret') ||
    request.headers.get('x-sync-secret')
  return provided === secret
}

export function automationAuthErrorResponse() {
  return {
    success: false,
    error: 'Unauthorized — valid x-automation-secret or x-sync-secret required',
  }
}
