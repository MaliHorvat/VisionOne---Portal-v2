import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './vitest.global-setup.ts',
    fileParallelism: false,
    testTimeout: 120000,
    hookTimeout: 120000,
    env: {
      DATABASE_URL: 'mysql://portal:portal@127.0.0.1:3306/portal_test',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      AUTH_SECRET: 'test-auth-secret-visionone-portal',
      PORTAL_DATA: '/tmp/visionone-portal-test-data',
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
