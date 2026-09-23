import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

test('Today creates duplicate Tasks locally, validates titles and recovers first load', async ({ browser }) => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `task-browser-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
    const page = await context.newPage()
    await page.route('**/api/sync/pull**', route => route.abort())
    await page.goto('/today')
    await expect(page.getByText('Loading your data…')).toBeVisible()
    await expect(page.getByText('Connect to the internet to load your data.')).toBeVisible()
    await page.unroute('**/api/sync/pull**')
    await page.getByRole('button', { name: 'Try again' }).click()
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('  Plan Tuesday  ')
    await input.press('Enter')
    await expect(page.getByText('Plan Tuesday', { exact: true })).toHaveCount(1)
    await input.fill('Plan Tuesday')
    await input.press('Enter')
    await expect(page.getByText('Plan Tuesday', { exact: true })).toHaveCount(2)
    await input.fill('   ')
    await input.press('Enter')
    await expect(page.getByRole('alert').getByText('Enter a Task title.')).toBeVisible()
    await input.fill('x'.repeat(121))
    await input.press('Enter')
    await expect(page.getByRole('alert').getByText('Task titles must be 120 characters or fewer.')).toBeVisible()
    await context.setOffline(true)
    await input.fill('Offline Task')
    await input.press('Enter')
    await expect(page.getByText('Offline Task', { exact: true })).toBeVisible()
    await context.setOffline(false)
    await expect(page.getByText('Offline Task', { exact: true })).toBeVisible()
    await expect.poll(async () => {
      const response = await context.request.get('/api/sync/pull?after=0')
      const data: { changes: Array<{ task: { title: string } }> } = await response.json()
      return data.changes.some(({ task }) => task.title === 'Offline Task')
    }).toBe(true)
    await page.reload()
    await expect(page.getByText('Offline Task', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})
