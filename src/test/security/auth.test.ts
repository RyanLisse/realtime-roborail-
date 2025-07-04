import { describe, it, expect, beforeEach } from 'vitest';
import { authOptions, hasRole, requireRole, generateAPIKey, validateAPIKey, ROLES } from '../../lib/auth/config';

describe('Authentication System', () => {
  describe('Role-based Access Control', () => {
    it('should correctly validate role hierarchy', () => {
      expect(hasRole(ROLES.ADMIN, ROLES.USER)).toBe(true);
      expect(hasRole(ROLES.ADMIN, ROLES.GUEST)).toBe(true);
      expect(hasRole(ROLES.USER, ROLES.ADMIN)).toBe(false);
      expect(hasRole(ROLES.USER, ROLES.GUEST)).toBe(true);
      expect(hasRole(ROLES.GUEST, ROLES.USER)).toBe(false);
      expect(hasRole(ROLES.GUEST, ROLES.ADMIN)).toBe(false);
    });

    it('should handle undefined roles', () => {
      expect(hasRole(undefined, ROLES.USER)).toBe(false);
      expect(hasRole('', ROLES.USER)).toBe(false);
      expect(hasRole('invalid', ROLES.USER)).toBe(false);
    });

    it('should throw error for insufficient roles', () => {
      expect(() => requireRole(ROLES.USER, ROLES.ADMIN)).toThrow('Access denied');
      expect(() => requireRole(undefined, ROLES.USER)).toThrow('Access denied');
      expect(() => requireRole(ROLES.ADMIN, ROLES.USER)).not.toThrow();
    });
  });

  describe('API Key Management', () => {
    it('should generate valid API keys', () => {
      const userId = 'user123';
      const apiKey = generateAPIKey(userId);
      
      expect(apiKey).toMatch(/^sk-user-[a-zA-Z0-9]{32}$/);
      expect(apiKey.length).toBeGreaterThan(40);
    });

    it('should validate API key format', () => {
      const validKey = 'sk-user-' + 'a'.repeat(32);
      const invalidKey = 'sk-invalid-key';
      
      expect(validateAPIKey(validKey).valid).toBe(true);
      expect(validateAPIKey(invalidKey).valid).toBe(false);
      expect(validateAPIKey('').valid).toBe(false);
    });

    it('should generate unique keys for different users', () => {
      const key1 = generateAPIKey('user1');
      const key2 = generateAPIKey('user2');
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('NextAuth Configuration', () => {
    it('should have required configuration properties', () => {
      expect(authOptions.providers).toBeDefined();
      expect(authOptions.callbacks).toBeDefined();
      expect(authOptions.session).toBeDefined();
      expect(authOptions.jwt).toBeDefined();
    });

    it('should configure session strategy as JWT', () => {
      expect(authOptions.session?.strategy).toBe('jwt');
    });

    it('should have proper session duration', () => {
      expect(authOptions.session?.maxAge).toBe(30 * 24 * 60 * 60); // 30 days
    });

    it('should have debug enabled in development', () => {
      const originalEnv = process.env.NODE_ENV;
      
      process.env.NODE_ENV = 'development';
      expect(authOptions.debug).toBe(true);
      
      process.env.NODE_ENV = 'production';
      expect(authOptions.debug).toBe(false);
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Provider Configuration', () => {
    it('should include GitHub provider', () => {
      const githubProvider = authOptions.providers.find(
        p => p.type === 'oauth' && p.id === 'github'
      );
      expect(githubProvider).toBeDefined();
    });

    it('should include Google provider', () => {
      const googleProvider = authOptions.providers.find(
        p => p.type === 'oauth' && p.id === 'google'
      );
      expect(googleProvider).toBeDefined();
    });

    it('should include Credentials provider', () => {
      const credentialsProvider = authOptions.providers.find(
        p => p.type === 'credentials'
      );
      expect(credentialsProvider).toBeDefined();
    });
  });

  describe('Security Callbacks', () => {
    it('should enhance JWT with user information', async () => {
      const token = {};
      const user = { id: '1', role: 'admin' };
      const account = { access_token: 'token123', provider: 'github' };

      const result = await authOptions.callbacks?.jwt?.({
        token,
        user,
        account,
      } as any);

      expect(result?.accessToken).toBe('token123');
      expect(result?.provider).toBe('github');
      expect(result?.role).toBe('admin');
    });

    it('should enhance session with token information', async () => {
      const session = { user: {} };
      const token = {
        accessToken: 'token123',
        provider: 'github',
        role: 'admin',
      };

      const result = await authOptions.callbacks?.session?.({
        session,
        token,
      } as any);

      expect(result?.accessToken).toBe('token123');
      expect(result?.provider).toBe('github');
      expect(result?.user.role).toBe('admin');
    });
  });
});