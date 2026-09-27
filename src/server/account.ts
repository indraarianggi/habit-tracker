import { database } from '@/server/db'

const noCache = { 'Cache-Control': 'private, no-store' }
const tombstoneById = database.prepare('SELECT 1 FROM deleted_account WHERE userId = ?')
const insertTombstone = database.prepare('INSERT OR IGNORE INTO deleted_account (userId, deletedAt) VALUES (?, ?)')
const removeUser = database.prepare('DELETE FROM "user" WHERE id = ?')

export function isAccountDeleted(userId: string): boolean {
  return !!tombstoneById.get(userId)
}

export const deleteAccount = database.transaction((userId: string): void => {
  insertTombstone.run(userId, new Date().toISOString())
  removeUser.run(userId)
})

// A deleted account's session row is cascade-removed along with it, so `getSession` fails the same
// way an expired session would. The tombstone lets a still-cookied device tell the two apart.
export function unauthorizedResponse(request: Request): Response {
  const localUser = request.headers.get('X-Local-User')
  if (localUser && isAccountDeleted(localUser)) {
    return Response.json({ error: 'Account deleted' }, { status: 410, headers: noCache })
  }
  return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noCache })
}
