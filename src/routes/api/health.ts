import { createFileRoute } from '@tanstack/react-router'
import { database } from '@/server/db'

const noCache = { 'Cache-Control': 'private, no-store' }
// `database` finishes its startup migration (src/server/db.ts) before this module
// can even be imported, so a successful query here also proves migrations ran.
const ping = database.prepare('SELECT 1')

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () => {
        try {
          ping.get()
          return Response.json({ status: 'ok' }, { headers: noCache })
        } catch {
          return Response.json({ status: 'error' }, { status: 503, headers: noCache })
        }
      },
    },
  },
})
