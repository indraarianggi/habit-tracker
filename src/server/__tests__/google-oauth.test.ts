import { expect, test } from '@playwright/test'
import { auth, authOptions } from '@/server/auth'

const origin = 'http://127.0.0.1:3000'

function idToken(subject: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const claims = Buffer.from(JSON.stringify({ sub: subject, name: 'Returning User', email: `${subject}@invalid.test`, email_verified: true, iss: 'https://accounts.google.com', aud: 'browser-smoke-client', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  return `${header}.${claims}.signature`
}

async function completeGoogleFlow(subject: string) {
  const start = await auth.handler(new Request(`${origin}/api/auth/sign-in/social`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ provider: 'google', callbackURL: '/today' }),
  }))
  expect(start.status).toBe(200)
  const { url } = await start.json() as { url: string }
  const authorization = new URL(url)
  expect(authorization.hostname).toBe('accounts.google.com')
  const state = authorization.searchParams.get('state')
  expect(state).toBeTruthy()
  const stateCookies = start.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ')
  const callback = await auth.handler(new Request(`${origin}/api/auth/callback/google?code=test-code&state=${state}`, {
    headers: { cookie: stateCookies },
  }))
  expect(callback.status).toBe(302)
  expect(callback.headers.get('location')).toBe('/today')
  const sessionCookies = callback.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ')
  const session = await auth.api.getSession({ headers: new Headers({ cookie: sessionCookies }) })
  expect(session?.user.email).toBe(`${subject}@invalid.test`)
  return session!.user.id
}

test('Google first sign-in creates a User and later sign-in reopens it', async () => {
  const originalFetch = globalThis.fetch
  let subject = ''
  let firstId: string | undefined
  globalThis.fetch = async (input, init) => {
    if (String(input) === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'test-only-access-token', token_type: 'Bearer', expires_in: 3600, id_token: idToken(subject) })
    }
    return originalFetch(input, init)
  }
  try {
    subject = `google-smoke-${crypto.randomUUID()}`
    firstId = await completeGoogleFlow(subject)
    const secondId = await completeGoogleFlow(subject)
    expect(secondId).toBe(firstId)
  } finally {
    globalThis.fetch = originalFetch
    if (firstId) authOptions.database.prepare('DELETE FROM "user" WHERE id = ?').run(firstId)
  }
})
