import { pullResponseSchema, pushRequestSchema, pushResponseSchema } from '@/lib/task-contract'
import { type TaskStore } from '@/lib/task-store'

const PAGE_SIZE = 100

export async function syncTasks(
  store: TaskStore,
  userId: string,
  fetcher: typeof fetch = fetch,
  onDeletion?: () => Promise<void>,
): Promise<void> {
  const pending = await store.pendingChanges(userId)
  for (let offset = 0; offset < pending.length;) {
    const boundary = pending.findIndex((change, index) => index >= offset && 'deleteTaskId' in change)
    const end = boundary === -1 ? Math.min(offset + PAGE_SIZE, pending.length)
      : boundary === offset ? Math.min(offset + 1, pending.length) : Math.min(boundary, offset + PAGE_SIZE)
    const changes = pending.slice(offset, end)
    if ('deleteTaskId' in changes[0]) await onDeletion?.()
    offset = end
    const request = pushRequestSchema.parse({ changes })
    const response = await fetcher('/api/sync/push', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`Task push failed (${response.status}).`)

    const { results } = pushResponseSchema.parse(await response.json())
    const expected = new Set(changes.map((change) => change.id))
    if (results.length !== changes.length || results.some(({ id }) => !expected.delete(id)) || expected.size) {
      throw new Error('Task push returned an incomplete acknowledgement.')
    }
    const accepted = results.filter((result) => result.status === 'accepted')
    if (accepted.some(({ seq }) => seq === undefined)) {
      throw new Error('Task push returned an accepted change without its sequence.')
    }
    await store.acceptChanges(userId, accepted.map(({ id }) => id))
    const rejected = results.find((result) => result.status === 'rejected')
    if (rejected) throw new Error(rejected.reason ?? 'A Task change was rejected.')
  }

  let sawDeletion = false
  let { cursor } = await store.syncState(userId)
  while (true) {
    const query = new URLSearchParams({ after: String(cursor), limit: String(PAGE_SIZE) })
    const response = await fetcher(`/api/sync/pull?${query}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`Task pull failed (${response.status}).`)

    const page = pullResponseSchema.parse(await response.json())
    if (page.nextSeq < cursor || (page.hasMore && page.nextSeq === cursor)) {
      throw new Error('Task pull did not advance its cursor.')
    }
    if (page.changes.some(change => 'deletedTaskId' in change)) sawDeletion = true
    await store.applyPage(userId, page.changes, page.nextSeq, page.hasMore)
    cursor = page.nextSeq
    if (!page.hasMore) {
      if (sawDeletion) await onDeletion?.()
      return
    }
  }
}
