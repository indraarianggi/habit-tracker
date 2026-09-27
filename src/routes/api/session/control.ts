import { createFileRoute } from '@tanstack/react-router'
import { controlSessionSchema } from '@/lib/session-contract'
import type { SessionRecord } from '@/lib/session-contract'
import { unauthorizedResponse } from '@/server/account'
import { auth } from '@/server/auth'
import { database } from '@/server/db'

const noCache = { 'Cache-Control': 'private, no-store' }
type ActiveRow = SessionRecord & { lastControlAt: string }
type ControlResult = { session: SessionRecord } | { error: string; status: number }
const active = database.prepare(`
  SELECT id, userId, taskId, day, plannedMinutes, shortBreakMinutes, longBreakMinutes,
    status, startedAt, elapsedMs, segmentStartedAt, lastControlAt
  FROM active_session WHERE id = ? AND userId = ?
`)
const update = database.prepare(`
  UPDATE active_session SET status = @status, elapsedMs = @elapsedMs,
    segmentStartedAt = @segmentStartedAt, lastControlAt = @lastControlAt
  WHERE id = @id AND userId = @userId
`)

const control = database.transaction((userId: string, id: string, action: 'pause' | 'resume', at?: string): ControlResult => {
  const current = active.get(id, userId) as ActiveRow | undefined
  if (!current) return { error: 'Session not found', status: 404 }
  const now = Date.now()
  const effectiveMs = Math.max(Date.parse(current.startedAt), Math.min(at ? Date.parse(at) : now, now))
  if (effectiveMs < Date.parse(current.lastControlAt)) {
    return { error: 'Session control is stale', status: 409 }
  }
  if ((action === 'pause' && current.status !== 'running') || (action === 'resume' && current.status !== 'paused')) {
    return { error: 'Session state has changed', status: 409 }
  }
  const lastControlAt = new Date(effectiveMs).toISOString()
  const { lastControlAt: _previousControl, ...session } = current
  if (action === 'pause') {
    session.elapsedMs = Math.min(current.plannedMinutes * 60_000,
      current.elapsedMs + Math.max(0, effectiveMs - Date.parse(current.segmentStartedAt!)))
    session.status = 'paused'
    session.segmentStartedAt = null
  } else {
    session.status = 'running'
    session.segmentStartedAt = lastControlAt
  }
  update.run({ ...session, lastControlAt })
  return { session }
})

export const Route = createFileRoute('/api/session/control')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const login = await auth.api.getSession({ headers: request.headers })
        if (!login) return unauthorizedResponse(request)
        if (request.headers.get('X-Local-User') && request.headers.get('X-Local-User') !== login.user.id) {
          return Response.json({ error: 'Account switched' }, { status: 403, headers: noCache })
        }
        let body: unknown
        try { body = await request.json() } catch {
          return Response.json({ error: 'Malformed JSON' }, { status: 400, headers: noCache })
        }
        const parsed = controlSessionSchema.safeParse(body)
        if (!parsed.success) return Response.json({ error: 'Invalid Session control' }, { status: 400, headers: noCache })
        const result = control.immediate(login.user.id, parsed.data.id, parsed.data.action, parsed.data.at)
        return 'session' in result
          ? Response.json(result, { headers: noCache })
          : Response.json({ error: result.error }, { status: result.status, headers: noCache })
      },
    },
  },
})
