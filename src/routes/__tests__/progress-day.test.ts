import { expect, test, type Page } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { v7 as uuidv7 } from 'uuid'
import { localDay } from '@/lib/task-contract'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

function shiftDay(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return localDay(date)
}

function statTile(page: Page, label: string) {
  return page.locator('section[aria-label="Focus statistics"] > div', { hasText: label })
}

test('adding and correcting a past Check-in from the Progress Day panel updates the grid and streaks', async ({ browser }) => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `progress-day-browser-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
    const yesterday = shiftDay(-1)
    const task = {
      id: uuidv7(), day: yesterday, title: 'Draft the report', completed: false,
      orderKey: '00000000000000010000000000000000', createdAt: new Date().toISOString(),
    }
    const seed = await context.request.post('/api/sync/push', { data: { changes: [{ id: uuidv7(), task }] } })
    expect((await seed.json()).results[0].status).toBe('accepted')

    const page = await context.newPage()
    await page.goto('/today')
    await page.getByRole('button', { name: 'Progress', exact: true }).click()
    const grid = page.getByRole('grid', { name: 'Activity Grid' })
    await expect(grid).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Today ·/ })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'New Task' })).toBeVisible()
    await expect(statTile(page, 'Current Focus Streak')).toContainText('0 days')

    const pastCell = page.locator(`[role="gridcell"][data-day="${yesterday}"]`)
    await pastCell.click()
    const dialog = page.getByRole('dialog', { name: 'Day details' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Draft the report')).toBeVisible()
    await expect(dialog.getByText('No focus recorded.')).toBeVisible()
    // Past Days never offer the add-Task input, in the dialog or the panel behind it.
    await expect(page.getByRole('textbox', { name: 'New Task' })).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Add Check-in' }).click()
    const addSheet = page.getByRole('dialog', { name: 'Add Check-in' })
    await addSheet.getByLabel('Focused minutes').fill('40')
    await addSheet.getByRole('button', { name: 'Save Check-in' }).click()

    await expect(pastCell).toHaveAttribute('aria-label', /40 minutes, 1 Check-in, 0 of 1 Tasks completed/)
    await expect(statTile(page, 'Focused time')).toContainText('40 min')
    await expect(statTile(page, 'Current Focus Streak')).toContainText('1 days')
    await expect(statTile(page, 'Longest Focus Streak')).toContainText('1 days')
    await expect(statTile(page, 'Active Days')).toContainText('1 days')

    await page.getByRole('button', { name: 'Edit Check-in for Draft the report' }).click()
    const editSheet = page.getByRole('dialog', { name: 'Edit Check-in' })
    await editSheet.getByLabel('Focused minutes').fill('15')
    await editSheet.getByRole('button', { name: 'Save changes' }).click()

    await expect(pastCell).toHaveAttribute('aria-label', /15 minutes, 1 Check-in, 0 of 1 Tasks completed/)
    await expect(statTile(page, 'Focused time')).toContainText('15 min')
    await expect(statTile(page, 'Current Focus Streak')).toContainText('1 days')
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})
