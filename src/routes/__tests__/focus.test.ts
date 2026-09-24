import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

test('Timer selects completed Tasks, blocks offline Start, controls focus and records an offline finish independently of completion', async ({ browser }) => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `focus-browser-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
    const page = await context.newPage()
    await page.clock.install()
    await page.goto('/today')
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await expect(page.getByText('What will you focus on today?')).toBeVisible()
    await input.fill('Deep work')
    await input.press('Enter')
    await expect(page.getByRole('button', { name: 'Deep work, open, 0 focused minutes' })).toHaveAttribute('aria-pressed', 'true')
    const start = page.getByRole('button', { name: 'Start Session' })
    await context.setOffline(true)
    await expect(start).toBeDisabled()
    await expect(page.getByText('Connect to the internet to start a session.')).toBeVisible()
    await context.setOffline(false)
    await expect(start).toBeEnabled()
    await start.click()
    await expect(page.getByText('Focusing on Deep work')).toBeVisible()
    await expect(input).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Mark as complete' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Tasks', exact: true }).click()
    await page.getByRole('button', { name: 'Actions for Deep work' }).click()
    await page.getByRole('button', { name: 'Mark as complete' }).click()
    await page.getByRole('button', { name: 'Timer', exact: true }).click()
    await expect(page.getByText('Focusing on Deep work')).toBeVisible()
    await page.getByRole('button', { name: 'Pause Session' }).click()
    await expect(page.getByRole('button', { name: 'Resume Session' })).toBeVisible()
    await page.clock.fastForward(60_000)
    await expect(page.getByText('25:00')).toBeVisible()
    await page.getByRole('button', { name: 'Stop' }).click()
    await expect(page.getByText('No focus recorded today yet.')).toBeVisible()
    await expect(start).toBeVisible()

    await start.click()
    await page.getByRole('button', { name: 'Pause Session' }).click()
    await page.getByRole('button', { name: 'Resume Session' }).click()
    await context.setOffline(true)
    await page.clock.fastForward(25 * 60_000)
    await expect(page.getByRole('dialog', { name: 'While you were away' })).toBeVisible()
    await page.getByRole('button', { name: 'Fully finished · 25 min' }).click()
    await expect(page.getByText('25 min')).toBeVisible()
    await expect(page.getByText('Pomodoro')).toBeVisible()
    await context.setOffline(false)
    await expect.poll(async () => {
      const response = await context.request.get('/api/session')
      const body: { checkins: Array<{ taskId: string; durationMinutes: number }> } = await response.json()
      return body.checkins.filter(checkin => checkin.durationMinutes === 25).length
    }).toBe(1)
    await page.getByRole('button', { name: 'Tasks', exact: true }).click()
    await expect(page.getByRole('listitem', { name: 'Deep work, complete, 25 focused minutes' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.setViewportSize({ width: 1024, height: 768 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})
