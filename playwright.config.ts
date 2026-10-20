import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3000'
const authTestEnv = {
  BETTER_AUTH_URL: baseURL,
  BETTER_AUTH_SECRET: 'local-browser-smoke-secret-32-chars-only',
  GOOGLE_CLIENT_ID: 'browser-smoke-client',
  GOOGLE_CLIENT_SECRET: 'browser-smoke-secret',
  DATABASE_PATH: '.data/browser-smoke.sqlite',
  VITE_PRIVACY_CONTACT_EMAIL: 'privacy-smoke@invalid.test',
}
Object.assign(process.env, authTestEnv)

export default defineConfig({
  testDir: './src',
  testMatch: '**/__tests__/*.test.ts',
  // The smoke workers and web server share one SQLite test database; serialize fixtures and writes.
  workers: 1,
  // CI-only: a genuine failure still fails (it fails identically on every
  // retry); this only rescues the rare one-off browser crash/hang on a
  // shared CI runner — ticket 20's first real pipeline run hit exactly that
  // (a Chromium context died mid-test, not an assertion failure).
  retries: process.env.CI ? 2 : 0,
  // CI-only, kept generous regardless of what's causing the failure below.
  expect: { timeout: process.env.CI ? 10_000 : 5_000 },
  // 3 specific tests (breaks.test.ts x2, focus.test.ts) fail identically on
  // every CI run and every retry — not fixed by the timeout above, so it's
  // not a timing-margin issue — while passing clean locally every time.
  // Cause not yet identified; capture real evidence instead of guessing
  // further. `retain-on-failure` covers the original attempt too, not just
  // retries.
  use: {
    baseURL,
    browserName: 'chromium',
    trace: process.env.CI ? 'retain-on-failure' : 'off',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
  },
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
