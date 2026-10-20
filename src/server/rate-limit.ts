// In-memory abuse limits for a single-node deployment (ADR-0002). Caddy is the
// only possible peer in front of this process (isolated Docker network, no
// published port — docs/deployment-home-server.md §6.2), and its global
// `trusted_proxies`/`client_ip_headers` config makes it the one hop that
// appends to X-Forwarded-For. A client can prepend whatever it wants to that
// header; only the last entry was placed by Caddy itself, so that is the only
// entry safe to key a limit on.
const noCache = { 'Cache-Control': 'private, no-store' }

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

function hit(key: string, limit: number, windowMs: number): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now()
  if (now - lastSweep > 300_000) {
    lastSweep = now
    for (const [k, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(k)
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
  // Preferred: a single-value header only the proxy sets, with no parsing
  // ambiguity. The per-project Caddy site block should set this explicitly
  // (`header_up X-Real-IP {http.request.remote.host}`) rather than relying
  // on Caddy's default X-Forwarded-For append behavior — see ticket 18.
  const explicit = request.headers.get('x-real-ip')
  if (explicit) return explicit.trim()

  // Fallback for as long as that header isn't configured: the last hop of
  // X-Forwarded-For, which only a well-behaved proxy appends to (never
  // replaces). Weaker than X-Real-IP because it trusts that append-only
  // behavior rather than an explicit, single-purpose header.
  const header = request.headers.get('x-forwarded-for')
  if (!header) {
    if (process.env.NODE_ENV === 'production') {
      console.error('rate-limit: request has neither X-Real-IP nor X-Forwarded-For — is this process reachable directly, bypassing Caddy?')
    }
    return 'unknown'
  }
  const hops = header.split(',').map(hop => hop.trim()).filter(Boolean)
  return hops.at(-1) ?? 'unknown'
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

/**
 * Stricter limit for the public, pre-account sign-in/callback surface only —
 * not the whole `/api/auth/*` catch-all, so routine `get-session`/`sign-out`
 * reads from an already-signed-in client (cheap, cookie-gated) aren't held
 * to the same tight bound as the actual credential-issuing endpoints.
 */
export function enforceSignInLimit(request: Request): Response | null {
  const { pathname } = new URL(request.url)
  if (!pathname.includes('/sign-in') && !pathname.includes('/callback')) return null
  const result = hit(`sign-in:${getTrustedClientIp(request)}`, SIGN_IN_LIMIT.limit, SIGN_IN_LIMIT.windowMs)
  return result.allowed ? null : rateLimitResponse(result.retryAfterSeconds)
}

/** Looser per-IP limit, checked before auth so an anonymous flood is cheap to reject. */
export function enforceIpLimit(request: Request): Response | null {
  const result = hit(`api-ip:${getTrustedClientIp(request)}`, API_IP_LIMIT.limit, API_IP_LIMIT.windowMs)
  return result.allowed ? null : rateLimitResponse(result.retryAfterSeconds)
}

/** Looser per-User limit, checked once a session is confirmed. */
export function enforceUserLimit(userId: string): Response | null {
  const result = hit(`api-user:${userId}`, API_USER_LIMIT.limit, API_USER_LIMIT.windowMs)
  return result.allowed ? null : rateLimitResponse(result.retryAfterSeconds)
}
