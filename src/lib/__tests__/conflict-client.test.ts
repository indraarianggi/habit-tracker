import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { authOptions } from '@/server/auth'
import { SessionStore } from '@/lib/session-store'
import { syncSession } from '@/lib/session-client'
import { TaskStore } from '@/lib/task-store'
import { syncTasks } from '@/lib/task-sync'
import { localDay } from '@/lib/task-contract'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })
const origin = 'http://127.0.0.1:3000'

test('a deleted Task rejects an offline Check-in but does not block another Pending Check-in', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `conflict-create-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const factory = new IDBFactory()
  const first = new TaskStore(`conflict-tasks-a-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const second = new TaskStore(`conflict-tasks-b-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const focus = new SessionStore(`conflict-focus-a-${crypto.randomUUID()}`, factory, IDBKeyRange)
  try {
    const login = await helpers.login({ userId: user.id })
    const authorized = ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(new URL(String(input), origin), { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), ...Object.fromEntries(login.headers) } })) as typeof fetch
    const lostTask = await first.createTask(user.id, 'Draft report', localDay())
    const keptTask = await first.createTask(user.id, 'Review report', localDay())
    await syncTasks(first, user.id, authorized)
    await syncTasks(second, user.id, authorized)
    const lost = await focus.createCheckin(user.id, lostTask, 25)
    await focus.editCheckin(user.id, lost.id, lostTask, 30)
    await focus.createCheckin(user.id, keptTask, 12)
    await second.deleteTask(user.id, lostTask.id)
    await syncTasks(second, user.id, authorized)
    const notices: string[] = []
    await syncSession(focus, user.id, authorized, notice => notices.push(notice))
    expect(notices).toEqual([expect.stringContaining('30 min on "Draft report"')])
    expect(notices[0]).toContain(localDay())
    expect((await focus.snapshot(user.id)).checkins).toMatchObject([{ taskId: keptTask.id, durationMinutes: 12 }])
    expect((await focus.pendingChanges(user.id))).toEqual([])
    const remote = await (await authorized('/api/session')).json()
    expect(remote.checkins).toMatchObject([{ taskId: keptTask.id, durationMinutes: 12 }])
    await syncTasks(first, user.id, authorized)
    expect((await first.listTasks(user.id, localDay())).map(task => task.id)).toEqual([keptTask.id])
    expect((await second.listTasks(user.id, localDay())).map(task => task.id)).toEqual([keptTask.id])
  } finally {
    first.close(); second.close(); focus.close()
    await helpers.deleteUser(user.id)
  }
})

test('rejected reassignment keeps accepted minutes on original Task and still syncs unrelated corrections', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `conflict-move-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const factory = new IDBFactory()
  const first = new TaskStore(`move-tasks-a-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const second = new TaskStore(`move-tasks-b-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const focus = new SessionStore(`move-focus-a-${crypto.randomUUID()}`, factory, IDBKeyRange)
  try {
    const login = await helpers.login({ userId: user.id })
    const authorized = ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(new URL(String(input), origin), { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), ...Object.fromEntries(login.headers) } })) as typeof fetch
    const original = await first.createTask(user.id, 'Original focus', localDay())
    const deletedTarget = await first.createTask(user.id, 'Deleted destination', localDay())
    await syncTasks(first, user.id, authorized)
    await syncTasks(second, user.id, authorized)
    const accepted = await focus.createCheckin(user.id, original, 25)
    const unrelated = await focus.createCheckin(user.id, original, 10)
    await syncSession(focus, user.id, authorized)
    await focus.editCheckin(user.id, accepted.id, deletedTarget, 30, original)
    await focus.editCheckin(user.id, unrelated.id, original, 15)
    await second.deleteTask(user.id, deletedTarget.id)
    await syncTasks(second, user.id, authorized)
    const notices: string[] = []
    await syncSession(focus, user.id, authorized, notice => notices.push(notice))
    expect(notices).toEqual([expect.stringContaining('25 min stayed on "Original focus"')])
    expect(notices[0]).toContain('only the move failed')
    expect((await focus.snapshot(user.id)).checkins).toMatchObject([
      { id: accepted.id, taskId: original.id, durationMinutes: 25 },
      { id: unrelated.id, taskId: original.id, durationMinutes: 15 },
    ])
    expect((await focus.pendingChanges(user.id))).toEqual([])
    expect((await (await authorized('/api/session')).json()).checkins).toMatchObject([
      { taskId: original.id, durationMinutes: 25 }, { taskId: original.id, durationMinutes: 15 },
    ])
  } finally {
    first.close(); second.close(); focus.close()
    await helpers.deleteUser(user.id)
  }
})

test('a stale Task edit is reconciled without freezing unrelated Pending Tasks', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `conflict-task-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const factory = new IDBFactory()
  const first = new TaskStore(`stale-tasks-a-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const second = new TaskStore(`stale-tasks-b-${crypto.randomUUID()}`, factory, IDBKeyRange)
  try {
    const login = await helpers.login({ userId: user.id })
    const authorized = ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(new URL(String(input), origin), { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), ...Object.fromEntries(login.headers) } })) as typeof fetch
    const removed = await first.createTask(user.id, 'Remote deletion')
    await syncTasks(first, user.id, authorized)
    await syncTasks(second, user.id, authorized)
    await first.renameTask(user.id, removed.id, 'Stale edit')
    const unrelated = await first.createTask(user.id, 'Independent work')
    await second.deleteTask(user.id, removed.id)
    await syncTasks(second, user.id, authorized)
    await syncTasks(first, user.id, authorized)
    expect((await first.syncState(user.id)).pending).toBe(0)
    expect((await first.listTasks(user.id, localDay())).map(task => task.id)).toEqual([unrelated.id])
    await syncTasks(second, user.id, authorized)
    expect((await second.listTasks(user.id, localDay())).map(task => task.id)).toEqual([unrelated.id])
  } finally {
    first.close(); second.close()
    await helpers.deleteUser(user.id)
  }
})

test('intentional Task cascade discards its unsent Check-ins without a loss notice', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `conflict-cascade-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const factory = new IDBFactory()
  const tasks = new TaskStore(`cascade-tasks-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const focus = new SessionStore(`cascade-focus-${crypto.randomUUID()}`, factory, IDBKeyRange)
  try {
    const login = await helpers.login({ userId: user.id })
    const authorized = ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(new URL(String(input), origin), { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), ...Object.fromEntries(login.headers) } })) as typeof fetch
    const deleted = await tasks.createTask(user.id, 'Intentional cascade')
    const kept = await tasks.createTask(user.id, 'Kept work')
    await syncTasks(tasks, user.id, authorized)
    await focus.createCheckin(user.id, deleted, 30)
    await focus.createCheckin(user.id, kept, 15)
    await focus.removeTaskCheckins(user.id, deleted.id)
    await tasks.deleteTask(user.id, deleted.id)
    const notices: string[] = []
    await syncTasks(tasks, user.id, authorized, () => syncSession(focus, user.id, authorized, notice => notices.push(notice)))
    await syncSession(focus, user.id, authorized, notice => notices.push(notice))
    expect(notices).toEqual([])
    expect((await focus.snapshot(user.id)).checkins).toMatchObject([{ taskId: kept.id, durationMinutes: 15 }])
    expect((await focus.pendingChanges(user.id))).toEqual([])
    expect((await (await authorized('/api/session')).json()).checkins).toMatchObject([{ taskId: kept.id, durationMinutes: 15 }])
  } finally {
    focus.close(); tasks.close()
    await helpers.deleteUser(user.id)
  }
})