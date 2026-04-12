import { NextResponse } from 'next/server';

/**
 * Edge Middleware — runs before every matching request.
 *
 * Protected routes (/dashboard, /admin):
 *   - Check for the `mkt_session` cookie (written by api.js setToken).
 *   - If absent → redirect to /login?redirect=<original path>.
 *
 * Admin-only routes (/admin):
 *   - The cookie only tells us "logged in"; we do NOT decode the JWT here
 *     (Edge runtime can't load jsonwebtoken).
 *   - The backend still enforces admin role on every API call.
 *   - If a non-admin somehow reaches /admin, they'll see an empty page
 *     because all API calls return 403 and the page redirects them.
 *
 * Public routes (/login, /signup):
 *   - If the session cookie IS present, redirect to /dashboard instead
 *     (avoids showing login page to already-authenticated users).
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get('mkt_session')?.value;
  const isLoggedIn = Boolean(session);

  // Redirect logged-in users away from auth pages
  if ((pathname === '/login' || pathname === '/signup') && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Guard protected routes
  const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/admin');
  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on these paths only — skip Next internals and static assets
  matcher: ['/dashboard/:path*', '/admin/:path*', '/login', '/signup'],
};
