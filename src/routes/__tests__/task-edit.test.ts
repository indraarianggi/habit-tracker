import { expect, test, type Page } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { v7 as uuidv7 } from 'uuid'
import { localDay } from '@/lib/task-contract'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })
async function openPastDay(page: Page, day: string) {
  const [year, month, date] = day.split('-').map(Number)
  const label = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
    .format(new Date(year, month - 1, date, 12))
  const button = page.getByRole('button', { name: label })
  if (!(await button.count())) await page.getByRole('button', { name: 'Previous week' }).click()
  await button.click()
}

test('Tasks controls rename past and complete Tasks, reorder without play, and retain changes after reload', async ({ browser }) => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `task-controls-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    const past = localDay(pastDate)
    const pastTask = { id: uuidv7(), day: past, title: 'Yesterday’s work', completed: true,
      orderKey: '00000000000000010000000000000000', createdAt: new Date().toISOString() }
    const seed = await context.request.post('/api/sync/push', {
      data: { changes: [{ id: uuidv7(), task: pastTask }] },
    })
    expect(seed.status()).toBe(200)
    const page = await context.newPage()
    await page.goto('/today')
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    for (const title of ['First', 'Second', 'Third']) {
      await input.fill(title)
      await input.press('Enter')
      await expect(page.getByText(title, { exact: true })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Tasks', exact: true }).click()
    const list = page.getByRole('list', { name: 'Tasks for selected Day' })
    await expect(list.getByRole('listitem')).toHaveCount(3)
    await expect(list.getByRole('listitem').filter({ hasText: 'Second' })).toHaveAttribute('aria-label', 'Second, open, 0 focused minutes')
    await expect(page.getByRole('button', { name: /Start Session|Play/ })).toHaveCount(0)
    await list.getByRole('button', { name: 'Actions for Second' }).click()
    await page.getByRole('button', { name: 'Mark as complete' }).click()
    await expect(list.getByRole('listitem').filter({ hasText: 'Second' })).toHaveAttribute('aria-label', 'Second, complete, 0 focused minutes')
    await expect(list.getByRole('listitem').filter({ hasText: 'Second' }).getByText('Second')).toHaveCSS('text-decoration-line', 'line-through')
    await list.getByRole('button', { name: 'Actions for Second' }).click()
    await page.getByRole('button', { name: 'Reopen Task' }).click()
    await expect(list.getByRole('listitem').filter({ hasText: 'Second' })).toHaveAttribute('aria-label', 'Second, open, 0 focused minutes')
    await list.getByRole('button', { name: 'Actions for Third' }).click()
    await page.getByRole('button', { name: 'Move up' }).click()
    await expect(list.getByRole('listitem')).toHaveText([/First/, /Third/, /Second/])
    await list.getByRole('button', { name: 'Actions for Third' }).click()
    await page.getByRole('button', { name: 'Move down' }).click()
    await expect(list.getByRole('listitem')).toHaveText([/First/, /Second/, /Third/])
    await list.getByRole('button', { name: 'Actions for Third' }).click()
    await page.getByRole('button', { name: 'Move up' }).click()
    await expect(list.getByRole('listitem')).toHaveText([/First/, /Third/, /Second/])
    await page.reload()
    await page.getByRole('button', { name: 'Tasks', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Tasks for selected Day' }).getByRole('listitem')).toHaveText([/First/, /Third/, /Second/])
    await openPastDay(page, past)
    const pastRow = page.getByRole('listitem', { name: 'Yesterday’s work, complete, 0 focused minutes' })
    await expect(pastRow).toBeVisible()
    await pastRow.getByRole('button', { name: 'Actions for Yesterday’s work' }).click()
    await page.getByRole('button', { name: 'Rename Task' }).click()
    await page.getByRole('textbox', { name: 'Task title' }).fill('  Renamed yesterday  ')
    await page.getByRole('button', { name: 'Save title' }).click()
    await expect(page.getByRole('listitem', { name: 'Renamed yesterday, complete, 0 focused minutes' })).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'Tasks', exact: true }).click()
    await openPastDay(page, past)
    await expect(page.getByRole('listitem', { name: 'Renamed yesterday, complete, 0 focused minutes' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.setViewportSize({ width: 1024, height: 768 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})
