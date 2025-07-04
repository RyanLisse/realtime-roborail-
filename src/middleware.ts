import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit } from './lib/security/rateLimit';
import { validateCSRF } from './lib/security/csrf';
import { securityHeaders } from './lib/security/headers';

// Public routes that don't require authentication
const publicRoutes = [
  '/api/health',
  '/api/session',
  '/api/responses',
  '/api/chat'
];

// API routes that require rate limiting
const rateLimitedRoutes = [
  '/api/session',
  '/api/responses',
  '/api/chat'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Apply security headers to all responses
  const response = NextResponse.next();
  securityHeaders(response);
  
  // Rate limiting for API routes
  if (rateLimitedRoutes.some(route => pathname.startsWith(route))) {
    const rateLimitResult = await rateLimit(request);
    if (!rateLimitResult.success) {
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
          }
        }
      );
    }
  }
  
  // CSRF protection for state-changing operations
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const csrfValid = await validateCSRF(request);
    if (!csrfValid) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid CSRF token' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
  
  // Log security events
  if (pathname.startsWith('/api/')) {
    console.log(`[Security] ${request.method} ${pathname} - IP: ${request.ip || 'unknown'}`);
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};