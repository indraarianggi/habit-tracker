import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

test('Task warning reports actual Check-ins, cancel preserves history, and active focus blocks deletion', async ({ browser }) => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `task-delete-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
    const page = await context.newPage()
    await page.goto('/today')
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    await input.fill('Draft report')
    await input.press('Enter')
    for (const minutes of ['12', '25']) {
      await page.getByRole('button', { name: 'Add Check-in' }).click()
      const add = page.getByRole('dialog', { name: 'Add Check-in' })
      await add.getByLabel('Focused minutes').fill(minutes)
      await add.getByRole('button', { name: 'Save Check-in' }).click()
    }
    await expect.poll(async () => {
      const response = await context.request.get('/api/session')
      const body: { checkins: unknown[] } = await response.json()
      return body.checkins.length
    }).toBe(2)
    await page.getByRole('button', { name: 'Tasks', exact: true }).click()
    const row = page.getByRole('listitem', { name: 'Draft report, open, 37 focused minutes' })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Actions for Draft report' }).click()
    await page.getByRole('button', { name: /Delete Task/ }).click()
    const warning = page.getByRole('dialog', { name: 'Delete Draft report' })
    await expect(warning).toContainText('2 Check-ins')
    await expect(warning).toContainText('37 focused minutes')
    await warning.getByRole('button', { name: 'Keep Task' }).click()
    await expect(row).toBeVisible()
    await expect(page.getByText('37m focused')).toBeVisible()

    await page.getByRole('button', { name: 'Timer', exact: true }).click()
    await page.getByRole('button', { name: 'Start Session' }).click()
    await page.getByRole('button', { name: 'Tasks', exact: true }).click()
    await row.getByRole('button', { name: 'Actions for Draft report' }).click()
    await expect(page.getByText('Stop or finish the session first')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete Task' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Rename Task' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Move up' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Mark as complete' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Copy to a later Day →' })).toBeEnabled()
    await page.getByRole('button', { name: 'Close Task actions' }).click()
    await page.getByRole('button', { name: 'Timer', exact: true }).click()
    await page.getByRole('button', { name: 'Pause Session' }).click()
    await page.getByRole('button', { name: 'Tasks', exact: true }).click()
    await row.getByRole('button', { name: 'Actions for Draft report' }).click()
    await expect(page.getByRole('button', { name: 'Delete Task' })).toBeDisabled()
    await page.getByRole('button', { name: 'Close Task actions' }).click()
    await page.getByRole('button', { name: 'Timer', exact: true }).click()
    await page.getByRole('button', { name: 'Stop' }).click()
    await page.getByRole('button', { name: 'Tasks', exact: true }).click()
    await row.getByRole('button', { name: 'Actions for Draft report' }).click()
    await page.getByRole('button', { name: /Delete Task/ }).click()
    await warning.getByRole('button', { name: 'Delete Task permanently' }).click()
    await expect(row).toHaveCount(0)
    await expect.poll(async () => {
      const response = await context.request.get('/api/session')
      const body: { checkins: unknown[] } = await response.json()
      return body.checkins.length
    }).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.setViewportSize({ width: 1024, height: 768 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})
