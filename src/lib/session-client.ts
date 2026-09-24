import { v7 as uuidv7 } from 'uuid'
import { checkinRecordSchema, sessionRecordSchema, type SessionRecord } from '@/lib/session-contract'
import type { SessionStore } from '@/lib/session-store'
import { localDay } from '@/lib/task-contract'

const requestOptions = { credentials: 'same-origin' as const, cache: 'no-store' as const }

export async function startSession(taskId: string, day: string, fetcher: typeof fetch = fetch): Promise<SessionRecord> {
  const response = await fetcher('/api/session/start', {
    ...requestOptions, method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: uuidv7(), taskId, day, plannedMinutes: 25 }),
  })
  if (response.status === 409) throw new Error('A Session is already active on another device.')
  if (!response.ok) throw new Error('Could not start a Session. Check your connection and try again.')
  const body: unknown = await response.json()
  if (!body || typeof body !== 'object' || !('session' in body)) throw new Error('Invalid Session response.')
  return sessionRecordSchema.parse(body.session)
}

export async function syncSession(store: SessionStore, userId: string, fetcher: typeof fetch = fetch): Promise<void> {
  for (;;) {
    const change = (await store.pendingChanges(userId))[0]
    if (!change) break
    if ('change' in change) {
      const response = await fetcher('/api/checkin/change', {
        ...requestOptions, method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...change.change, today: localDay() }),
      })
      if (response.status === 404 && change.change.action !== 'create') {
        // A deletion on another device beats our pending correction.
        await store.acceptCheckinChange(userId, change.id!, null)
        continue
      }
      if (!response.ok) throw new Error(`Could not sync Check-in (${response.status}).`)
      const body: unknown = await response.json()
      if (!body || typeof body !== 'object' || !('checkin' in body)) throw new Error('Invalid Check-in response.')
      const receipt = body.checkin === null ? null : checkinRecordSchema.parse(body.checkin)
      await store.acceptCheckinChange(userId, change.id!, receipt)
      continue
    }
    const control = 'action' in change
    const response = await fetcher(control ? '/api/session/control' : '/api/session/finish', {
      ...requestOptions, method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(control
        ? { id: change.sessionId, action: change.action, at: change.at }
        : { id: change.sessionId, outcome: change.outcome, ...(change.durationMinutes ? { durationMinutes: change.durationMinutes } : {}) }),
    })
    if (control && response.status === 409) {
      // The other device moved the Session first; adopt its state below.
      await store.acceptChange(userId, change.id!)
      continue
    }
    if (!response.ok) throw new Error(`Could not sync focus (${response.status}).`)
    const body: unknown = await response.json()
    if (!control) {
      if (!body || typeof body !== 'object' || !('checkin' in body)) throw new Error('Invalid Session outcome.')
      await store.applyReceipt(userId, change.sessionId, body.checkin ? checkinRecordSchema.parse(body.checkin) : null)
    }
    await store.acceptChange(userId, change.id!)
  }
  const response = await fetcher('/api/session', requestOptions)
  if (!response.ok) throw new Error(`Could not load focus (${response.status}).`)
  const body: unknown = await response.json()
  if (!body || typeof body !== 'object' || !('session' in body) || !('lastTaskId' in body) || !('checkins' in body) || !Array.isArray(body.checkins)) {
    throw new Error('Invalid focus response.')
  }
  await store.receive(userId, body.session ? sessionRecordSchema.parse(body.session) : null,
    typeof body.lastTaskId === 'string' ? body.lastTaskId : null, body.checkins.map(checkin => checkinRecordSchema.parse(checkin)))
}
