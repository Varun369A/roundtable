import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware — sets COOP/COEP headers for /workspace/* routes.
 *
 * WebContainers (StackBlitz) requires SharedArrayBuffer, which needs:
 *   Cross-Origin-Opener-Policy: same-origin
 *   Cross-Origin-Embedder-Policy: credentialless
 *
 * These are injected here (not just next.config.js) because nginx proxy
 * can strip or override response headers set via next.config.js headers().
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const response = NextResponse.next()

  if (pathname.startsWith('/workspace')) {
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless')
  }

  return response
}

export const config = {
  matcher: '/workspace/:path*',
}
