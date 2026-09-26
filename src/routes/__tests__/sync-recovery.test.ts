import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

async function createUser(name: string) {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ name, email: `recovery-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  return { helpers, user, cookies: await helpers.getCookies({ userId: user.id, domain: '127.0.0.1' }) }
}

test('online failures remain quiet until the third attempt, then Sync now recovers', async ({ browser }) => {
  const { helpers, user, cookies } = await createUser('Recovery')
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(cookies)
    const page = await context.newPage()
    await page.goto('/today')
    await expect(page.getByRole('heading', { name: 'What will you focus on today?' })).toBeVisible()
    let failures = 0
    await page.route('**/api/sync/push', async route => {
      failures++
      await route.fulfill({ status: 503, body: 'unavailable' })
    })
    await page.getByRole('textbox', { name: 'New Task' }).fill('Keep my work')
    await page.getByRole('textbox', { name: 'New Task' }).press('Enter')
    await expect(page.getByRole('button', { name: '1 change waiting' })).toBeVisible()
    await expect.poll(() => failures).toBeGreaterThanOrEqual(1)
    await expect(page.getByRole('button', { name: "Can't sync" })).toHaveCount(0)
    await expect.poll(() => failures, { timeout: 12_000 }).toBeGreaterThanOrEqual(3)
    await expect(page.getByRole('button', { name: "Can't sync" })).toBeVisible()
    await page.getByRole('button', { name: "Can't sync" }).click()
    await expect(page.getByRole('dialog', { name: 'Sync status' })).toContainText('Sync now')
    await page.unroute('**/api/sync/push')
    await page.getByRole('button', { name: 'Sync now' }).click()
    await expect(page.getByRole('button', { name: "Can't sync" })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '1 change waiting' })).toHaveCount(0)
    expect((await (await context.request.get('/api/sync/pull?after=0&limit=100')).json()).changes).toEqual(
      expect.arrayContaining([expect.objectContaining({ task: expect.objectContaining({ title: 'Keep my work' }) })]),
    )
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('sign-out syncs Pending work first and warns only while the online push still fails', async ({ browser }) => {
  const { helpers, user, cookies } = await createUser('Online')
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(cookies)
    const page = await context.newPage()
    await page.goto('/today')
    await expect(page.getByRole('textbox', { name: 'New Task' })).toBeVisible()
    await page.route('**/api/sync/push', route => route.fulfill({ status: 503, body: 'unavailable' }))
    await page.getByRole('textbox', { name: 'New Task' }).fill('Saved before sign-out')
    await page.getByRole('textbox', { name: 'New Task' }).press('Enter')
    await expect(page.getByRole('button', { name: '1 change waiting' })).toBeVisible()
    await page.getByRole('button', { name: "Online's profile" }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('dialog', { name: 'Unsent changes' })).toContainText('1 change')
    await page.getByRole('button', { name: 'Keep working' }).click()
    await page.unroute('**/api/sync/push')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Unsent changes' })).toHaveCount(0)
    const login = await helpers.login({ userId: user.id })
    const response = await fetch('http://127.0.0.1:3000/api/sync/pull?after=0&limit=100', { headers: login.headers })
    expect((await response.json()).changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ task: expect.objectContaining({ title: 'Saved before sign-out' }) }),
    ]))
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('expired sign-in keeps local Tasks, Check-ins and settings editable and resumes for the same account', async ({ browser }) => {
  const { helpers, user, cookies } = await createUser('Returning')
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(cookies)
    const page = await context.newPage()
    await page.goto('/today')
    await expect(page.getByRole('textbox', { name: 'New Task' })).toBeVisible()
    await context.clearCookies()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Sign in to sync' })).toBeVisible()
    await page.getByRole('textbox', { name: 'New Task' }).fill('Offline after expiry')
    await page.getByRole('textbox', { name: 'New Task' }).press('Enter')
    await expect(page.getByText('Offline after expiry')).toBeVisible()
    await page.getByRole('button', { name: 'Add Check-in' }).click()
    await page.getByRole('dialog', { name: 'Add Check-in' }).getByRole('button', { name: 'Save Check-in' }).click()
    await expect(page.getByText('25 min')).toBeVisible()
    await page.getByRole('button', { name: "Returning's profile" }).click()
    await page.getByRole('button', { name: 'Increase Focus' }).click()
    await expect(page.getByRole('spinbutton', { name: 'Focus minutes' })).toHaveValue('26')
    await page.getByRole('button', { name: 'Back' }).click()
    await page.getByRole('button', { name: "Returning's profile" }).click()
    await expect(page.getByRole('spinbutton', { name: 'Focus minutes' })).toHaveValue('26')
    await page.reload()
    await page.getByRole('button', { name: "Returning's profile" }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('dialog', { name: 'Unsent changes' })).toContainText('3 changes')
    await page.getByRole('button', { name: 'Keep working' }).click()
    await page.getByRole('button', { name: 'Back' }).click()
    await page.route('https://accounts.google.com/**', route => route.fulfill({
      status: 200, contentType: 'text/html', body: '<title>Google authorization test stop</title>',
    }))
    await page.getByRole('button', { name: 'Sign in to sync' }).click()
    await page.waitForURL(/^https:\/\/accounts\.google\.com\//)
    expect(new URL(page.url()).searchParams.get('client_id')).toBe('browser-smoke-client')
    await context.addCookies(cookies)
    await page.goto('/today')
    await expect(page.getByRole('button', { name: /Offline after expiry, open/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in to sync' })).toHaveCount(0)
    await expect.poll(async () => (await (await context.request.get('/api/session')).json()).checkins.length).toBe(1)
    await expect.poll(async () => (await (await context.request.get('/api/settings')).json()).settings.focusMinutes).toBe(26)
    expect((await (await context.request.get('/api/sync/pull?after=0&limit=100')).json()).changes)
      .toEqual(expect.arrayContaining([expect.objectContaining({ task: expect.objectContaining({ title: 'Offline after expiry' }) })]))
  } finally {
    await context.close()
    await helpers.deleteUser(user.id)
  }
})

test('a live account switch cannot send the previous account’s Pending work to the new account', async ({ browser }) => {
  const alice = await createUser('Alice')
  const bob = await createUser('Bob')
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(alice.cookies)
    const page = await context.newPage()
    await page.goto('/today')
    await expect(page.getByRole('textbox', { name: 'New Task' })).toBeVisible()
    await page.route('**/api/sync/push', route => route.fulfill({ status: 503, body: 'unavailable' }))
    await page.getByRole('textbox', { name: 'New Task' }).fill('Private in flight')
    await page.getByRole('textbox', { name: 'New Task' }).press('Enter')
    await expect(page.getByRole('button', { name: '1 change waiting' })).toBeVisible()
    await context.clearCookies()
    await context.addCookies(bob.cookies)
    await page.unroute('**/api/sync/push')
    await page.getByRole('button', { name: '1 change waiting' }).click()
    await page.getByRole('button', { name: 'Sync now' }).click()
    await expect(page.getByLabel("Bob's profile")).toBeVisible()
    await expect(page.getByText('Private in flight')).toHaveCount(0)
    expect((await (await context.request.get('/api/sync/pull?after=0&limit=100')).json()).changes).toEqual([])
    await context.clearCookies()
    await context.addCookies(await alice.helpers.getCookies({ userId: alice.user.id, domain: '127.0.0.1' }))
    await page.reload()
    await expect(page.getByRole('button', { name: /Private in flight, open/ })).toBeVisible()
  } finally {
    await context.close()
    await alice.helpers.deleteUser(alice.user.id)
    await bob.helpers.deleteUser(bob.user.id)
  }
})

test('signing out with unsent work warns with the count; switching users cannot see or erase it', async ({ browser }) => {
  const alice = await createUser('Alice')
  const bob = await createUser('Bob')
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  try {
    await context.addCookies(alice.cookies)
    const page = await context.newPage()
    await page.goto('/today')
    await expect(page.getByRole('textbox', { name: 'New Task' })).toBeVisible()
    await context.setOffline(true)
    await page.getByRole('textbox', { name: 'New Task' }).fill('Alice private draft')
    await page.getByRole('textbox', { name: 'New Task' }).press('Enter')
    await expect(page.getByText('Alice private draft')).toBeVisible()
    await page.getByRole('button', { name: "Alice's profile" }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('dialog', { name: 'Unsent changes' })).toContainText('1 change')
    await page.getByRole('button', { name: 'Keep working' }).click()
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByText('Alice private draft')).toBeVisible()
    await page.getByRole('button', { name: "Alice's profile" }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByRole('button', { name: 'Sign out anyway' }).click()
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
    await context.setOffline(false)
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled()
    await expect(page).toHaveURL('http://127.0.0.1:3000/')
    await context.addCookies(bob.cookies)
    await page.goto('/today')
    await expect(page.getByLabel("Bob's profile")).toBeVisible()
    await expect(page.getByText('Alice private draft')).toHaveCount(0)
    await page.getByRole('button', { name: "Bob's profile" }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL('http://127.0.0.1:3000/')
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
    await context.addCookies(await alice.helpers.getCookies({ userId: alice.user.id, domain: '127.0.0.1' }))
    await expect.poll(async () => (await context.request.get('/api/today')).status()).toBe(200)
    await page.goto('/today')
    await expect(page.getByRole('button', { name: /Alice private draft, open/ })).toBeVisible()
    await expect.poll(async () => (await (await context.request.get('/api/sync/pull?after=0&limit=100')).json()).changes.length).toBe(1)
  } finally {
    await context.close()
    await alice.helpers.deleteUser(alice.user.id)
    await bob.helpers.deleteUser(bob.user.id)
  }
})
