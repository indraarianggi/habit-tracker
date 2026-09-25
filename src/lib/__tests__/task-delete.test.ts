import { expect, test } from '@playwright/test'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { v7 as uuidv7 } from 'uuid'
import { SessionStore } from '@/lib/session-store'
import { TaskStore } from '@/lib/task-store'
import { localDay } from '@/lib/task-contract'

test('a local Task deletion queues one tombstone and removes its Check-ins without touching other Tasks', async () => {
  const factory = new IDBFactory()
  const userId = uuidv7()
  const day = localDay()
  const tasks = new TaskStore(`delete-tasks-${uuidv7()}`, factory, IDBKeyRange)
  const focus = new SessionStore(`delete-focus-${uuidv7()}`, factory, IDBKeyRange)
  try {
    const target = await tasks.createTask(userId, 'Remove', day)
    const retained = await tasks.createTask(userId, 'Keep', day)
    const first = await focus.createCheckin(userId, target, 12)
    const second = await focus.createCheckin(userId, target, 20)
    const other = await focus.createCheckin(userId, retained, 5)
    await tasks.deleteTask(userId, target.id)
    await focus.removeTaskCheckins(userId, target.id)
    expect((await tasks.listTasks(userId, day)).map(task => task.id)).toEqual([retained.id])
    expect((await focus.snapshot(userId)).checkins).toEqual([other])
    expect((await tasks.pendingChanges(userId)).at(-1)).toMatchObject({ deleteTaskId: target.id })
    expect((await focus.pendingChanges(userId)).some(change => 'change' in change && [first.id, second.id].includes(change.change.checkinId))).toBe(false)
  } finally {
    focus.close()
    tasks.close()
  }
})

test('pulled Task tombstones remove remote Tasks without resurrecting from earlier pages', async () => {
  const factory = new IDBFactory()
  const userId = uuidv7()
  const tasks = new TaskStore(`delete-remote-${uuidv7()}`, factory, IDBKeyRange)
  try {
    const task = await tasks.createTask(userId, 'Remote', localDay())
    await tasks.resolveChanges(userId, (await tasks.pendingChanges(userId)).map(change => ({ id: change.id, status: 'accepted' })))
    await tasks.applyPage(userId, [{ seq: 10, task: { ...task, seq: 10 } }], 10, false)
    await tasks.applyPage(userId, [{ seq: 11, deletedTaskId: task.id }], 11, false)
    expect(await tasks.listTasks(userId, task.day)).toEqual([])
    await tasks.applyPage(userId, [{ seq: 10, task: { ...task, seq: 10 } }], 11, false)
    expect(await tasks.listTasks(userId, task.day)).toEqual([])
  } finally {
    tasks.close()
  }
})
