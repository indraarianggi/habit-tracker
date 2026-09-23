import { createRouter, type Router } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
export type AppRouter = Router<typeof routeTree>
export function getRouter() {
  return createRouter({ routeTree })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
