import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { authOptions } from '@/server/auth'
import { SessionStore } from '@/lib/session-store'
import { syncSession } from '@/lib/session-client'
import { TaskStore } from '@/lib/task-store'
import { syncTasks } from '@/lib/task-sync'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })
const origin = 'http://127.0.0.1:3000'

test('a delayed old-account sync cannot upload or pull data through a new account cookie', async () => {
  const helpers = (await testAuth.$context).test
  const alice = helpers.createUser({ email: `old-${crypto.randomUUID()}@invalid.test` })
  const bob = helpers.createUser({ email: `new-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(alice)
  await helpers.saveUser(bob)
  const idb = new IDBFactory()
  const tasks = new TaskStore(`identity-tasks-${crypto.randomUUID()}`, idb, IDBKeyRange)
  const focus = new SessionStore(`identity-focus-${crypto.randomUUID()}`, idb, IDBKeyRange)
  try {
    const bobLogin = await helpers.login({ userId: bob.id })
    const bobFetch = ((input: RequestInfo | URL, init?: RequestInit) => fetch(new URL(String(input), origin), {
      ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), ...Object.fromEntries(bobLogin.headers) },
    })) as typeof fetch
    const offline = await tasks.createTask(alice.id, 'Only Alice')
    await focus.createCheckin(alice.id, offline, 24)
    await expect(syncTasks(tasks, alice.id, bobFetch)).rejects.toThrow('Sign in to sync')
    await expect(syncSession(focus, alice.id, bobFetch)).rejects.toThrow('Sign in to sync')
    expect((await tasks.syncState(alice.id)).pending).toBe(1)
    expect((await focus.pendingChanges(alice.id)).length).toBe(1)
    expect((await focus.snapshot(alice.id)).checkins).toMatchObject([{ taskId: offline.id, durationMinutes: 24 }])
    expect((await (await bobFetch('/api/sync/pull?after=0&limit=100')).json()).changes).toEqual([])
    expect((await (await bobFetch('/api/session')).json()).checkins).toEqual([])
  } finally {
    tasks.close(); focus.close()
    await helpers.deleteUser(alice.id)
    await helpers.deleteUser(bob.id)
  }
})
