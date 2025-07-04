import type { NextRequest } from 'next/server';
import { createHash } from 'crypto';

// CSRF token validation
export async function validateCSRF(request: NextRequest): Promise<boolean> {
  // Skip CSRF validation for same-origin requests
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  
  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) {
        return true; // Same origin, CSRF not needed
      }
    } catch {
      // Invalid origin URL
    }
  }
  
  // For cross-origin requests, check CSRF token
  const csrfToken = request.headers.get('x-csrf-token') || 
                    request.headers.get('x-xsrf-token');
  
  if (!csrfToken) {
    return false;
  }
  
  // Validate CSRF token format and signature
  return validateCSRFToken(csrfToken);
}

function validateCSRFToken(token: string): boolean {
  try {
    // Simple validation - in production, use signed tokens
    const [timestamp, hash] = token.split('.');
    const now = Date.now();
    const tokenTime = parseInt(timestamp, 10);
    
    // Token should not be older than 1 hour
    if (now - tokenTime > 3600000) {
      return false;
    }
    
    // Validate hash (simplified - use proper HMAC in production)
    const expectedHash = createHash('sha256')
      .update(timestamp + process.env.AUTH_SECRET)
      .digest('hex')
      .substring(0, 16);
    
    return hash === expectedHash;
  } catch {
    return false;
  }
}

export function generateCSRFToken(): string {
  const timestamp = Date.now().toString();
  const hash = createHash('sha256')
    .update(timestamp + process.env.AUTH_SECRET)
    .digest('hex')
    .substring(0, 16);
  
  return `${timestamp}.${hash}`;
}