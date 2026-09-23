import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })

test('each session opens only its own private Today on mobile', async ({ browser, request }) => {
  const helpers = (await testAuth.$context).test
  const alice = helpers.createUser({ name: 'Alice', email: `alice-smoke-${crypto.randomUUID()}@invalid.test` })
  const bob = helpers.createUser({ name: 'Bob', email: `bob-smoke-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(alice)
  await helpers.saveUser(bob)

  try {
    const aliceCookies = await helpers.getCookies({ userId: alice.id, domain: '127.0.0.1' })
    const bobCookies = await helpers.getCookies({ userId: bob.id, domain: '127.0.0.1' })
    const aliceContext = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const bobContext = await browser.newContext({ viewport: { width: 375, height: 812 } })
    try {
      await aliceContext.addCookies(aliceCookies)
      await bobContext.addCookies(bobCookies)
      const alicePage = await aliceContext.newPage()
      await alicePage.goto('/today')
      await expect(alicePage.getByRole('heading', { name: 'What will you focus on today?' })).toBeVisible()
      await expect(alicePage.getByText('25:00')).toBeVisible()
      await expect(alicePage.getByRole('region', { name: "Today's focus" }).getByText('No focus recorded today yet.')).toBeVisible()
      await expect(alicePage.getByLabel("Alice's profile")).toBeVisible()
      await expect(alicePage.getByRole('navigation', { name: 'Main sections' }).getByText('Timer')).toBeVisible()
      await expect(alicePage.getByText('Task entry is coming in the next update.')).toBeVisible()
      await expect(alicePage.getByRole('textbox')).toHaveCount(0)
      await expect(alicePage.getByText('Bob')).toHaveCount(0)
      expect(await alicePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

      const bobPage = await bobContext.newPage()
      await bobPage.goto('/today')
      await expect(bobPage.getByLabel("Bob's profile")).toBeVisible()
      await expect(bobPage.getByText('Alice')).toHaveCount(0)

      const unauthenticated = await request.get('/api/today')
      expect(unauthenticated.status()).toBe(401)
      const aliceResponse = await aliceContext.request.get('/api/today')
      expect(aliceResponse.status()).toBe(200)
      const aliceData = await aliceResponse.json()
      expect(aliceData).toMatchObject({ user: { id: alice.id, name: 'Alice' } })
      expect(JSON.stringify(aliceData)).not.toContain(bob.id)
      const bobResponse = await bobContext.request.get('/api/today')
      expect(await bobResponse.json()).toMatchObject({ user: { id: bob.id, name: 'Bob' } })

      await alicePage.getByRole('button', { name: 'Sign out' }).click()
      await expect(alicePage.getByRole('button', { name: /sign in with google/i })).toBeVisible()
      expect((await aliceContext.request.get('/api/today')).status()).toBe(401)
    } finally {
      await aliceContext.close()
      await bobContext.close()
    }
  } finally {
    await helpers.deleteUser(alice.id)
    await helpers.deleteUser(bob.id)
  }
})

test('active sessions last seven days and renew no more than daily', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `session-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  try {
    const { session, headers } = await helpers.login({ userId: user.id })
    const week = 7 * 24 * 60 * 60 * 1000
    expect(session.expiresAt.getTime() - Date.now()).toBeGreaterThan(week - 10_000)
    expect(session.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(week)

    const initial = await testAuth.api.getSession({ headers })
    expect(initial?.session.expiresAt.getTime()).toBe(session.expiresAt.getTime())

    authOptions.database.prepare('UPDATE "session" SET "expiresAt" = ? WHERE "id" = ?')
      .run(Date.now() + 5 * 24 * 60 * 60 * 1000, session.id)
    const renewed = await testAuth.api.getSession({ headers })
    expect((renewed?.session.expiresAt.getTime() ?? 0) - Date.now()).toBeGreaterThan(week - 10_000)

    const again = await testAuth.api.getSession({ headers })
    expect(again?.session.expiresAt.getTime()).toBe(renewed?.session.expiresAt.getTime())
  } finally {
    await helpers.deleteUser(user.id)
  }
})
