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

function shiftDay(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return localDay(date)
}

test('copying unfinished work preserves its Day and produces an independent, appended Task across devices', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `copy-${crypto.randomUUID()}@invalid.test` })
  const other = helpers.createUser({ email: `copy-other-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  await helpers.saveUser(other)
  const factory = new IDBFactory()
  const first = new TaskStore(`copy-first-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const second = new TaskStore(`copy-second-${crypto.randomUUID()}`, factory, IDBKeyRange)
  try {
    const { headers } = await helpers.login({ userId: user.id })
    const authorized: typeof fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(new URL(String(input), origin), { ...init, headers: new Headers([...headers, ...new Headers(init?.headers)]) })) as typeof fetch
    const yesterday = shiftDay(-1)
    const today = localDay()
    const tomorrow = shiftDay(1)
    const source = { id: uuidv7(), day: yesterday, title: 'Carry this forward', completed: false,
      orderKey: '00000000000000010000000000000000', createdAt: new Date().toISOString() }
    const completed = { ...source, id: uuidv7(), title: 'Finished already', completed: true,
      orderKey: '00000000000000020000000000000000' }
    const older = { ...source, id: uuidv7(), day: shiftDay(-3), title: 'Older unfinished work' }
    const seed = await authorized('/api/sync/push', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: [source, completed, older].map(task => ({ id: uuidv7(), task })) }) })
    expect(seed.status).toBe(200)
    await syncTasks(first, user.id, authorized)
    const existing = await first.createTask(user.id, 'Already planned', today)

    await expect(first.copyTask(user.id, source.id, yesterday)).rejects.toThrow('later')
    await expect(first.copyTask(user.id, source.id, shiftDay(-2))).rejects.toThrow('later')
    await expect(first.copyTask(user.id, older.id, yesterday)).rejects.toThrow('Today')
    await expect(first.createTask(user.id, 'Backdated', yesterday)).rejects.toThrow('today or a future day')
    await expect(first.copyTask(user.id, completed.id, today)).rejects.toThrow('unfinished')
    await expect(first.copyTask(other.id, source.id, today)).rejects.toThrow('not found')
    expect((await first.listTasks(user.id, yesterday)).map(task => task.id)).toEqual([source.id, completed.id])
    expect((await first.syncState(user.id)).pending).toBe(1)

    const copy = await first.copyTask(user.id, source.id, today)
    expect(copy).toMatchObject({ day: today, title: source.title, completed: false, seq: 0 })
    expect(copy.id).not.toBe(source.id)
    expect((await first.listTasks(user.id, today)).map(task => task.id)).toEqual([existing.id, copy.id])
    expect((await first.listTasks(user.id, yesterday))[0]).toMatchObject(source)
    await first.setTaskCompleted(user.id, source.id, true)
    expect((await first.listTasks(user.id, today))[1]).toMatchObject({ id: copy.id, completed: false })
    const future = await first.copyTask(user.id, copy.id, tomorrow)
    expect(future).toMatchObject({ day: tomorrow, title: source.title, completed: false })
    await expect(first.copyTask(user.id, future.id, today)).rejects.toThrow('later')
    expect(await first.daysWithTasks(user.id, shiftDay(-7), shiftDay(7))).toEqual([older.day, yesterday, today, tomorrow])
    const offline: typeof fetch = (() => Promise.reject(new TypeError('offline'))) as typeof fetch
    await expect(syncTasks(first, user.id, offline)).rejects.toThrow('offline')
    expect((await first.syncState(user.id)).pending).toBe(4)
    await syncTasks(first, user.id, authorized)
    await syncTasks(second, user.id, authorized)
    expect((await second.listTasks(user.id, yesterday))[0]).toMatchObject({ ...source, completed: true })
    expect((await second.listTasks(user.id, today)).map(task => task.id)).toEqual([existing.id, copy.id])
    expect((await second.listTasks(user.id, tomorrow))[0]).toMatchObject({ id: future.id, completed: false })

    // Ticket 10 provides the guarded, synced user-facing deletion. These independent
    // rows have no source reference: deleting either row cannot cascade to the other.
    authOptions.database.prepare('DELETE FROM task WHERE id = ? AND userId = ?').run(source.id, user.id)
    expect(authOptions.database.prepare('SELECT id FROM task WHERE id = ?').get(copy.id)).toEqual({ id: copy.id })
    authOptions.database.prepare('DELETE FROM task WHERE id = ? AND userId = ?').run(copy.id, user.id)
    expect(authOptions.database.prepare('SELECT id FROM task WHERE id = ?').get(future.id)).toEqual({ id: future.id })
    expect((await fetch(`${origin}/api/sync/pull?after=0`)).status).toBe(401)
    expect((await fetch(`${origin}/api/sync/push`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: [] }) })).status).toBe(401)
  } finally {
    first.close()
    second.close()
    await helpers.deleteUser(user.id)
    await helpers.deleteUser(other.id)
  }
})
