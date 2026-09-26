import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

test('offline Task remains available, reconnect uploads it and enables Start automatically', async ({ browser }) => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `reconnect-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
    const page = await context.newPage()
    await page.goto('/today')
    await expect(page.getByRole('textbox', { name: 'New Task' })).toBeVisible()
    await context.setOffline(true)
    await page.getByRole('textbox', { name: 'New Task' }).fill('Reconnect task')
    await page.getByRole('textbox', { name: 'New Task' }).press('Enter')
    await expect(page.getByRole('button', { name: 'Offline' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeDisabled()
    await page.getByRole('button', { name: 'Offline' }).click()
    await expect(page.getByRole('dialog', { name: 'Sync status' })).toContainText('saved here')
    await expect(page.getByRole('button', { name: 'Sync now' })).toBeDisabled()
    await page.getByRole('button', { name: 'Close sync status' }).click()
    await context.setOffline(false)
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Offline' })).toHaveCount(0)
    await expect.poll(async () => (await (await context.request.get('/api/sync/pull?after=0&limit=100')).json()).changes.length).toBe(1)
    await expect(page.getByRole('button', { name: '1 change waiting' })).toHaveCount(0)
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})
