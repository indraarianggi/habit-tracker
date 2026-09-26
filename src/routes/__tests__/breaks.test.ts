import { expect, test, type Browser } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { authOptions } from '@/server/auth'
import { database } from '@/server/db'

declare global {
  interface Window {
    wakeEvents: string[]
    alertTones: number[]
  }
}

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

async function signedIn(browser: Browser) {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `break-browser-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
  return { context, user, helpers }
}

test('focus offers either break or skip; break expiry waits for explicit next-Session consent without recording minutes', async ({ browser }) => {
  test.setTimeout(90_000)
  const { context, user, helpers } = await signedIn(browser)
  try {
    const page = await context.newPage()
    await page.clock.install()
    await page.goto('/today')
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('Design a flow')
    await input.press('Enter')
    const start = page.getByRole('button', { name: 'Start Session' })
    await start.click()
    await expect(page.getByText('Focusing on Design a flow')).toBeVisible()
    await page.clock.runFor(25 * 60_000)
    await expect(page.getByRole('alert', { name: 'Focus interval complete' })).toBeVisible()
    await expect(page.getByText('Take a break after Design a flow')).toBeVisible()
    await page.getByRole('button', { name: 'Short Break · 5 min' }).click()
    await expect(page.getByText('On a short Break from Design a flow')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause Session' })).toHaveCount(0)
    await page.clock.runFor(5 * 60_000)
    await expect(page.getByRole('alert', { name: 'Break is over!' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start Next Session' })).toBeVisible()
    expect((await (await context.request.get('/api/session')).json()).session).toBeNull()
    await page.clock.setSystemTime(new Date(Date.now() + 24 * 60 * 60_000))
    await page.clock.runFor(1_000)
    await expect(page.getByRole('button', { name: 'Start Next Session' })).toBeDisabled()
    expect((await (await context.request.get('/api/session')).json()).session).toBeNull()
    // The server clock is real; align the simulated browser before a second server-backed Start.
    await page.clock.setSystemTime(new Date())
    await page.clock.runFor(1_000)
    await expect(page.getByRole('button', { name: 'Start Next Session' })).toBeEnabled()
    await page.getByRole('button', { name: 'Start Next Session' }).click()
    await expect(page.getByText('Focusing on Design a flow')).toBeVisible()
    const state = await (await context.request.get('/api/session')).json()
    expect(state.checkins.map((checkin: { durationMinutes: number }) => checkin.durationMinutes)).toEqual([25])
    await page.getByRole('button', { name: 'Stop' }).click()
    await start.click()
    await page.clock.runFor(25 * 60_000)
    await page.getByRole('button', { name: 'Long Break · 15 min' }).click()
    await expect(page.getByText('On a long Break from Design a flow')).toBeVisible()
    await page.getByRole('button', { name: 'Skip Break' }).click()
    await expect(start).toBeVisible()
    expect((await (await context.request.get('/api/session')).json()).session).toBeNull()
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('a missed break end corrects wall-clock time without a focus recovery prompt and unsupported Wake Lock is disabled', async ({ browser }) => {
  const { context, user, helpers } = await signedIn(browser)
  try {
    const page = await context.newPage()
    await page.addInitScript(() => { Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true }) })
    await page.clock.install()
    await page.goto('/today')
    await page.getByRole('button', { name: /profile/i }).click()
    await expect(page.getByText('Not supported on this device')).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Keep screen awake' })).toBeDisabled()
    await page.getByRole('button', { name: 'Back' }).click()
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('Review plans')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Start Session' }).click()
    await expect(page.getByText('Focusing on Review plans')).toBeVisible()
    await page.clock.runFor(25 * 60_000)
    await page.getByRole('button', { name: 'Short Break · 5 min' }).click()
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
    await page.clock.fastForward(6 * 60_000)
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
    await expect(page.getByRole('alert', { name: 'Break is over!' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'While you were away' })).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('alert', { name: 'Break is over!' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'While you were away' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Dismiss Break' }).click()
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible()
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('gesture-unlocked focus and break tones differ; Wake Lock releases and reacquires with focus visibility', async ({ browser }) => {
  test.setTimeout(60_000)
  const { context, user, helpers } = await signedIn(browser)
  try {
    const page = await context.newPage()
    await page.addInitScript(() => {
      const events = window
      events.wakeEvents = []
      events.alertTones = []
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {
        request: async () => {
          events.wakeEvents.push('request')
          return { release: async () => { events.wakeEvents.push('release') } }
        },
      } })
      class AudioProbe {
        currentTime = 0
        destination = {}
        resume = async () => {}
        close = async () => {}
        createOscillator() {
          return {
            type: 'sine', frequency: { set value(value: number) { events.alertTones.push(value) } },
            connect: () => ({ connect: () => {} }), start: () => {}, stop: () => {},
          }
        }
        createGain() {
          return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }
        }
      }
      Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioProbe })
    })
    await page.clock.install()
    await page.goto('/today')
    await page.getByRole('button', { name: /profile/i }).click()
    await expect(page.getByRole('switch', { name: 'Keep screen awake' })).toBeEnabled()
    await page.getByRole('button', { name: 'Back' }).click()
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('Write proposal')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Start Session' }).click()
    await expect.poll(() => page.evaluate(() => window.wakeEvents)).toContain('request')
    await page.getByRole('button', { name: 'Pause Session' }).click()
    await expect.poll(() => page.evaluate(() => window.wakeEvents)).toContain('release')
    await page.getByRole('button', { name: 'Resume Session' }).click()
    await expect.poll(() => page.evaluate(() => window.wakeEvents.filter(event => event === 'request').length)).toBe(2)
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
    await expect.poll(() => page.evaluate(() => window.wakeEvents.filter(event => event === 'request').length)).toBe(3)
    await page.clock.runFor(25 * 60_000)
    await expect(page.getByRole('alert', { name: 'Focus interval complete' })).toBeVisible()
    await page.getByRole('button', { name: 'Short Break · 5 min' }).click()
    await page.clock.runFor(5 * 60_000)
    await expect(page.getByRole('alert', { name: 'Break is over!' })).toBeVisible()
    expect(await page.evaluate(() => window.alertTones)).toEqual([660, 880, 520, 390])
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('a recovered full focus offers No Break and does not start another Session', async ({ browser }) => {
  const { context, user, helpers } = await signedIn(browser)
  try {
    const page = await context.newPage()
    await page.goto('/today')
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('Close the loop')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Start Session' }).click()
    await expect(page.getByText('Focusing on Close the loop')).toBeVisible()
    const session = (await (await context.request.get('/api/session')).json()).session as { id: string }
    const elapsedAt = new Date(Date.now() - 26 * 60_000).toISOString()
    database.prepare('UPDATE active_session SET segmentStartedAt = ?, lastControlAt = ? WHERE id = ?').run(elapsedAt, elapsedAt, session.id)
    await page.reload()
    await page.getByRole('dialog', { name: 'While you were away' }).getByRole('button', { name: 'Fully finished · 25 min' }).click()
    await expect(page.getByText('Take a break after Close the loop')).toBeVisible()
    await page.getByRole('button', { name: 'No Break' }).click()
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible()
    expect((await (await context.request.get('/api/session')).json()).session).toBeNull()
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})
