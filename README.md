# Habit Tracker

Ticket 01 provides a public Privacy Policy at `/privacy`. Google sign-in, private data, offline caching and account controls are not implemented yet (ticket 02 and later). The single TypeScript package uses React and TanStack Start in SPA mode; its production output includes a Node server.

## Run

Requires Node 22.12+ and pnpm 11.20.0 (pin in `package.json`; Corepack can provide it). Run `pnpm install --frozen-lockfile`, copy `.env.example` to `.env.local`, and set `VITE_PRIVACY_CONTACT_EMAIL` to a real, monitored contact mailbox. This value is bundled into the public privacy page; do not use a private mailbox you do not want displayed. The app refuses to start or build without a valid contact value. Local `.env*` files other than `.env.example` are ignored.

- `pnpm run dev` — development server on http://localhost:3000
- `pnpm run build` — production build (uses the configured contact at **build time**)
- `pnpm run start` — serve that build on port 3000 (`PORT` can override the port)
- `pnpm run typecheck` — check TypeScript after the router has generated `src/routeTree.gen.ts` (via dev or build)
- `pnpm exec playwright install chromium` — one-time browser installation
- `pnpm run smoke:browser` — launch dev server and check `/privacy` in a mobile browser without signing in
- `SMOKE_SERVER=production pnpm run smoke:browser` — launch a previously built server and run the same browser check

The smoke runner owns port 3000. Stop other local servers on that port before using it. For a public deployment, provide the same contact value to the build environment; runtime changes to `VITE_` values do not alter built assets. Point the public domain's `/privacy` path to the built app.

## Google sign-in configuration (ticket 02)

No Google sign-in endpoint or button is active in ticket 01. For ticket 02, create a Google OAuth web client for each origin (local and public) and configure its authorized origin and redirect URI `https://<app-domain>/api/auth/callback/google` (local: `http://localhost:3000/api/auth/callback/google`). Supply `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the server, `BETTER_AUTH_URL` set to the app's origin, and a generated high-entropy `BETTER_AUTH_SECRET` of at least 32 characters. Do not prefix secrets with `VITE_`: those values are exposed to browsers. These variables are documented now, not read or used until ticket 02.

Never commit `.env.local`, other credentials, SQLite databases, generated output, or local test artifacts. The committed `pnpm-lock.yaml` pins the chosen compatible release set; install with `pnpm install --frozen-lockfile`.
