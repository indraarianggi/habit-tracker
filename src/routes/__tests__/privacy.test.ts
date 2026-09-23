import { expect, test } from '@playwright/test'

test('public privacy policy is readable on a phone without signing in', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const response = await page.goto('/privacy')

  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeVisible()
  await expect(page.getByText(/Google name, email address, and profile photo/i)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Storage and access' }).getByText(/Tasks, Check-ins, Pomodoro Sessions/i)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Backups and deletion' }).getByText(/up to 30 days/i)).toBeVisible()
  await expect(page.getByRole('link', { name: /contact.*privacy/i })).toHaveAttribute('href', /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(page.url()).toMatch(/\/privacy\/?$/)
})
