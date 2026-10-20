import { createFileRoute } from '@tanstack/react-router'
import { unauthorizedResponse } from '@/server/account'
import { auth } from '@/server/auth'
import { enforceIpLimit, enforceUserLimit } from '@/server/rate-limit'

export const Route = createFileRoute('/api/today')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ipLimited = enforceIpLimit(request)
        if (ipLimited) return ipLimited
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return unauthorizedResponse(request)
        const userLimited = enforceUserLimit(session.user.id)
        if (userLimited) return userLimited
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
