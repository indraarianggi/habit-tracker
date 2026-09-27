import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { v7 as uuidv7 } from 'uuid'
import { authOptions } from '@/server/auth'
import { localDay } from '@/lib/task-contract'
import { TaskStore } from '@/lib/task-store'
import { SyncAuthError, syncTasks } from '@/lib/task-sync'
import { SessionStore } from '@/lib/session-store'
import { syncSession } from '@/lib/session-client'
import { SettingsStore, syncSettings } from '@/lib/settings-store'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })
const origin = 'http://127.0.0.1:3000'

test('TaskStore.wipeUser removes only that User’s Tasks, pending changes and sync cursor', async () => {
  const factory = new IDBFactory()
  const alice = uuidv7()
  const bob = uuidv7()
  const tasks = new TaskStore(`wipe-tasks-${uuidv7()}`, factory, IDBKeyRange)
  try {
    await tasks.createTask(alice, 'Alice draft')
    const bobTask = await tasks.createTask(bob, 'Bob draft')
    await tasks.applyPage(alice, [], 5, false)
    await tasks.wipeUser(alice)
    expect(await tasks.listTasks(alice, localDay())).toEqual([])
    expect((await tasks.pendingChanges(alice))).toEqual([])
    expect((await tasks.syncState(alice))).toEqual({ cursor: 0, firstLoadComplete: false, pending: 0 })
    expect(await tasks.listTasks(bob, localDay())).toEqual([bobTask])
    expect((await tasks.pendingChanges(bob)).length).toBe(1)
  } finally {
    tasks.close()
  }
})

test('SessionStore.wipeUser removes only that User’s focus state, Check-ins and Pending changes', async () => {
  const factory = new IDBFactory()
  const alice = uuidv7()
  const bob = uuidv7()
  const focus = new SessionStore(`wipe-focus-${uuidv7()}`, factory, IDBKeyRange)
  try {
    const aliceTask = { id: uuidv7(), userId: alice, day: localDay(), title: 'A', completed: false, orderKey: '0', createdAt: new Date().toISOString(), seq: 0 }
    const bobTask = { id: uuidv7(), userId: bob, day: localDay(), title: 'B', completed: false, orderKey: '0', createdAt: new Date().toISOString(), seq: 0 }
    await focus.createCheckin(alice, aliceTask, 10)
    const bobCheckin = await focus.createCheckin(bob, bobTask, 15)
    await focus.wipeUser(alice)
    expect((await focus.snapshot(alice)).checkins).toEqual([])
    expect((await focus.pendingChanges(alice))).toEqual([])
    expect((await focus.snapshot(bob)).checkins).toEqual([bobCheckin])
    expect((await focus.pendingChanges(bob)).length).toBe(1)
  } finally {
    focus.close()
  }
})

test('SettingsStore.wipeUser removes only that User’s Settings and Pending changes', async () => {
  const factory = new IDBFactory()
  const alice = uuidv7()
  const bob = uuidv7()
  const settings = new SettingsStore(`wipe-settings-${uuidv7()}`, factory, IDBKeyRange)
  try {
    await settings.update(alice, current => ({ ...current, focusMinutes: 45 }))
    await settings.update(bob, current => ({ ...current, focusMinutes: 50 }))
    await settings.wipeUser(alice)
    expect((await settings.snapshot(alice)).focusMinutes).toBe(25)
    expect((await settings.pendingChanges(alice))).toEqual([])
    expect((await settings.snapshot(bob)).focusMinutes).toBe(50)
    expect((await settings.pendingChanges(bob)).length).toBe(1)
  } finally {
    settings.close()
  }
})

test('sync throws a SyncAuthError with status 410 once the server has torn down the account', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `wipe-sync-${crypto.randomUUID()}@invalid.test` })
  const stillAround = helpers.createUser({ email: `wipe-sync-peer-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  await helpers.saveUser(stillAround)
  const login = await helpers.login({ userId: user.id })
  const authenticatedFetch = ((input: RequestInfo | URL, init?: RequestInit) => fetch(new URL(String(input), origin), {
    ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), ...Object.fromEntries(login.headers) },
  })) as typeof fetch
  const factory = new IDBFactory()
  const tasks = new TaskStore(`wipe-sync-tasks-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const focus = new SessionStore(`wipe-sync-focus-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const settings = new SettingsStore(`wipe-sync-settings-${crypto.randomUUID()}`, factory, IDBKeyRange)
  try {
    const deletion = await authenticatedFetch('/api/account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: 'DELETE' }),
    })
    expect(deletion.status).toBe(200)

    await expect(syncTasks(tasks, user.id, authenticatedFetch)).rejects.toBeInstanceOf(SyncAuthError)
    await expect(syncTasks(tasks, user.id, authenticatedFetch)).rejects.toMatchObject({ status: 410 })
    await expect(syncSession(focus, user.id, authenticatedFetch)).rejects.toMatchObject({ status: 410 })
    await expect(syncSettings(settings, user.id, authenticatedFetch)).rejects.toMatchObject({ status: 410 })
    // An ordinary expired session, for an account that still exists, reads as the plain sign-in prompt.
    const anonymousFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(new URL(String(input), origin), init)) as typeof fetch
    await expect(syncTasks(tasks, stillAround.id, anonymousFetch)).rejects.toBeInstanceOf(SyncAuthError)
    await expect(syncTasks(tasks, stillAround.id, anonymousFetch)).rejects.toMatchObject({ status: 401 })
  } finally {
    tasks.close(); focus.close(); settings.close()
    await helpers.deleteUser(stillAround.id)
  }
})
