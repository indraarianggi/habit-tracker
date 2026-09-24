import { expect, test } from '@playwright/test'
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { v7 as uuidv7 } from 'uuid'
import type { CheckinRecord, CheckinChangeRequest, SessionRecord } from '@/lib/session-contract'
import { syncSession } from '@/lib/session-client'
import { SessionStore } from '@/lib/session-store'
import { localDay, type TaskRecord } from '@/lib/task-contract'
import { TaskStore } from '@/lib/task-store'

function task(userId: string, day = localDay()): TaskRecord {
  return { id: uuidv7(), userId, day, title: day, completed: true, orderKey: '00000000000000010000000000000000', createdAt: new Date().toISOString(), seq: 1 }
}

function server() {
  const records = new Map<string, CheckinRecord>()
  const receipts = new Map<string, CheckinRecord | null>()
  const changes: CheckinChangeRequest[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    if (path === '/api/checkin/change') {
      const change = JSON.parse(String(init?.body)) as CheckinChangeRequest
      changes.push(change)
      let record = receipts.get(change.id)
      if (receipts.has(change.id)) record = records.get(change.checkinId) ?? null
      if (!receipts.has(change.id)) {
        if (change.action === 'create') {
          record = { id: change.checkinId, userId: 'test-user', taskId: change.taskId, durationMinutes: change.durationMinutes, origin: 'manual', sourceSessionId: null, createdAt: change.createdAt }
          records.set(record.id, record)
        } else if (change.action === 'edit') {
          const previous = records.get(change.checkinId)
          if (!previous) return new Response(null, { status: 404 })
          record = { ...previous, taskId: change.taskId, durationMinutes: change.durationMinutes }
          records.set(record.id, record)
        } else {
          record = null
          records.delete(change.checkinId)
        }
        receipts.set(change.id, record ?? null)
      }
      return Response.json({ checkin: record ?? null })
    }
    if (path === '/api/session') return Response.json({ session: null, lastTaskId: null, checkins: [...records.values()] })
    throw new Error(`Unexpected request: ${path}`)
  }) as typeof fetch
  return { records, changes, fetcher }
}

test('offline Check-in edits and deletion survive reopening and stale server snapshots', async () => {
  const factory = new IDBFactory()
  const name = `checkin-offline-${uuidv7()}`
  const first = new SessionStore(name, factory, IDBKeyRange)
  const userId = 'test-user'
  const today = task(userId)
  const past = task(userId, '2020-01-01')
  const stale = server()
  let reopened: SessionStore | undefined
  try {
    const created = await first.createCheckin(userId, today, 1)
    expect(created).toMatchObject({ taskId: today.id, durationMinutes: 1, origin: 'manual', sourceSessionId: null })
    await first.editCheckin(userId, created.id, past, 480)
    await first.receive(userId, null, null, [{ ...created }])
    expect((await first.snapshot(userId)).checkins).toMatchObject([{ id: created.id, taskId: past.id, durationMinutes: 480 }])
    first.close()
    reopened = new SessionStore(name, factory, IDBKeyRange)
    await reopened.deleteCheckin(userId, created.id)
    await reopened.receive(userId, null, null, [created])
    expect((await reopened.snapshot(userId)).checkins).toEqual([])
    const offline: typeof fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch
    await expect(syncSession(reopened, userId, offline)).rejects.toThrow('offline')
    expect((await reopened.snapshot(userId)).checkins).toEqual([])
    await syncSession(reopened, userId, stale.fetcher)
    expect((await reopened.snapshot(userId)).checkins).toEqual([])
    expect(stale.changes.map(change => change.action)).toEqual(['create', 'edit', 'delete'])
    expect(new Set(stale.changes.map(change => change.id)).size).toBe(3)
  } finally {
    reopened?.close()
    first.close()
  }
})

test('lost create receipt followed by a remote deletion does not resurrect a Check-in', async () => {
  const factory = new IDBFactory()
  const store = new SessionStore(`checkin-tombstone-${uuidv7()}`, factory, IDBKeyRange)
  const userId = 'test-user'
  const remote = server()
  try {
    const selected = task(userId)
    const created = await store.createCheckin(userId, selected, 25)
    await store.editCheckin(userId, created.id, selected, 30)
    const lostResponse: typeof fetch = (async (input, init) => {
      await remote.fetcher(input, init)
      throw new TypeError('response lost')
    }) as typeof fetch
    await expect(syncSession(store, userId, lostResponse)).rejects.toThrow('response lost')
    expect((await store.snapshot(userId)).checkins).toMatchObject([{ durationMinutes: 30 }])
    remote.records.delete(created.id)
    await syncSession(store, userId, remote.fetcher)
    expect((await store.snapshot(userId)).checkins).toEqual([])
    expect((await store.pendingChanges(userId))).toEqual([])
    expect(remote.changes.map(change => change.id)).toEqual([remote.changes[0].id, remote.changes[0].id])
  } finally {
    store.close()
  }
})

test('offline reassignment across Task Days converges on a second device without changing completion', async () => {
  const factory = new IDBFactory()
  const first = new SessionStore(`checkin-a-${uuidv7()}`, factory, IDBKeyRange)
  const second = new SessionStore(`checkin-b-${uuidv7()}`, factory, IDBKeyRange)
  const tasks = new TaskStore(`checkin-task-${uuidv7()}`, factory, IDBKeyRange)
  const userId = 'test-user'
  const past = task(userId, '2020-01-01')
  const remote = server()
  try {
    const draft = await tasks.createTask(userId, 'Completed Task')
    await tasks.setTaskCompleted(userId, draft.id, true)
    const today = (await tasks.listTasks(userId, draft.day))[0]
    const created = await first.createCheckin(userId, today, 25)
    await syncSession(first, userId, remote.fetcher)
    await syncSession(second, userId, remote.fetcher)
    expect((await second.snapshot(userId)).checkins).toMatchObject([{ id: created.id, taskId: today.id }])
    await first.editCheckin(userId, created.id, past, 30)
    await first.receive(userId, null, null, [created])
    expect((await first.snapshot(userId)).checkins).toMatchObject([{ taskId: past.id, durationMinutes: 30 }])
    await syncSession(first, userId, remote.fetcher)
    await syncSession(second, userId, remote.fetcher)
    expect((await second.snapshot(userId)).checkins).toMatchObject([{ taskId: past.id, durationMinutes: 30 }])
    expect((await tasks.listTasks(userId, today.day))[0].completed).toBe(true)
    await first.deleteCheckin(userId, created.id)
    await syncSession(first, userId, remote.fetcher)
    await syncSession(second, userId, remote.fetcher)
    expect((await second.snapshot(userId)).checkins).toEqual([])
  } finally {
    first.close()
    second.close()
    tasks.close()
  }
})

test('remote deletion wins over an offline edit instead of blocking later sync', async () => {
  const factory = new IDBFactory()
  const first = new SessionStore(`checkin-delete-a-${uuidv7()}`, factory, IDBKeyRange)
  const second = new SessionStore(`checkin-delete-b-${uuidv7()}`, factory, IDBKeyRange)
  const userId = 'test-user'
  const selected = task(userId)
  const remote = server()
  try {
    const created = await first.createCheckin(userId, selected, 25)
    await syncSession(first, userId, remote.fetcher)
    await syncSession(second, userId, remote.fetcher)
    await first.editCheckin(userId, created.id, selected, 30)
    await second.deleteCheckin(userId, created.id)
    await syncSession(second, userId, remote.fetcher)
    await syncSession(first, userId, remote.fetcher)
    expect((await first.snapshot(userId)).checkins).toEqual([])
    expect((await first.pendingChanges(userId))).toEqual([])
  } finally {
    first.close()
    second.close()
  }
})

test('invalid duration, future Task and another User’s records cannot be changed locally', async () => {
  const factory = new IDBFactory()
  const store = new SessionStore(`checkin-invalid-${uuidv7()}`, factory, IDBKeyRange)
  const userId = 'test-user'
  const own = task(userId)
  const future = task(userId, '9999-12-31')
  try {
    for (const minutes of [0, 481, 1.5, NaN]) {
      await expect(store.createCheckin(userId, own, minutes)).rejects.toThrow()
    }
    await expect(store.createCheckin(userId, future, 25)).rejects.toThrow()
    await expect(store.createCheckin(userId, task('another-user'), 25)).rejects.toThrow()
    const created = await store.createCheckin(userId, own, 480)
    await expect(store.editCheckin(userId, created.id, future, 25)).rejects.toThrow()
    await expect(store.editCheckin(userId, created.id, own, 0)).rejects.toThrow()
    await expect(store.editCheckin('another-user', created.id, task('another-user'), 25)).rejects.toThrow()
    await expect(store.deleteCheckin('another-user', created.id)).rejects.toThrow()
    expect((await store.snapshot(userId)).checkins).toMatchObject([{ id: created.id, durationMinutes: 480 }])
  } finally {
    store.close()
  }
})

test('Session receipt remaps queued edits and deletions without resurrecting provisional records', async () => {
  const factory = new IDBFactory()
  const store = new SessionStore(`checkin-session-${uuidv7()}`, factory, IDBKeyRange)
  const userId = 'test-user'
  const today = task(userId)
  const past = task(userId, '2020-01-01')
  const session: SessionRecord = { id: uuidv7(), userId, taskId: today.id, day: today.day, plannedMinutes: 25, status: 'running', startedAt: new Date().toISOString(), elapsedMs: 0, segmentStartedAt: new Date().toISOString() }
  try {
    await store.started(userId, session)
    await store.finish(userId, 'finish')
    const provisional = (await store.snapshot(userId)).checkins[0]
    await store.editCheckin(userId, provisional.id, past, 12)
    const committed = { ...provisional, id: uuidv7(), durationMinutes: 25 }
    await store.applyReceipt(userId, session.id, committed)
    expect((await store.snapshot(userId)).checkins).toMatchObject([{ id: committed.id, taskId: past.id, durationMinutes: 12 }])
    await store.deleteCheckin(userId, committed.id)
    await store.receive(userId, null, null, [committed])
    expect((await store.snapshot(userId)).checkins).toEqual([])
    expect((await store.snapshot(userId)).session).toBeNull()
    expect((await store.pendingChanges(userId)).filter(change => 'change' in change).map(change => change.change.checkinId)).toEqual([committed.id, committed.id])
  } finally {
    store.close()
  }
})

test('deleting a provisional Session Check-in before its receipt never recreates it', async () => {
  const factory = new IDBFactory()
  const store = new SessionStore(`checkin-session-delete-${uuidv7()}`, factory, IDBKeyRange)
  const userId = 'test-user'
  const selected = task(userId)
  const session: SessionRecord = {
    id: uuidv7(), userId, taskId: selected.id, day: selected.day, plannedMinutes: 25,
    status: 'running', startedAt: new Date().toISOString(), elapsedMs: 0, segmentStartedAt: new Date().toISOString(),
  }
  try {
    await store.started(userId, session)
    await store.finish(userId, 'finish')
    const provisional = (await store.snapshot(userId)).checkins[0]
    await store.deleteCheckin(userId, provisional.id)
    expect((await store.snapshot(userId)).break?.phase).toBe('choice')
    const committed = { ...provisional, id: uuidv7() }
    await store.receive(userId, null, null, [committed])
    expect((await store.snapshot(userId)).checkins).toEqual([])
    await store.applyReceipt(userId, session.id, committed)
    expect((await store.snapshot(userId)).checkins).toEqual([])
    await store.receive(userId, null, null, [committed])
    expect((await store.snapshot(userId)).checkins).toEqual([])
    expect((await store.snapshot(userId)).break?.phase).toBe('choice')
    expect((await store.pendingChanges(userId)).filter(change => 'change' in change).map(change => change.change.checkinId)).toEqual([committed.id])
  } finally {
    store.close()
  }
})

test('deleting a provisional Check-in from the earlier Dexie store remaps its Session receipt', async () => {
  const factory = new IDBFactory()
  const name = `checkin-old-focus-${uuidv7()}`
  const userId = 'test-user'
  const selected = task(userId)
  const sessionId = uuidv7()
  const provisional: CheckinRecord = {
    id: uuidv7(), userId, taskId: selected.id, durationMinutes: 25, origin: 'session',
    sourceSessionId: sessionId, createdAt: new Date().toISOString(),
  }
  const legacy = new Dexie(name, { indexedDB: factory, IDBKeyRange })
  legacy.version(1).stores({ state: 'userId', checkins: '[userId+id], [userId+sourceSessionId]', pending: '++id, userId' })
  await legacy.table('checkins').put(provisional)
  await legacy.table('pending').add({ userId, sessionId, outcome: 'finish' })
  legacy.close()
  const store = new SessionStore(name, factory, IDBKeyRange)
  try {
    await store.deleteCheckin(userId, provisional.id)
    const committed = { ...provisional, id: uuidv7() }
    await store.applyReceipt(userId, sessionId, committed)
    expect((await store.snapshot(userId)).checkins).toEqual([])
    expect((await store.pendingChanges(userId)).filter(change => 'change' in change).map(change => change.change.checkinId)).toEqual([committed.id])
  } finally {
    store.close()
  }
})
