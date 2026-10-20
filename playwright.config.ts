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
  // CI-only: the 3 heaviest tests (breaks.test.ts x2, focus.test.ts — long
  // chains of fake-clock jumps plus real UI transitions) consistently missed
  // the 5000ms default on GitHub's shared runner, identically across every
  // retry, while passing clean locally — a timing-margin problem from a
  // slower CPU, not a logic bug. A genuinely broken assertion still fails,
  // just after 10s instead of 5s.
  expect: { timeout: process.env.CI ? 10_000 : 5_000 },
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
