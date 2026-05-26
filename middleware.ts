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
  if (!pathname.startsWith('/api/tender-briefings') && pathname !== '/api/health/firestore') {
    return null
  }

  const ip = clientIpFromRequest(request)
  const key = `${ip}:${pathname.split('?')[0]}`
  const limit = pathname.includes('stats') ? 30 : 120
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isProduction && isDevOnlyPage(pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  if (pathname.startsWith('/admin')) {
    return NextResponse.next()
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
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    '/admin/:path*',
    '/scraper-demo',
    '/scraper-demo/:path*',
    '/ai-test',
    '/matching-test',
    '/features-test',
    '/gmail-test',
    '/drive-test',
    '/storage-test',
    '/maps-test',
    '/secrets-test',
    '/test',
    '/test/:path*',
  ],
}
