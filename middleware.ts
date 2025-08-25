import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;

  console.log(`[Middleware] Path: ${pathname}`);

  if (
    pathname === '/' ||
    pathname.startsWith('/authentication')
  ) {
    if (token && pathname.startsWith('/authentication')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const signinUrl = new URL('/authentication/signin', request.url);
    signinUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/room/:path*',
    '/dashboard/:path*',
    '/draw/:path*',
    '/authentication/:path*',
    '/'
  ],
};