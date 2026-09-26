import { expect, test, type Browser, type Page } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

async function signedIn(browser: Browser) {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `settings-${crypto.randomUUID()}@invalid.test`, name: 'Settings User' })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
  return { helpers, user, context }
}
async function openSettings(page: Page) {
  await page.goto('/today')
  await page.getByRole('button', { name: /settings user.*profile/i }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
}

test('profile Settings saves bounded durations across devices, rejects bad input and resets', async ({ browser }) => {
  const { helpers, user, context } = await signedIn(browser)
  const second = await browser.newContext({ viewport: { width: 375, height: 812 } })
  await second.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
  try {
    const page = await context.newPage()
    await openSettings(page)
    await expect(page.getByText(user.email)).toBeVisible()
    const focus = page.getByRole('spinbutton', { name: 'Focus minutes' })
    const short = page.getByRole('spinbutton', { name: 'Short Break minutes' })
    const long = page.getByRole('spinbutton', { name: 'Long Break minutes' })
    await expect(focus).toHaveValue('25')
    await page.getByRole('button', { name: 'Increase Focus' }).click()
    await expect(focus).toHaveValue('26')
    await focus.fill('120')
    await focus.press('Tab')
    await short.fill('30')
    await short.press('Tab')
    await long.fill('60')
    await long.press('Tab')
    await expect.poll(async () => (await context.request.get('/api/settings')).json()).toMatchObject({ settings: { focusMinutes: 120, shortBreakMinutes: 30, longBreakMinutes: 60 } })
    await focus.fill('121')
    await focus.press('Tab')
    await expect(page.getByRole('alert')).toContainText('1–120')
    await expect(focus).toHaveValue('120')
    await focus.fill('1.5')
    await focus.press('Tab')
    await expect(focus).toHaveValue('120')
    const other = await second.newPage()
    await openSettings(other)
    await expect(other.getByRole('spinbutton', { name: 'Focus minutes' })).toHaveValue('120')
    await expect(other.getByRole('spinbutton', { name: 'Short Break minutes' })).toHaveValue('30')
    await expect(other.getByRole('spinbutton', { name: 'Long Break minutes' })).toHaveValue('60')
    await page.getByRole('button', { name: 'Reset to defaults' }).click()
    await expect(focus).toHaveValue('25')
    await expect.poll(async () => (await context.request.get('/api/settings')).json()).toMatchObject({ settings: { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 } })
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByText('25:00')).toBeVisible()
  } finally {
    await context.close()
    await second.close()
    await helpers.deleteUser(user.id)
  }
})

test('active focus and chosen break retain their start durations when settings change', async ({ browser }) => {
  const { helpers, user, context } = await signedIn(browser)
  try {
    const page = await context.newPage()
    await page.clock.install()
    await openSettings(page)
    await page.getByRole('spinbutton', { name: 'Focus minutes' }).fill('1')
    await page.getByRole('spinbutton', { name: 'Focus minutes' }).press('Tab')
    await page.getByRole('spinbutton', { name: 'Short Break minutes' }).fill('2')
    await page.getByRole('spinbutton', { name: 'Short Break minutes' }).press('Tab')
    await expect.poll(async () => (await context.request.get('/api/settings')).json()).toMatchObject({ settings: { focusMinutes: 1, shortBreakMinutes: 2 } })
    await page.getByRole('button', { name: 'Back' }).click()
    await page.getByRole('textbox', { name: 'New Task' }).fill('Keep this interval')
    await page.getByRole('textbox', { name: 'New Task' }).press('Enter')
    await page.getByRole('button', { name: 'Start Session' }).click()
    await expect(page.getByText('01:00')).toBeVisible()
    await page.getByRole('button', { name: /settings user.*profile/i }).click()
    await page.getByRole('spinbutton', { name: 'Focus minutes' }).fill('3')
    await page.getByRole('spinbutton', { name: 'Focus minutes' }).press('Tab')
    await page.getByRole('spinbutton', { name: 'Short Break minutes' }).fill('4')
    await page.getByRole('spinbutton', { name: 'Short Break minutes' }).press('Tab')
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByRole('button', { name: 'Pause Session' })).toBeVisible()
    const active = await (await context.request.get('/api/session')).json()
    expect(active.session.plannedMinutes).toBe(1)
    await page.clock.runFor(60_000)
    await expect(page.getByRole('button', { name: 'Short Break · 2 min' })).toBeVisible()
    await page.getByRole('button', { name: 'Short Break · 2 min' }).click()
    await expect(page.getByText('02:00')).toBeVisible()
    await page.getByRole('button', { name: 'Skip Break' }).click()
    await expect(page.getByText('03:00')).toBeVisible()
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('device sounds, Wake Lock and theme remain on this device only', async ({ browser }) => {
  const { helpers, user, context } = await signedIn(browser)
  const second = await browser.newContext({ viewport: { width: 375, height: 812 } })
  await second.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
  try {
    const page = await context.newPage()
    await page.addInitScript(() => { Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true }) })
    await openSettings(page)
    await expect(page.getByText('Not supported on this device')).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Keep screen awake' })).toBeDisabled()
    await page.getByRole('switch', { name: 'Focus-end sound' }).click()
    await page.getByRole('switch', { name: 'Break-end sound' }).click()
    await page.getByText('Dark', { exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await page.getByRole('button', { name: /settings user.*profile/i }).click()
    await expect(page.getByRole('switch', { name: 'Focus-end sound' })).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked()
    const other = await second.newPage()
    await openSettings(other)
    await expect(other.getByRole('switch', { name: 'Focus-end sound' })).toHaveAttribute('aria-checked', 'true')
    await expect(other.getByRole('radio', { name: 'System' })).toBeChecked()
    await expect(other.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy')
    await expect(page.getByText('Only on this device')).toHaveCount(2)
  } finally {
    await context.close()
    await second.close()
    await helpers.deleteUser(user.id)
  }
})
