import { createFileRoute } from '@tanstack/react-router'
import { v7 as uuidv7 } from 'uuid'
import { finishSessionSchema } from '@/lib/session-contract'
import type { CheckinRecord, FinishSessionRequest } from '@/lib/session-contract'
import { unauthorizedResponse } from '@/server/account'
import { auth } from '@/server/auth'
import { database } from '@/server/db'

const noCache = { 'Cache-Control': 'private, no-store' }
type Receipt = { sessionId: string; userId: string; outcome: 'saved' | 'discarded'; checkinId: string | null }
type FinishResult = { sessionId: string; outcome: 'saved' | 'discarded'; checkin: CheckinRecord | null }
  | { error: string; status: number }
const receiptById = database.prepare('SELECT sessionId, userId, outcome, checkinId FROM session_receipt WHERE sessionId = ?')
const activeById = database.prepare('SELECT userId, taskId, plannedMinutes FROM active_session WHERE id = ? AND userId = ?')
const checkinById = database.prepare(`
  SELECT id, userId, taskId, durationMinutes, origin, sourceSessionId, createdAt
  FROM session_checkin WHERE id = ? AND userId = ?
`)
const insertReceipt = database.prepare(`
  INSERT INTO session_receipt (sessionId, userId, outcome, checkinId) VALUES (?, ?, ?, ?)
`)
const insertCheckin = database.prepare(`
  INSERT INTO session_checkin (id, userId, taskId, durationMinutes, origin, sourceSessionId, createdAt)
  VALUES (@id, @userId, @taskId, @durationMinutes, @origin, @sourceSessionId, @createdAt)
`)
const release = database.prepare('DELETE FROM active_session WHERE id = ? AND userId = ?')

const finalize = database.transaction((userId: string, input: FinishSessionRequest): FinishResult => {
  const prior = receiptById.get(input.id) as Receipt | undefined
  if (prior) {
    if (prior.userId !== userId) return { error: 'Session not found', status: 404 }
    const checkin = prior.checkinId
      ? (checkinById.get(prior.checkinId, userId) as CheckinRecord | undefined) ?? null
      : null
    return { sessionId: prior.sessionId, outcome: prior.outcome, checkin }
  }
  const current = activeById.get(input.id, userId) as { userId: string; taskId: string; plannedMinutes: number } | undefined
  if (!current) return { error: 'Session not found', status: 404 }
  if (input.outcome === 'save' && (!input.durationMinutes || input.durationMinutes > current.plannedMinutes)) {
    return { error: 'Invalid Session duration', status: 400 }
  }
  const outcome = input.outcome === 'discard' ? 'discarded' : 'saved'
  const checkin: CheckinRecord | null = outcome === 'saved' ? {
    id: uuidv7(), userId, taskId: current.taskId,
    durationMinutes: input.outcome === 'finish' ? current.plannedMinutes : input.durationMinutes!,
    origin: 'session', sourceSessionId: input.id, createdAt: new Date(Date.now()).toISOString(),
  } : null
  insertReceipt.run(input.id, userId, outcome, checkin?.id ?? null)
  if (checkin) insertCheckin.run(checkin)
  release.run(input.id, userId)
  return { sessionId: input.id, outcome, checkin }
})

export const Route = createFileRoute('/api/session/finish')({
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
        const parsed = finishSessionSchema.safeParse(body)
        if (!parsed.success) return Response.json({ error: 'Invalid Session finish' }, { status: 400, headers: noCache })
        const result = finalize.immediate(login.user.id, parsed.data)
        return 'error' in result
          ? Response.json({ error: result.error }, { status: result.status, headers: noCache })
          : Response.json(result, { headers: noCache })
      },
    },
  },
})
