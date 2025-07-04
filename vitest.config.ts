import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: true,
    env: {
      NODE_ENV: 'test',
      OPENAI_API_KEY: 'test-key-mock',
      VECTOR_STORE_ID: 'test-vector-store',
      AUTH_SECRET: 'test-auth-secret-for-testing-purposes-only',
      NEXTAUTH_URL: 'http://localhost:3000',
      NEXTAUTH_SECRET: 'test-nextauth-secret',
      DATABASE_URL: 'sqlite://test.db',
      REDIS_URL: 'redis://localhost:6379'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});