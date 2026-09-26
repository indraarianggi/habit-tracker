import Dexie, { type Table } from 'dexie'
import { v7 as uuidv7 } from 'uuid'
import { checkinChangeSchema, type CheckinChangeRequest, type CheckinRecord, type SessionRecord } from '@/lib/session-contract'
import { defaultDurations } from '@/lib/settings-contract'
import { localDay, taskRecordSchema, type TaskRecord } from '@/lib/task-contract'

export type BreakState =
  | { phase: 'choice'; taskId: string; taskTitle: string; sourceSessionId: string; plannedMinutes: number; shortBreakMinutes: number; longBreakMinutes: number }
  | { phase: 'running' | 'ended'; taskId: string; taskTitle: string; sourceSessionId: string; plannedMinutes: number; kind: 'short' | 'long'; durationMinutes: number; startedAt: string }
type FocusState = { userId: string; session: SessionRecord | null; lastTaskId: string | null; sessionTaskTitle?: string; break?: BreakState | null }
type PendingControl = { id?: number; userId: string; sessionId: string; action: 'pause' | 'resume'; at: string }
type PendingFinish = { id?: number; userId: string; sessionId: string; outcome: 'finish' | 'save' | 'discard'; durationMinutes?: number; provisionalCheckinId?: string }
type PendingCheckin = { id?: number; userId: string; change: CheckinChangeRequest; taskTitle?: string; taskDay?: string; originalTaskTitle?: string }
type PendingChange = PendingControl | PendingFinish | PendingCheckin
export function elapsedFocusMs(session: SessionRecord, now = Date.now()): number {
  return Math.min(session.plannedMinutes * 60_000,
    session.elapsedMs + (session.segmentStartedAt ? Math.max(0, now - Date.parse(session.segmentStartedAt)) : 0))
}

export function remainingBreakSeconds(value: BreakState, now = Date.now()): number {
  if (value.phase !== 'running') return 0
  return Math.max(0, Math.ceil((Date.parse(value.startedAt) + value.durationMinutes * 60_000 - now) / 1000))
}

function checkinTarget(userId: string, task: TaskRecord, minutes: number): void {
  if (task.userId !== userId) throw new Error('Task not found.')
  if (!taskRecordSchema.shape.day.safeParse(task.day).success || task.day > localDay()) {
    throw new Error('Choose a Task on Today or a past Day.')
  }
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 480) {
    throw new Error('Enter 1–480 whole focused minutes.')
  }
}

function withPendingChanges(checkin: CheckinRecord, pending: PendingCheckin[]): CheckinRecord | null {
  let result: CheckinRecord | null = checkin
  for (const { change } of pending) {
    if (change.action === 'delete') result = null
    else if (change.action === 'edit') result = { ...checkin, taskId: change.taskId, durationMinutes: change.durationMinutes }
  }
  return result
}


class FocusDatabase extends Dexie {
  state!: Table<FocusState, string>
  checkins!: Table<CheckinRecord, [string, string]>
  pending!: Table<PendingChange, number>

  constructor(name: string, indexedDB?: IDBFactory, IDBKeyRange?: typeof globalThis.IDBKeyRange) {
    super(name, { ...(indexedDB ? { indexedDB } : {}), ...(IDBKeyRange ? { IDBKeyRange } : {}) })
    const stores = { state: 'userId', checkins: '[userId+id], [userId+sourceSessionId]', pending: '++id, userId' }
    this.version(1).stores(stores)
    this.version(2).stores(stores).upgrade(transaction => transaction.table('state').toCollection().modify((state: FocusState) => {
      if (state.session) {
        state.session.shortBreakMinutes ??= defaultDurations.shortBreakMinutes
        state.session.longBreakMinutes ??= defaultDurations.longBreakMinutes
      }
      if (state.break?.phase === 'choice') {
        state.break.shortBreakMinutes ??= defaultDurations.shortBreakMinutes
        state.break.longBreakMinutes ??= defaultDurations.longBreakMinutes
      }
    }))
  }
}

export class SessionStore {
  private readonly db: FocusDatabase

  constructor(name = 'habit-tracker-focus', indexedDB?: IDBFactory, IDBKeyRange?: typeof globalThis.IDBKeyRange) {
    this.db = new FocusDatabase(name, indexedDB, IDBKeyRange)
  }

  async snapshot(userId: string): Promise<{ session: SessionRecord | null; lastTaskId: string | null; break: BreakState | null; checkins: CheckinRecord[] }> {
    const [state, checkins] = await Promise.all([
      this.db.state.get(userId),
      this.db.checkins.where('[userId+id]').between([userId, Dexie.minKey], [userId, Dexie.maxKey]).toArray(),
    ])
    return { session: state?.session ?? null, lastTaskId: state?.lastTaskId ?? null, break: state?.break ?? null, checkins }
  }

  async started(userId: string, session: SessionRecord, taskTitle = ''): Promise<void> {
    await this.db.state.put({ userId, session, lastTaskId: session.taskId, sessionTaskTitle: taskTitle, break: null })
  }

  async control(userId: string, action: 'pause' | 'resume', now = new Date()): Promise<void> {
    await this.db.transaction('rw', this.db.state, this.db.pending, async () => {
      const state = await this.db.state.get(userId)
      const session = state?.session
      if (!session || session.status !== (action === 'pause' ? 'running' : 'paused')) throw new Error('Session state changed. Try again.')
      const at = now.toISOString()
      const next: SessionRecord = action === 'pause'
        ? { ...session, status: 'paused', elapsedMs: elapsedFocusMs(session, now.getTime()), segmentStartedAt: null }
        : { ...session, status: 'running', segmentStartedAt: at }
      await this.db.state.put({ ...state, userId, session: next, lastTaskId: session.taskId })
      await this.db.pending.add({ userId, sessionId: session.id, action, at })
    })
  }

  async finish(userId: string, outcome: 'finish' | 'save' | 'discard', durationMinutes?: number, now = new Date(), taskTitle = ''): Promise<void> {
    await this.db.transaction('rw', this.db.state, this.db.checkins, this.db.pending, async () => {
      const state = await this.db.state.get(userId)
      const session = state?.session
      if (!session) throw new Error('Session has already ended.')
      const minutes = outcome === 'finish' ? session.plannedMinutes : durationMinutes
      if (outcome !== 'discard' && (!minutes || minutes < 1 || minutes > session.plannedMinutes)) throw new Error('No whole focused minute to save.')
      let provisionalCheckinId: string | undefined
      if (outcome !== 'discard') {
        provisionalCheckinId = uuidv7()
        await this.db.checkins.put({ id: provisionalCheckinId, userId, taskId: session.taskId, durationMinutes: minutes!, origin: 'session', sourceSessionId: session.id, createdAt: now.toISOString() })
      }
      await this.db.pending.add({ userId, sessionId: session.id, outcome, provisionalCheckinId, ...(outcome === 'save' ? { durationMinutes: minutes } : {}) })
      await this.db.state.put({ userId, session: null, lastTaskId: session.taskId,
        break: outcome === 'finish' ? { phase: 'choice', taskId: session.taskId, taskTitle: state?.sessionTaskTitle || taskTitle, sourceSessionId: session.id, plannedMinutes: session.plannedMinutes, shortBreakMinutes: session.shortBreakMinutes, longBreakMinutes: session.longBreakMinutes } : null })
    })
  }

  async startBreak(userId: string, kind: 'short' | 'long', now = new Date()): Promise<void> {
    await this.db.transaction('rw', this.db.state, async () => {
      const state = await this.db.state.get(userId)
      if (!state || state.session || state.break?.phase !== 'choice') throw new Error('Break choice is no longer available.')
      await this.db.state.put({ ...state, break: {
        phase: 'running', taskId: state.break.taskId, taskTitle: state.break.taskTitle, sourceSessionId: state.break.sourceSessionId, plannedMinutes: state.break.plannedMinutes,
        kind, durationMinutes: kind === 'short' ? state.break.shortBreakMinutes : state.break.longBreakMinutes, startedAt: now.toISOString(),
      } })
    })
  }

  async endBreak(userId: string): Promise<void> {
    await this.db.transaction('rw', this.db.state, async () => {
      const state = await this.db.state.get(userId)
      if (state?.break?.phase === 'running') {
        await this.db.state.put({ ...state, break: { ...state.break, phase: 'ended' } })
      }
    })
  }

  async clearBreak(userId: string): Promise<void> {
    await this.db.transaction('rw', this.db.state, async () => {
      const state = await this.db.state.get(userId)
      if (state?.break) await this.db.state.put({ ...state, break: null })
    })
  }

  async createCheckin(userId: string, task: TaskRecord, minutes: number): Promise<CheckinRecord> {
    checkinTarget(userId, task, minutes)
    const record: CheckinRecord = {
      id: uuidv7(), userId, taskId: task.id, durationMinutes: minutes,
      origin: 'manual', sourceSessionId: null, createdAt: new Date().toISOString(),
    }
    const change = checkinChangeSchema.parse({
      id: uuidv7(), action: 'create', checkinId: record.id, taskId: task.id,
      durationMinutes: minutes, createdAt: record.createdAt, today: localDay(),
    })
    await this.db.transaction('rw', this.db.checkins, this.db.pending, async () => {
      await this.db.checkins.add(record)
      await this.db.pending.add({ userId, change, taskTitle: task.title, taskDay: task.day })
    })
    return record
  }

  async editCheckin(userId: string, id: string, task: TaskRecord, minutes: number, originalTask?: TaskRecord): Promise<void> {
    checkinTarget(userId, task, minutes)
    await this.db.transaction('rw', this.db.checkins, this.db.pending, async () => {
      const current = await this.db.checkins.get([userId, id])
      if (!current) throw new Error('Check-in not found.')
      if (current.taskId === task.id && current.durationMinutes === minutes) return
      const change = checkinChangeSchema.parse({
        id: uuidv7(), action: 'edit', checkinId: id, taskId: task.id,
        durationMinutes: minutes, today: localDay(),
      })
      await this.db.checkins.put({ ...current, taskId: task.id, durationMinutes: minutes })
      await this.db.pending.add({ userId, change, taskTitle: task.title, taskDay: task.day, originalTaskTitle: originalTask?.title })
    })
  }

  async deleteCheckin(userId: string, id: string): Promise<void> {
    await this.db.transaction('rw', this.db.checkins, this.db.pending, async () => {
      const current = await this.db.checkins.get([userId, id])
      if (!current) throw new Error('Check-in not found.')
      if (current.sourceSessionId) {
        const finish = (await this.db.pending.where('userId').equals(userId).toArray())
          .find((item): item is PendingFinish => 'outcome' in item && item.sessionId === current.sourceSessionId)
        if (finish && !finish.provisionalCheckinId) {
          await this.db.pending.put({ ...finish, provisionalCheckinId: id })
        }
      }
      const change = checkinChangeSchema.parse({ id: uuidv7(), action: 'delete', checkinId: id, today: localDay() })
      await this.db.checkins.delete([userId, id])
      await this.db.pending.add({ userId, change })
    })
  }
  async removeTaskCheckins(userId: string, taskId: string): Promise<void> {
    await this.db.transaction('rw', this.db.checkins, this.db.pending, async () => {
      const checkins = await this.db.checkins.where('[userId+id]')
        .between([userId, Dexie.minKey], [userId, Dexie.maxKey]).toArray()
      const removed = checkins.filter(checkin => checkin.taskId === taskId)
      const ids = new Set(removed.map(checkin => checkin.id))
      for (const checkin of removed) await this.db.checkins.delete([userId, checkin.id])
      for (const pending of await this.db.pending.where('userId').equals(userId).toArray()) {
        if ('change' in pending && (ids.has(pending.change.checkinId) ||
          (pending.change.action !== 'delete' && pending.change.taskId === taskId))) {
          await this.db.pending.delete(pending.id!)
        }
      }
    })
  }


  async pendingChanges(userId: string): Promise<PendingChange[]> {
    return this.db.pending.where('userId').equals(userId).sortBy('id')
  }

  async acceptCheckinChange(userId: string, id: number, checkin: CheckinRecord | null): Promise<boolean> {
    return this.db.transaction('rw', this.db.checkins, this.db.pending, async () => {
      const accepted = await this.db.pending.get(id)
      if (!accepted || accepted.userId !== userId || !('change' in accepted)) return false
      const originalId = accepted.change.checkinId
      const later = (await this.db.pending.where('userId').equals(userId).sortBy('id'))
        .filter((item): item is PendingCheckin => 'change' in item && item.id! > id && item.change.checkinId === originalId)
      if (checkin && checkin.userId !== userId) throw new Error('Invalid Check-in receipt.')
      if (checkin && checkin.id !== originalId) {
        for (const item of later) await this.db.pending.put({ ...item, change: { ...item.change, checkinId: checkin.id } })
      }
      await this.db.checkins.delete([userId, originalId])
      if (checkin) {
        const visible = withPendingChanges(checkin, later)
        if (visible) await this.db.checkins.put(visible)
      } else {
        // An accepted change replay can return null after another device deleted the record.
        for (const item of later) await this.db.pending.delete(item.id!)
      }
      await this.db.pending.delete(id)
      return true
    })
  }

  async acceptChange(userId: string, id: number): Promise<void> {
    const change = await this.db.pending.get(id)
    if (change?.userId === userId) await this.db.pending.delete(id)
  }

  async receive(userId: string, session: SessionRecord | null, lastTaskId: string | null, checkins: CheckinRecord[]): Promise<void> {
    await this.db.transaction('rw', this.db.state, this.db.checkins, this.db.pending, async () => {
      const pending = await this.db.pending.where('userId').equals(userId).toArray()
      const state = await this.db.state.get(userId)
      // A locally ended Session is authoritative until its outcome reaches the server.
      const keepLocal = pending.some(change => 'outcome' in change)
      const keepControl = pending.some(change => 'action' in change)
      if (!keepLocal) {
        const nextSession = keepControl && state?.session && session && state.session.id === session.id ? state.session : session
        const nextLastTaskId = lastTaskId ?? state?.lastTaskId ?? null
        if (!state || state.session?.id !== nextSession?.id || state.session?.status !== nextSession?.status ||
          state?.session?.elapsedMs !== nextSession?.elapsedMs || state?.session?.segmentStartedAt !== nextSession?.segmentStartedAt ||
          state.lastTaskId !== nextLastTaskId) {
          await this.db.state.put({ userId, session: nextSession, lastTaskId: nextLastTaskId,
            sessionTaskTitle: state?.session && state.session.id === nextSession?.id ? state.sessionTaskTitle : undefined,
            break: nextSession ? null : state?.break ?? null })
        }
      }
      const pendingIds = new Set(pending.filter((item): item is PendingCheckin => 'change' in item).map(item => item.change.checkinId))
      const pendingSessions = new Set(pending.filter((item): item is PendingFinish => 'outcome' in item).map(item => item.sessionId))
      const remote = new Map(checkins.filter(item => item.userId === userId).map(item => [item.id, item]))
      const local = await this.db.checkins.where('[userId+id]').between([userId, Dexie.minKey], [userId, Dexie.maxKey]).toArray()
      const localById = new Map(local.map(item => [item.id, item]))
      const localBySession = new Map(local.filter(item => item.sourceSessionId).map(item => [item.sourceSessionId!, item]))
      for (const existing of local) {
        if (pendingIds.has(existing.id) || existing.sourceSessionId && pendingSessions.has(existing.sourceSessionId)) continue
        if (!remote.has(existing.id)) await this.db.checkins.delete([userId, existing.id])
      }
      for (const checkin of remote.values()) {
        if (pendingIds.has(checkin.id) || checkin.sourceSessionId && pendingSessions.has(checkin.sourceSessionId)) continue
        const previous = checkin.sourceSessionId ? localBySession.get(checkin.sourceSessionId) : undefined
        if (previous && previous.id !== checkin.id) await this.db.checkins.delete([userId, previous.id])
        const existing = localById.get(checkin.id)
        if (!existing || existing.taskId !== checkin.taskId || existing.durationMinutes !== checkin.durationMinutes ||
          existing.createdAt !== checkin.createdAt || existing.origin !== checkin.origin ||
          existing.sourceSessionId !== checkin.sourceSessionId) await this.db.checkins.put(checkin)
      }
    })
  }

  async applyReceipt(userId: string, sessionId: string, checkin: CheckinRecord | null): Promise<void> {
    await this.db.transaction('rw', this.db.state, this.db.checkins, this.db.pending, async () => {
      const pending = await this.db.pending.where('userId').equals(userId).sortBy('id')
      const finish = pending.find((item): item is PendingFinish => 'outcome' in item && item.sessionId === sessionId)
      const provisional = await this.db.checkins.where('[userId+sourceSessionId]').equals([userId, sessionId]).first()
      const provisionalId = finish?.provisionalCheckinId ?? provisional?.id
      const corrections = pending.filter((item): item is PendingCheckin =>
        'change' in item && item.change.checkinId === provisionalId)
      if (provisionalId) await this.db.checkins.delete([userId, provisionalId])
      if (checkin) {
        if (checkin.userId !== userId || checkin.sourceSessionId !== sessionId) throw new Error('Invalid Session receipt.')
        for (const correction of corrections) {
          await this.db.pending.put({ ...correction, change: { ...correction.change, checkinId: checkin.id } })
        }
        const visible = withPendingChanges(checkin, corrections)
        if (visible) await this.db.checkins.put(visible)
      } else {
        for (const correction of corrections) await this.db.pending.delete(correction.id!)
      }
      const state = await this.db.state.get(userId)
      if (state?.break?.sourceSessionId === sessionId &&
        (!checkin || checkin.durationMinutes !== state.break.plannedMinutes)) {
        await this.db.state.put({ ...state, break: null })
      }
    })
  }

  close(): void { this.db.close() }
}
