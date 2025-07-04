import type { NextRequest } from 'next/server';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { z } from 'zod';

// User session interface
export interface UserSession {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
  lastActivity: number;
  permissions: string[];
}

// Session storage (in production, use Redis or database)
const sessions = new Map<string, UserSession>();

// Authentication schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
});

export const sessionTokenSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
  signature: z.string().length(64, 'Invalid signature length'),
});

// Generate secure session token
export function generateSessionToken(userId: string, email: string, role: string = 'user'): string {
  const sessionId = randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const expiry = timestamp + (24 * 60 * 60 * 1000); // 24 hours

  const session: UserSession = {
    userId,
    email,
    role,
    sessionId,
    issuedAt: timestamp,
    expiresAt: expiry,
    lastActivity: timestamp,
    permissions: getDefaultPermissions(role),
  };

  sessions.set(sessionId, session);

  // Create signed token
  const tokenData = `${sessionId}.${timestamp}.${expiry}`;
  const signature = createHash('sha256')
    .update(tokenData + process.env.AUTH_SECRET)
    .digest('hex');

  return `${tokenData}.${signature}`;
}

// Validate session token
export function validateSessionToken(token: string): UserSession | null {
  try {
    const [sessionId, issuedAt, expiresAt, signature] = token.split('.');
    
    if (!sessionId || !issuedAt || !expiresAt || !signature) {
      return null;
    }

    // Verify signature
    const expectedSignature = createHash('sha256')
      .update(`${sessionId}.${issuedAt}.${expiresAt}${process.env.AUTH_SECRET}`)
      .digest('hex');

    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    // Check expiry
    const now = Date.now();
    if (now > parseInt(expiresAt)) {
      sessions.delete(sessionId);
      return null;
    }

    // Get session data
    const session = sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Update last activity
    session.lastActivity = now;
    sessions.set(sessionId, session);

    return session;
  } catch {
    return null;
  }
}

// Extract session from request
export function getSessionFromRequest(request: NextRequest): UserSession | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return validateSessionToken(token);
  }

  // Try cookie
  const cookies = request.headers.get('cookie');
  if (cookies) {
    const sessionMatch = cookies.match(/session=([^;]+)/);
    if (sessionMatch) {
      return validateSessionToken(sessionMatch[1]);
    }
  }

  return null;
}

// Invalidate session
export function invalidateSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

// Clean up expired sessions
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
      cleaned++;
    }
  }

  return cleaned;
}

// Get default permissions for role
function getDefaultPermissions(role: string): string[] {
  const permissionMap: Record<string, string[]> = {
    admin: ['read', 'write', 'delete', 'manage_users', 'manage_system'],
    moderator: ['read', 'write', 'moderate_content'],
    user: ['read', 'write_own'],
    guest: ['read'],
  };

  return permissionMap[role] || permissionMap.guest;
}

// Permission checking
export function hasPermission(session: UserSession, permission: string): boolean {
  return session.permissions.includes(permission);
}

export function requirePermission(session: UserSession | null, permission: string): boolean {
  if (!session) return false;
  return hasPermission(session, permission);
}

// Password hashing utilities
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256')
    .update(password + salt + process.env.AUTH_SECRET)
    .digest('hex');
  
  return `${salt}.${hash}`;
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const [salt, hash] = hashedPassword.split('.');
    const expectedHash = createHash('sha256')
      .update(password + salt + process.env.AUTH_SECRET)
      .digest('hex');
    
    return timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
  } catch {
    return false;
  }
}

// Rate limiting for authentication attempts
const authAttempts = new Map<string, { count: number; resetTime: number; blocked: boolean }>();

export function recordAuthAttempt(identifier: string, success: boolean): boolean {
  const now = Date.now();
  const key = `auth:${identifier}`;
  
  let attempts = authAttempts.get(key);
  
  if (!attempts || now > attempts.resetTime) {
    attempts = { count: 0, resetTime: now + (15 * 60 * 1000), blocked: false }; // 15 minute window
  }

  if (success) {
    // Reset on successful login
    authAttempts.delete(key);
    return true;
  }

  attempts.count++;
  
  // Block after 5 failed attempts
  if (attempts.count >= 5) {
    attempts.blocked = true;
    attempts.resetTime = now + (30 * 60 * 1000); // Block for 30 minutes
  }

  authAttempts.set(key, attempts);
  return !attempts.blocked;
}

export function isAuthBlocked(identifier: string): boolean {
  const attempts = authAttempts.get(`auth:${identifier}`);
  if (!attempts) return false;
  
  const now = Date.now();
  if (now > attempts.resetTime) {
    authAttempts.delete(`auth:${identifier}`);
    return false;
  }
  
  return attempts.blocked;
}

// Security logging
export interface SecurityEvent {
  type: 'login' | 'logout' | 'auth_failed' | 'session_expired' | 'permission_denied';
  userId?: string;
  sessionId?: string;
  ip: string;
  userAgent: string;
  timestamp: number;
  details?: Record<string, any>;
}

const securityLog: SecurityEvent[] = [];

export function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
  const logEvent: SecurityEvent = {
    ...event,
    timestamp: Date.now(),
  };
  
  securityLog.push(logEvent);
  
  // Keep only last 1000 events
  if (securityLog.length > 1000) {
    securityLog.splice(0, securityLog.length - 1000);
  }
  
  // In production, send to proper logging service
  console.log('[Security Event]', JSON.stringify(logEvent));
}

export function getSecurityLog(limit: number = 100): SecurityEvent[] {
  return securityLog.slice(-limit);
}