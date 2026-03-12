import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/sign-in',
  '/login',
  '/api/auth',
  '/api/health',
]

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function hasAuthSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) => {
    return (
      name.includes('signal_noise') &&
      (name.includes('session') || name.includes('cookie_cache'))
    ) || name.includes('better-auth')
  })
}

function isLocalDevelopmentHost(request: NextRequest) {
  const { hostname } = request.nextUrl
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0'
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  if (isLocalDevelopmentHost(request)) {
    return NextResponse.next()
  }

  if (hasAuthSessionCookie(request)) {
    return NextResponse.next()
  }

  const signInUrl = new URL('/sign-in', request.url)
  signInUrl.searchParams.set('redirect', `${pathname}${search}`)
  return NextResponse.redirect(signInUrl)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|fonts|badges|images).*)',
  ],
}
