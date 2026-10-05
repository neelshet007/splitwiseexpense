import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('session_token')?.value;

  const protectedPrefixes = [
    '/dashboard',
    '/expenses',
    '/friends',
    '/groups',
    '/trips',
    '/activity',
    '/settings'
  ];

  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If already logged in and visiting login or register, redirect to dashboard
  const authRoutes = ['/login', '/register'];
  if (sessionToken && authRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/expenses/:path*',
    '/friends/:path*',
    '/groups/:path*',
    '/trips/:path*',
    '/activity/:path*',
    '/settings/:path*',
    '/login',
    '/register'
  ]
};
