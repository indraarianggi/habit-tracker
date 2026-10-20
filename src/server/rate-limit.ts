// In-memory abuse limits for a single-node deployment (ADR-0002). Caddy is the
// only possible peer in front of this process (isolated Docker network, no
// published port — docs/deployment-home-server.md §6.2). A client fully
// controls every header on its request, so a value is only ever trusted once
// something on the trusted side of that boundary is known to overwrite it.
//
// `isIP` returns 0 (falsy) for anything that isn't a well-formed IPv4/IPv6
// literal, so a client can't poison the bucket key space with arbitrary junk.
import { isIP } from 'node:net'

const noCache = { 'Cache-Control': 'private, no-store' }

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()
// Caps total memory regardless of how many distinct keys a client can force
// (e.g. by varying an unvalidated header per request) between sweeps. Map
// iteration order is insertion order, so this evicts the oldest bucket —
// a cheap FIFO approximation, not true LRU, which is fine for a backstop.
const MAX_BUCKETS = 5000

function hit(key: string, limit: number, windowMs: number): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now()
  if (now - lastSweep > 300_000) {
    lastSweep = now
    for (const [k, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(k)
  }
  if (buckets.size >= MAX_BUCKETS && !buckets.has(key)) {
    const oldestKey = buckets.keys().next().value
    if (oldestKey !== undefined) buckets.delete(oldestKey)
  }

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }
  bucket.count += 1
  if (bucket.count > limit) return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  return { allowed: true }
}

export function getTrustedClientIp(request: Request): string {
  // X-Real-IP is only trusted once TRUST_X_REAL_IP is turned on in the
  // server's own .env — which the operator does only after deploying the
  // Caddy site block with `header_up X-Real-IP {http.request.remote.host}`
  // (ticket 18), so the header is actually overwritten before it reaches
  // this process. Trusting it unconditionally would let any client just set
  // it themselves and fully control their own rate-limit bucket.
  if (process.env.TRUST_X_REAL_IP === '1') {
    const explicit = request.headers.get('x-real-ip')?.trim()
    if (explicit && isIP(explicit)) return explicit
  }

  // Fallback: the last hop of X-Forwarded-For, which only a well-behaved
  // proxy appends to (never replaces) — weaker than X-Real-IP because it
  // trusts that append-only convention rather than an explicit header.
  const header = request.headers.get('x-forwarded-for')
  if (!header) {
    if (process.env.NODE_ENV === 'production') {
      console.error('rate-limit: request has no X-Forwarded-For header — is this process reachable directly, bypassing Caddy?')
    }
    return 'unknown'
  }
  const hops = header.split(',').map(hop => hop.trim()).filter(Boolean)
  const last = hops.at(-1)
  return last && isIP(last) ? last : 'unknown'
}

function rateLimitResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { error: 'Too many requests' },
    { status: 429, headers: { ...noCache, 'Retry-After': String(retryAfterSeconds) } },
  )
}

// Thresholds are generous on purpose: in production every distinct visitor
// gets its own IP (Caddy always sets the trusted hop), so these only ever
// need to catch one client hammering the server, not normal multi-device use.
export const SIGN_IN_LIMIT = { limit: 100, windowMs: 60_000 }
const API_IP_LIMIT = { limit: 50_000, windowMs: 60_000 }
const API_USER_LIMIT = { limit: 20_000, windowMs: 60_000 }

/** Looser per-IP limit, checked before auth so an anonymous flood is cheap to reject. */
export function enforceIpLimit(request: Request): Response | null {
  const result = hit(`api-ip:${getTrustedClientIp(request)}`, API_IP_LIMIT.limit, API_IP_LIMIT.windowMs)
  return result.allowed ? null : rateLimitResponse(result.retryAfterSeconds)
}

// Cheap, cookie-gated reads a signed-in client may call often from a shared
// IP (multiple tabs/devices) — exempted from the *stricter* tier below, but
// still covered by the baseline per-IP limit like every other `/api/auth/*`
// path. An exact allowlist, not a substring match: anything not explicitly
// listed here defaults to the strict tier, including every other
// better-auth endpoint (sign-up, forget-password, reset-password,
// update-user, …) this app doesn't call today but could expose later.
const SIGN_IN_EXEMPT_PATHS = new Set(['/api/auth/get-session', '/api/auth/sign-out'])

/**
 * Stricter limit, layered on top of `enforceIpLimit`, for every
 * `/api/auth/*` path except the cheap reads in `SIGN_IN_EXEMPT_PATHS`.
 */
export function enforceSignInLimit(request: Request): Response | null {
  const ipLimited = enforceIpLimit(request)
  if (ipLimited) return ipLimited
  const { pathname } = new URL(request.url)
  if (SIGN_IN_EXEMPT_PATHS.has(pathname)) return null
  const result = hit(`sign-in:${getTrustedClientIp(request)}`, SIGN_IN_LIMIT.limit, SIGN_IN_LIMIT.windowMs)
  return result.allowed ? null : rateLimitResponse(result.retryAfterSeconds)
}

/** Looser per-User limit, checked once a session is confirmed. */
export function enforceUserLimit(userId: string): Response | null {
  const result = hit(`api-user:${userId}`, API_USER_LIMIT.limit, API_USER_LIMIT.windowMs)
  return result.allowed ? null : rateLimitResponse(result.retryAfterSeconds)
}
