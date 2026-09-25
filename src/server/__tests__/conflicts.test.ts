import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { v7 as uuidv7 } from 'uuid'
import { localDay, pullResponseSchema, pushResponseSchema, type TaskChange } from '@/lib/task-contract'
import { TaskStore } from '@/lib/task-store'
import { syncTasks } from '@/lib/task-sync'
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

function authenticatedFetch(headers: Headers): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const requestHeaders = new Headers(init?.headers)
    for (const [key, value] of headers) requestHeaders.set(key, value)
    return fetch(new URL(String(input), origin), { ...init, headers: requestHeaders })
  }) as typeof fetch
}

async function push(request: UserRequest, changes: TaskChange[]) {
  const response = await request('/api/sync/push', { changes })
  expect(response.status).toBe(200)
  return pushResponseSchema.parse(await response.json()).results
}

async function pull(request: UserRequest) {
  const response = await request('/api/sync/pull?after=0')
  expect(response.status).toBe(200)
  return pullResponseSchema.parse(await response.json()).changes
}

async function userFixture() {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `conflict-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  const alice = await helpers.login({ userId: user.id })
  const bob = await helpers.login({ userId: user.id })
  const first = new TaskStore(`conflict-first-${crypto.randomUUID()}`, new IDBFactory(), IDBKeyRange)
  const second = new TaskStore(`conflict-second-${crypto.randomUUID()}`, new IDBFactory(), IDBKeyRange)
  return { helpers, user, first, second, alice: asUser(alice.headers), bob: asUser(bob.headers),
    aliceFetch: authenticatedFetch(alice.headers), bobFetch: authenticatedFetch(bob.headers) }
}

test('whole-record server order wins offline completion, title, and order conflicts; tied keys sort by identity', async () => {
  const { helpers, user, first, second, alice, bob, aliceFetch, bobFetch } = await userFixture()
  const day = localDay()
  try {
    const before = await first.createTask(user.id, 'Before', day)
    const disputed = await first.createTask(user.id, 'Disputed', day)
    const after = await first.createTask(user.id, 'After', day)
    await syncTasks(first, user.id, aliceFetch)
    await syncTasks(second, user.id, bobFetch)

    // Both devices work from the same snapshot without receiving each other's edits.
    await first.renameTask(user.id, disputed.id, 'First device')
    await first.setTaskCompleted(user.id, disputed.id, true)
    expect(await first.moveTask(user.id, disputed.id, 'up')).toBe(true)
    await second.renameTask(user.id, disputed.id, 'Second device')
    expect(await second.moveTask(user.id, disputed.id, 'down')).toBe(true)
    const firstEdits = await first.pendingChanges(user.id)
    const secondEdits = await second.pendingChanges(user.id)
    const firstResults = await push(alice, firstEdits)
    expect(firstResults.map(result => result.status)).toEqual(['accepted', 'accepted', 'accepted'])
    const firstWinner = (await pull(alice)).at(-1)
    expect(firstWinner).toMatchObject({ task: { id: disputed.id, title: 'First device', completed: true } })
    const secondResults = await push(bob, secondEdits)
    expect(secondResults.map(result => result.status)).toEqual(['accepted', 'accepted'])
    expect(secondResults[0].seq).toBeGreaterThan(firstResults.at(-1)?.seq ?? 0)
    const changes = await pull(alice)
    const winner = changes.at(-1)
    const authoritative = winner && 'task' in winner ? winner.task : null
    expect(authoritative).toMatchObject({ id: disputed.id, title: 'Second device', completed: false,
      orderKey: (await second.listTasks(user.id, day)).find(task => task.id === disputed.id)?.orderKey })
    expect(authoritative !== null && authoritative.orderKey > after.orderKey).toBe(true)
    expect(firstWinner && 'task' in firstWinner && firstWinner.task.orderKey < before.orderKey).toBe(true)
    expect(changes.map(change => change.seq)).toEqual([...changes.map(change => change.seq)].sort((a, b) => a - b))
    const movedDay = localDay(new Date(Date.now() + 3 * 86_400_000))
    const [invalidDay] = await push(bob, [{ id: uuidv7(), task: {
      id: disputed.id, day: movedDay, title: 'Cannot move Day', completed: true,
      orderKey: disputed.orderKey, createdAt: disputed.createdAt,
    } }])
    expect(invalidDay).toMatchObject({ status: 'rejected', reason: 'Task day cannot be changed.' })
    expect((await pull(alice)).at(-1)).toEqual(winner)
    expect(database.prepare('SELECT day, title, completed, orderKey FROM task WHERE id = ?').get(disputed.id))
      .toEqual({ day, title: 'Second device', completed: 0, orderKey: authoritative?.orderKey })

    await first.resolveChanges(user.id, firstResults)
    await second.resolveChanges(user.id, secondResults)
    await syncTasks(first, user.id, aliceFetch)
    await syncTasks(second, user.id, bobFetch)
    for (const device of [first, second]) {
      expect((await device.listTasks(user.id, day)).find(task => task.id === disputed.id))
        .toMatchObject({ title: 'Second device', completed: false, orderKey: authoritative?.orderKey })
    }

    // Both offline appends see the same last key; no per-Day order update is needed.
    const firstTie = await first.createTask(user.id, 'First tie', day)
    const secondTie = await second.createTask(user.id, 'Second tie', day)
    expect(firstTie.orderKey).toBe(secondTie.orderKey)
    await syncTasks(first, user.id, aliceFetch)
    await syncTasks(second, user.id, bobFetch)
    await syncTasks(first, user.id, aliceFetch)
    const tieOrder = [firstTie.id, secondTie.id].sort()
    for (const device of [first, second]) {
      expect((await device.listTasks(user.id, day)).filter(task => task.orderKey === firstTie.orderKey).map(task => task.id))
        .toEqual(tieOrder)
      expect((await device.eligibleCheckinTasks(user.id, day))
        .filter(task => task.orderKey === firstTie.orderKey).map(task => task.id)).toEqual(tieOrder)
    }
    const beforeReplay = await pull(alice)
    expect(await push(alice, firstEdits)).toEqual(firstResults)
    expect(await pull(bob)).toEqual(beforeReplay)
    expect((await first.listTasks(user.id, day)).find(task => task.id === disputed.id)?.title).toBe('Second device')
  } finally {
    first.close()
    second.close()
    await helpers.deleteUser(user.id)
  }
})

test('deletion tombstones defeat stale edits and restores while an unrelated Task and its Check-in succeed', async () => {
  const { helpers, user, first, second, alice, bob, aliceFetch, bobFetch } = await userFixture()
  const outsider = helpers.createUser({ email: `conflict-outsider-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(outsider)
  const other = asUser((await helpers.login({ userId: outsider.id })).headers)
  const day = localDay()
  try {
    const doomed = await first.createTask(user.id, 'Deleted focus', day)
    const safe = await first.createTask(user.id, 'Safe focus', day)
    await syncTasks(first, user.id, aliceFetch)
    await syncTasks(second, user.id, bobFetch)
    const doomedCheckin = { id: uuidv7(), action: 'create', checkinId: uuidv7(), taskId: doomed.id,
      durationMinutes: 25, createdAt: new Date().toISOString(), today: day }
    const safeCheckin = { ...doomedCheckin, id: uuidv7(), checkinId: uuidv7(), taskId: safe.id, durationMinutes: 18 }
    expect((await alice('/api/checkin/change', doomedCheckin)).status).toBe(200)
    expect((await alice('/api/checkin/change', safeCheckin)).status).toBe(200)

    await first.renameTask(user.id, doomed.id, 'Stale edit')
    await second.deleteTask(user.id, doomed.id)
    const deletion = (await second.pendingChanges(user.id))[0]
    const [tombstone] = await push(bob, [deletion])
    expect(tombstone).toMatchObject({ id: deletion.id, status: 'accepted', seq: expect.any(Number) })
    expect(await push(bob, [deletion])).toEqual([tombstone])
    expect(database.prepare('SELECT id FROM task WHERE id = ?').get(doomed.id)).toBeUndefined()
    expect(database.prepare('SELECT checkinId FROM checkin_deletion WHERE checkinId = ?').get(doomedCheckin.checkinId))
      .toEqual({ checkinId: doomedCheckin.checkinId })
    expect(database.prepare('SELECT id FROM session_checkin WHERE id = ?').get(doomedCheckin.checkinId)).toBeUndefined()

    // The rejected stale edit and attempted restore share a batch with an independent create.
    const independent = await first.createTask(user.id, 'Independent', day)
    const [stale, fresh] = await first.pendingChanges(user.id)
    const restore: TaskChange = { id: uuidv7(), task: { id: doomed.id, day, title: 'Restore',
      completed: false, orderKey: doomed.orderKey, createdAt: doomed.createdAt } }
    const results = await push(alice, [stale, restore, fresh])
    expect(results.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: stale.id, status: 'rejected' }, { id: restore.id, status: 'rejected' },
      { id: fresh.id, status: 'accepted' },
    ])
    expect(results[2].seq).toBeGreaterThan(tombstone.seq ?? 0)
    expect(await push(alice, [{ id: uuidv7(), task: { id: doomed.id, day, title: 'Late restore',
      completed: true, orderKey: doomed.orderKey, createdAt: doomed.createdAt } }])).toEqual([
      expect.objectContaining({ status: 'rejected' }),
    ])
    const pulled = await pull(bob)
    expect(pulled).toContainEqual({ seq: tombstone.seq, deletedTaskId: doomed.id })
    expect(pulled.at(-1)).toMatchObject({ seq: results[2].seq, task: { id: independent.id } })
    expect(pulled.some(change => 'task' in change && change.task.id === doomed.id && change.seq > tombstone.seq!)).toBe(false)

    const lost = { id: uuidv7(), action: 'create', checkinId: uuidv7(), taskId: doomed.id,
      durationMinutes: 12, createdAt: new Date().toISOString(), today: day }
    expect((await alice('/api/checkin/change', lost)).status).toBe(404)
    const move = { id: uuidv7(), action: 'edit', checkinId: safeCheckin.checkinId,
      taskId: doomed.id, durationMinutes: 33, today: day }
    expect((await alice('/api/checkin/change', move)).status).toBe(404)
    expect((await (await alice('/api/session')).json()).checkins).toEqual([
      expect.objectContaining({ id: safeCheckin.checkinId, taskId: safe.id, durationMinutes: 18 }),
    ])
    expect(database.prepare('SELECT taskId, durationMinutes FROM session_checkin WHERE id = ?').get(safeCheckin.checkinId))
      .toEqual({ taskId: safe.id, durationMinutes: 18 })
    // Task-before-Check-in is the dependency: the accepted independent create can now be referenced.
    const acceptedCheckin = { ...lost, id: uuidv7(), checkinId: uuidv7(), taskId: independent.id }
    expect((await alice('/api/checkin/change', acceptedCheckin)).status).toBe(200)
    expect((await (await bob('/api/session')).json()).checkins).toEqual([
      expect.objectContaining({ id: safeCheckin.checkinId, taskId: safe.id, durationMinutes: 18 }),
      expect.objectContaining({ id: acceptedCheckin.checkinId, taskId: independent.id, durationMinutes: 12 }),
    ])

    expect((await asUser(new Headers())('/api/sync/push', { changes: [restore] })).status).toBe(401)
    expect((await asUser(new Headers())('/api/checkin/change', lost)).status).toBe(401)
    expect((await other('/api/checkin/change', { ...lost, id: uuidv7(), checkinId: uuidv7() })).status).toBe(404)
    expect((await push(other, [restore]))[0].status).toBe('rejected')
    expect(await pull(other)).toEqual([])
    expect(database.pragma('foreign_key_check')).toEqual([])
  } finally {
    first.close()
    second.close()
    await helpers.deleteUser(user.id)
    await helpers.deleteUser(outsider.id)
  }
})
