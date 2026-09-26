import Dexie, { type Table } from 'dexie'
import { v7 as uuidv7 } from 'uuid'
import { defaultDurations, durationSettingsSchema, type DurationSettings } from '@/lib/settings-contract'
import { SyncAuthError } from '@/lib/task-sync'

type StoredSettings = { userId: string; settings: DurationSettings; seq: number }
type PendingSettings = { userId: string; id: string; settings: DurationSettings }

class SettingsDatabase extends Dexie {
  settings!: Table<StoredSettings, string>
  pending!: Table<PendingSettings, [string, string]>

  constructor(name: string, indexedDB?: IDBFactory, IDBKeyRange?: typeof globalThis.IDBKeyRange) {
    super(name, { ...(indexedDB ? { indexedDB } : {}), ...(IDBKeyRange ? { IDBKeyRange } : {}) })
    this.version(1).stores({ settings: 'userId', pending: '[userId+id], userId' })
  }
}

export class SettingsStore {
  private readonly db: SettingsDatabase

  constructor(name = 'habit-tracker-settings', indexedDB?: IDBFactory, IDBKeyRange?: typeof globalThis.IDBKeyRange) {
    this.db = new SettingsDatabase(name, indexedDB, IDBKeyRange)
  }

  async snapshot(userId: string): Promise<DurationSettings> {
    const row = await this.db.settings.get(userId)
    return row ? { ...row.settings } : { ...defaultDurations }
  }

  async update(userId: string, settings: DurationSettings | ((current: DurationSettings) => DurationSettings)): Promise<void> {
    await this.db.transaction('rw', this.db.settings, this.db.pending, async () => {
      const current = await this.db.settings.get(userId)
      const valid = durationSettingsSchema.parse(typeof settings === 'function'
        ? settings(current?.settings ?? defaultDurations) : settings)
      await this.db.settings.put({ userId, settings: valid, seq: current?.seq ?? 0 })
      await this.db.pending.add({ userId, id: uuidv7(), settings: valid })
    })
  }

  async pendingCount(userId: string): Promise<number> {
    return this.db.pending.where('userId').equals(userId).count()
  }

  async pendingChanges(userId: string): Promise<PendingSettings[]> {
    return this.db.pending.where('userId').equals(userId).sortBy('id')
  }

  async accept(userId: string, id: string, settings: DurationSettings, seq: number): Promise<void> {
    await this.db.transaction('rw', this.db.settings, this.db.pending, async () => {
      if (!await this.db.pending.get([userId, id])) return
      await this.db.pending.delete([userId, id])
      const current = await this.db.settings.get(userId)
      const stillPending = await this.db.pending.where('userId').equals(userId).count()
      if (current && seq < current.seq) return
      await this.db.settings.put({ userId, settings: stillPending ? current?.settings ?? settings : settings, seq })
    })
  }

  async receive(userId: string, settings: DurationSettings, seq: number): Promise<void> {
    await this.db.transaction('rw', this.db.settings, this.db.pending, async () => {
      if (await this.db.pending.where('userId').equals(userId).count()) return
      const current = await this.db.settings.get(userId)
      if (!current || seq > current.seq) await this.db.settings.put({ userId, settings, seq })
    })
  }

  close(): void {
    this.db.close()
  }
}

function parseReceipt(value: unknown): { settings: DurationSettings; seq: number } {
  if (!value || typeof value !== 'object' || !('settings' in value) || !('seq' in value) ||
    typeof value.seq !== 'number' || !Number.isSafeInteger(value.seq) || value.seq < 0) {
    throw new Error('Invalid settings response.')
  }
  return { settings: durationSettingsSchema.parse(value.settings), seq: value.seq }
}

const syncs = new WeakMap<SettingsStore, Map<string, Promise<void>>>()

export function syncSettings(store: SettingsStore, userId: string, fetcher: typeof fetch = fetch): Promise<void> {
  const users = syncs.get(store) ?? new Map<string, Promise<void>>()
  syncs.set(store, users)
  const previous = users.get(userId) ?? Promise.resolve()
  const run = previous.then(async () => {
    // Capture one batch: edits made during a request remain pending for the next sync,
    // rather than letting an old server response replace the newer local choice.
    for (const change of await store.pendingChanges(userId)) {
      const response = await fetcher('/api/settings', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Local-User': userId },
        body: JSON.stringify({ id: change.id, settings: change.settings }),
      })
      if (response.status === 401 || response.status === 403) throw new SyncAuthError(response.status)
      if (!response.ok) throw new Error(`Settings push failed (${response.status}).`)
      const receipt = parseReceipt(await response.json())
      await store.accept(userId, change.id, receipt.settings, receipt.seq)
    }
    const response = await fetcher('/api/settings', {
      credentials: 'same-origin', cache: 'no-store', headers: { 'X-Local-User': userId },
    })
    if (response.status === 401 || response.status === 403) throw new SyncAuthError(response.status)
    if (!response.ok) throw new Error(`Settings pull failed (${response.status}).`)
    const remote = parseReceipt(await response.json())
    await store.receive(userId, remote.settings, remote.seq)
  })
  const settled = run.then(() => undefined, () => undefined)
  users.set(userId, settled)
  void settled.then(() => { if (users.get(userId) === settled) users.delete(userId) })
  return run
}
