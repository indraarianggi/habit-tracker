import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { authOptions } from '@/server/auth'
import { database } from '@/server/db'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

test('returning after an elapsed interval chooses whole minutes or no focus while a paused Session stays paused', async ({ browser }) => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `recovery-browser-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
    const page = await context.newPage()
    await page.goto('/today')
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('Recover my focus')
    await input.press('Enter')
    const start = page.getByRole('button', { name: 'Start Session' })
    await start.click()
    await expect(page.getByText('Focusing on Recover my focus')).toBeVisible()
    await page.getByRole('button', { name: 'Pause Session' }).click()
    await expect(page.getByRole('button', { name: 'Resume Session' })).toBeVisible()
    await expect.poll(async () => (await (await context.request.get('/api/session')).json()).session?.status).toBe('paused')
    database.prepare('UPDATE active_session SET startedAt = ? WHERE userId = ?').run(
      new Date(Date.now() - 26 * 60 * 60_000).toISOString(), user.id,
    )
    await page.reload()
    await expect(page.getByRole('button', { name: 'Resume Session' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'While you were away' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Resume Session' }).click()
    await expect(page.getByRole('button', { name: 'Pause Session' })).toBeVisible()
    await expect.poll(async () => (await (await context.request.get('/api/session')).json()).session?.status).toBe('running')
    const firstSession = (await (await context.request.get('/api/session')).json()).session as { id: string }
    const elapsedAt = new Date(Date.now() - 26 * 60_000).toISOString()
    database.prepare('UPDATE active_session SET segmentStartedAt = ?, lastControlAt = ? WHERE id = ?').run(
      elapsedAt, elapsedAt, firstSession.id,
    )
    await page.reload()
    const recovery = page.getByRole('dialog', { name: 'While you were away' })
    await expect(recovery).toBeVisible()
    await recovery.getByRole('button', { name: 'Partly finished' }).click()
    await recovery.getByRole('spinbutton', { name: 'Focused minutes' }).fill('7')
    await recovery.getByRole('button', { name: 'Save 7 min' }).click()
    await expect(recovery).toHaveCount(0)
    await expect(page.getByText('7 min')).toBeVisible()
    await expect(start).toBeVisible()

    await start.click()
    await expect(page.getByText('Focusing on Recover my focus')).toBeVisible()
    const secondSession = (await (await context.request.get('/api/session')).json()).session as { id: string }
    const secondElapsedAt = new Date(Date.now() - 26 * 60_000).toISOString()
    database.prepare('UPDATE active_session SET segmentStartedAt = ?, lastControlAt = ? WHERE id = ?').run(
      secondElapsedAt, secondElapsedAt, secondSession.id,
    )
    await page.reload()
    await expect(recovery).toBeVisible()
    await recovery.getByRole('button', { name: 'No focus' }).click()
    await expect(start).toBeVisible()
    await expect(page.getByText('7 min')).toBeVisible()
    const response = await context.request.get('/api/session')
    const state: { session: unknown; checkins: Array<{ durationMinutes: number }> } = await response.json()
    expect(state.session).toBeNull()
    expect(state.checkins.map(checkin => checkin.durationMinutes)).toEqual([7])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.setViewportSize({ width: 1024, height: 768 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('normal visible completion shows one dismissible focus-end alert', async ({ browser }) => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `focus-end-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
    const page = await context.newPage()
    await page.clock.install()
    await page.goto('/today')
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('Stay present')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Start Session' }).click()
    await expect(page.getByText('Focusing on Stay present')).toBeVisible()
    await page.clock.runFor(25 * 60_000)
    await expect(page.getByRole('alert', { name: 'Focus interval complete' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'While you were away' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Dismiss focus alert' }).click()
    await page.clock.runFor(10_000)
    await expect(page.getByRole('alert', { name: 'Focus interval complete' })).toHaveCount(0)
    const response = await context.request.get('/api/session')
    const state: { checkins: Array<{ durationMinutes: number }> } = await response.json()
    expect(state.checkins.map(checkin => checkin.durationMinutes)).toEqual([25])
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})
