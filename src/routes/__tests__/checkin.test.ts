import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

test('Timer adds, edits and deletes offline Check-ins without changing completion', async ({ browser }) => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `checkin-browser-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
    const page = await context.newPage()
    await page.goto('/today')
    const newTask = page.getByRole('textbox', { name: 'New Task' })
    await expect(newTask).toBeVisible()
    await context.setOffline(true)
    await newTask.fill('Draft notes')
    await newTask.press('Enter')
    await expect(page.getByRole('button', { name: 'Draft notes, open, 0 focused minutes' })).toBeVisible()
    await newTask.fill('Review notes')
    await newTask.press('Enter')
    await expect(page.getByText('No focus recorded today yet.')).toBeVisible()
    await page.getByRole('button', { name: 'Add Check-in' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add Check-in' })
    await expect(sheet.getByLabel('Focused minutes')).toHaveValue('25')
    await sheet.getByLabel('Task').selectOption({ label: 'Draft notes' })
    await sheet.getByLabel('Focused minutes').fill('31')
    await sheet.getByRole('button', { name: 'Save Check-in' }).click()
    await expect(page.getByText('Added by hand')).toBeVisible()
    await expect(page.getByText('31 min')).toBeVisible()
    await page.getByRole('button', { name: 'Edit Check-in for Draft notes' }).click()
    const edit = page.getByRole('dialog', { name: 'Edit Check-in' })
    await edit.getByLabel('Task').selectOption({ label: 'Review notes' })
    await edit.getByLabel('Focused minutes').fill('12')
    await edit.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('12 min')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Review notes, open, 12 focused minutes' })).toBeVisible()
    await context.setOffline(false)
    await expect.poll(async () => {
      const response = await context.request.get('/api/session')
      const body: { checkins: Array<{ durationMinutes: number }> } = await response.json()
      return body.checkins.map(checkin => checkin.durationMinutes)
    }).toEqual([12])
    await context.setOffline(true)
    await page.getByRole('button', { name: 'Edit Check-in for Review notes' }).click()
    await page.getByRole('button', { name: 'Delete Check-in' }).click()
    await page.getByRole('button', { name: 'Confirm deletion' }).click()
    await expect(page.getByText('No focus recorded today yet.')).toBeVisible()
    await context.setOffline(false)
    await expect.poll(async () => {
      const response = await context.request.get('/api/session')
      const body: { checkins: unknown[] } = await response.json()
      return body.checkins.length
    }).toBe(0)
    await page.getByRole('button', { name: 'Tasks', exact: true }).click()
    await expect(page.getByRole('listitem', { name: 'Review notes, open, 0 focused minutes' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.setViewportSize({ width: 1024, height: 768 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})
