import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { v7 as uuidv7 } from 'uuid'
import { localDay } from '@/lib/task-contract'
import { TaskStore } from '@/lib/task-store'
import { syncTasks } from '@/lib/task-sync'
import { SessionStore } from '@/lib/session-store'
import { startSession, syncSession } from '@/lib/session-client'
import { authOptions } from '@/server/auth'
import { database } from '@/server/db'

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })
const origin = 'http://127.0.0.1:3000'
const today = localDay()
type UserRequest = (path: string, body?: object) => Promise<Response>

function asUser(headers: Headers): UserRequest {
  return (path, body) => fetch(new URL(path, origin), {
    method: body ? 'POST' : 'GET',
    headers: new Headers([...headers, ...new Headers(body ? { 'Content-Type': 'application/json' } : {})]),
    body: body ? JSON.stringify(body) : undefined,
  })
}

function authenticatedFetch(headers: Headers): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const requestHeaders = new Headers(init?.headers)
    for (const [key, value] of headers) requestHeaders.set(key, value)
    return fetch(new URL(String(input), origin), { ...init, headers: requestHeaders })
  }) as typeof fetch
}

async function addTask(request: UserRequest, title: string) {
  const task = { id: uuidv7(), day: today, title, completed: false,
    orderKey: '00000000000000010000000000000000', createdAt: new Date().toISOString() }
  const change = { id: uuidv7(), task }
  const response = await request('/api/sync/push', { changes: [change] })
  expect(response.status).toBe(200)
  expect((await response.json()).results).toEqual([expect.objectContaining({ id: change.id, status: 'accepted' })])
  return change
}

async function pushDeletion(request: UserRequest, taskId: string, id = uuidv7()) {
  const response = await request('/api/sync/push', { changes: [{ id, deleteTaskId: taskId }] })
  expect(response.status).toBe(200)
  return (await response.json()).results[0] as { id: string; status: string; seq?: number; reason?: string }
}

async function userFixture() {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `delete-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const first = await helpers.login({ userId: user.id })
  const second = await helpers.login({ userId: user.id })
  return { helpers, user, first: asUser(first.headers), second: asUser(second.headers),
    firstFetch: authenticatedFetch(first.headers), secondFetch: authenticatedFetch(second.headers) }
}

test('two stores honor the offline owner’s active Session, then receive a cascading deletion after save', async () => {
  const { helpers, user, first, second, firstFetch, secondFetch } = await userFixture()
  const factory = new IDBFactory()
  const owner = new TaskStore(`delete-owner-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const peer = new TaskStore(`delete-peer-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const ownerFocus = new SessionStore(`delete-owner-focus-${crypto.randomUUID()}`, factory, IDBKeyRange)
  const peerFocus = new SessionStore(`delete-peer-focus-${crypto.randomUUID()}`, factory, IDBKeyRange)
  try {
    const task = await owner.createTask(user.id, 'Focus', today)
    const originalChange = (await owner.pendingChanges(user.id))[0]
    await syncTasks(owner, user.id, firstFetch)
    await syncTasks(peer, user.id, secondFetch)
    expect((await peer.listTasks(user.id, today)).map(item => item.id)).toEqual([task.id])
    const manualId = uuidv7()
    const manual = await first('/api/checkin/change', { id: uuidv7(), action: 'create',
      checkinId: manualId, taskId: task.id, durationMinutes: 11, createdAt: new Date().toISOString(), today })
    await syncSession(ownerFocus, user.id, firstFetch)
    await syncSession(peerFocus, user.id, secondFetch)
    expect((await ownerFocus.snapshot(user.id)).checkins).toHaveLength(1)
    expect((await peerFocus.snapshot(user.id)).checkins).toHaveLength(1)
    expect(manual.status).toBe(200)
    const sessionId = uuidv7()
    expect((await first('/api/session/start', { id: sessionId, taskId: task.id, day: today, plannedMinutes: 25 })).status).toBe(200)
    // The originating device makes no more sync requests until after the peer attempts deletion.
    const paused = await second('/api/session/control', { id: sessionId, action: 'pause' })
    expect(paused.status).toBe(200)
    const before = await (await second('/api/sync/pull?after=0')).json()
    const blocked = await pushDeletion(second, task.id)
    expect(blocked).toMatchObject({ status: 'rejected', reason: 'Stop or finish the session first' })
    expect((await (await second('/api/sync/pull?after=0')).json())).toEqual(before)
    expect((await (await first('/api/session')).json()).session).toMatchObject({ id: sessionId, taskId: task.id })
    expect((await (await second('/api/session')).json()).checkins).toEqual([
      expect.objectContaining({ id: manualId, taskId: task.id, durationMinutes: 11 }),
    ])
    expect(database.prepare('SELECT id FROM task WHERE id = ?').get(task.id)).toEqual({ id: task.id })

    const saved = await second('/api/session/finish', { id: sessionId, outcome: 'save', durationMinutes: 7 })
    expect(saved.status).toBe(200)
    const savedCheckin = (await saved.json()).checkin
    expect(savedCheckin).toMatchObject({ taskId: task.id, durationMinutes: 7 })
    expect((await (await first('/api/session')).json()).checkins.map((checkin: { durationMinutes: number }) =>
      checkin.durationMinutes)).toEqual([11, 7])
    const deletionId = uuidv7()
    const deleted = await pushDeletion(second, task.id, deletionId)
    expect(deleted).toMatchObject({ id: deletionId, status: 'accepted', seq: expect.any(Number) })
    expect(await pushDeletion(second, task.id, deletionId)).toEqual(deleted)
    const page = await (await second(`/api/sync/pull?after=${before.nextSeq}`)).json()
    expect(page.changes).toEqual([{ seq: deleted.seq, deletedTaskId: task.id }])
    await syncTasks(owner, user.id, firstFetch, () => syncSession(ownerFocus, user.id, firstFetch))
    await syncTasks(peer, user.id, secondFetch, () => syncSession(peerFocus, user.id, secondFetch))
    expect(await owner.listTasks(user.id, today)).toEqual([])
    expect((await ownerFocus.snapshot(user.id)).checkins).toEqual([])
    expect((await peerFocus.snapshot(user.id)).checkins).toEqual([])
    expect(await peer.listTasks(user.id, today)).toEqual([])
    expect((await (await first('/api/session')).json())).toMatchObject({ session: null, lastTaskId: null, checkins: [] })
    expect((await (await second('/api/session')).json()).checkins).toEqual([])
    expect(database.prepare('SELECT id FROM session_checkin WHERE taskId = ?').all(task.id)).toEqual([])
    expect(database.prepare('SELECT checkinId FROM checkin_deletion WHERE checkinId IN (?, ?) ORDER BY checkinId')
      .all(savedCheckin.id, manualId)).toEqual([savedCheckin.id, manualId].sort().map(checkinId => ({ checkinId })))
    expect(database.pragma('foreign_key_check')).toEqual([])
    const stale = await second('/api/sync/push', { changes: [{ id: uuidv7(), task: {
      id: task.id, day: task.day, title: 'Resurrected', completed: task.completed,
      orderKey: task.orderKey, createdAt: task.createdAt,
    } }] })
    expect((await stale.json()).results[0].status).toBe('rejected')
    const replay = await second('/api/sync/push', { changes: [originalChange] })
    expect((await replay.json()).results[0].status).toBe('accepted')
    expect(database.prepare('SELECT id FROM task WHERE id = ?').get(task.id)).toBeUndefined()
    expect((await first('/api/checkin/change', { id: uuidv7(), action: 'create',
      checkinId: savedCheckin.id, taskId: task.id, durationMinutes: 2, createdAt: new Date().toISOString(), today })).status).toBe(409)
  } finally {
    owner.close()
    peer.close()
    ownerFocus.close()
    peerFocus.close()
    await helpers.deleteUser(user.id)
  }
})

test('discard releases the guard; another Task’s active focus and following Break do not protect deleted Task', async () => {
  const { helpers, user, first, second } = await userFixture()
  const localBreak = new SessionStore(`delete-break-${crypto.randomUUID()}`, new IDBFactory(), IDBKeyRange)
  try {
    const task = await addTask(first, 'To discard')
    const other = await addTask(first, 'Other focus')
    const sessionId = uuidv7()
    expect((await first('/api/session/start', { id: sessionId, taskId: task.task.id, day: today, plannedMinutes: 25 })).status).toBe(200)
    expect((await pushDeletion(second, task.task.id)).reason).toBe('Stop or finish the session first')
    expect((await first('/api/session/finish', { id: sessionId, outcome: 'discard' })).status).toBe(200)
    const following = uuidv7()
    expect((await first('/api/session/start', { id: following, taskId: other.task.id, day: today, plannedMinutes: 25 })).status).toBe(200)
    expect((await pushDeletion(second, task.task.id)).status).toBe('accepted')
    expect((await (await second('/api/session')).json()).session).toMatchObject({ id: following, taskId: other.task.id })
    expect((await first('/api/session/finish', { id: following, outcome: 'discard' })).status).toBe(200)
    const breakTask = await addTask(first, 'Break follows focus')
    const breakId = uuidv7()
    const started = await first('/api/session/start', { id: breakId, taskId: breakTask.task.id, day: today, plannedMinutes: 25 })
    expect(started.status).toBe(200)
    await localBreak.started(user.id, (await started.json()).session, breakTask.task.title)
    await localBreak.finish(user.id, 'finish')
    await localBreak.startBreak(user.id, 'short')
    expect((await localBreak.snapshot(user.id)).break?.phase).toBe('running')
    expect((await pushDeletion(second, breakTask.task.id)).reason).toBe('Stop or finish the session first')
    expect((await first('/api/session/finish', { id: breakId, outcome: 'finish' })).status).toBe(200)
    expect((await localBreak.snapshot(user.id)).break?.phase).toBe('running')
    expect((await pushDeletion(second, breakTask.task.id)).status).toBe('accepted')
  } finally {
    localBreak.close()
    await helpers.deleteUser(user.id)
  }
})
test('offline finish is delivered before a queued deletion, then a Break does not retain focus', async () => {
  const { helpers, user, firstFetch } = await userFixture()
  const factory = new IDBFactory()
  const tasks = new TaskStore(`delete-queued-tasks-${uuidv7()}`, factory, IDBKeyRange)
  const focus = new SessionStore(`delete-queued-focus-${uuidv7()}`, factory, IDBKeyRange)
  try {
    const task = await tasks.createTask(user.id, 'Queued after finish', today)
    await syncTasks(tasks, user.id, firstFetch)
    const active = await startSession(task.id, task.day, firstFetch)
    await focus.started(user.id, active, task.title)
    await focus.finish(user.id, 'finish')
    await focus.startBreak(user.id, 'short')
    await focus.removeTaskCheckins(user.id, task.id)
    await tasks.deleteTask(user.id, task.id)
    await syncTasks(tasks, user.id, firstFetch, () => syncSession(focus, user.id, firstFetch))
    expect((await focus.snapshot(user.id)).checkins).toEqual([])
    expect((await focus.snapshot(user.id)).break?.phase).toBe('running')
    expect(await tasks.listTasks(user.id, task.day)).toEqual([])
    expect(database.prepare('SELECT id FROM active_session WHERE userId = ?').get(user.id)).toBeUndefined()
    expect(database.prepare('SELECT id FROM session_checkin WHERE taskId = ?').all(task.id)).toEqual([])
  } finally {
    tasks.close()
    focus.close()
    await helpers.deleteUser(user.id)
  }
})


test('deletion receipts and tombstones remain private, and unauthenticated changes cannot delete', async () => {
  const { helpers, user, first } = await userFixture()
  const outsider = helpers.createUser({ email: `delete-outsider-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(outsider)
  try {
    const other = asUser((await helpers.login({ userId: outsider.id })).headers)
    const owned = await addTask(first, 'Private')
    const otherTask = await addTask(other, 'Other user')
    const changeId = uuidv7()
    const unauthorized = await asUser(new Headers())('/api/sync/push', { changes: [{ id: changeId, deleteTaskId: owned.task.id }] })
    expect(unauthorized.status).toBe(401)
    expect((await asUser(new Headers())('/api/sync/pull?after=0')).status).toBe(401)
    expect((await pushDeletion(other, owned.task.id, changeId)).status).toBe('rejected')
    expect((await pushDeletion(first, otherTask.task.id)).status).toBe('rejected')
    const deleted = await pushDeletion(first, owned.task.id, changeId)
    expect(deleted.status).toBe('accepted')
    expect((await pushDeletion(other, owned.task.id, changeId)).status).toBe('rejected')
    expect((await (await other('/api/sync/pull?after=0')).json()).changes).toEqual([
      expect.objectContaining({ task: expect.objectContaining({ id: otherTask.task.id }) }),
    ])
    expect((await (await first('/api/sync/pull?after=0')).json()).changes.at(-1))
      .toEqual({ seq: deleted.seq, deletedTaskId: owned.task.id })
    expect(database.pragma('user_version', { simple: true })).toBe(5)
  } finally {
    await helpers.deleteUser(user.id)
    await helpers.deleteUser(outsider.id)
  }
})
