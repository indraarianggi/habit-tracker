import { createFileRoute } from '@tanstack/react-router'
import { deleteAccountRequestSchema } from '@/lib/account-contract'
import { deleteAccount, unauthorizedResponse } from '@/server/account'
import { auth } from '@/server/auth'

const noCache = { 'Cache-Control': 'private, no-store' }

export const Route = createFileRoute('/api/account')({
  server: {
    handlers: {
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
        const parsed = deleteAccountRequestSchema.safeParse(body)
        if (!parsed.success) return Response.json({ error: 'Type DELETE to confirm.' }, { status: 400, headers: noCache })
        deleteAccount.immediate(login.user.id)
        return Response.json({ success: true }, { headers: noCache })
      },
    },
  },
})
