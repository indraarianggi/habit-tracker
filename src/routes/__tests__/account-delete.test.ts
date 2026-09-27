import { expect, test, type Browser } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

async function signedIn(browser: Browser, name: string) {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `account-delete-${crypto.randomUUID()}@invalid.test`, name })
  await helpers.saveUser(user)
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  await context.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
  return { helpers, user, context }
}

test('the Danger zone journey shows real counts, requires the typed word, deletes online only, wipes this device and confirms on sign-in', async ({ browser }) => {
  const { helpers, user, context } = await signedIn(browser, 'Deleting')
  try {
    const page = await context.newPage()
    await page.goto('/today')
    await page.getByRole('textbox', { name: 'New Task' }).fill('Keep me honest')
    await page.getByRole('textbox', { name: 'New Task' }).press('Enter')
    await page.getByRole('button', { name: 'Add Check-in' }).click()
    await page.getByRole('dialog', { name: 'Add Check-in' }).getByRole('button', { name: 'Save Check-in' }).click()
    await expect(page.getByText('25 min')).toBeVisible()

    await page.getByRole('button', { name: /deleting.*profile/i }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await page.getByRole('button', { name: 'Delete account and data' }).click()
    const sheet = page.getByRole('dialog', { name: 'Delete account and data' })
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText('This cannot be undone.')
    await expect(sheet).toContainText('1 Task, and 1 Check-in')
    await expect(sheet).toContainText('backups for up to 30 days')

    const confirmButton = sheet.getByRole('button', { name: 'Delete my account and data' })
    await expect(confirmButton).toBeDisabled()
    await sheet.getByRole('textbox', { name: 'Type DELETE to confirm' }).fill('delete')
    await expect(confirmButton).toBeDisabled()

    await context.setOffline(true)
    await sheet.getByRole('textbox', { name: 'Type DELETE to confirm' }).fill('DELETE')
    await expect(sheet).toContainText('Connect to the internet to delete your account.')
    await expect(confirmButton).toBeDisabled()
    await context.setOffline(false)
    await expect(confirmButton).toBeEnabled()

    await confirmButton.click()
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
    await expect(page.getByText('Your account and its data have been deleted.')).toBeVisible()
    await expect(page.getByText('Keep me honest')).toHaveCount(0)

    expect((await context.request.get('/api/today')).status()).toBe(401)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'New Task' })).toHaveCount(0)
  } finally {
    await context.close()
    try { await helpers.deleteUser(user.id) } catch { /* Already deleted by the test itself. */ }
  }
})

test('a second signed-in device recognizes the account is gone and wipes itself automatically', async ({ browser }) => {
  const { helpers, user, context } = await signedIn(browser, 'Elsewhere')
  const second = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await second.addCookies(await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }))
    const page = await context.newPage()
    const other = await second.newPage()
    await page.goto('/today')
    await page.getByRole('textbox', { name: 'New Task' }).fill('Visible on both devices')
    await page.getByRole('textbox', { name: 'New Task' }).press('Enter')
    await expect(page.getByText('Visible on both devices')).toBeVisible()

    await other.goto('/today')
    await expect(other.getByText('Visible on both devices')).toBeVisible()

    await page.getByRole('button', { name: /elsewhere.*profile/i }).click()
    await page.getByRole('button', { name: 'Delete account and data' }).click()
    const sheet = page.getByRole('dialog', { name: 'Delete account and data' })
    await sheet.getByRole('textbox', { name: 'Type DELETE to confirm' }).fill('DELETE')
    await sheet.getByRole('button', { name: 'Delete my account and data' }).click()
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()

    await expect(other.getByRole('button', { name: 'Sign in with Google' })).toBeVisible({ timeout: 15_000 })
    await expect(other.getByText('Your account was deleted on another device.')).toBeVisible()
    await other.reload()
    await expect(other.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
    await expect(other.getByText('Visible on both devices')).toHaveCount(0)
  } finally {
    await context.close()
    await second.close()
    try { await helpers.deleteUser(user.id) } catch { /* Already deleted by the test itself. */ }
  }
})

test('another signed-in User’s data on a shared device is untouched, and the deleted credentials cannot sync again', async ({ browser }) => {
  const alice = await signedIn(browser, 'Alice')
  const bob = await signedIn(browser, 'Bob')
  try {
    const page = await alice.context.newPage()
    await page.goto('/today')
    await page.getByRole('textbox', { name: 'New Task' }).fill('Alice only')
    await page.getByRole('textbox', { name: 'New Task' }).press('Enter')
    await expect(page.getByText('Alice only')).toBeVisible()
    const aliceCookies = await alice.context.cookies()

    await alice.context.clearCookies()
    await alice.context.addCookies(await bob.helpers.getCookies({ userId: bob.user.id, domain: '127.0.0.1' }))
    await page.reload()
    await page.getByRole('textbox', { name: 'New Task' }).fill('Bob only')
    await page.getByRole('textbox', { name: 'New Task' }).press('Enter')
    await expect(page.getByText('Bob only')).toBeVisible()
    await expect(page.getByText('Alice only')).toHaveCount(0)

    await alice.context.clearCookies()
    await alice.context.addCookies(aliceCookies)
    await page.reload()
    await expect(page.getByText('Alice only')).toBeVisible()
    await page.getByRole('button', { name: /alice.*profile/i }).click()
    await page.getByRole('button', { name: 'Delete account and data' }).click()
    const sheet = page.getByRole('dialog', { name: 'Delete account and data' })
    await sheet.getByRole('textbox', { name: 'Type DELETE to confirm' }).fill('DELETE')
    await sheet.getByRole('button', { name: 'Delete my account and data' }).click()
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()

    await alice.context.clearCookies()
    await alice.context.addCookies(await bob.helpers.getCookies({ userId: bob.user.id, domain: '127.0.0.1' }))
    await page.reload()
    await expect(page.getByText('Bob only')).toBeVisible()
    await expect(page.getByText('Alice only')).toHaveCount(0)

    await alice.context.clearCookies()
    await alice.context.addCookies(aliceCookies)
    expect((await alice.context.request.get('/api/today')).status()).toBe(401)
    expect((await alice.context.request.get('/api/sync/pull?after=0')).status()).toBe(401)
  } finally {
    await alice.context.close()
    await bob.context.close()
    try { await alice.helpers.deleteUser(alice.user.id) } catch { /* Already deleted by the test itself. */ }
    await bob.helpers.deleteUser(bob.user.id)
  }
})
