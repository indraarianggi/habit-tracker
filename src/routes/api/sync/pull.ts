import { createFileRoute } from '@tanstack/react-router'
import type { TaskRecord } from '@/lib/task-contract'
import { unauthorizedResponse } from '@/server/account'
import { auth } from '@/server/auth'
import { database } from '@/server/db'
import { enforceIpLimit, enforceUserLimit } from '@/server/rate-limit'

const noCache = { 'Cache-Control': 'private, no-store' }
type ChangeRow = {
  seq: number
  userId: string
  deleted: number
  taskId: string
  day: string
  title: string
  completed: number
  orderKey: string
  createdAt: string
}

const pageAfter = database.prepare(`
  SELECT seq, userId, taskId, day, title, completed, orderKey, createdAt, deleted
  FROM task_change
  WHERE userId = ? AND seq > ?
  ORDER BY seq ASC
  LIMIT ?
`)

export const Route = createFileRoute('/api/sync/pull')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ipLimited = enforceIpLimit(request)
        if (ipLimited) return ipLimited
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return unauthorizedResponse(request)
        const userLimited = enforceUserLimit(session.user.id)
        if (userLimited) return userLimited
        if (request.headers.get('X-Local-User') && request.headers.get('X-Local-User') !== session.user.id) {
          return Response.json({ error: 'Account switched' }, { status: 403, headers: noCache })
        }

        const url = new URL(request.url)
        const afterInput = url.searchParams.get('after') ?? '0'
        const limitInput = url.searchParams.get('limit') ?? '100'
        if (!/^(0|[1-9]\d*)$/.test(afterInput) || !/^[1-9]\d*$/.test(limitInput)) {
          return Response.json({ error: 'Invalid sync cursor or limit' }, { status: 400, headers: noCache })
        }
        const after = Number(afterInput)
        const limit = Number(limitInput)
        if (!Number.isSafeInteger(after) || !Number.isSafeInteger(limit) || limit > 100) {
          return Response.json({ error: 'Invalid sync cursor or limit' }, { status: 400, headers: noCache })
        }

        const rows = pageAfter.all(session.user.id, after, limit + 1) as ChangeRow[]
        const hasMore = rows.length > limit
        if (hasMore) rows.pop()
        const changes = rows.map(({ seq, userId, taskId, day, title, completed, orderKey, createdAt, deleted }) => {
          if (deleted) return { seq, deletedTaskId: taskId }
          const task: TaskRecord = {
            id: taskId,
            userId,
            day,
            title,
            completed: Boolean(completed),
            orderKey,
            createdAt,
            seq,
          }
          return { seq, task }
        })
        return Response.json({ changes, nextSeq: changes.at(-1)?.seq ?? after, hasMore }, { headers: noCache })
      },
    },
  },
})
