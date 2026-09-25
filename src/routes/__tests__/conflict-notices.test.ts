import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

test('offline lost focus and failed reassignment produce distinct dismissible notices', async ({ browser }) => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `conflict-notice-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const first = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const second = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    const cookies = await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' })
    await first.addCookies(cookies)
    await second.addCookies(cookies)
    const page = await first.newPage()
    await page.goto('/today')
    const input = page.getByRole('textbox', { name: 'New Task' })
    await expect(input).toBeVisible()
    for (const [index, name] of ['Lost task', 'Original focus', 'Deleted destination'].entries()) {
      await input.fill(name)
      await input.press('Enter')
      await expect.poll(async () => {
        const data = await (await first.request.get('/api/sync/pull?after=0')).json()
        return data.changes.filter((item: { task?: unknown }) => item.task).length
      }).toBe(index + 1)
    }
    const remote = await second.newPage()
    await remote.goto('/today')
    await remote.getByRole('button', { name: 'Tasks', exact: true }).click()
    await expect(remote.getByRole('listitem', { name: 'Lost task, open, 0 focused minutes' })).toBeVisible()

    await first.setOffline(true)
    await page.getByRole('button', { name: 'Add Check-in' }).click()
    const add = page.getByRole('dialog', { name: 'Add Check-in' })
    await add.getByLabel('Task').selectOption({ label: 'Lost task' })
    await add.getByLabel('Focused minutes').fill('27')
    await add.getByRole('button', { name: 'Save Check-in' }).click()
    const lostRow = remote.getByRole('listitem', { name: 'Lost task, open, 0 focused minutes' })
    await lostRow.getByRole('button', { name: 'Actions for Lost task' }).click()
    await remote.getByRole('button', { name: /Delete Task/ }).click()
    await remote.getByRole('dialog', { name: 'Delete Lost task' }).getByRole('button', { name: 'Delete Task permanently' }).click()
    await expect.poll(async () => (await (await second.request.get('/api/sync/pull?after=0')).json())
      .changes.filter((item: { deletedTaskId?: string }) => item.deletedTaskId).length).toBe(1)
    await expect(lostRow).toHaveCount(0)
    await first.setOffline(false)
    const lost = page.getByRole('alert', { name: 'Sync conflict' })
    await expect(lost).toContainText('27 min on "Lost task"')
    await expect(lost).toContainText('wasn\'t saved because that Task was deleted')
    expect(await lost.evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0)
    await lost.getByRole('button', { name: 'Dismiss sync notice' }).click()
    await expect(lost).toHaveCount(0)

    await page.getByRole('button', { name: 'Add Check-in' }).click()
    const accepted = page.getByRole('dialog', { name: 'Add Check-in' })
    await accepted.getByLabel('Task').selectOption({ label: 'Original focus' })
    await accepted.getByLabel('Focused minutes').fill('25')
    await accepted.getByRole('button', { name: 'Save Check-in' }).click()
    await expect.poll(async () => (await (await first.request.get('/api/session')).json()).checkins.length).toBe(1)
    await first.setOffline(true)
    await page.getByRole('button', { name: 'Edit Check-in for Original focus' }).click()
    const edit = page.getByRole('dialog', { name: 'Edit Check-in' })
    await edit.getByLabel('Task').selectOption({ label: 'Deleted destination' })
    await edit.getByLabel('Focused minutes').fill('30')
    await edit.getByRole('button', { name: 'Save changes' }).click()
    const destination = remote.getByRole('listitem', { name: 'Deleted destination, open, 0 focused minutes' })
    await destination.getByRole('button', { name: 'Actions for Deleted destination' }).click()
    await remote.getByRole('button', { name: /Delete Task/ }).click()
    await remote.getByRole('dialog', { name: 'Delete Deleted destination' }).getByRole('button', { name: 'Delete Task permanently' }).click()
    await expect.poll(async () => (await (await second.request.get('/api/sync/pull?after=0')).json())
      .changes.filter((item: { deletedTaskId?: string }) => item.deletedTaskId).length).toBe(2)
    await first.setOffline(false)
    const move = page.getByRole('alert', { name: 'Sync conflict' })
    await expect(move).toContainText('only the move failed')
    await expect(move).toContainText('25 min stayed on "Original focus"')
    await expect(page.getByRole('button', { name: 'Edit Check-in for Original focus' })).toBeVisible()
    await page.setViewportSize({ width: 1024, height: 768 })
    await move.getByRole('button', { name: 'Dismiss sync notice' }).click()
    await expect(move).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally {
    await first.close()
    await second.close()
    await helpers.deleteUser(user.id)
  }
})
