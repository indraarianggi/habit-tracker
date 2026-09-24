import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { v7 as uuidv7 } from 'uuid'
import { elapsedFocusMs, remainingBreakSeconds, SessionStore } from '@/lib/session-store'
import { localDay } from '@/lib/task-contract'
import { startSession, syncSession } from '@/lib/session-client'
import { TaskStore } from '@/lib/task-store'
import { syncTasks } from '@/lib/task-sync'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })
const origin = 'http://127.0.0.1:3000'

test('separate devices converge offline finish and exact early stop minute boundaries', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `session-local-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const factory = new IDBFactory()
  const first = new SessionStore(`focus-first-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const second = new SessionStore(`focus-second-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const tasks = new TaskStore(`focus-tasks-${crypto.randomUUID()}`, factory, IDBKeyRange)
  try {
    const login = await helpers.login({ userId: user.id })
    const authorized: typeof fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(new URL(String(input), origin), { ...init, headers: new Headers([...login.headers, ...new Headers(init?.headers)]) })) as typeof fetch
    const task = await tasks.createTask(user.id, 'Complete without checking off', localDay())
    await syncTasks(tasks, user.id, authorized)
    const session = await startSession(task.id, task.day, authorized)
    await first.started(user.id, session)
    const startAt = Date.parse(session.startedAt)
    expect(Math.floor(elapsedFocusMs(session, startAt + 59_999) / 60_000)).toBe(0)
    expect(Math.floor(elapsedFocusMs(session, startAt + 60_000) / 60_000)).toBe(1)
    expect(elapsedFocusMs(session, startAt + 30 * 60_000)).toBe(session.plannedMinutes * 60_000)
    expect(elapsedFocusMs({ ...session, status: 'paused', elapsedMs: 60_000, segmentStartedAt: null }, startAt + 26 * 60 * 60_000)).toBe(60_000)
    await syncSession(second, user.id, authorized)
    expect((await second.snapshot(user.id)).session?.id).toBe(session.id)
    await first.finish(user.id, 'finish')
    const disconnected: typeof fetch = (() => Promise.reject(new TypeError('offline'))) as typeof fetch
    await expect(syncSession(first, user.id, disconnected)).rejects.toThrow('offline')
    expect((await first.snapshot(user.id)).checkins).toMatchObject([{ taskId: task.id, durationMinutes: 25, origin: 'session' }])
    await syncSession(first, user.id, authorized)
    await syncSession(second, user.id, authorized)
    const onFirst = await first.snapshot(user.id)
    const onSecond = await second.snapshot(user.id)
    expect(onFirst.session).toBeNull()
    expect(onSecond.session).toBeNull()
    expect(onFirst.checkins).toEqual(onSecond.checkins)
    expect(onFirst.checkins).toHaveLength(1)
    expect(onFirst.checkins[0]).toMatchObject({ sourceSessionId: session.id, durationMinutes: 25 })
    const short = await startSession(task.id, task.day, authorized)
    await first.started(user.id, short)
    const belowMinute = Math.floor(elapsedFocusMs(short, Date.parse(short.startedAt) + 59_999) / 60_000)
    await first.finish(user.id, belowMinute ? 'save' : 'discard', belowMinute || undefined)
    await syncSession(first, user.id, authorized)
    await syncSession(second, user.id, authorized)
    expect((await second.snapshot(user.id)).checkins).toHaveLength(1)

    const oneMinute = await startSession(task.id, task.day, authorized)
    await first.started(user.id, oneMinute)
    const minutes = Math.floor(elapsedFocusMs(oneMinute, Date.parse(oneMinute.startedAt) + 60_000) / 60_000)
    await first.finish(user.id, 'save', minutes)
    await syncSession(first, user.id, authorized)
    await syncSession(second, user.id, authorized)
    expect((await second.snapshot(user.id)).checkins.map(checkin => checkin.durationMinutes).sort((a, b) => a - b)).toEqual([1, 25])
    expect((await tasks.listTasks(user.id, task.day))[0].completed).toBe(false)
  } finally {
    first.close()
    second.close()
    tasks.close()
    await helpers.deleteUser(user.id)
  }
})

test('two devices replace provisional outcomes with the first committed server receipt', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `session-conflict-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const factory = new IDBFactory()
  const first = new SessionStore(`focus-conflict-a-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const second = new SessionStore(`focus-conflict-b-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const tasks = new TaskStore(`focus-conflict-tasks-${crypto.randomUUID()}`, factory, IDBKeyRange)
  try {
    const login = await helpers.login({ userId: user.id })
    const authorized: typeof fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(new URL(String(input), origin), { ...init, headers: new Headers([...login.headers, ...new Headers(init?.headers)]) })) as typeof fetch
    const task = await tasks.createTask(user.id, 'Same outcome everywhere', localDay())
    await syncTasks(tasks, user.id, authorized)

    const discarded = await startSession(task.id, task.day, authorized)
    await first.started(user.id, discarded)
    await syncSession(second, user.id, authorized)
    await first.finish(user.id, 'save', 7)
    await second.finish(user.id, 'discard')
    await syncSession(second, user.id, authorized)
    await syncSession(first, user.id, authorized)
    expect((await first.snapshot(user.id)).checkins).toEqual([])
    expect((await second.snapshot(user.id)).checkins).toEqual([])

    const saved = await startSession(task.id, task.day, authorized)
    await first.started(user.id, saved)
    await syncSession(second, user.id, authorized)
    await first.finish(user.id, 'save', 7)
    await second.finish(user.id, 'discard')
    await syncSession(first, user.id, authorized)
    await syncSession(second, user.id, authorized)
    const onFirst = await first.snapshot(user.id)
    const onSecond = await second.snapshot(user.id)
    expect(onFirst.session).toBeNull()
    expect(onSecond.session).toBeNull()
    expect(onFirst.checkins).toEqual(onSecond.checkins)
    expect(onFirst.checkins).toMatchObject([{ sourceSessionId: saved.id, durationMinutes: 7 }])
    const conflicted = await startSession(task.id, task.day, authorized)
    await first.started(user.id, conflicted, task.title)
    await syncSession(second, user.id, authorized)
    await first.finish(user.id, 'finish')
    expect((await first.snapshot(user.id)).break?.phase).toBe('choice')
    await second.finish(user.id, 'discard')
    await syncSession(second, user.id, authorized)
    await syncSession(first, user.id, authorized)
    expect((await first.snapshot(user.id)).break).toBeNull()
  } finally {
    first.close()
    second.close()
    tasks.close()
    await helpers.deleteUser(user.id)
  }
})

test('break choices use wall-clock deadlines, can be skipped, and never add focused minutes', async () => {
  const factory = new IDBFactory()
  const focus = new SessionStore(`break-clock-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const userId = crypto.randomUUID()
  const sessionId = uuidv7()
  const taskId = uuidv7()
  const start = new Date('2026-09-24T12:00:00.000Z')
  try {
    await focus.started(userId, {
      id: sessionId, userId, taskId, day: '2026-09-24', plannedMinutes: 25,
      status: 'running', startedAt: start.toISOString(), elapsedMs: 0, segmentStartedAt: start.toISOString(),
    })
    await focus.finish(userId, 'finish', undefined, new Date(start.getTime() + 25 * 60_000), 'Restored Task')
    expect((await focus.snapshot(userId)).break).toMatchObject({ phase: 'choice', taskId, taskTitle: 'Restored Task' })
    await focus.startBreak(userId, 'short', new Date(start.getTime() + 26 * 60_000))
    const running = (await focus.snapshot(userId)).break!
    expect(running).toMatchObject({ phase: 'running', kind: 'short', taskId, durationMinutes: 5 })
    expect(remainingBreakSeconds(running, start.getTime() + 30 * 60_000)).toBe(60)
    expect(remainingBreakSeconds(running, start.getTime() + 35 * 60_000)).toBe(0)
    await focus.endBreak(userId)
    expect((await focus.snapshot(userId)).break?.phase).toBe('ended')
    await focus.clearBreak(userId)
    expect((await focus.snapshot(userId)).break).toBeNull()
    expect((await focus.snapshot(userId)).checkins.map(checkin => checkin.durationMinutes)).toEqual([25])
    await focus.started(userId, {
      id: uuidv7(), userId, taskId, day: '2026-09-24', plannedMinutes: 25,
      status: 'running', startedAt: start.toISOString(), elapsedMs: 0, segmentStartedAt: start.toISOString(),
    })
    await focus.finish(userId, 'finish')
    await focus.startBreak(userId, 'long', start)
    expect((await focus.snapshot(userId)).break).toMatchObject({ kind: 'long', durationMinutes: 15 })
    await focus.clearBreak(userId)
    expect((await focus.snapshot(userId)).break).toBeNull()
  } finally {
    focus.close()
  }
})
