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

test('one device retains its first account’s unsent Task and Check-in while another account syncs', async () => {
  const helpers = (await testAuth.$context).test
  const alice = helpers.createUser({ email: `resume-alice-${crypto.randomUUID()}@invalid.test` })
  const bob = helpers.createUser({ email: `resume-bob-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(alice)
  await helpers.saveUser(bob)
  const idb = new IDBFactory()
  const shared = new TaskStore(`shared-tasks-${crypto.randomUUID()}`, idb, IDBKeyRange)
  const focus = new SessionStore(`shared-focus-${crypto.randomUUID()}`, idb, IDBKeyRange)
  const second = new TaskStore(`second-tasks-${crypto.randomUUID()}`, idb, IDBKeyRange)
  const secondFocus = new SessionStore(`second-focus-${crypto.randomUUID()}`, idb, IDBKeyRange)
  try {
    const aliceLogin = await helpers.login({ userId: alice.id })
    const bobLogin = await helpers.login({ userId: bob.id })
    const authorized = (headers: Headers) => ((input: RequestInfo | URL, init?: RequestInit) => fetch(
      new URL(String(input), origin), { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), ...Object.fromEntries(headers) } },
    )) as typeof fetch
    const aliceFetch = authorized(aliceLogin.headers)
    const bobFetch = authorized(bobLogin.headers)
    const offlineTask = await shared.createTask(alice.id, 'Alice unsent focus')
    await focus.createCheckin(alice.id, offlineTask, 19)
    expect(await shared.listTasks(bob.id, localDay())).toEqual([])
    expect((await focus.snapshot(bob.id)).checkins).toEqual([])
    await shared.createTask(bob.id, 'Bob work')
    await syncTasks(shared, bob.id, bobFetch)
    expect((await shared.syncState(alice.id)).pending).toBe(1)
    expect((await focus.pendingChanges(alice.id)).length).toBe(1)
    expect((await (await bobFetch('/api/sync/pull?after=0&limit=100')).json()).changes).toEqual([
      expect.objectContaining({ task: expect.objectContaining({ title: 'Bob work' }) }),
    ])
    await syncTasks(shared, alice.id, aliceFetch)
    await syncSession(focus, alice.id, aliceFetch)
    await syncTasks(second, alice.id, aliceFetch)
    await syncSession(secondFocus, alice.id, aliceFetch)
    expect((await second.listTasks(alice.id, localDay())).map(task => task.title)).toEqual(['Alice unsent focus'])
    expect((await secondFocus.snapshot(alice.id)).checkins).toMatchObject([{ taskId: offlineTask.id, durationMinutes: 19 }])
    expect((await shared.listTasks(bob.id, localDay())).map(task => task.title)).toEqual(['Bob work'])
    expect((await shared.syncState(alice.id)).pending).toBe(0)
    expect(await focus.pendingChanges(alice.id)).toEqual([])
  } finally {
    shared.close(); focus.close(); second.close(); secondFocus.close()
    await helpers.deleteUser(alice.id)
    await helpers.deleteUser(bob.id)
  }
})
