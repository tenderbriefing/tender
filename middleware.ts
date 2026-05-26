import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  hasBearerToken,
  isDevOnlyPage,
  isPublicApiRoute,
} from '@/lib/security/apiRoutePolicy'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (process.env.NODE_ENV === 'production' && isDevOnlyPage(pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  if (pathname.startsWith('/api/')) {
    if (isPublicApiRoute(pathname, request.method)) {
      return NextResponse.next()
    }

    if (!hasBearerToken(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized — sign in required' },
        { status: 401 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
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
