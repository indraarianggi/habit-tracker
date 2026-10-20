import { createFileRoute } from '@tanstack/react-router'
import type { CheckinRecord, SessionRecord } from '@/lib/session-contract'
import { unauthorizedResponse } from '@/server/account'
import { auth } from '@/server/auth'
import { database } from '@/server/db'
import { enforceIpLimit, enforceUserLimit } from '@/server/rate-limit'

const noCache = { 'Cache-Control': 'private, no-store' }
const current = database.prepare(`
  SELECT id, userId, taskId, day, plannedMinutes, shortBreakMinutes, longBreakMinutes,
    status, startedAt, elapsedMs, segmentStartedAt
  FROM active_session WHERE userId = ?
`)
const lastTask = database.prepare('SELECT taskId FROM session_last_task WHERE userId = ?')
const checkins = database.prepare(`
  SELECT id, userId, taskId, durationMinutes, origin, sourceSessionId, createdAt
  FROM session_checkin WHERE userId = ? ORDER BY createdAt, id
`)

export const Route = createFileRoute('/api/session/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ipLimited = enforceIpLimit(request)
        if (ipLimited) return ipLimited
        const login = await auth.api.getSession({ headers: request.headers })
        if (!login) return unauthorizedResponse(request)
        const userLimited = enforceUserLimit(login.user.id)
        if (userLimited) return userLimited
        if (request.headers.get('X-Local-User') && request.headers.get('X-Local-User') !== login.user.id) {
          return Response.json({ error: 'Account switched' }, { status: 403, headers: noCache })
        }
        const userId = login.user.id
        const session = (current.get(userId) as SessionRecord | undefined) ?? null
        const lastTaskId = (lastTask.get(userId) as { taskId: string } | undefined)?.taskId ?? null
        const records = checkins.all(userId) as CheckinRecord[]
        return Response.json({ session, lastTaskId, checkins: records }, { headers: noCache })
      },
    },
  },
})
