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
  const header = request.headers.get('x-forwarded-for')
  if (!header) return 'unknown'
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

/** Stricter limit for the public, pre-account `/api/auth/*` surface. */
export function enforceSignInLimit(request: Request): Response | null {
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
