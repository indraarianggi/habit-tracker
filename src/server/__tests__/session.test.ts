import { expect, test } from '@playwright/test'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { v7 as uuidv7 } from 'uuid'
import { chooseTimerTask } from '@/lib/session-contract'
import type { TaskRecord } from '@/lib/task-contract'
import { authOptions } from '@/server/auth'
import { database } from '@/server/db'
const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] })
const origin = 'http://127.0.0.1:3000'
const day = '2026-09-24'

type UserRequest = (path: string, body?: object) => Promise<Response>

function asUser(headers: Headers): UserRequest {
  return (path: string, body?: object) => fetch(new URL(path, origin), {
    method: body ? 'POST' : 'GET',
    headers: new Headers([...headers, ...new Headers(body ? { 'Content-Type': 'application/json' } : {})]),
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function pushTask(request: UserRequest, completed = false, taskDay = day) {
  const id = uuidv7()
  const response = await request('/api/sync/push', { changes: [{ id: uuidv7(), task: {
    id, day: taskDay, title: 'Focus Task', completed,
    orderKey: '00000000000000010000000000000000', createdAt: new Date().toISOString(),
  } }] })
  expect(response.status).toBe(200)
  expect((await response.json()).results[0].status).toBe('accepted')
  return id
}

test('one active slot across devices, completed Task allowed, pause excludes paused time, finish is exactly once', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `session-${crypto.randomUUID()}@invalid.test` })
  const other = helpers.createUser({ email: `session-other-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  await helpers.saveUser(other)
  try {
    const first = asUser((await helpers.login({ userId: user.id })).headers)
    const second = asUser((await helpers.login({ userId: user.id })).headers)
    const outsider = asUser((await helpers.login({ userId: other.id })).headers)
    const completedId = await pushTask(first, true)
    const otherTaskId = await pushTask(outsider)
    const firstId = uuidv7()
    const contenderId = uuidv7()
    const starts = await Promise.all([
      first('/api/session/start', { id: firstId, taskId: completedId, day, plannedMinutes: 25 }),
      second('/api/session/start', { id: contenderId, taskId: completedId, day, plannedMinutes: 25 }),
    ])
    expect(starts.map(response => response.status).sort()).toEqual([200, 409])
    const winner = starts[0].status === 200 ? firstId : contenderId
    const snapshot = await second('/api/session')
    expect(snapshot.headers.get('cache-control')).toBe('private, no-store')
    expect((await snapshot.json()).session).toMatchObject({ id: winner, taskId: completedId, day, plannedMinutes: 25, status: 'running' })
    expect((await (await outsider('/api/session')).json()).session).toBeNull()
    expect((await outsider('/api/session/control', { id: winner, action: 'pause' })).status).toBe(404)
    expect((await outsider('/api/session/finish', { id: winner, outcome: 'discard' })).status).toBe(404)
    expect((await outsider('/api/session/start', { id: uuidv7(), taskId: completedId, day, plannedMinutes: 25 })).status).toBe(404)
    expect((await first('/api/session/start', { id: uuidv7(), taskId: otherTaskId, day, plannedMinutes: 25 })).status).toBe(409)

    const paused = await first('/api/session/control', { id: winner, action: 'pause' })
    expect(paused.status).toBe(200)
    const pausedSession = (await paused.json()).session
    expect(pausedSession).toMatchObject({ id: winner, status: 'paused', segmentStartedAt: null })
    const stillPaused = (await (await second('/api/session')).json()).session
    expect(stillPaused.elapsedMs).toBe(pausedSession.elapsedMs)
    expect(stillPaused.segmentStartedAt).toBeNull()
    const resumed = await second('/api/session/control', { id: winner, action: 'resume' })
    expect((await resumed.json()).session).toMatchObject({ status: 'running', elapsedMs: pausedSession.elapsedMs })
    // Shift the persisted anchor instead of sleeping: the server still reads its real clock.
    database.prepare('UPDATE active_session SET segmentStartedAt = ? WHERE id = ?').run(
      new Date(Date.now() - 2_000).toISOString(), winner,
    )
    const pausedAgain = await first('/api/session/control', { id: winner, action: 'pause' })
    const accrued = (await pausedAgain.json()).session.elapsedMs - pausedSession.elapsedMs
    expect(accrued).toBeGreaterThanOrEqual(2_000)
    expect(accrued).toBeLessThan(3_000)
    const finishResponse = await first('/api/session/finish', { id: winner, outcome: 'finish' })
    expect(finishResponse.status).toBe(200)
    const receipt = await finishResponse.json()
    expect(receipt).toMatchObject({ outcome: 'saved', sessionId: winner, checkin: {
      taskId: completedId, durationMinutes: 25, origin: 'session', sourceSessionId: winner,
    } })
    expect(receipt.checkin).not.toHaveProperty('day')
    expect((await (await second('/api/session/finish', { id: winner, outcome: 'discard' })).json())).toEqual(receipt)
    expect((await (await first('/api/session')).json())).toMatchObject({
      session: null, lastTaskId: completedId, checkins: [receipt.checkin],
    })
    expect((await (await outsider('/api/session')).json()).checkins).toEqual([])
    const pull = await first('/api/sync/pull?after=0')
    const task = (await pull.json()).changes.find((change: { task: TaskRecord }) => change.task.id === completedId).task
    expect(task.completed).toBe(true)
  } finally {
    await helpers.deleteUser(user.id)
    await helpers.deleteUser(other.id)
  }
})

test('early save and discard preserve first receipt, last Task, validation, and Task completion', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `session-early-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  try {
    const request = asUser((await helpers.login({ userId: user.id })).headers)
    const taskId = await pushTask(request)
    const priorDayId = await pushTask(request, false, '2026-09-23')
    const foreignId = uuidv7()
    expect((await request('/api/session/start', { id: uuidv7(), taskId: priorDayId, day, plannedMinutes: 25 })).status).toBe(400)
    expect((await request('/api/session/start', { id: uuidv7(), taskId: foreignId, day, plannedMinutes: 25 })).status).toBe(404)
    expect((await request('/api/session/start', { id: uuidv7(), taskId, day, plannedMinutes: 30 })).status).toBe(400)
    const id = uuidv7()
    expect((await request('/api/session/start', { id, taskId, day, plannedMinutes: 25 })).status).toBe(200)
    expect((await request('/api/session/finish', { id, outcome: 'save', durationMinutes: 0 })).status).toBe(400)
    expect((await request('/api/session/finish', { id, outcome: 'save', durationMinutes: 26 })).status).toBe(400)
    const saved = await request('/api/session/finish', { id, outcome: 'save', durationMinutes: 3 })
    expect(saved.status).toBe(200)
    const receipt = await saved.json()
    expect(receipt.checkin).toMatchObject({ durationMinutes: 3, taskId, sourceSessionId: id })
    expect((await (await request('/api/session/finish', { id, outcome: 'save', durationMinutes: 18 })).json())).toEqual(receipt)
    const discardedId = uuidv7()
    expect((await request('/api/session/start', { id: discardedId, taskId: priorDayId, day: '2026-09-23', plannedMinutes: 25 })).status).toBe(200)
    const discarded = await request('/api/session/finish', { id: discardedId, outcome: 'discard' })
    expect(await discarded.json()).toEqual({ outcome: 'discarded', checkin: null, sessionId: discardedId })
    expect((await (await request('/api/session/finish', { id: discardedId, outcome: 'finish' })).json())).toEqual({ outcome: 'discarded', checkin: null, sessionId: discardedId })
    const state = await (await request('/api/session')).json()
    expect(state).toMatchObject({ session: null, lastTaskId: priorDayId, checkins: [receipt.checkin] })
    const pull = await (await request('/api/sync/pull?after=0')).json()
    expect(pull.changes.find((change: { task: TaskRecord }) => change.task.id === taskId).task.completed).toBe(false)
  } finally {
    await helpers.deleteUser(user.id)
  }
})

test('offline controls replay elapsed segments by event time and reject stale controls', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `session-replay-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  try {
    const request = asUser((await helpers.login({ userId: user.id })).headers)
    const taskId = await pushTask(request)
    const id = uuidv7()
    expect((await request('/api/session/start', { id, taskId, day, plannedMinutes: 25 })).status).toBe(200)
    const base = Date.now()
    const startedAt = new Date(base - 10_000).toISOString()
    database.prepare(`
      UPDATE active_session SET startedAt = ?, segmentStartedAt = ?, lastControlAt = ? WHERE id = ?
    `).run(startedAt, startedAt, startedAt, id)
    const pauseAt = new Date(base - 4_000).toISOString()
    const paused = await request('/api/session/control', { id, action: 'pause', at: pauseAt })
    expect(paused.status).toBe(200)
    expect((await paused.json()).session.elapsedMs).toBe(6_000)
    const resumeAt = new Date(base - 2_000).toISOString()
    const resumed = await request('/api/session/control', { id, action: 'resume', at: resumeAt })
    expect((await resumed.json()).session.segmentStartedAt).toBe(resumeAt)
    expect((await request('/api/session/control', {
      id, action: 'pause', at: new Date(base - 3_000).toISOString(),
    })).status).toBe(409)
    const live = await request('/api/session/control', { id, action: 'pause' })
    const elapsed = (await live.json()).session.elapsedMs
    expect(elapsed).toBeGreaterThanOrEqual(8_000)
    expect(elapsed).toBeLessThan(12_000)
    expect((await request('/api/session/finish', { id, outcome: 'discard' })).status).toBe(200)
  } finally {
    await helpers.deleteUser(user.id)
  }
})

test('simultaneous terminal requests share the first committed receipt', async () => {
  const helpers = (await testAuth.$context).test
  const user = helpers.createUser({ email: `session-finalize-${crypto.randomUUID()}@invalid.test` })
  await helpers.saveUser(user)
  try {
    const first = asUser((await helpers.login({ userId: user.id })).headers)
    const second = asUser((await helpers.login({ userId: user.id })).headers)
    const taskId = await pushTask(first)
    const id = uuidv7()
    expect((await first('/api/session/start', { id, taskId, day, plannedMinutes: 25 })).status).toBe(200)
    const [save, discard] = await Promise.all([
      first('/api/session/finish', { id, outcome: 'save', durationMinutes: 4 }),
      second('/api/session/finish', { id, outcome: 'discard' }),
    ])
    expect([save.status, discard.status]).toEqual([200, 200])
    const receipt = await save.json()
    expect(await discard.json()).toEqual(receipt)
    const snapshot = await (await second('/api/session')).json()
    expect(snapshot.session).toBeNull()
    expect(snapshot.checkins).toEqual(receipt.checkin ? [receipt.checkin] : [])
    expect((await (await first('/api/session/finish', { id, outcome: 'finish' })).json())).toEqual(receipt)
  } finally {
    await helpers.deleteUser(user.id)
  }
})

test('preference selects last used Task before first incomplete and falls back to first completed', () => {
  const tasks = [
    { id: 'completed', completed: true },
    { id: 'incomplete', completed: false },
  ] as TaskRecord[]
  expect(chooseTimerTask(tasks, 'completed')).toBe(tasks[0])
  expect(chooseTimerTask(tasks, 'absent')).toBe(tasks[1])
  expect(chooseTimerTask([tasks[0]], null)).toBe(tasks[0])
  expect(chooseTimerTask([], null)).toBeNull()
})

test('all Session endpoints reject anonymous access without caching responses', async () => {
  for (const [path, body] of [
    ['/api/session', undefined],
    ['/api/session/start', { id: uuidv7(), taskId: uuidv7(), day, plannedMinutes: 25 }],
    ['/api/session/control', { id: uuidv7(), action: 'pause' }],
    ['/api/session/finish', { id: uuidv7(), outcome: 'finish' }],
  ] as const) {
    const response = await asUser(new Headers())(path, body)
    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  }
})
