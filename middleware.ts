import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin rotaları koru (login hariç)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    try {
      await jwtVerify(token, secret)
    } catch {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Admin API rotaları - auth lib handle ediyor, middleware burada sadece redirect
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}
