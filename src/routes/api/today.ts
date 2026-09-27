import { createFileRoute } from '@tanstack/react-router'
import { unauthorizedResponse } from '@/server/account'
import { auth } from '@/server/auth'

export const Route = createFileRoute('/api/today')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return unauthorizedResponse(request)
        return Response.json({
          user: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            image: session.user.image,
          },
        }, { headers: { 'Cache-Control': 'private, no-store' } })
      },
    },
  },
})
