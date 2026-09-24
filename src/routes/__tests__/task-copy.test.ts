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

function label(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    .format(new Date(year, month - 1, date, 12))
}

async function openDay(page: Page, day: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const button = page.getByRole('button', { name: label(day) })
    if (await button.count()) {
      await button.click()
      return
    }
    await page.getByRole('button', { name: day < localDay() ? 'Previous week' : 'Next week' }).click()
  }
  throw new Error(`Day ${day} not found in week navigation`)
}

test('week navigation plans future work and copies past unfinished work without moving it', async ({ browser, request }) => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `copy-browser-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
    const yesterday = shiftDay(-1)
    const tomorrow = shiftDay(1)
    const source = { id: uuidv7(), day: yesterday, title: 'Still here yesterday', completed: false,
      orderKey: '00000000000000010000000000000000', createdAt: new Date().toISOString() }
    const seed = await context.request.post('/api/sync/push', { data: { changes: [{ id: uuidv7(), task: source }] } })
    expect((await seed.json()).results[0].status).toBe('accepted')
    expect((await request.get('/api/sync/pull?after=0')).status()).toBe(401)
    expect((await context.request.get('/api/sync/pull?after=0')).status()).toBe(200)

    const page = await context.newPage()
    await page.goto('/today')
    await page.getByRole('button', { name: 'Tasks', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Previous week' })).toBeVisible()
    const monday = new Date()
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(sunday.getDate() + 6)
    const week = page.getByRole('region', { name: 'Choose a Day' })
    await expect(week.getByRole('button').nth(2)).toHaveAttribute('aria-label', new RegExp(`^${label(localDay(monday))}`))
    await expect(week.getByRole('button').nth(8)).toHaveAttribute('aria-label', new RegExp(`^${label(localDay(sunday))}`))
    await openDay(page, yesterday)
    await expect(page.getByRole('button', { name: `${label(yesterday)}, has Tasks` })).toBeVisible()
    await expect(page.getByText('Unfinished tasks stay on this Day. Tap Copy → to bring work forward.')).toBeVisible()
    const sourceRow = page.getByRole('listitem', { name: 'Still here yesterday, open, 0 focused minutes' })
    await expect(sourceRow.getByRole('button', { name: 'Copy →' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'New Task' })).toHaveCount(0)
    await sourceRow.getByRole('button', { name: 'Copy →' }).click()
    const destination = page.getByRole('textbox', { name: 'Destination Day' })
    await expect(destination).toHaveValue(localDay())
    await expect(destination).toHaveAttribute('min', localDay())
    await page.getByRole('button', { name: 'Copy Task' }).click()
    await expect(sourceRow).toBeVisible()
    await openDay(page, localDay())
    await expect(page.getByRole('listitem', { name: 'Still here yesterday, open, 0 focused minutes' })).toBeVisible()

    await openDay(page, tomorrow)
    await expect(page.getByRole('textbox', { name: 'New Task' })).toBeVisible()
    await expect(page.getByText('No Tasks for this Day. Add one above to plan ahead.')).toBeVisible()
    const input = page.getByRole('textbox', { name: 'New Task' })
    await input.fill('Tomorrow’s plan')
    await input.press('Enter')
    await expect(page.getByRole('listitem', { name: 'Tomorrow’s plan, open, 0 focused minutes' })).toBeVisible()
    await expect(page.getByRole('button', { name: `${label(tomorrow)}, has Tasks` })).toBeVisible()
    await page.getByRole('button', { name: 'Actions for Tomorrow’s plan' }).click()
    await page.getByRole('button', { name: 'Copy to a later Day →' }).click()
    await expect(page.getByRole('textbox', { name: 'Destination Day' })).toHaveAttribute('min', shiftDay(2))
    await page.getByRole('button', { name: 'Close Task actions' }).click()

    await openDay(page, shiftDay(-8))
    await expect(page.getByText('No Tasks for this Day.', { exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'New Task' })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.setViewportSize({ width: 1024, height: 768 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})
