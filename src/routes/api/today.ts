import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/server/auth'

export const Route = createFileRoute('/api/today')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        return Response.json({
          user: {
            id: session.user.id,
            name: session.user.name,
            image: session.user.image,
          },
        }, { headers: { 'Cache-Control': 'private, no-store' } })
      },
    },
  },
})
