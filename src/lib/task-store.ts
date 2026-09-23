import Dexie, { type Table } from 'dexie'
import { v7 as uuidv7 } from 'uuid'
import {
  localDay,
  nextOrderKey,
  orderKeyBetween,
  taskRecordSchema,
  normalizeTaskTitle,
  type TaskChange,
  type TaskRecord,
} from '@/lib/task-contract'

type PendingTask = TaskChange & { userId: string }
type TaskSyncCursor = { userId: string; cursor: number; firstLoadComplete: boolean }

class TaskDatabase extends Dexie {
  tasks!: Table<TaskRecord, [string, string]>
  pending!: Table<PendingTask, [string, string]>
  cursors!: Table<TaskSyncCursor, string>

  constructor(name: string, indexedDB?: IDBFactory, IDBKeyRange?: typeof globalThis.IDBKeyRange) {
    super(name, {
      ...(indexedDB ? { indexedDB } : {}),
      ...(IDBKeyRange ? { IDBKeyRange } : {}),
    })
    this.version(1).stores({
      tasks: '[userId+id], [userId+day]',
      pending: '[userId+id], userId, [userId+task.id]',
      cursors: 'userId',
    })
  }
}

export class TaskStore {
  private readonly db: TaskDatabase

  constructor(
    name = 'habit-tracker-tasks',
    indexedDB?: IDBFactory,
    IDBKeyRange?: typeof globalThis.IDBKeyRange,
  ) {
    this.db = new TaskDatabase(name, indexedDB, IDBKeyRange)
  }

  async createTask(userId: string, input: string, day = localDay()): Promise<TaskRecord> {
    const title = normalizeTaskTitle(input)
    if (!taskRecordSchema.shape.day.safeParse(day).success) {
      throw new Error('Enter a valid day.')
    }
    if (day < localDay()) {
      throw new Error('Tasks can only be created for today or a future day.')
    }

    return this.db.transaction('rw', this.db.tasks, this.db.pending, async () => {
      const tasks = await this.db.tasks.where('[userId+day]').equals([userId, day]).toArray()
      const task: TaskRecord = {
        id: uuidv7(),
        userId,
        day,
        title,
        completed: false,
        orderKey: nextOrderKey(tasks.map((existing) => existing.orderKey)),
        createdAt: new Date().toISOString(),
        seq: 0,
      }
      const { userId: _userId, seq: _seq, ...changeTask } = task
      await this.db.tasks.add(task)
      await this.db.pending.add({ userId, id: uuidv7(), task: changeTask })
      return task
    })
  }

  async listTasks(userId: string, day: string): Promise<TaskRecord[]> {
    const tasks = await this.db.tasks.where('[userId+day]').equals([userId, day]).toArray()
    return tasks.sort((left, right) =>
      left.orderKey < right.orderKey ? -1 : left.orderKey > right.orderKey ? 1 : left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    )
  }

  private async saveEdit(userId: string, task: TaskRecord): Promise<void> {
    const { userId: _userId, seq: _seq, ...changeTask } = task
    await this.db.tasks.put(task)
    await this.db.pending.add({ userId, id: uuidv7(), task: changeTask })
  }

  async renameTask(userId: string, id: string, input: string): Promise<void> {
    const title = normalizeTaskTitle(input)
    await this.db.transaction('rw', this.db.tasks, this.db.pending, async () => {
      const task = await this.db.tasks.get([userId, id])
      if (!task) throw new Error('Task not found.')
      if (task.title !== title) await this.saveEdit(userId, { ...task, title })
    })
  }

  async setTaskCompleted(userId: string, id: string, completed: boolean): Promise<void> {
    await this.db.transaction('rw', this.db.tasks, this.db.pending, async () => {
      const task = await this.db.tasks.get([userId, id])
      if (!task) throw new Error('Task not found.')
      if (task.completed !== completed) await this.saveEdit(userId, { ...task, completed })
    })
  }

  async moveTask(userId: string, id: string, direction: 'up' | 'down'): Promise<boolean> {
    return this.db.transaction('rw', this.db.tasks, this.db.pending, async () => {
      const task = await this.db.tasks.get([userId, id])
      if (!task) throw new Error('Task not found.')
      const tasks = await this.listTasks(userId, task.day)
      const index = tasks.findIndex((item) => item.id === id)
      const neighbor = tasks[index + (direction === 'up' ? -1 : 1)]
      if (!neighbor) return false
      // Equal keys have an id tie-breaker. Put the moved Task outside the tied
      // group, leaving every other Task's key untouched.
      const bound = direction === 'up'
        ? tasks.slice(0, index - 1).reverse().find((item) => item.orderKey < neighbor.orderKey)
        : tasks.slice(index + 2).find((item) => item.orderKey > neighbor.orderKey)
      const orderKey = direction === 'up'
        ? orderKeyBetween(bound?.orderKey, neighbor.orderKey)
        : orderKeyBetween(neighbor.orderKey, bound?.orderKey)
      await this.saveEdit(userId, { ...task, orderKey })
      return true
    })
  }

  async pendingChanges(userId: string): Promise<TaskChange[]> {
    const pending = await this.db.pending.where('userId').equals(userId).sortBy('id')
    return pending.map(({ id, task }) => ({ id, task }))
  }

  async acceptChanges(userId: string, ids: string[]): Promise<void> {
    await this.db.transaction('rw', this.db.pending, async () => {
      await this.db.pending.bulkDelete(ids.map((id): [string, string] => [userId, id]))
    })
  }

  async applyPage(
    userId: string,
    changes: Array<{ seq: number; task: TaskRecord }>,
    nextSeq: number,
    hasMore: boolean,
  ): Promise<void> {
    await this.db.transaction('rw', this.db.tasks, this.db.pending, this.db.cursors, async () => {
      const cursor = await this.db.cursors.get(userId)
      for (const { seq, task } of changes) {
        if (task.userId !== userId) continue
        const pending = await this.db.pending.where('[userId+task.id]').equals([userId, task.id]).first()
        if (pending) continue
        const existing = await this.db.tasks.get([userId, task.id])
        if (!existing || seq > existing.seq) {
          await this.db.tasks.put({ ...task, seq })
        }
      }
      await this.db.cursors.put({
        userId,
        cursor: Math.max(cursor?.cursor ?? 0, nextSeq),
        firstLoadComplete: (cursor?.firstLoadComplete ?? false) || !hasMore,
      })
    })
  }

  async syncState(userId: string): Promise<{ cursor: number; firstLoadComplete: boolean; pending: number }> {
    return this.db.transaction('r', this.db.pending, this.db.cursors, async () => {
      const [cursor, pending] = await Promise.all([
        this.db.cursors.get(userId),
        this.db.pending.where('userId').equals(userId).count(),
      ])
      return {
        cursor: cursor?.cursor ?? 0,
        firstLoadComplete: cursor?.firstLoadComplete ?? false,
        pending,
      }
    })
  }

  close(): void {
    this.db.close()
  }
}
