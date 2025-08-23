// file: middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;

  // This log will appear in your terminal where you run `npm run dev`.
  // It can help debug which path is being intercepted.
  console.log(`[Middleware] Path: ${pathname}`);

  // --- Explicit Logic Flow ---

  // 1. First, check for the exact public routes that anyone can access.
  if (
    pathname === '/' ||
    pathname === '/authentication/signin' ||
    pathname === '/authentication/signup'
  ) {
    // If a user is already logged in, don't let them see the sign-in page again.
    // Redirect them to the dashboard.
    if (token && (pathname === '/authentication/signin' || pathname === '/authentication/signup')) {
      console.log('[Middleware] User is logged in, redirecting from auth page to /dashboard');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // If it's a public route, allow access.
    console.log(`[Middleware] Public route allowed: ${pathname}`);
    return NextResponse.next();
  }

  // 2. For any other route, it's considered protected. Check if the user is logged in.
  if (!token) {
    // If there is no token, redirect to the sign-in page.
    console.log(`[Middleware] No token, redirecting to sign-in from protected route: ${pathname}`);
    const signinUrl = new URL('/authentication/signin', request.url);
    signinUrl.searchParams.set('from', pathname); // Remember where the user was going
    return NextResponse.redirect(signinUrl);
  }

  // 3. If a token exists and the route is not public, allow access.
  console.log(`[Middleware] Token found, allowing access to protected route: ${pathname}`);
  return NextResponse.next();
}

// This configures the middleware to run on all paths except for specific
// static files and API routes.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
