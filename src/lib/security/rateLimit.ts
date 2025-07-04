import type { NextRequest } from 'next/server';

// In-memory rate limiting (for development)
// In production, use Redis or similar distributed cache
const requests = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
};

const apiConfigs: Record<string, RateLimitConfig> = {
  '/api/session': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 session requests per minute
  },
  '/api/responses': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 response requests per minute
  },
  '/api/chat': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 chat requests per minute
  },
};

interface RateLimitResult {
  success: boolean;
  retryAfter?: number;
  remaining?: number;
}

export async function rateLimit(request: NextRequest): Promise<RateLimitResult> {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'anonymous';
  const pathname = request.nextUrl.pathname;
  
  // Get configuration for this endpoint
  const config = apiConfigs[pathname] || defaultConfig;
  
  const key = `${ip}:${pathname}`;
  const now = Date.now();
  
  // Clean up expired entries
  cleanupExpiredEntries(now);
  
  const requestData = requests.get(key);
  
  if (!requestData) {
    // First request
    requests.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { success: true, remaining: config.maxRequests - 1 };
  }
  
  if (now > requestData.resetTime) {
    // Reset window
    requests.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { success: true, remaining: config.maxRequests - 1 };
  }
  
  if (requestData.count >= config.maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((requestData.resetTime - now) / 1000);
    return { success: false, retryAfter };
  }
  
  // Increment counter
  requestData.count++;
  requests.set(key, requestData);
  
  return { success: true, remaining: config.maxRequests - requestData.count };
}

function cleanupExpiredEntries(now: number) {
  for (const [key, data] of requests.entries()) {
    if (now > data.resetTime) {
      requests.delete(key);
    }
  }
}

// Rate limiting for authenticated users (with user ID)
export async function rateLimitUser(userId: string, action: string): Promise<RateLimitResult> {
  const key = `user:${userId}:${action}`;
  const config = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 requests per minute per user
  };
  
  const now = Date.now();
  const requestData = requests.get(key);
  
  if (!requestData) {
    requests.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { success: true, remaining: config.maxRequests - 1 };
  }
  
  if (now > requestData.resetTime) {
    requests.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { success: true, remaining: config.maxRequests - 1 };
  }
  
  if (requestData.count >= config.maxRequests) {
    const retryAfter = Math.ceil((requestData.resetTime - now) / 1000);
    return { success: false, retryAfter };
  }
  
  requestData.count++;
  requests.set(key, requestData);
  
  return { success: true, remaining: config.maxRequests - requestData.count };
}