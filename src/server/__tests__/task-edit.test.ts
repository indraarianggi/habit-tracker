import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { v7 as uuidv7 } from 'uuid'
import { localDay } from '@/lib/task-contract'
import { TaskStore } from '@/lib/task-store'
import { syncTasks } from '@/lib/task-sync'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })
const origin = 'http://127.0.0.1:3000'

test('Task edits preserve Day, reverse completion, and move only the selected Task across devices', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `task-edit-${crypto.randomUUID()}@invalid.test` })
  const other = helpers.createUser({ email: `task-edit-other-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  await helpers.saveUser(other)
  const factory = new IDBFactory()
  const first = new TaskStore(`edit-first-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const second = new TaskStore(`edit-second-${crypto.randomUUID()}`, factory, IDBKeyRange)
  try {
    const login = await helpers.login({ userId: user.id })
    const otherLogin = await helpers.login({ userId: other.id })
    const fetchAs = (headers: Headers): typeof fetch => ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(new URL(String(input), origin), { ...init, headers: new Headers([...headers, ...new Headers(init?.headers)]) })
    ) as typeof fetch
    const authorized = fetchAs(login.headers)
    const day = localDay()
    const previousDay = new Date()
    previousDay.setDate(previousDay.getDate() - 1)
    const past = localDay(previousDay)
    const pastId = uuidv7()
    const pastChange = { id: uuidv7(), task: {
      id: pastId, day: past, title: 'Old title', completed: true,
      orderKey: '00000000000000010000000000000000', createdAt: new Date().toISOString(),
    } }
    expect((await authorized('/api/sync/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: [pastChange] }) })).status).toBe(200)
    const a = await first.createTask(user.id, 'First', day)
    const b = await first.createTask(user.id, 'Second', day)
    const c = await first.createTask(user.id, 'Third', day)
    await syncTasks(first, user.id, authorized)
    await syncTasks(second, user.id, authorized)

    await first.renameTask(user.id, pastId, '  Current title  ')
    await first.setTaskCompleted(user.id, b.id, true)
    await first.moveTask(user.id, c.id, 'up')
    expect((await first.listTasks(user.id, day)).map(task => task.id)).toEqual([a.id, c.id, b.id])
    expect((await first.listTasks(user.id, day)).find(task => task.id === b.id)).toMatchObject({ completed: true, orderKey: b.orderKey, day })
    const offline: typeof fetch = (() => Promise.reject(new TypeError('offline'))) as typeof fetch
    await expect(syncTasks(first, user.id, offline)).rejects.toThrow('offline')
    expect((await first.syncState(user.id)).pending).toBe(3)
    expect((await first.listTasks(user.id, past))[0].title).toBe('Current title')
    await syncTasks(first, user.id, authorized)
    await syncTasks(second, user.id, authorized)
    expect((await second.listTasks(user.id, day)).map(task => task.id)).toEqual([a.id, c.id, b.id])
    expect((await second.listTasks(user.id, past))[0]).toMatchObject({ id: pastId, title: 'Current title', day: past, completed: true })
    expect((await second.listTasks(user.id, day)).find(task => task.id === a.id)?.orderKey).toBe(a.orderKey)
    expect((await second.listTasks(user.id, day)).find(task => task.id === b.id)?.orderKey).toBe(b.orderKey)

    await second.setTaskCompleted(user.id, b.id, false)
    await second.moveTask(user.id, c.id, 'down')
    await syncTasks(second, user.id, authorized)
    await syncTasks(first, user.id, authorized)
    expect((await first.listTasks(user.id, day)).map(task => task.id)).toEqual([a.id, b.id, c.id])
    expect((await first.listTasks(user.id, day)).find(task => task.id === b.id)).toMatchObject({ completed: false, day, orderKey: b.orderKey })
    expect((await first.listTasks(user.id, past))[0]).toMatchObject({ id: pastId, title: 'Current title', day: past })
    expect((await first.listTasks(user.id, day)).find(task => task.id === a.id)?.orderKey).toBe(a.orderKey)
    await expect(first.renameTask(user.id, b.id, '   ')).rejects.toThrow('Enter a Task title.')
    await expect(first.moveTask(user.id, a.id, 'up')).resolves.toBe(false)
    expect((await first.listTasks(user.id, day)).map(task => task.id)).toEqual([a.id, b.id, c.id])
    const forged = { id: uuidv7(), task: { ...pastChange.task, title: 'Wrong day', day } }
    const moved = await authorized('/api/sync/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: [forged] }) })
    expect((await moved.json()).results[0]).toMatchObject({ status: 'rejected', reason: 'Task day cannot be changed.' })
    expect((await fetchAs(otherLogin.headers)('/api/sync/pull?after=0').then(response => response.json())).changes).toEqual([])
    expect((await fetch(`${origin}/api/sync/pull?after=0`)).status).toBe(401)
    expect((await fetch(`${origin}/api/sync/push`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: [] }) })).status).toBe(401)
  } finally {
    first.close()
    second.close()
    await helpers.deleteUser(user.id)
    await helpers.deleteUser(other.id)
  }
})

test('ties from concurrent appends sort identically and moving a tied Task changes no other order key', async () => {
  const factory = new IDBFactory()
  const store = new TaskStore(`ties-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const userId = 'ties-user'
  const day = localDay()
  try {
    const first = await store.createTask(userId, 'First', day)
    const second = await store.createTask(userId, 'Second', day)
    const third = await store.createTask(userId, 'Third', day)
    const tied = new TaskStore(`ties-second-${crypto.randomUUID()}`, factory, IDBKeyRange)
    try {
      await tied.applyPage(userId, [
        { seq: 1, task: { ...first, seq: 1 } },
        { seq: 2, task: { ...second, seq: 2 } },
        { seq: 3, task: { ...third, orderKey: second.orderKey, seq: 3 } },
      ], 3, false)
      const before = await tied.listTasks(userId, day)
      expect(before.map(task => task.id)).toEqual([first.id, second.id, third.id])
      const replay = new TaskStore(`ties-replay-${crypto.randomUUID()}`, factory, IDBKeyRange)
      try {
        await replay.applyPage(userId, [
          { seq: 3, task: { ...third, orderKey: second.orderKey, seq: 3 } },
          { seq: 2, task: { ...second, seq: 2 } },
          { seq: 1, task: { ...first, seq: 1 } },
        ], 3, false)
        expect((await replay.listTasks(userId, day)).map(task => task.id)).toEqual(before.map(task => task.id))
      } finally { replay.close() }
      expect(await tied.moveTask(userId, third.id, 'up')).toBe(true)
      const after = await tied.listTasks(userId, day)
      expect(after.map(task => task.id)).toEqual([first.id, third.id, second.id])
      expect(after.find(task => task.id === first.id)?.orderKey).toBe(first.orderKey)
      expect(after.find(task => task.id === second.id)?.orderKey).toBe(second.orderKey)
    } finally { tied.close() }
  } finally { store.close() }
})
