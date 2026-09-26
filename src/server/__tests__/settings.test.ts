import { expect, test } from '@playwright/test'
import Database from 'better-sqlite3'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { v7 as uuidv7 } from 'uuid'
import { defaultDurations } from '@/lib/settings-contract'
import { authOptions } from '@/server/auth'
import { migrateSettingsSchema } from '@/server/db'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })
const origin = 'http://127.0.0.1:3000'

function asUser(headers: Headers) {
  return (method: 'GET' | 'POST', path = '/api/settings', body?: unknown, localUser?: string) => {
    const requestHeaders = new Headers(headers)
    if (body !== undefined) requestHeaders.set('Content-Type', 'application/json')
    if (localUser !== undefined) requestHeaders.set('X-Local-User', localUser)
    return fetch(new URL(path, origin), {
      method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body),
    })
  }
}

test('settings are private, default for new accounts, and visible on another signed-in device', async () => {
  const helpers = (await testAuth.$context).test
  const alice = helpers.createUser({ email: `settings-alice-${crypto.randomUUID()}@invalid.test` })
  const bob = helpers.createUser({ email: `settings-bob-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(alice)
  await helpers.saveUser(bob)
  try {
    const device = asUser((await helpers.login({ userId: alice.id })).headers)
    const otherDevice = asUser((await helpers.login({ userId: alice.id })).headers)
    const outsider = asUser((await helpers.login({ userId: bob.id })).headers)
    const anonymous = await asUser(new Headers())('GET')
    expect(anonymous.status).toBe(401)
    expect(anonymous.headers.get('cache-control')).toBe('private, no-store')
    expect((await asUser(new Headers())('POST', '/api/settings', {
      id: uuidv7(), settings: defaultDurations,
    })).status).toBe(401)
    expect(await (await device('GET')).json()).toEqual({ settings: defaultDurations, seq: 0 })
    const settings = { focusMinutes: 45, shortBreakMinutes: 8, longBreakMinutes: 20 }
    const changed = await device('POST', '/api/settings', { id: uuidv7(), settings })
    expect(changed.status).toBe(200)
    const saved = await changed.json()
    expect(saved.settings).toEqual(settings)
    expect(saved.seq).toBeGreaterThan(0)
    expect(await (await otherDevice('GET')).json()).toEqual(saved)
    expect(await (await outsider('GET')).json()).toEqual({ settings: defaultDurations, seq: 0 })
    expect((await device('GET', '/api/settings', undefined, bob.id)).status).toBe(403)
    expect((await device('POST', '/api/settings', { id: uuidv7(), settings }, bob.id)).status).toBe(403)
    expect(await (await otherDevice('GET')).json()).toEqual(saved)
  } finally {
    await helpers.deleteUser(alice.id)
    await helpers.deleteUser(bob.id)
  }
})

test('settings reject every duration boundary breach without changing the saved record', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `settings-limits-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  try {
    const request = asUser((await helpers.login({ userId: user.id })).headers)
    const minimum = { focusMinutes: 1, shortBreakMinutes: 1, longBreakMinutes: 1 }
    expect((await request('POST', '/api/settings', { id: uuidv7(), settings: minimum })).status).toBe(200)
    const maximum = { focusMinutes: 120, shortBreakMinutes: 30, longBreakMinutes: 60 }
    const accepted = await request('POST', '/api/settings', { id: uuidv7(), settings: maximum })
    expect(accepted.status).toBe(200)
    const saved = await accepted.json()
    for (const [key, value] of [
      ['focusMinutes', 0], ['focusMinutes', 121], ['focusMinutes', 1.5],
      ['shortBreakMinutes', 0], ['shortBreakMinutes', 31],
      ['longBreakMinutes', 0], ['longBreakMinutes', 61],
    ] as const) {
      expect((await request('POST', '/api/settings', {
        id: uuidv7(), settings: { ...maximum, [key]: value },
      })).status).toBe(400)
    }
    expect((await request('POST', '/api/settings', { id: uuidv7(), settings: {
      ...maximum, focusMinutes: '25',
    } })).status).toBe(400)
    expect((await request('POST', '/api/settings', { id: uuidv7(), settings: {
      ...maximum, unknown: 1,
    } })).status).toBe(400)
    expect(await (await request('GET')).json()).toEqual(saved)
  } finally {
    await helpers.deleteUser(user.id)
  }
})

test('replayed settings change cannot overwrite a later accepted change', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `settings-replay-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  try {
    const request = asUser((await helpers.login({ userId: user.id })).headers)
    const first = { id: uuidv7(), settings: { focusMinutes: 40, shortBreakMinutes: 5, longBreakMinutes: 15 } }
    const second = { id: uuidv7(), settings: { focusMinutes: 55, shortBreakMinutes: 9, longBreakMinutes: 18 } }
    const before = await (await request('POST', '/api/settings', first)).json()
    const after = await (await request('POST', '/api/settings', second)).json()
    expect(after.seq).toBeGreaterThan(before.seq)
    expect(await (await request('POST', '/api/settings', first)).json()).toEqual(after)
    expect((await request('POST', '/api/settings', { ...first, settings: second.settings })).status).toBe(409)
    expect(await (await request('GET')).json()).toEqual(after)
  } finally {
    await helpers.deleteUser(user.id)
  }
})

test('Session Start snapshots all durations while subsequent Starts use updated settings', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `settings-session-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  try {
    const first = asUser((await helpers.login({ userId: user.id })).headers)
    const second = asUser((await helpers.login({ userId: user.id })).headers)
    const taskId = uuidv7()
    const day = new Date().toISOString().slice(0, 10)
    const created = await first('POST', '/api/sync/push', { changes: [{
      id: uuidv7(), task: { id: taskId, day, title: 'Snapshot work', completed: false,
        orderKey: '00000000000000010000000000000000', createdAt: new Date().toISOString() },
    }] })
    expect((await created.json()).results[0].status).toBe('accepted')
    const initial = { focusMinutes: 40, shortBreakMinutes: 7, longBreakMinutes: 18 }
    expect((await first('POST', '/api/settings', { id: uuidv7(), settings: initial })).status).toBe(200)
    expect((await first('POST', '/api/session/start', {
      id: uuidv7(), taskId, day, plannedMinutes: 25,
    })).status).toBe(409)
    const id = uuidv7()
    const start = await first('POST', '/api/session/start', { id, taskId, day, plannedMinutes: 40 })
    expect(start.status).toBe(200)
    expect((await start.json()).session).toMatchObject({
      id, plannedMinutes: 40, shortBreakMinutes: 7, longBreakMinutes: 18,
    })
    const revised = { focusMinutes: 70, shortBreakMinutes: 11, longBreakMinutes: 23 }
    expect((await second('POST', '/api/settings', { id: uuidv7(), settings: revised })).status).toBe(200)
    expect((await (await second('GET', '/api/session')).json()).session).toMatchObject({
      id, plannedMinutes: 40, shortBreakMinutes: 7, longBreakMinutes: 18,
    })
    const paused = await second('POST', '/api/session/control', { id, action: 'pause' })
    expect((await paused.json()).session).toMatchObject({
      plannedMinutes: 40, shortBreakMinutes: 7, longBreakMinutes: 18,
    })
    const finish = await first('POST', '/api/session/finish', { id, outcome: 'finish' })
    expect((await finish.json()).checkin.durationMinutes).toBe(40)
    expect((await second('POST', '/api/session/start', {
      id: uuidv7(), taskId, day, plannedMinutes: 40,
    })).status).toBe(409)
    const next = await second('POST', '/api/session/start', { id: uuidv7(), taskId, day, plannedMinutes: 70 })
    expect((await next.json()).session).toMatchObject({
      plannedMinutes: 70, shortBreakMinutes: 11, longBreakMinutes: 23,
    })
  } finally {
    await helpers.deleteUser(user.id)
  }
})

test('v5 migration retains active sessions and their receipt/check-in foreign keys', () => {
  const db = new Database(':memory:')
  try {
    db.pragma('foreign_keys = ON')
    db.exec(`
      CREATE TABLE "user" (id text primary key);
      CREATE TABLE task (id text primary key, userId text not null references "user" (id));
      CREATE TABLE active_session (
        userId text not null primary key references "user" (id) on delete cascade,
        id text not null unique,
        taskId text not null references task (id) on delete cascade,
        day text not null,
        plannedMinutes integer not null check (plannedMinutes = 25),
        status text not null check (status in ('running', 'paused')),
        startedAt text not null,
        elapsedMs integer not null check (elapsedMs >= 0),
        segmentStartedAt text,
        lastControlAt text not null,
        check ((status = 'running' and segmentStartedAt is not null)
          or (status = 'paused' and segmentStartedAt is null))
      );
      CREATE TABLE session_receipt (
        sessionId text primary key,
        userId text not null references "user" (id),
        outcome text not null,
        checkinId text
      );
      CREATE TABLE session_checkin (
        id text primary key,
        userId text not null references "user" (id),
        taskId text not null references task (id),
        durationMinutes integer not null,
        origin text not null,
        sourceSessionId text references session_receipt (sessionId),
        createdAt text not null
      );
      INSERT INTO "user" (id) VALUES ('person');
      INSERT INTO task (id, userId) VALUES ('task', 'person');
      INSERT INTO active_session VALUES ('person', 'running', 'task', '2026-09-24', 25,
        'paused', '2026-09-24T10:00:00.000Z', 120000, NULL, '2026-09-24T10:02:00.000Z');
      INSERT INTO session_receipt VALUES ('finished', 'person', 'saved', 'checkin');
      INSERT INTO session_checkin VALUES ('checkin', 'person', 'task', 25, 'session',
        'finished', '2026-09-24T09:00:00.000Z');
    `)
    db.pragma('user_version = 5')
    migrateSettingsSchema(db)
    expect(db.pragma('user_version', { simple: true })).toBe(6)
    expect(db.pragma('foreign_key_check')).toEqual([])
    expect(db.prepare(`
      SELECT id, taskId, plannedMinutes, shortBreakMinutes, longBreakMinutes, status, elapsedMs
      FROM active_session WHERE userId = ?
    `).get('person')).toEqual({
      id: 'running', taskId: 'task', plannedMinutes: 25, shortBreakMinutes: 5,
      longBreakMinutes: 15, status: 'paused', elapsedMs: 120000,
    })
    expect(db.prepare('SELECT sourceSessionId FROM session_checkin WHERE id = ?').get('checkin'))
      .toEqual({ sourceSessionId: 'finished' })
    db.prepare('UPDATE active_session SET plannedMinutes = 120 WHERE userId = ?').run('person')
    expect(() => db.prepare('UPDATE active_session SET plannedMinutes = 121 WHERE userId = ?').run('person')).toThrow()
    db.prepare('UPDATE active_session SET shortBreakMinutes = 30, longBreakMinutes = 60 WHERE userId = ?').run('person')
    expect(() => db.prepare('UPDATE active_session SET shortBreakMinutes = 31 WHERE userId = ?').run('person')).toThrow()
    expect(() => db.prepare('UPDATE active_session SET longBreakMinutes = 61 WHERE userId = ?').run('person')).toThrow()
    expect(db.pragma('foreign_key_check')).toEqual([])
  } finally {
    db.close()
  }
})
