import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3000'
const authTestEnv = {
  BETTER_AUTH_URL: baseURL,
  BETTER_AUTH_SECRET: 'local-browser-smoke-secret-32-chars-only',
  GOOGLE_CLIENT_ID: 'browser-smoke-client',
  GOOGLE_CLIENT_SECRET: 'browser-smoke-secret',
  DATABASE_PATH: '.data/browser-smoke.sqlite',
}
Object.assign(process.env, authTestEnv)

export default defineConfig({
  testDir: './tests',
  use: { baseURL, browserName: 'chromium' },
  webServer: {
    command: process.env.SMOKE_SERVER === 'production'
      ? 'pnpm run start'
      : 'pnpm run dev --host 127.0.0.1',
    url: baseURL,
    env: authTestEnv,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
