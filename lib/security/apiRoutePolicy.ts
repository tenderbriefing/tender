/** Pages that must not be reachable in production (internal QA / demos). */
export const DEV_ONLY_PAGE_PREFIXES = [
  '/scraper-demo',
  '/ai-test',
  '/matching-test',
  '/features-test',
  '/gmail-test',
  '/drive-test',
  '/storage-test',
  '/maps-test',
  '/secrets-test',
  '/test',
] as const

/** API routes allowed without a Bearer token (handlers still sanitize responses). */
export function isPublicApiRoute(pathname: string, method: string): boolean {
  const m = method.toUpperCase()

  if (pathname === '/api/tender-briefings' && m === 'GET') return true
  if (/^\/api\/tender-briefings\/[^/]+$/.test(pathname) && m === 'GET') return true
  if (pathname === '/api/tender-briefings/stats/summary' && m === 'GET') return true
  if (pathname === '/api/health/firestore' && m === 'GET') return true

  if (pathname === '/api/webhooks/whatsapp' && (m === 'GET' || m === 'POST')) return true
  if (pathname === '/api/webhooks/yoco' && m === 'POST') return true

  if (pathname === '/api/sync/run' && m === 'POST') return true
  if (pathname === '/api/automation/run' && m === 'POST') return true

  return false
}

export function isDevOnlyPage(pathname: string): boolean {
  return DEV_ONLY_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function hasBearerToken(request: { headers: { get(name: string): string | null } }): boolean {
  const auth = request.headers.get('authorization')
  return Boolean(auth?.startsWith('Bearer ') && auth.slice(7).trim())
}
