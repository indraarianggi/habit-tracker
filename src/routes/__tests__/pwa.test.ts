import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

async function signedInPage(browser: import('@playwright/test').Browser, name: string, extra: Parameters<import('@playwright/test').Browser['newContext']>[0] = {}) {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ name, email: `pwa-${name.toLowerCase().replace(/\s+/g, '-')}-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, ...extra })
  await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
  const page = await context.newPage()
  return { helpers, user, context, page }
}

async function dispatchInstallPrompt(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt?: () => void; userChoice?: Promise<{ outcome: string }> }
    event.prompt = () => { (window as unknown as { __installPromptCalled: number }).__installPromptCalled = ((window as unknown as { __installPromptCalled?: number }).__installPromptCalled ?? 0) + 1 }
    event.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(event)
  })
}

test('the install card and Settings entry wait for the first Check-in, dismiss independently, and hide once the prompt is used', async ({ browser }) => {
  const { helpers, user, context, page } = await signedInPage(browser, 'Installer')
  try {
    await page.goto('/today')
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('Deep work')
    await input.press('Enter')
    await dispatchInstallPrompt(page)
    await expect(page.getByRole('region', { name: 'Install Habit Tracker' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Add Check-in' }).click()
    await page.getByRole('dialog', { name: 'Add Check-in' }).getByRole('button', { name: 'Save Check-in' }).click()
    await expect(page.getByText('Added by hand')).toBeVisible()

    const card = page.getByRole('region', { name: 'Install Habit Tracker' })
    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: 'Install app' })).toBeVisible()
    await expect(card.getByText(/Share/)).toHaveCount(0)

    await page.getByRole('button', { name: `${user.name}'s profile` }).click()
    await expect(page.getByRole('button', { name: 'Install app' })).toBeVisible()
    await page.getByRole('button', { name: 'Back' }).click()

    await card.getByRole('button', { name: 'Dismiss install prompt' }).click()
    await expect(card).toHaveCount(0)

    await page.getByRole('button', { name: `${user.name}'s profile` }).click()
    const settingsInstall = page.getByRole('button', { name: 'Install app' })
    await expect(settingsInstall).toBeVisible()
    await settingsInstall.click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __installPromptCalled?: number }).__installPromptCalled ?? 0)).toBe(1)
    await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Back' }).click()

    await page.reload()
    await expect(page.getByRole('textbox', { name: 'New Task' })).toBeVisible()
    await dispatchInstallPrompt(page)
    await expect(page.getByRole('region', { name: 'Install Habit Tracker' })).toHaveCount(0)
    await page.getByRole('button', { name: `${user.name}'s profile` }).click()
    await expect(page.getByRole('button', { name: 'Install app' })).toBeVisible()
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('an already-installed device never shows the install card or the Settings entry', async ({ browser }) => {
  const { helpers, user, context, page } = await signedInPage(browser, 'Already Installed')
  try {
    await page.addInitScript(() => {
      const native = window.matchMedia.bind(window)
      window.matchMedia = query => {
        const result = native(query)
        if (query.includes('display-mode: standalone')) Object.defineProperty(result, 'matches', { get: () => true })
        return result
      }
    })
    await page.goto('/today')
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('Already installed')
    await input.press('Enter')
    await dispatchInstallPrompt(page)
    await page.getByRole('button', { name: 'Add Check-in' }).click()
    await page.getByRole('dialog', { name: 'Add Check-in' }).getByRole('button', { name: 'Save Check-in' }).click()
    await expect(page.getByText('Added by hand')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Install Habit Tracker' })).toHaveCount(0)
    await page.getByRole('button', { name: `${user.name}'s profile` }).click()
    await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0)
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('iOS gets Share instructions and a storage reason instead of a native install prompt', async ({ browser }) => {
  const iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  const { helpers, user, context, page } = await signedInPage(browser, 'iOS User', { userAgent: iosUserAgent })
  try {
    await page.goto('/today')
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('iOS task')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Add Check-in' }).click()
    await page.getByRole('dialog', { name: 'Add Check-in' }).getByRole('button', { name: 'Save Check-in' }).click()
    await expect(page.getByText('Added by hand')).toBeVisible()

    const card = page.getByRole('region', { name: 'Install Habit Tracker' })
    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: 'Install app' })).toHaveCount(0)
    await expect(card.getByText(/Add to Home Screen/)).toBeVisible()
    await expect(card.getByText(/offline/)).toBeVisible()

    await page.getByRole('button', { name: `${user.name}'s profile` }).click()
    await page.getByRole('button', { name: 'Install app' }).click()
    const sheet = page.getByRole('dialog', { name: 'Install Habit Tracker' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText(/Add to Home Screen/)).toBeVisible()
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('durable storage is requested silently after the first Check-in, without blocking recording', async ({ browser }) => {
  const { helpers, user, context, page } = await signedInPage(browser, 'Storage User')
  try {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'storage', {
        configurable: true,
        value: {
          persist: () => { (window as unknown as { __persistCalls: number }).__persistCalls = ((window as unknown as { __persistCalls?: number }).__persistCalls ?? 0) + 1; return Promise.resolve(true) },
          persisted: () => Promise.resolve(false),
        },
      })
    })
    await page.goto('/today')
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('Storage task')
    await input.press('Enter')
    expect(await page.evaluate(() => (window as unknown as { __persistCalls?: number }).__persistCalls ?? 0)).toBe(0)
    await page.getByRole('button', { name: 'Add Check-in' }).click()
    await page.getByRole('dialog', { name: 'Add Check-in' }).getByRole('button', { name: 'Save Check-in' }).click()
    await expect(page.getByText('Added by hand')).toBeVisible()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __persistCalls?: number }).__persistCalls ?? 0)).toBeGreaterThanOrEqual(1)
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('the installed shell reloads offline and keeps Pending changes usable', async ({ browser }) => {
  // The dev server serves unbundled, unhashed module URLs that must never be cached (a change at the same
  // URL would otherwise go stale forever) — so a full offline reload only hydrates against a production
  // build, where every script is content-hashed and immutable. See public/sw.js's isImmutableAsset.
  test.skip(process.env.SMOKE_SERVER !== 'production', 'Offline hydration after reload only works against the built server; dev serves unbundled, uncached module URLs.')
  const { helpers, user, context, page } = await signedInPage(browser, 'Offline User')
  try {
    await page.goto('/today')
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 15_000 })
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('Survive offline reload')
    await input.press('Enter')
    await expect(page.getByText('Survive offline reload')).toBeVisible()

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('textbox', { name: 'New Task' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Survive offline reload')).toBeVisible()
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('a new-version banner offers Reload, gated to "Update after your session" while focus runs or is paused', async ({ browser }) => {
  // The browser's update check byte-diffs the deployed sw.js itself, so a real (reversible) edit to the
  // served file is the only reliable way to exercise it — route interception does not reach the Service
  // Worker's own internal script fetch during registration.update(). The dev server rereads public/sw.js
  // from disk on every request, so the edit is visible immediately; the built server (nitro) serves
  // .output/public/sw.js from an in-memory snapshot taken at startup, so this in-place edit is invisible
  // to a running production process (a real deploy is a fresh process reading the newly-built file, which
  // scripts/stamp-service-worker.mjs already guarantees differs — see that script's own comment).
  test.skip(process.env.SMOKE_SERVER === 'production', 'The built server caches sw.js in memory per process; only a fresh process (a real deploy) observes a rewritten file.')
  // Always public/sw.js here (never .output/public/sw.js): this test only runs against the dev server,
  // and a stale .output from an earlier local build must not shadow the file the dev server actually serves.
  const swPath = 'public/sw.js'
  if (!existsSync(swPath)) throw new Error('Could not locate public/sw.js to stamp for this test.')
  const originalSw = readFileSync(swPath, 'utf8')
  const { helpers, user, context, page } = await signedInPage(browser, 'Update User')
  try {
    await page.goto('/today')
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 15_000 })
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('Update gating task')
    await input.press('Enter')

    writeFileSync(swPath, `${originalSw}\n// test build ${crypto.randomUUID()}\n`)
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      await registration?.update()
    })

    const banner = page.getByRole('alert', { name: 'New version available' })
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await expect(banner.getByRole('button', { name: 'Reload' })).toBeEnabled()

    await page.getByRole('button', { name: 'Update gating task, open, 0 focused minutes' }).click()
    await page.getByRole('button', { name: 'Start Session' }).click()
    await expect(page.getByText('Focusing on Update gating task')).toBeVisible()
    await expect(banner.getByRole('button', { name: 'Update after your session' })).toBeDisabled()

    await page.getByRole('button', { name: 'Pause Session' }).click()
    await expect(page.getByRole('button', { name: 'Resume Session' })).toBeVisible()
    await expect(banner.getByRole('button', { name: 'Update after your session' })).toBeDisabled()

    await page.getByRole('button', { name: 'Stop' }).click()
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible()
    const reloadButton = banner.getByRole('button', { name: 'Reload' })
    await expect(reloadButton).toBeEnabled()

    const reloaded = page.waitForEvent('load')
    await reloadButton.click()
    await reloaded
  } finally {
    writeFileSync(swPath, originalSw)
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('the offline shell and privacy policy are eagerly precached before they are ever visited', async ({ browser }) => {
  test.skip(process.env.SMOKE_SERVER !== 'production', 'Eager precaching of un-visited routes only happens against the built server; dev serves an unbundled shell.')
  const { helpers, user, context, page } = await signedInPage(browser, 'Precache User')
  try {
    await page.goto('/today')
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 15_000 })
    await expect.poll(async () => (await page.evaluate(async () => (await caches.open('habit-tracker-precache')).keys().then(keys => keys.length))), { timeout: 15_000 }).toBeGreaterThan(0)

    await context.setOffline(true)
    const response = await page.goto('/privacy')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeVisible()
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})
