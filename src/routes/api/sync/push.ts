import { createFileRoute } from '@tanstack/react-router'
import type { TaskChange } from '@/lib/task-contract'
import { pushRequestSchema } from '@/lib/task-contract'
import { auth } from '@/server/auth'
import { database } from '@/server/db'

const noCache = { 'Cache-Control': 'private, no-store' }
type Receipt = { userId: string; seq: number }
type ExistingTask = { userId: string; day: string; createdAt: string }
type PushResult = { id: string; status: 'accepted' | 'rejected'; seq?: number; reason?: string }

const receiptById = database.prepare('SELECT userId, seq FROM task_change WHERE id = ?')
const taskById = database.prepare('SELECT userId, day, createdAt FROM task WHERE id = ?')
const insertReceipt = database.prepare(`
  INSERT INTO task_change (id, userId, taskId, day, title, completed, orderKey, createdAt, acceptedAt)
  VALUES (@changeId, @userId, @taskId, @day, @title, @completed, @orderKey, @createdAt, @acceptedAt)
`)
const saveTask = database.prepare(`
  INSERT INTO task (id, userId, day, title, completed, orderKey, createdAt, updatedAt, seq)
  VALUES (@taskId, @userId, @day, @title, @completed, @orderKey, @createdAt, @acceptedAt, @seq)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    completed = excluded.completed,
    orderKey = excluded.orderKey,
    updatedAt = excluded.updatedAt,
    seq = excluded.seq
`)

const acceptChange = database.transaction((userId: string, change: TaskChange): PushResult => {
  const receipt = receiptById.get(change.id) as Receipt | undefined
  if (receipt) {
    return receipt.userId === userId
      ? { id: change.id, status: 'accepted', seq: receipt.seq }
      : { id: change.id, status: 'rejected', reason: 'Change cannot be accepted.' }
  }

  const previous = taskById.get(change.task.id) as ExistingTask | undefined
  if (previous?.userId !== undefined && previous.userId !== userId) {
    return { id: change.id, status: 'rejected', reason: 'Task cannot be changed.' }
  }
  if (previous && previous.day !== change.task.day) {
    return { id: change.id, status: 'rejected', reason: 'Task day cannot be changed.' }
  }

  const acceptedAt = new Date().toISOString()
  const record = {
    userId,
    taskId: change.task.id,
    day: change.task.day,
    title: change.task.title,
    completed: Number(change.task.completed),
    orderKey: change.task.orderKey,
    createdAt: previous?.createdAt ?? change.task.createdAt,
    acceptedAt,
  }
  const seq = Number(insertReceipt.run({ ...record, changeId: change.id }).lastInsertRowid)
  saveTask.run({ ...record, seq })
  return { id: change.id, status: 'accepted', seq }
})

export const Route = createFileRoute('/api/sync/push')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noCache })

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Malformed JSON' }, { status: 400, headers: noCache })
        }
        const parsed = pushRequestSchema.safeParse(body)
        if (!parsed.success) {
          return Response.json({ error: 'Invalid task changes' }, { status: 400, headers: noCache })
        }

        const results = parsed.data.changes.map((change) => acceptChange(session.user.id, change))
        return Response.json({ results }, { headers: noCache })
      },
    },
  },
})
