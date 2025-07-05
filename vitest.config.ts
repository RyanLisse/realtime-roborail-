import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: true,
    testTimeout: 10000,
    hookTimeout: 10000,
    env: {
      NODE_ENV: 'test',
      OPENAI_API_KEY: 'test-key-mock',
      VECTOR_STORE_ID: 'test-vector-store',
      AUTH_SECRET: 'test-auth-secret-for-testing-purposes-only',
      NEXTAUTH_URL: 'http://localhost:3000',
      NEXTAUTH_SECRET: 'test-nextauth-secret',
      DATABASE_URL: 'sqlite://test.db',
      REDIS_URL: 'redis://localhost:6379'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.test.{js,ts,jsx,tsx}',
        '**/*.config.{js,ts}',
        '**/coverage/**',
        '**/dist/**',
        '**/.next/**',
        '**/next.config.ts',
        '**/tailwind.config.ts',
        '**/postcss.config.js',
        '**/vitest.config.ts',
        'src/middleware.ts',
        'src/app/layout.tsx',
        'src/app/page.tsx',
        'src/app/globals.css',
        'src/app/not-found.tsx',
        'src/app/loading.tsx',
        'src/app/error.tsx',
      ],
      include: [
        'src/**/*.{js,ts,jsx,tsx}',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});