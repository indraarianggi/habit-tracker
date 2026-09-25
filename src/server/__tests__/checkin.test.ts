import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { v7 as uuidv7 } from 'uuid'
import { localDay } from '@/lib/task-contract'
import { authOptions } from '@/server/auth'
import { database } from '@/server/db'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })
const origin = 'http://127.0.0.1:3000'
type UserRequest = (path: string, body?: object) => Promise<Response>

function asUser(headers: Headers): UserRequest {
  return (path, body) => fetch(new URL(path, origin), {
    method: body ? 'POST' : 'GET',
    headers: new Headers([...headers, ...new Headers(body ? { 'Content-Type': 'application/json' } : {})]),
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function addTask(request: UserRequest, day: string, completed = false) {
  const id = uuidv7()
  const response = await request('/api/sync/push', { changes: [{ id: uuidv7(), task: {
    id, day, title: 'Focused Task', completed,
    orderKey: '00000000000000010000000000000000', createdAt: new Date().toISOString(),
  } }] })
  expect(response.status).toBe(200)
  expect((await response.json()).results[0].status).toBe('accepted')
  return id
}

function create(taskId: string, durationMinutes: number, today = localDay()) {
  return { id: uuidv7(), action: 'create', checkinId: uuidv7(), taskId, durationMinutes,
    createdAt: new Date().toISOString(), today }
}

async function userFixture() {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `checkin-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  return { helpers, user, request: asUser((await helpers.login({ userId: user.id })).headers) }
}

test('manual Check-ins accept boundary durations and complete or past Tasks, and remain visible across devices', async () => {
  const { helpers, user, request } = await userFixture()
  try {
    const otherDevice = asUser((await helpers.login({ userId: user.id })).headers)
    const today = localDay()
    const past = localDay(new Date(Date.now() - 3 * 86_400_000))
    const completedTask = await addTask(request, today, true)
    const pastTask = await addTask(request, past)
    const one = create(completedTask, 1)
    const max = create(pastTask, 480)
    for (const change of [one, max]) {
      const response = await request('/api/checkin/change', change)
      expect(response.status).toBe(200)
      expect((await response.json()).checkin).toMatchObject({
        id: change.checkinId, taskId: change.taskId, durationMinutes: change.durationMinutes,
        origin: 'manual', sourceSessionId: null, createdAt: change.createdAt,
      })
    }
    const snapshot = await (await otherDevice('/api/session')).json()
    expect(snapshot.checkins).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: one.checkinId, taskId: completedTask }),
      expect.objectContaining({ id: max.checkinId, taskId: pastTask }),
    ]))
    expect(snapshot.checkins[0]).not.toHaveProperty('day')
    const tasks = (await (await otherDevice('/api/sync/pull?after=0')).json()).changes
    expect(tasks.find((entry: { task: { id: string } }) => entry.task.id === completedTask).task.completed).toBe(true)
    expect(database.pragma('user_version', { simple: true })).toBe(5)
    expect(database.pragma('foreign_key_check')).toEqual([])
    const insert = database.prepare(`
      INSERT INTO session_checkin
      (id, userId, taskId, durationMinutes, origin, sourceSessionId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    expect(() => insert.run(uuidv7(), user.id, uuidv7(), 1, 'manual', null, new Date().toISOString())).toThrow()
    expect(() => insert.run(uuidv7(), user.id, completedTask, 1, 'session', null, new Date().toISOString())).toThrow()
  } finally { await helpers.deleteUser(user.id) }
})

test('editing a Check-in reassigns its inherited Day; deleting it preserves Task completion and an active Session', async () => {
  const { helpers, user, request } = await userFixture()
  try {
    const past = localDay(new Date(Date.now() - 3 * 86_400_000))
    const today = localDay()
    const oldTask = await addTask(request, past, true)
    const newTask = await addTask(request, today)
    const change = create(oldTask, 17)
    expect((await request('/api/checkin/change', change)).status).toBe(200)
    const sessionId = uuidv7()
    expect((await request('/api/session/start', { id: sessionId, taskId: newTask, day: today, plannedMinutes: 25 })).status).toBe(200)
    const edit = { id: uuidv7(), action: 'edit', checkinId: change.checkinId,
      taskId: newTask, durationMinutes: 33, today }
    const updated = await request('/api/checkin/change', edit)
    expect(updated.status).toBe(200)
    expect((await updated.json()).checkin).toMatchObject({
      id: change.checkinId, taskId: newTask, durationMinutes: 33, createdAt: change.createdAt,
    })
    expect((await (await request('/api/checkin/change', change)).json()).checkin.taskId).toBe(newTask)
    for (const minutes of [0, 481, 1.25]) {
      expect((await request('/api/checkin/change', {
        ...edit, id: uuidv7(), durationMinutes: minutes,
      })).status).toBe(400)
    }
    const snapshot = await (await request('/api/session')).json()
    expect(snapshot.session.id).toBe(sessionId)
    expect(snapshot.checkins).toEqual([expect.objectContaining({ id: change.checkinId, taskId: newTask })])
    expect(snapshot.checkins[0]).not.toHaveProperty('day')
    const taskChanges = (await (await request('/api/sync/pull?after=0')).json()).changes
    expect(taskChanges.find((entry: { task: { id: string } }) => entry.task.id === snapshot.checkins[0].taskId).task.day).toBe(today)
    expect(taskChanges.find((entry: { task: { id: string } }) => entry.task.id === oldTask).task.day).toBe(past)
    const deletion = await request('/api/checkin/change', {
      id: uuidv7(), action: 'delete', checkinId: change.checkinId, today,
    })
    expect(deletion.status).toBe(200)
    expect(await deletion.json()).toEqual({ checkin: null })
    expect((await (await request('/api/session')).json())).toMatchObject({
      session: { id: sessionId }, checkins: [],
    })
    expect(taskChanges.find((entry: { task: { id: string } }) => entry.task.id === oldTask).task.completed).toBe(true)
    expect((await request('/api/session/finish', { id: sessionId, outcome: 'discard' })).status).toBe(200)
  } finally { await helpers.deleteUser(user.id) }
})

test('edited and deleted Session Check-ins retain the same Session receipt without recreating focus', async () => {
  const { helpers, user, request } = await userFixture()
  try {
    const today = localDay()
    const taskId = await addTask(request, today)
    const id = uuidv7()
    expect((await request('/api/session/start', { id, taskId, day: today, plannedMinutes: 25 })).status).toBe(200)
    const firstFinish = await request('/api/session/finish', { id, outcome: 'finish' })
    expect(firstFinish.status).toBe(200)
    const saved = await firstFinish.json()
    const edited = await request('/api/checkin/change', {
      id: uuidv7(), action: 'edit', checkinId: saved.checkin.id,
      taskId, durationMinutes: 480, today,
    })
    expect(edited.status).toBe(200)
    expect((await edited.json()).checkin).toMatchObject({
      id: saved.checkin.id, sourceSessionId: id, durationMinutes: 480,
    })
    expect((await (await request('/api/session/finish', { id, outcome: 'discard' })).json()).checkin.durationMinutes).toBe(480)
    expect((await request('/api/checkin/change', {
      id: uuidv7(), action: 'delete', checkinId: saved.checkin.id, today,
    })).status).toBe(200)
    expect(await (await request('/api/session/finish', { id, outcome: 'finish' })).json()).toEqual({
      sessionId: id, outcome: 'saved', checkin: null,
    })
    expect((await (await request('/api/session')).json()).checkins).toEqual([])
    expect(database.prepare('SELECT outcome, checkinId FROM session_receipt WHERE sessionId = ?').get(id)).toEqual({
      outcome: 'saved', checkinId: saved.checkin.id,
    })
  } finally { await helpers.deleteUser(user.id) }
})

test('changes validate input and ownership while duplicate receipts never repeat a mutation', async () => {
  const { helpers, user, request } = await userFixture()
  const outsider = helpers.createUser({ email: `checkin-outsider-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(outsider)
  try {
    const foreign = asUser((await helpers.login({ userId: outsider.id })).headers)
    const today = localDay()
    const future = localDay(new Date(Date.now() + 3 * 86_400_000))
    const taskId = await addTask(request, today)
    const foreignTask = await addTask(foreign, today)
    const futureTask = await addTask(request, future)
    for (const minutes of [0, -1, 481, 1.5, '12', null]) {
      expect((await request('/api/checkin/change', create(taskId, minutes as number))).status).toBe(400)
    }
    expect((await request('/api/checkin/change', create(futureTask, 2))).status).toBe(400)
    expect((await request('/api/checkin/change', create(foreignTask, 2))).status).toBe(404)
    expect((await request('/api/checkin/change', create(uuidv7(), 2))).status).toBe(404)
    expect((await request('/api/checkin/change', create(taskId, 2, future))).status).toBe(400)
    const malformed = await request('/api/checkin/change', { ...create(taskId, 2), createdAt: 'yesterday' })
    expect(malformed.status).toBe(400)
    expect((await asUser(new Headers())('/api/checkin/change', create(taskId, 2))).status).toBe(401)
    expect((await request('/api/checkin/change', { ...create(taskId, 2), today: '2026-02-30' })).status).toBe(400)
    expect((await request('/api/checkin/change', { ...create(taskId, 2), unexpected: true })).status).toBe(400)
    expect((await request('/api/checkin/change', { id: uuidv7(), action: 'delete', checkinId: uuidv7(), today })).status).toBe(404)

    const accepted = create(taskId, 4)
    const first = await request('/api/checkin/change', accepted)
    expect(first.status).toBe(200)
    const original = await first.json()
    expect((await foreign('/api/checkin/change', {
      id: uuidv7(), action: 'delete', checkinId: accepted.checkinId, today,
    })).status).toBe(404)
    expect((await foreign('/api/checkin/change', {
      id: uuidv7(), action: 'edit', checkinId: accepted.checkinId,
      taskId: foreignTask, durationMinutes: 5, today,
    })).status).toBe(404)
    const changed = await request('/api/checkin/change', { ...accepted, durationMinutes: 99 })
    expect((await (await request('/api/checkin/change', { ...accepted, today: future })).json()).checkin).toEqual(original.checkin)
    expect(changed.status).toBe(409)
    const deleted = { id: uuidv7(), action: 'delete', checkinId: accepted.checkinId, today }
    expect((await request('/api/checkin/change', deleted)).status).toBe(200)
    expect((await (await request('/api/checkin/change', { ...deleted, today: future })).json()).checkin).toBeNull()
    expect((await (await request('/api/checkin/change', deleted)).json()).checkin).toBeNull()
    expect((await (await request('/api/checkin/change', accepted)).json()).checkin).toBeNull()
    expect((await request('/api/checkin/change', { ...create(taskId, 4), checkinId: accepted.checkinId })).status).toBe(409)
    expect((await (await request('/api/session')).json()).checkins).toEqual([])
    for (const action of ['edit', 'delete'] as const) {
      const change = { id: uuidv7(), action, checkinId: accepted.checkinId, taskId, durationMinutes: 9, today }
      const valid = action === 'delete'
        ? { id: change.id, action, checkinId: change.checkinId, today }
        : change
      expect((await request('/api/checkin/change', valid)).status).toBe(404)
    }
    expect((await foreign('/api/session')).status).toBe(200)
    expect((await (await foreign('/api/session')).json()).checkins).toEqual([])
  } finally {
    await helpers.deleteUser(user.id)
    await helpers.deleteUser(outsider.id)
  }
})
