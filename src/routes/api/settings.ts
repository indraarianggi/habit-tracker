import { createFileRoute } from '@tanstack/react-router'
import { defaultDurations, settingsChangeSchema } from '@/lib/settings-contract'
import type { DurationSettings, SettingsChange } from '@/lib/settings-contract'
import { unauthorizedResponse } from '@/server/account'
import { auth } from '@/server/auth'
import { database } from '@/server/db'

const noCache = { 'Cache-Control': 'private, no-store' }
type SettingsSnapshot = { settings: DurationSettings; seq: number }
type ChangeResult = SettingsSnapshot | { error: string; status: number }

const settingsByUser = database.prepare(`
  SELECT focusMinutes, shortBreakMinutes, longBreakMinutes, seq FROM duration_settings WHERE userId = ?
`)
const receiptById = database.prepare(`
  SELECT request FROM settings_change_receipt WHERE userId = ? AND id = ?
`)
const insertReceipt = database.prepare(`
  INSERT INTO settings_change_receipt (userId, id, request) VALUES (?, ?, ?)
`)
const saveSettings = database.prepare(`
  INSERT INTO duration_settings (userId, focusMinutes, shortBreakMinutes, longBreakMinutes, seq)
  VALUES (@userId, @focusMinutes, @shortBreakMinutes, @longBreakMinutes, @seq)
  ON CONFLICT(userId) DO UPDATE SET
    focusMinutes = excluded.focusMinutes,
    shortBreakMinutes = excluded.shortBreakMinutes,
    longBreakMinutes = excluded.longBreakMinutes,
    seq = excluded.seq
`)

function snapshot(userId: string): SettingsSnapshot {
  const row = settingsByUser.get(userId) as (DurationSettings & { seq: number }) | undefined
  if (!row) return { settings: defaultDurations, seq: 0 }
  const { seq, ...settings } = row
  return { settings, seq }
}

const acceptChange = database.transaction((userId: string, change: SettingsChange): ChangeResult => {
  const request = JSON.stringify(change.settings)
  const receipt = receiptById.get(userId, change.id) as { request: string } | undefined
  if (receipt) {
    return receipt.request === request
      ? snapshot(userId)
      : { error: 'Change ID already used', status: 409 }
  }
  const seq = Number(insertReceipt.run(userId, change.id, request).lastInsertRowid)
  saveSettings.run({ userId, ...change.settings, seq })
  return { settings: change.settings, seq }
})

export const Route = createFileRoute('/api/settings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const login = await auth.api.getSession({ headers: request.headers })
        if (!login) return unauthorizedResponse(request)
        if (request.headers.get('X-Local-User') && request.headers.get('X-Local-User') !== login.user.id) {
          return Response.json({ error: 'Account switched' }, { status: 403, headers: noCache })
        }
        return Response.json(snapshot(login.user.id), { headers: noCache })
      },
      POST: async ({ request }) => {
        const login = await auth.api.getSession({ headers: request.headers })
        if (!login) return unauthorizedResponse(request)
        if (request.headers.get('X-Local-User') && request.headers.get('X-Local-User') !== login.user.id) {
          return Response.json({ error: 'Account switched' }, { status: 403, headers: noCache })
        }
        let body: unknown
        try { body = await request.json() } catch {
          return Response.json({ error: 'Malformed JSON' }, { status: 400, headers: noCache })
        }
        const parsed = settingsChangeSchema.safeParse(body)
        if (!parsed.success) return Response.json({ error: 'Invalid Settings' }, { status: 400, headers: noCache })
        const result = acceptChange.immediate(login.user.id, parsed.data)
        return 'error' in result
          ? Response.json({ error: result.error }, { status: result.status, headers: noCache })
          : Response.json(result, { headers: noCache })
      },
    },
  },
})
