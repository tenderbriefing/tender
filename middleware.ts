import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyFirebaseIdTokenEdge } from '@/lib/auth/verifyFirebaseIdTokenEdge'
import {
  extractBearerToken,
  isDevOnlyPage,
  isProductionBlockedApiRoute,
  isPublicApiRoute,
} from '@/lib/security/apiRoutePolicy'
import { checkRateLimit, clientIpFromRequest } from '@/lib/security/rateLimit'

const isProduction = process.env.NODE_ENV === 'production'

function rateLimitPublicApi(request: NextRequest, pathname: string): NextResponse | null {
  const isSupportCreate = pathname === '/api/support/tickets' && request.method === 'POST'
  if (
    !pathname.startsWith('/api/tender-briefings') &&
    pathname !== '/api/health/firestore' &&
    !isSupportCreate
  ) {
    return null
  }

  const ip = clientIpFromRequest(request)
  const key = `${ip}:${pathname.split('?')[0]}`
  const limit = isSupportCreate ? 8 : pathname.includes('stats') ? 30 : 120
  const result = checkRateLimit(key, limit, 60_000)

  if (!result.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests — please try again shortly' },
      {
        status: 429,
        headers: result.retryAfterSec
          ? { 'Retry-After': String(result.retryAfterSec) }
          : undefined,
      }
    )
  }

  return null
}

function withHtmlDeploySafeCache(response: NextResponse) {
  // Next.js static pages default to s-maxage=31536000. Edge/CDN caches that HTML
  // across deploys, so browsers request deleted /_next/static chunk hashes and
  // crash with ChunkLoadError → React #423 → "Application error".
  response.headers.set(
    'Cache-Control',
    'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
  )
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isProduction && isDevOnlyPage(pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  if (pathname.startsWith('/admin')) {
    return withHtmlDeploySafeCache(NextResponse.next())
  }

  if (pathname.startsWith('/api/')) {
    if (isProduction && isProductionBlockedApiRoute(pathname)) {
      return NextResponse.json(
        { success: false, error: 'This API is not available in production' },
        { status: 404 }
      )
    }

    const rateLimited = rateLimitPublicApi(request, pathname)
    if (rateLimited) return rateLimited

    if (isPublicApiRoute(pathname, request.method)) {
      return NextResponse.next()
    }

    const token = extractBearerToken(request)
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized — sign in required' },
        { status: 401 }
      )
    }

    try {
      await verifyFirebaseIdTokenEdge(token)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Unauthorized — invalid or expired session' },
        { status: 401 }
      )
    }

    return NextResponse.next()
  }

  return withHtmlDeploySafeCache(NextResponse.next())
}

export const config = {
  matcher: [
    /*
     * Run on pages + APIs so HTML Cache-Control can be shortened after deploys.
     * Skip Next internals and common static file extensions.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
    '/api/:path*',
    '/admin/:path*',
  ],
}
