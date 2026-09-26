import { createFileRoute } from '@tanstack/react-router'
import { checkinChangeSchema } from '@/lib/session-contract'
import type { CheckinChangeRequest, CheckinRecord } from '@/lib/session-contract'
import { auth } from '@/server/auth'
import { database } from '@/server/db'

const noCache = { 'Cache-Control': 'private, no-store' }
type ChangeResult = { checkin: CheckinRecord | null } | { error: string; status: number }

const receiptById = database.prepare(`
  SELECT request, checkinId FROM checkin_change_receipt WHERE userId = ? AND id = ?
`)
const checkinById = database.prepare(`
  SELECT id, userId, taskId, durationMinutes, origin, sourceSessionId, createdAt
  FROM session_checkin WHERE id = ? AND userId = ?
`)
const checkinIdUsed = database.prepare(`
  SELECT 1 FROM session_checkin WHERE id = ?
  UNION SELECT 1 FROM checkin_deletion WHERE checkinId = ?
`)
const taskById = database.prepare('SELECT day FROM task WHERE id = ? AND userId = ?')
const insertCheckin = database.prepare(`
  INSERT INTO session_checkin (id, userId, taskId, durationMinutes, origin, sourceSessionId, createdAt)
  VALUES (?, ?, ?, ?, 'manual', NULL, ?)
`)
const updateCheckin = database.prepare(`
  UPDATE session_checkin SET taskId = ?, durationMinutes = ? WHERE id = ? AND userId = ?
`)
const deleteCheckin = database.prepare('DELETE FROM session_checkin WHERE id = ? AND userId = ?')
const markDeleted = database.prepare('INSERT INTO checkin_deletion (checkinId, userId) VALUES (?, ?)')
const insertReceipt = database.prepare(`
  INSERT INTO checkin_change_receipt (userId, id, request, checkinId) VALUES (?, ?, ?, ?)
`)

const changeCheckin = database.transaction((userId: string, change: CheckinChangeRequest): ChangeResult => {
  const request = JSON.stringify({ ...change, today: undefined })
  const previous = receiptById.get(userId, change.id) as { request: string; checkinId: string } | undefined
  if (previous) {
    if (previous.request !== request) return { error: 'Change ID already used', status: 409 }
    return { checkin: (checkinById.get(previous.checkinId, userId) as CheckinRecord | undefined) ?? null }
  }
  const now = Date.now()
  const earliest = new Date(now - 86_400_000).toISOString().slice(0, 10)
  const latest = new Date(now + 86_400_000).toISOString().slice(0, 10)
  if (change.today < earliest || change.today > latest) {
    return { error: 'Invalid local Day', status: 400 }
  }

  if (change.action === 'create' && checkinIdUsed.get(change.checkinId, change.checkinId)) {
    return { error: 'Check-in ID already used', status: 409 }
  }
  if (change.action !== 'create' && !checkinById.get(change.checkinId, userId)) {
    return { error: 'Check-in not found', status: 404 }
  }
  if (change.action !== 'delete') {
    const task = taskById.get(change.taskId, userId) as { day: string } | undefined
    if (!task) return { error: 'Task not found', status: 404 }
    if (task.day > change.today) return { error: 'Future Task', status: 400 }
  }

  if (change.action === 'create') {
    insertCheckin.run(change.checkinId, userId, change.taskId, change.durationMinutes, change.createdAt)
  } else if (change.action === 'edit') {
    updateCheckin.run(change.taskId, change.durationMinutes, change.checkinId, userId)
  } else {
    deleteCheckin.run(change.checkinId, userId)
    markDeleted.run(change.checkinId, userId)
  }
  insertReceipt.run(userId, change.id, request, change.checkinId)
  return { checkin: change.action === 'delete'
    ? null
    : checkinById.get(change.checkinId, userId) as CheckinRecord }
})

export const Route = createFileRoute('/api/checkin/change')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const login = await auth.api.getSession({ headers: request.headers })
        if (!login) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noCache })
        if (request.headers.get('X-Local-User') && request.headers.get('X-Local-User') !== login.user.id) {
          return Response.json({ error: 'Account switched' }, { status: 403, headers: noCache })
        }
        let body: unknown
        try { body = await request.json() } catch {
          return Response.json({ error: 'Malformed JSON' }, { status: 400, headers: noCache })
        }
        const parsed = checkinChangeSchema.safeParse(body)
        if (!parsed.success) return Response.json({ error: 'Invalid Check-in change' }, { status: 400, headers: noCache })

        const result = changeCheckin.immediate(login.user.id, parsed.data)
        return 'error' in result
          ? Response.json({ error: result.error }, { status: result.status, headers: noCache })
          : Response.json(result, { headers: noCache })
      },
    },
  },
})
