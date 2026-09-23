import { expect, test } from '@playwright/test'

test('a visitor can read privacy before Google sign-in', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')

  await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible()
  const features = page.getByRole('list', { name: 'What Habit Tracker offers' })
  await expect(features.getByText('Pomodoro Focus')).toBeVisible()
  await expect(features.getByText('Activity Grid')).toBeVisible()
  await expect(features.getByText('Local-First & Offline')).toBeVisible()
  const featuresBox = await features.boundingBox()
  const buttonBox = await page.getByRole('button', { name: /sign in with google/i }).boundingBox()
  expect(featuresBox!.y + featuresBox!.height).toBeLessThan(buttonBox!.y)
  await page.getByRole('link', { name: /privacy policy/i }).click()
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
  expect(page.url()).toMatch(/\/privacy\/?$/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('the Google button starts the real OAuth authorization flow', async ({ page }) => {
  await page.route('https://accounts.google.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<title>Google authorization test stop</title>',
  }))
  await page.goto('/')
  await page.getByRole('button', { name: /sign in with google/i }).click()
  await page.waitForURL(/^https:\/\/accounts\.google\.com\//)
  const destination = new URL(page.url())
  expect(destination.searchParams.get('client_id')).toBe('browser-smoke-client')
  expect(destination.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:3000/api/auth/callback/google')
})

test('an unsigned visitor cannot read Today or its data endpoint', async ({ page, request }) => {
  await page.goto('/today')
  await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Today' })).toHaveCount(0)

  const response = await request.get('/api/today')
  expect(response.status()).toBe(401)
  expect(await response.text()).not.toContain('userId')
})
