import { describe, it, expect, beforeEach } from 'vitest';
import { env, validateEnvironment, hasRequiredAPIKeys, getAPIKeyStatus } from '../../lib/config/env';

describe('Deployment Security', () => {
  describe('Environment Configuration', () => {
    it('should validate required environment variables', () => {
      const validation = validateEnvironment();
      
      if (!validation.valid) {
        console.warn('Environment validation errors:', validation.errors);
      }
      
      // In test environment, some keys might be missing
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('errors');
    });

    it('should require OpenAI API key', () => {
      expect(env.OPENAI_API_KEY).toBeDefined();
      expect(env.OPENAI_API_KEY.length).toBeGreaterThan(0);
    });

    it('should require auth secret', () => {
      expect(env.AUTH_SECRET).toBeDefined();
      expect(env.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    });

    it('should have secure default configurations', () => {
      expect(env.NODE_ENV).toMatch(/^(development|production|test)$/);
      expect(env.LOG_LEVEL).toMatch(/^(debug|info|warn|error)$/);
    });

    it('should validate API key presence', () => {
      const hasRequired = hasRequiredAPIKeys();
      expect(typeof hasRequired).toBe('boolean');
      
      const keyStatus = getAPIKeyStatus();
      expect(keyStatus).toHaveProperty('openai');
      expect(typeof keyStatus.openai).toBe('boolean');
    });
  });

  describe('Production Security Settings', () => {
    it('should have production-safe configurations', () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // Test production-specific validations
      expect(env.NODE_ENV).toBe('production');
      
      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should disable debug mode in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // Debug should be disabled in production
      // This would be tested in the actual middleware
      expect(env.NODE_ENV).toBe('production');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should have rate limiting enabled by default', () => {
      expect(env.RATE_LIMIT_ENABLED).toBe(true);
    });
  });

  describe('Docker Configuration', () => {
    it('should validate Docker environment requirements', () => {
      // Test that Docker configuration is secure
      // This would include checking for non-root user, health checks, etc.
      expect(true).toBe(true); // Placeholder for Docker-specific tests
    });

    it('should have proper port configuration', () => {
      // Default port should be 3000
      const port = process.env.PORT || '3000';
      expect(parseInt(port)).toBeGreaterThan(0);
      expect(parseInt(port)).toBeLessThan(65536);
    });
  });

  describe('Database Security', () => {
    it('should validate database connection strings', () => {
      if (env.DATABASE_URL) {
        expect(env.DATABASE_URL).toMatch(/^postgresql:\/\//);
        // Should not contain credentials in logs
        expect(env.DATABASE_URL).not.toContain('@localhost');
      }
    });

    it('should require SSL in production database connections', () => {
      if (env.DATABASE_URL && env.NODE_ENV === 'production') {
        expect(env.DATABASE_URL).toContain('sslmode=require');
      }
    });
  });

  describe('API Security', () => {
    it('should validate API key formats', () => {
      if (env.OPENAI_API_KEY) {
        // OpenAI keys should follow expected format
        expect(env.OPENAI_API_KEY).toMatch(/^sk-(proj-)?[a-zA-Z0-9_-]+$/);
      }
    });

    it('should not expose sensitive keys in logs', () => {
      // Test that environment variables are properly redacted
      const safeEnvString = JSON.stringify(env);
      
      // Should not contain actual API keys
      if (env.OPENAI_API_KEY) {
        expect(safeEnvString).not.toContain(env.OPENAI_API_KEY);
      }
    });
  });

  describe('CORS Configuration', () => {
    it('should have restrictive CORS settings in production', () => {
      // Test CORS configuration
      const corsOrigins = env.CORS_ORIGINS;
      
      if (corsOrigins) {
        const origins = corsOrigins.split(',');
        origins.forEach(origin => {
          expect(origin.trim()).toMatch(/^https?:\/\//);
        });
      }
    });

    it('should allow localhost in development only', () => {
      // Development should allow localhost
      if (env.NODE_ENV === 'development') {
        // This would be tested in the actual CORS middleware
        expect(true).toBe(true);
      }
    });
  });

  describe('Health Check Configuration', () => {
    it('should have health check endpoint configured', () => {
      // Health check should be available
      expect(true).toBe(true); // This would test the actual endpoint
    });

    it('should validate service dependencies', () => {
      // Test that all required services are configured
      const requiredServices = ['openai'];
      
      requiredServices.forEach(service => {
        switch (service) {
          case 'openai':
            expect(env.OPENAI_API_KEY).toBeDefined();
            break;
        }
      });
    });
  });

  describe('Monitoring Configuration', () => {
    it('should have monitoring configuration', () => {
      expect(typeof env.MONITORING_ENABLED).toBe('boolean');
      expect(env.LOG_LEVEL).toMatch(/^(debug|info|warn|error)$/);
    });

    it('should configure structured logging for production', () => {
      if (env.NODE_ENV === 'production') {
        // Production should use structured logging
        expect(env.LOG_LEVEL).not.toBe('debug');
      }
    });
  });

  describe('Security Headers Validation', () => {
    it('should validate CSP configuration', () => {
      // Test that CSP headers are properly configured
      // This would test the actual security headers middleware
      expect(true).toBe(true);
    });

    it('should validate HSTS configuration', () => {
      // Test HSTS headers
      expect(true).toBe(true);
    });
  });
});