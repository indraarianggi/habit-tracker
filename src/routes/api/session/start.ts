import { createFileRoute } from '@tanstack/react-router'
import { defaultDurations } from '@/lib/settings-contract'
import { startSessionSchema } from '@/lib/session-contract'
import type { SessionRecord, StartSessionRequest } from '@/lib/session-contract'
import { unauthorizedResponse } from '@/server/account'
import { auth } from '@/server/auth'
import { database } from '@/server/db'

const noCache = { 'Cache-Control': 'private, no-store' }
type StartResult = { session: SessionRecord } | { error: string; status: number }
const active = database.prepare('SELECT 1 FROM active_session WHERE userId = ?')
const usedId = database.prepare('SELECT 1 FROM active_session WHERE id = ? UNION SELECT 1 FROM session_receipt WHERE sessionId = ?')
const task = database.prepare('SELECT day FROM task WHERE id = ? AND userId = ?')
const settings = database.prepare(`
  SELECT focusMinutes, shortBreakMinutes, longBreakMinutes FROM duration_settings WHERE userId = ?
`)
const insert = database.prepare(`
  INSERT INTO active_session
  (id, userId, taskId, day, plannedMinutes, shortBreakMinutes, longBreakMinutes,
    status, startedAt, elapsedMs, segmentStartedAt, lastControlAt)
  VALUES (@id, @userId, @taskId, @day, @plannedMinutes, @shortBreakMinutes, @longBreakMinutes,
    @status, @startedAt, @elapsedMs, @segmentStartedAt, @lastControlAt)
`)
const rememberTask = database.prepare(`
  INSERT INTO session_last_task (userId, taskId) VALUES (?, ?)
  ON CONFLICT(userId) DO UPDATE SET taskId = excluded.taskId
`)

const start = database.transaction((userId: string, input: StartSessionRequest): StartResult => {
  if (active.get(userId)) return { error: 'A Session is already active', status: 409 }
  if (usedId.get(input.id, input.id)) return { error: 'Session ID already used', status: 409 }
  const ownedTask = task.get(input.taskId, userId) as { day: string } | undefined
  if (!ownedTask) return { error: 'Task not found', status: 404 }
  if (ownedTask.day !== input.day) return { error: 'Task day does not match', status: 400 }
  const current = settings.get(userId) as {
    focusMinutes: number; shortBreakMinutes: number; longBreakMinutes: number
  } | undefined
  if (input.plannedMinutes !== (current?.focusMinutes ?? defaultDurations.focusMinutes)) {
    return { error: 'Session duration does not match current settings', status: 409 }
  }
  const startedAt = new Date(Date.now()).toISOString()
  const session: SessionRecord = {
    ...input, userId,
    shortBreakMinutes: current?.shortBreakMinutes ?? defaultDurations.shortBreakMinutes,
    longBreakMinutes: current?.longBreakMinutes ?? defaultDurations.longBreakMinutes,
    status: 'running', startedAt, elapsedMs: 0, segmentStartedAt: startedAt,
  }
  insert.run({ ...session, lastControlAt: startedAt })
  rememberTask.run(userId, input.taskId)
  return { session }
})

export const Route = createFileRoute('/api/session/start')({
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
        const parsed = startSessionSchema.safeParse(body)
        if (!parsed.success) return Response.json({ error: 'Invalid Session' }, { status: 400, headers: noCache })
        const result = start.immediate(login.user.id, parsed.data)
        return 'session' in result
          ? Response.json(result, { headers: noCache })
          : Response.json({ error: result.error }, { status: result.status, headers: noCache })
      },
    },
  },
})
