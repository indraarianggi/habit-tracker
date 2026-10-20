import { expect, test } from '@playwright/test'
import { getTrustedClientIp, SIGN_IN_LIMIT } from '@/server/rate-limit'

test('trusted client IP is the proxy-appended hop, not a forgeable prefix', () => {
  const direct = new Request('http://127.0.0.1/x')
  expect(getTrustedClientIp(direct)).toBe('unknown')

  // Caddy's `trusted_proxies`/`client_ip_headers` config makes it the one hop
  // that appends to X-Forwarded-For; anything before that is attacker-supplied.
  const spoofed = new Request('http://127.0.0.1/x', {
    headers: { 'X-Forwarded-For': '203.0.113.9, 198.51.100.1' },
  })
  expect(getTrustedClientIp(spoofed)).toBe('198.51.100.1')
})

test('GET /api/health reports database readiness', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})

test('a flood from one trusted hop is rate-limited regardless of a forged prefix, and a different hop is unaffected', async ({ request }) => {
  const trustedHop = '203.0.113.77'
  const otherHop = '203.0.113.78'

  let lastStatus = 0
  let retryAfter: string | null = null
  for (let i = 0; i < SIGN_IN_LIMIT.limit + 1; i += 1) {
    // Vary the forged, attacker-controlled prefix on every request; only the
    // last hop (the one a proxy would append) stays fixed.
    const response = await request.get('/api/auth/get-session', {
      headers: { 'X-Forwarded-For': `${i}.${i}.${i}.${i}, ${trustedHop}` },
    })
    lastStatus = response.status()
    if (lastStatus === 429) {
      retryAfter = response.headers()['retry-after'] ?? null
      break
    }
  }
  expect(lastStatus).toBe(429)
  expect(Number(retryAfter)).toBeGreaterThan(0)

  const otherHopResponse = await request.get('/api/auth/get-session', {
    headers: { 'X-Forwarded-For': otherHop },
  })
  expect(otherHopResponse.status()).not.toBe(429)
})
