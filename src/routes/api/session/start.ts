import { createFileRoute } from '@tanstack/react-router'
import { startSessionSchema } from '@/lib/session-contract'
import type { SessionRecord, StartSessionRequest } from '@/lib/session-contract'
import { auth } from '@/server/auth'
import { database } from '@/server/db'

const noCache = { 'Cache-Control': 'private, no-store' }
type StartResult = { session: SessionRecord } | { error: string; status: number }
const active = database.prepare('SELECT 1 FROM active_session WHERE userId = ?')
const usedId = database.prepare('SELECT 1 FROM active_session WHERE id = ? UNION SELECT 1 FROM session_receipt WHERE sessionId = ?')
const task = database.prepare('SELECT day FROM task WHERE id = ? AND userId = ?')
const insert = database.prepare(`
  INSERT INTO active_session
  (id, userId, taskId, day, plannedMinutes, status, startedAt, elapsedMs, segmentStartedAt, lastControlAt)
  VALUES (@id, @userId, @taskId, @day, @plannedMinutes, @status, @startedAt, @elapsedMs, @segmentStartedAt, @lastControlAt)
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
  const startedAt = new Date(Date.now()).toISOString()
  const session: SessionRecord = {
    ...input, userId, status: 'running', startedAt, elapsedMs: 0, segmentStartedAt: startedAt,
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
        if (!login) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noCache })
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
