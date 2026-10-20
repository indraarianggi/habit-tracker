import { expect, test } from '@playwright/test'
import { getTrustedClientIp, SIGN_IN_LIMIT } from '@/server/rate-limit'

test('trusted client IP prefers an explicit X-Real-IP, then falls back to the proxy-appended XFF hop', () => {
  const direct = new Request('http://127.0.0.1/x')
  expect(getTrustedClientIp(direct)).toBe('unknown')

  // Fallback: only the last hop (the one a well-behaved proxy appends) is
  // trusted; anything before that is attacker-supplied.
  const spoofed = new Request('http://127.0.0.1/x', {
    headers: { 'X-Forwarded-For': '203.0.113.9, 198.51.100.1' },
  })
  expect(getTrustedClientIp(spoofed)).toBe('198.51.100.1')

  // Preferred: a single-value header the proxy sets explicitly wins outright,
  // even over a well-formed XFF chain, since it has no parsing ambiguity.
  const explicit = new Request('http://127.0.0.1/x', {
    headers: { 'X-Real-IP': '198.51.100.1', 'X-Forwarded-For': '203.0.113.9, 192.0.2.1' },
  })
  expect(getTrustedClientIp(explicit)).toBe('198.51.100.1')
})

test('GET /api/health reports database readiness', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})

test('a flood of sign-in/callback requests from one trusted hop is rate-limited regardless of a forged prefix, and a different hop is unaffected', async ({ request }) => {
  const trustedHop = '203.0.113.77'
  const otherHop = '203.0.113.78'

  let lastStatus = 0
  let retryAfter: string | null = null
  for (let i = 0; i < SIGN_IN_LIMIT.limit + 1; i += 1) {
    // Vary the forged, attacker-controlled prefix on every request; only the
    // last hop (the one a proxy would append) stays fixed.
    const response = await request.get('/api/auth/callback/google', {
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

  const otherHopResponse = await request.get('/api/auth/callback/google', {
    headers: { 'X-Forwarded-For': otherHop },
  })
  expect(otherHopResponse.status()).not.toBe(429)
})

test('get-session and sign-out are not held to the sign-in/callback limit', async ({ request }) => {
  const floodedHop = '203.0.113.77'
  // The previous test already drove this hop's sign-in/callback bucket past
  // its limit; a get-session read from the same hop must still go through,
  // since it isn't part of the credential-issuing surface that limit guards.
  const response = await request.get('/api/auth/get-session', {
    headers: { 'X-Forwarded-For': floodedHop },
  })
  expect(response.status()).not.toBe(429)
})
