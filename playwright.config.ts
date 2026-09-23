import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './tests',
  use: { baseURL, browserName: 'chromium' },
  webServer: {
    command: process.env.SMOKE_SERVER === 'production'
      ? 'pnpm run start'
      : 'pnpm run dev --host 127.0.0.1',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
