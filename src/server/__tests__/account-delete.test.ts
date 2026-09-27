import { expect, test } from '@playwright/test'
import Database from 'better-sqlite3'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { v7 as uuidv7 } from 'uuid'
import { localDay } from '@/lib/task-contract'
import { authOptions } from '@/server/auth'
import { database, migrateAccountSchema } from '@/server/db'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })
const origin = 'http://127.0.0.1:3000'
const today = localDay()

function asUser(headers: Headers) {
  return (path: string, body?: object, localUser?: string) => {
    const requestHeaders = new Headers(headers)
    if (body !== undefined) requestHeaders.set('Content-Type', 'application/json')
    if (localUser !== undefined) requestHeaders.set('X-Local-User', localUser)
    return fetch(new URL(path, origin), {
      method: body === undefined ? 'GET' : 'POST',
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }
}

async function userFixture(email: string) {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email })
  await helpers.saveUser(user)
  return { helpers, user }
}

async function seedLiveData(request: ReturnType<typeof asUser>, userId: string) {
  const task = { id: uuidv7(), day: today, title: 'Keep focused', completed: false,
    orderKey: '00000000000000010000000000000000', createdAt: new Date().toISOString() }
  await request('/api/sync/push', { changes: [{ id: uuidv7(), task }] })
  await request('/api/checkin/change', { id: uuidv7(), action: 'create', checkinId: uuidv7(),
    taskId: task.id, durationMinutes: 12, createdAt: new Date().toISOString(), today })
  await request('/api/settings', { id: uuidv7(), settings: { focusMinutes: 45, shortBreakMinutes: 8, longBreakMinutes: 20 } })
  const sessionId = uuidv7()
  await request('/api/session/start', { id: sessionId, taskId: task.id, day: today, plannedMinutes: 25 })
  return { task, sessionId }
}

test('deleting an account atomically removes the User and every live record, including the active Session', async () => {
  const { helpers, user } = await userFixture(`account-delete-${crypto.randomUUID()}@invalid.test`)
  try {
    const login = await helpers.login({ userId: user.id })
    const request = asUser(login.headers)
    const { task, sessionId } = await seedLiveData(request, user.id)

    const unauthenticated = await asUser(new Headers())('/api/account', { confirmation: 'DELETE' })
    expect(unauthenticated.status).toBe(401)

    const badConfirmation = await request('/api/account', { confirmation: 'delete' })
    expect(badConfirmation.status).toBe(400)
    expect(database.prepare('SELECT id FROM "user" WHERE id = ?').get(user.id)).toEqual({ id: user.id })

    const response = await request('/api/account', { confirmation: 'DELETE' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })

    expect(database.prepare('SELECT id FROM "user" WHERE id = ?').get(user.id)).toBeUndefined()
    expect(database.prepare('SELECT id FROM "session" WHERE "userId" = ?').all(user.id)).toEqual([])
    expect(database.prepare('SELECT id FROM "account" WHERE "userId" = ?').all(user.id)).toEqual([])
    expect(database.prepare('SELECT id FROM task WHERE userId = ?').all(user.id)).toEqual([])
    expect(database.prepare('SELECT seq FROM task_change WHERE userId = ?').all(user.id)).toEqual([])
    expect(database.prepare('SELECT id FROM active_session WHERE userId = ?').all(user.id)).toEqual([])
    expect(database.prepare('SELECT sessionId FROM session_receipt WHERE userId = ?').all(user.id)).toEqual([])
    expect(database.prepare('SELECT id FROM session_checkin WHERE userId = ?').all(user.id)).toEqual([])
    expect(database.prepare('SELECT userId FROM duration_settings WHERE userId = ?').all(user.id)).toEqual([])
    expect(database.prepare('SELECT id FROM active_session WHERE id = ?').get(sessionId)).toBeUndefined()
    expect(database.pragma('foreign_key_check')).toEqual([])

    // The session cookie the deletion happened with is now meaningless too.
    expect((await request('/api/today')).status).toBe(401)
    expect((await request('/api/sync/pull?after=0')).status).toBe(401)
  } finally {
    // The account no longer exists; nothing left for helpers.deleteUser to clean up.
  }
})

test('another device recognizes the account is gone, distinctly from an ordinary expired session', async () => {
  const { helpers, user } = await userFixture(`account-delete-peer-${crypto.randomUUID()}@invalid.test`)
  const outsider = await userFixture(`account-delete-outsider-${crypto.randomUUID()}@invalid.test`)
  try {
    const owner = asUser((await helpers.login({ userId: user.id })).headers)
    const peer = asUser((await helpers.login({ userId: user.id })).headers)
    const outsiderRequest = asUser((await outsider.helpers.login({ userId: outsider.user.id })).headers)
    await seedLiveData(owner, user.id)

    expect((await owner('/api/account', { confirmation: 'DELETE' })).status).toBe(200)

    // The peer device's own session row was cascade-deleted with the account: it now
    // gets a distinct "account deleted" signal instead of a plain "sign in again".
    const gone = await peer('/api/sync/pull?after=0', undefined, user.id)
    expect(gone.status).toBe(410)
    expect(await gone.json()).toEqual({ error: 'Account deleted' })
    const goneOnPush = await peer('/api/sync/push', { changes: [] }, user.id)
    expect(goneOnPush.status).toBe(410)
    const goneOnSession = await peer('/api/session', undefined, user.id)
    expect(goneOnSession.status).toBe(410)
    const goneOnSettings = await peer('/api/settings', undefined, user.id)
    expect(goneOnSettings.status).toBe(410)

    // Without a locally-known user id there is nothing to check the tombstone against,
    // so a stranger's plain expired/absent session still reads as a normal 401.
    expect((await peer('/api/sync/pull?after=0')).status).toBe(401)

    // A real, unrelated account's expired-looking request is unaffected by someone else's tombstone.
    expect((await outsiderRequest('/api/sync/pull?after=0')).status).toBe(200)
  } finally {
    await outsider.helpers.deleteUser(outsider.user.id)
  }
})

test('deletion requires the exact typed confirmation and cannot be replayed on someone else’s account', async () => {
  const { helpers, user } = await userFixture(`account-delete-guard-${crypto.randomUUID()}@invalid.test`)
  const other = await userFixture(`account-delete-guard-other-${crypto.randomUUID()}@invalid.test`)
  try {
    const request = asUser((await helpers.login({ userId: user.id })).headers)
    const otherRequest = asUser((await other.helpers.login({ userId: other.user.id })).headers)
    expect((await request('/api/account', {})).status).toBe(400)
    expect((await request('/api/account', { confirmation: 'Delete' })).status).toBe(400)
    expect((await request('/api/account', { confirmation: 'DELETE' }, other.user.id)).status).toBe(403)
    expect(database.prepare('SELECT id FROM "user" WHERE id = ?').get(user.id)).toEqual({ id: user.id })

    expect((await otherRequest('/api/account', { confirmation: 'DELETE' })).status).toBe(200)
    expect(database.prepare('SELECT id FROM "user" WHERE id = ?').get(other.user.id)).toBeUndefined()
    expect(database.prepare('SELECT id FROM "user" WHERE id = ?').get(user.id)).toEqual({ id: user.id })
  } finally {
    await helpers.deleteUser(user.id)
  }
})

test('the account schema migration adds a tombstone table without disturbing existing data', () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`CREATE TABLE "user" (id text not null primary key); INSERT INTO "user" (id) VALUES ('person');`)
  db.pragma('user_version = 6')
  migrateAccountSchema(db)
  expect(db.pragma('user_version', { simple: true })).toBe(7)
  expect(db.pragma('foreign_key_check')).toEqual([])
  expect(db.prepare('SELECT id FROM "user" WHERE id = ?').get('person')).toEqual({ id: 'person' })
  db.prepare('INSERT INTO deleted_account (userId, deletedAt) VALUES (?, ?)').run('gone', new Date().toISOString())
  expect(db.prepare('SELECT userId FROM deleted_account WHERE userId = ?').get('gone')).toEqual({ userId: 'gone' })
  db.close()
})
