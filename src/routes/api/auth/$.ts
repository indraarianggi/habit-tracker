import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/server/auth'
import { enforceSignInLimit } from '@/server/rate-limit'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => enforceSignInLimit(request) ?? auth.handler(request),
      POST: ({ request }) => enforceSignInLimit(request) ?? auth.handler(request),
    },
  },
})
