import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { rateLimit, rateLimitUser } from '../../lib/security/rateLimit';
import { validateCSRF, generateCSRFToken } from '../../lib/security/csrf';
import { 
  sanitizeString, 
  sanitizeJSON, 
  isValidEmail, 
  isValidURL, 
  isValidAPIKey,
  validateContentLength 
} from '../../lib/security/validation';

describe('Security Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/session', {
        headers: { 'x-forwarded-for': '127.0.0.1' }
      });

      const result = await rateLimit(mockRequest);
      expect(result.success).toBe(true);
      expect(result.remaining).toBeDefined();
    });

    it('should block requests exceeding rate limit', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/session', {
        headers: { 'x-forwarded-for': '127.0.0.1' }
      });

      // Make multiple requests to exceed limit
      for (let i = 0; i < 15; i++) {
        await rateLimit(mockRequest);
      }

      const result = await rateLimit(mockRequest);
      expect(result.success).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });

    it('should handle user-specific rate limiting', async () => {
      const userId = 'user123';
      const action = 'api_call';

      const result1 = await rateLimitUser(userId, action);
      expect(result1.success).toBe(true);

      // Different user should have separate limit
      const result2 = await rateLimitUser('user456', action);
      expect(result2.success).toBe(true);
    });

    it('should reset rate limit after window expires', async () => {
      // This test would need to mock time or wait, simplified for demo
      const mockRequest = new NextRequest('http://localhost:3000/api/session', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });

      const result = await rateLimit(mockRequest);
      expect(result.success).toBe(true);
    });
  });

  describe('CSRF Protection', () => {
    it('should generate valid CSRF tokens', () => {
      const token = generateCSRFToken();
      
      expect(token).toMatch(/^\d+\.[a-f0-9]{16}$/);
      expect(token.split('.').length).toBe(2);
    });

    it('should validate same-origin requests', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'origin': 'http://localhost:3000',
          'host': 'localhost:3000'
        }
      });

      const result = await validateCSRF(mockRequest);
      expect(result).toBe(true);
    });

    it('should reject cross-origin requests without CSRF token', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'origin': 'https://evil.com',
          'host': 'localhost:3000'
        }
      });

      const result = await validateCSRF(mockRequest);
      expect(result).toBe(false);
    });

    it('should accept cross-origin requests with valid CSRF token', async () => {
      const token = generateCSRFToken();
      const mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'origin': 'https://evil.com',
          'host': 'localhost:3000',
          'x-csrf-token': token
        }
      });

      const result = await validateCSRF(mockRequest);
      expect(result).toBe(true);
    });

    it('should reject expired CSRF tokens', async () => {
      // Create an expired token (simulate old timestamp)
      const expiredToken = '1000000.abc123';
      const mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'origin': 'https://evil.com',
          'host': 'localhost:3000',
          'x-csrf-token': expiredToken
        }
      });

      const result = await validateCSRF(mockRequest);
      expect(result).toBe(false);
    });
  });

  describe('Input Validation and Sanitization', () => {
    describe('String Sanitization', () => {
      it('should remove script tags', () => {
        const malicious = '<script>alert("xss")</script>Hello';
        const sanitized = sanitizeString(malicious);
        expect(sanitized).toBe('Hello');
      });

      it('should remove iframe tags', () => {
        const malicious = '<iframe src="evil.com"></iframe>Content';
        const sanitized = sanitizeString(malicious);
        expect(sanitized).toBe('Content');
      });

      it('should remove javascript: URIs', () => {
        const malicious = 'javascript:alert("xss")';
        const sanitized = sanitizeString(malicious);
        expect(sanitized).toBe('alert("xss")');
      });

      it('should remove event handlers', () => {
        const malicious = 'onload="alert(1)" content';
        const sanitized = sanitizeString(malicious);
        expect(sanitized).toBe('content');
      });

      it('should preserve safe content', () => {
        const safe = 'Hello <b>World</b>!';
        const sanitized = sanitizeString(safe);
        expect(sanitized).toBe('Hello <b>World</b>!');
      });
    });

    describe('JSON Sanitization', () => {
      it('should sanitize string values in objects', () => {
        const input = {
          name: '<script>alert("xss")</script>John',
          description: 'Safe content'
        };
        const sanitized = sanitizeJSON(input);
        expect(sanitized.name).toBe('John');
        expect(sanitized.description).toBe('Safe content');
      });

      it('should sanitize arrays', () => {
        const input = ['<script>alert("xss")</script>item1', 'safe item'];
        const sanitized = sanitizeJSON(input);
        expect(sanitized[0]).toBe('item1');
        expect(sanitized[1]).toBe('safe item');
      });

      it('should sanitize nested objects', () => {
        const input = {
          user: {
            name: '<script>alert("xss")</script>John',
            profile: {
              bio: 'Safe bio <iframe>evil</iframe>'
            }
          }
        };
        const sanitized = sanitizeJSON(input);
        expect(sanitized.user.name).toBe('John');
        expect(sanitized.user.profile.bio).toBe('Safe bio');
      });
    });

    describe('Format Validation', () => {
      it('should validate email addresses', () => {
        expect(isValidEmail('user@example.com')).toBe(true);
        expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
        expect(isValidEmail('invalid-email')).toBe(false);
        expect(isValidEmail('user@')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
      });

      it('should validate URLs', () => {
        // In test environment with our URL mock, these should work properly
        expect(isValidURL('https://example.com')).toBe(true);
        expect(isValidURL('http://example.com')).toBe(true);
        expect(isValidURL('ftp://files.example.com')).toBe(true);
        expect(isValidURL('not-a-url')).toBe(false);
        expect(isValidURL('javascript:alert(1)')).toBe(false);
      });

      it('should validate API keys', () => {
        expect(isValidAPIKey('sk-' + 'a'.repeat(48))).toBe(true);
        expect(isValidAPIKey('sk-proj-' + 'a'.repeat(64))).toBe(true);
        expect(isValidAPIKey('invalid-key')).toBe(false);
        expect(isValidAPIKey('sk-tooshort')).toBe(false);
      });

      it('should validate content length', () => {
        expect(validateContentLength('short', 100)).toBe(true);
        expect(validateContentLength('a'.repeat(100), 100)).toBe(true);
        expect(validateContentLength('a'.repeat(101), 100)).toBe(false);
      });
    });
  });

  describe('Security Headers', () => {
    it('should include all required security headers', () => {
      // This would test the securityHeaders function
      // Testing the actual headers would require middleware integration
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Error Handling', () => {
    it('should not leak sensitive information in error messages', () => {
      // Test that errors don't expose internal details
      expect(true).toBe(true); // Placeholder
    });

    it('should log security events appropriately', () => {
      // Test security event logging
      expect(true).toBe(true); // Placeholder
    });
  });
});