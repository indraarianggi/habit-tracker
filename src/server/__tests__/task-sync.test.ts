import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { authOptions } from '@/server/auth'
import { TaskStore } from '@/lib/task-store'
import { syncTasks } from '@/lib/task-sync'
import { localDay } from '@/lib/task-contract'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })
const origin = 'http://127.0.0.1:3000'

test('offline creation survives, resends once, downloads in pages, recovers first load and isolates Users', async () => {
  const helpers = (await testAuth.$context).test
  const alice = helpers.createUser({ email: `task-alice-${crypto.randomUUID()}@invalid.test` })
  const bob = helpers.createUser({ email: `task-bob-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(alice)
  await helpers.saveUser(bob)
  const factory = new IDBFactory()
  const firstName = `task-first-${crypto.randomUUID()}`
  const first = new TaskStore(firstName, factory, IDBKeyRange)
  const second = new TaskStore(`task-second-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const other = new TaskStore(`task-other-${crypto.randomUUID()}`, factory, IDBKeyRange)
  try {
    const aliceLogin = await helpers.login({ userId: alice.id })
    const bobLogin = await helpers.login({ userId: bob.id })
    const authenticated = (headers: Headers, pageSize?: number): typeof fetch =>
      ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), origin)
        if (pageSize && url.pathname === '/api/sync/pull') url.searchParams.set('limit', String(pageSize))
        const requestHeaders = new Headers(init?.headers)
        for (const [key, value] of headers) requestHeaders.set(key, value)
        return fetch(url, { ...init, headers: requestHeaders })
      }) as typeof fetch
    const aliceFetch = authenticated(aliceLogin.headers)
    const bobFetch = authenticated(bobLogin.headers)
    const day = localDay()

    const one = await first.createTask(alice.id, '  Draft Report  ', day)
    const two = await first.createTask(alice.id, 'Draft Report', day)
    expect(one.title).toBe('Draft Report')
    expect(two.title).toBe('Draft Report')
    expect(one.id).not.toBe(two.id)
    expect(one.completed).toBe(false)
    expect(one.day).toBe(day)
    expect((await first.listTasks(alice.id, day)).map(task => task.id)).toEqual([one.id, two.id])
    expect((await first.syncState(alice.id)).pending).toBe(2)
    const reopened = new TaskStore(firstName, factory, IDBKeyRange)
    try {
      expect((await reopened.listTasks(alice.id, day)).map(task => task.id)).toEqual([one.id, two.id])
      expect((await reopened.syncState(alice.id)).pending).toBe(2)
    } finally {
      reopened.close()
    }

    const unauthenticated = await fetch(`${origin}/api/sync/pull?after=0`)
    expect(unauthenticated.status).toBe(401)
    const unauthorizedPush = await fetch(`${origin}/api/sync/push`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: [] }),
    })
    expect(unauthorizedPush.status).toBe(401)
    const before = await aliceFetch('/api/sync/pull?after=0')
    expect((await before.json()).changes).toEqual([])
    const pending = await first.pendingChanges(alice.id)
    const send = await aliceFetch('/api/sync/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: pending }),
    })
    expect(send.status).toBe(200)
    const accepted = await send.json()
    expect(accepted.results).toHaveLength(2)
    await syncTasks(first, alice.id, aliceFetch)
    expect((await first.syncState(alice.id)).pending).toBe(0)
    const resent = await aliceFetch('/api/sync/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: pending }),
    })
    expect((await resent.json()).results).toEqual(accepted.results)

    const offlineFetch: typeof fetch = (() => Promise.reject(new TypeError('offline'))) as typeof fetch
    await expect(syncTasks(second, alice.id, offlineFetch)).rejects.toThrow('offline')
    expect((await second.syncState(alice.id)).firstLoadComplete).toBe(false)
    let pages = 0
    const pagedFetch = authenticated(aliceLogin.headers, 1)
    const interrupted: typeof fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith('/api/sync/pull') && ++pages === 2) {
        return Promise.reject(new TypeError('connection interrupted'))
      }
      return pagedFetch(input, init)
    }) as typeof fetch
    await expect(syncTasks(second, alice.id, interrupted)).rejects.toThrow('connection interrupted')
    expect((await second.syncState(alice.id)).firstLoadComplete).toBe(false)
    expect((await second.syncState(alice.id)).cursor).toBeGreaterThan(0)
    await syncTasks(second, alice.id, pagedFetch)
    expect((await second.syncState(alice.id)).firstLoadComplete).toBe(true)
    expect((await second.listTasks(alice.id, day)).map(task => task.id)).toEqual([one.id, two.id])
    expect((await first.listTasks(bob.id, day))).toEqual([])
    await syncTasks(other, bob.id, bobFetch)
    expect(await other.listTasks(bob.id, day)).toEqual([])
    const denied = await bobFetch('/api/sync/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: pending }),
    })
    expect(denied.status).toBe(200)
    expect((await denied.json()).results.every((result: { status: string }) => result.status === 'rejected')).toBe(true)
    expect((await bobFetch('/api/sync/pull?after=0')).status).toBe(200)
    expect((await (await bobFetch('/api/sync/pull?after=0')).json()).changes).toEqual([])
  } finally {
    first.close()
    second.close()
    other.close()
    await helpers.deleteUser(alice.id)
    await helpers.deleteUser(bob.id)
  }
})
