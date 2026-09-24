import Dexie, { type Table } from 'dexie'
import { v7 as uuidv7 } from 'uuid'
import type { CheckinRecord, SessionRecord } from '@/lib/session-contract'

export type BreakState =
  | { phase: 'choice'; taskId: string; taskTitle: string; sourceSessionId: string; plannedMinutes: number }
  | { phase: 'running' | 'ended'; taskId: string; taskTitle: string; sourceSessionId: string; plannedMinutes: number; kind: 'short' | 'long'; durationMinutes: number; startedAt: string }
type FocusState = { userId: string; session: SessionRecord | null; lastTaskId: string | null; sessionTaskTitle?: string; break?: BreakState | null }
type PendingControl = { id?: number; userId: string; sessionId: string; action: 'pause' | 'resume'; at: string }
type PendingFinish = { id?: number; userId: string; sessionId: string; outcome: 'finish' | 'save' | 'discard'; durationMinutes?: number }
type PendingChange = PendingControl | PendingFinish
export function elapsedFocusMs(session: SessionRecord, now = Date.now()): number {
  return Math.min(session.plannedMinutes * 60_000,
    session.elapsedMs + (session.segmentStartedAt ? Math.max(0, now - Date.parse(session.segmentStartedAt)) : 0))
}

export function remainingBreakSeconds(value: BreakState, now = Date.now()): number {
  if (value.phase !== 'running') return 0
  return Math.max(0, Math.ceil((Date.parse(value.startedAt) + value.durationMinutes * 60_000 - now) / 1000))
}


class FocusDatabase extends Dexie {
  state!: Table<FocusState, string>
  checkins!: Table<CheckinRecord, [string, string]>
  pending!: Table<PendingChange, number>

  constructor(name: string, indexedDB?: IDBFactory, IDBKeyRange?: typeof globalThis.IDBKeyRange) {
    super(name, { ...(indexedDB ? { indexedDB } : {}), ...(IDBKeyRange ? { IDBKeyRange } : {}) })
    this.version(1).stores({ state: 'userId', checkins: '[userId+id], [userId+sourceSessionId]', pending: '++id, userId' })
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
      if (outcome !== 'discard') {
        await this.db.checkins.put({ id: uuidv7(), userId, taskId: session.taskId, durationMinutes: minutes!, origin: 'session', sourceSessionId: session.id, createdAt: now.toISOString() })
      }
      await this.db.pending.add({ userId, sessionId: session.id, outcome, ...(outcome === 'save' ? { durationMinutes: minutes } : {}) })
      await this.db.state.put({ userId, session: null, lastTaskId: session.taskId,
        break: outcome === 'finish' ? { phase: 'choice', taskId: session.taskId, taskTitle: state?.sessionTaskTitle || taskTitle, sourceSessionId: session.id, plannedMinutes: session.plannedMinutes } : null })
    })
  }

  async startBreak(userId: string, kind: 'short' | 'long', now = new Date()): Promise<void> {
    await this.db.transaction('rw', this.db.state, async () => {
      const state = await this.db.state.get(userId)
      if (!state || state.session || state.break?.phase !== 'choice') throw new Error('Break choice is no longer available.')
      await this.db.state.put({ ...state, break: {
        phase: 'running', taskId: state.break.taskId, taskTitle: state.break.taskTitle, sourceSessionId: state.break.sourceSessionId, plannedMinutes: state.break.plannedMinutes,
        kind, durationMinutes: kind === 'short' ? 5 : 15, startedAt: now.toISOString(),
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

  async pendingChanges(userId: string): Promise<PendingChange[]> {
    return this.db.pending.where('userId').equals(userId).sortBy('id')
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
          state.session?.elapsedMs !== nextSession?.elapsedMs || state.session?.segmentStartedAt !== nextSession?.segmentStartedAt ||
          state.lastTaskId !== nextLastTaskId) {
          await this.db.state.put({ userId, session: nextSession, lastTaskId: nextLastTaskId,
            sessionTaskTitle: state?.session && state.session.id === nextSession?.id ? state.sessionTaskTitle : undefined,
            break: nextSession ? null : state?.break ?? null })
        }
      }
      for (const checkin of checkins) {
        if (checkin.userId !== userId) continue
        const previous = await this.db.checkins.where('[userId+sourceSessionId]').equals([userId, checkin.sourceSessionId]).first()
        if (previous?.id !== checkin.id || previous.taskId !== checkin.taskId ||
          previous.durationMinutes !== checkin.durationMinutes || previous.createdAt !== checkin.createdAt) {
          if (previous && previous.id !== checkin.id) await this.db.checkins.delete([userId, previous.id])
          await this.db.checkins.put(checkin)
        }
      }
    })
  }

  async applyReceipt(userId: string, sessionId: string, checkin: CheckinRecord | null): Promise<void> {
    await this.db.transaction('rw', this.db.state, this.db.checkins, async () => {
      const provisional = await this.db.checkins.where('[userId+sourceSessionId]').equals([userId, sessionId]).first()
      if (provisional) await this.db.checkins.delete([userId, provisional.id])
      if (checkin) await this.db.checkins.put(checkin)
      const state = await this.db.state.get(userId)
      if (state?.break?.sourceSessionId === sessionId &&
        (!checkin || checkin.durationMinutes !== state.break.plannedMinutes)) {
        await this.db.state.put({ ...state, break: null })
      }
    })
  }

  close(): void { this.db.close() }
}
