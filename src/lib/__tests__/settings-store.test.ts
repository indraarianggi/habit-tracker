import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { defaultDurations } from '@/lib/settings-contract'
import { SettingsStore, syncSettings } from '@/lib/settings-store'
import { authOptions } from '@/server/auth'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })
const origin = 'http://127.0.0.1:3000'

test('durations save locally immediately, reject invalid values and reset to defaults', async () => {
  const factory = new IDBFactory()
  const store = new SettingsStore(`settings-local-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const userId = crypto.randomUUID()
  try {
    expect(await store.snapshot(userId)).toEqual(defaultDurations)
    const changed = { focusMinutes: 120, shortBreakMinutes: 30, longBreakMinutes: 60 }
    await store.update(userId, changed)
    expect(await store.snapshot(userId)).toEqual(changed)
    expect(await store.pendingCount(userId)).toBe(1)
    await expect(store.update(userId, { ...changed, shortBreakMinutes: 31 })).rejects.toThrow()
    await expect(store.update(userId, { ...changed, focusMinutes: 0 })).rejects.toThrow()
    await expect(store.update(userId, { ...changed, longBreakMinutes: 1.5 })).rejects.toThrow()
    expect(await store.snapshot(userId)).toEqual(changed)
    expect(await store.pendingCount(userId)).toBe(1)
    await store.update(userId, defaultDurations)
    expect(await store.snapshot(userId)).toEqual(defaultDurations)
    expect(await store.pendingCount(userId)).toBe(2)
    const anotherUser = crypto.randomUUID()
    await store.update(anotherUser, defaultDurations)
    expect(await store.pendingCount(anotherUser)).toBe(1)
  } finally {
    store.close()
  }
})

test('offline durations survive reload, upload on reconnect and reach another device without crossing accounts', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `settings-sync-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const factory = new IDBFactory()
  const name = `settings-reload-${crypto.randomUUID()}`
  let first = new SettingsStore(name, factory, IDBKeyRange)
  const second = new SettingsStore(`settings-other-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const otherUser = crypto.randomUUID()
  try {
    const changed = { focusMinutes: 42, shortBreakMinutes: 9, longBreakMinutes: 21 }
    await first.update(user.id, changed)
    const offline: typeof fetch = (() => Promise.reject(new TypeError('offline'))) as typeof fetch
    await expect(syncSettings(first, user.id, offline)).rejects.toThrow('offline')
    first.close()
    first = new SettingsStore(name, factory, IDBKeyRange)
    expect(await first.snapshot(user.id)).toEqual(changed)
    expect(await first.pendingCount(user.id)).toBe(1)
    expect(await first.snapshot(otherUser)).toEqual(defaultDurations)
    const login = await helpers.login({ userId: user.id })
    const authorized: typeof fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(new URL(String(input), origin), { ...init, headers: new Headers([...login.headers, ...new Headers(init?.headers)]) })) as typeof fetch
    await syncSettings(first, user.id, authorized)
    expect(await first.pendingCount(user.id)).toBe(0)
    await syncSettings(second, user.id, authorized)
    expect(await second.snapshot(user.id)).toEqual(changed)
    expect(await second.snapshot(otherUser)).toEqual(defaultDurations)
    await second.update(user.id, defaultDurations)
    await syncSettings(second, user.id, authorized)
    await syncSettings(first, user.id, authorized)
    expect(await first.snapshot(user.id)).toEqual(defaultDurations)
  } finally {
    first.close()
    second.close()
    await helpers.deleteUser(user.id)
  }
})

test('an older in-flight receipt and pull cannot overwrite a newer local edit', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `settings-race-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const factory = new IDBFactory()
  const store = new SettingsStore(`settings-race-${crypto.randomUUID()}`, factory, IDBKeyRange)
  try {
    const first = { focusMinutes: 30, shortBreakMinutes: 5, longBreakMinutes: 15 }
    const latest = { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20 }
    const login = await helpers.login({ userId: user.id })
    const authorized: typeof fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(new URL(String(input), origin), { ...init, headers: new Headers([...login.headers, ...new Headers(init?.headers)]) })) as typeof fetch
    let releaseReceipt!: () => void
    let receiptReady!: () => void
    const waiting = new Promise<void>(resolve => { releaseReceipt = resolve })
    const received = new Promise<void>(resolve => { receiptReady = resolve })
    const delayed: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await authorized(input, init)
      if (init?.method === 'POST') {
        receiptReady()
        await waiting
      }
      return response
    }) as typeof fetch
    await store.update(user.id, first)
    const syncing = syncSettings(store, user.id, delayed)
    await received
    try {
      await store.update(user.id, latest)
    } finally {
      releaseReceipt()
    }
    await syncing
    expect(await store.snapshot(user.id)).toEqual(latest)
    expect(await store.pendingCount(user.id)).toBe(1)
    await syncSettings(store, user.id, authorized)
    expect(await store.pendingCount(user.id)).toBe(0)
    expect(await store.snapshot(user.id)).toEqual(latest)
  } finally {
    store.close()
    await helpers.deleteUser(user.id)
  }
})
