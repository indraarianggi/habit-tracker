# Habit Tracker

Tickets 01–03 publish `/privacy`, Google sign-in, a private Today view and local-first Task creation with authenticated cross-device sync. Type a Task title and press Enter; the local IndexedDB write and Pending change are atomic, and the server uploads changes idempotently and downloads them in pages. A new device holds the loading screen until its first download finishes. Focus sessions, the Tasks and Progress tabs, service-worker offline navigation, and account deletion belong to later tickets. The single TypeScript package uses React and TanStack Start in SPA mode; its production output includes a Node server.

UI styling uses Tailwind CSS v4 design tokens in `src/styles.css` and locally owned shadcn/ui primitives in `src/components/ui/`, customized to match `habit-tracker.pen`. Import application code through `@/` (mapped to `src/` in TypeScript and Vite). Playwright tests live alongside their routes/server code in `__tests__/*.test.ts`; route generation ignores those folders.

## Run

Requires Node 22.12+ and pnpm 11.20.0 (pinned in `package.json`). Run `pnpm install --frozen-lockfile`, copy `.env.example` to `.env.local`, and set `VITE_PRIVACY_CONTACT_EMAIL` to a real monitored mailbox. This address appears publicly on `/privacy`; it is bundled at build time. Set the Google and server credentials below before using the app. `.env.local` is read by the development, build and start scripts; existing process environment variables take precedence. Local `.env*` files other than `.env.example` are ignored.

- `pnpm run dev` — development server on http://localhost:3000
- `pnpm run build` — production build (requires the contact at **build time**)
- `pnpm run start` — serve that build on port 3000 (`PORT` can override the port)
- `pnpm run typecheck` — TypeScript check after the router generates `src/routeTree.gen.ts`
- `pnpm exec playwright install chromium` — one-time browser installation
- `pnpm run smoke:browser` — launch the development server and exercise public privacy, Google authorization start, private Today, Task entry and first-load recovery in a mobile browser, plus a headless two-store sync check against the real authenticated routes
- `SMOKE_SERVER=production pnpm run smoke:browser` — exercise the same paths against a previously built server

The smoke runner owns port 3000 and supplies **test-only** OAuth configuration, a test-only privacy contact, and isolated SQLite data; it does not contact Google or create a public test login. It seeds Better Auth sessions outside the production app to test the private routes. Stop another local server on that port first. For public deployment provide the contact at build time and all server variables at runtime; keep the SQLite file and its WAL files on persistent storage. Runtime changes to `VITE_` values do not alter built assets.

Tasks live in IndexedDB per User, including Pending changes after a disconnect. An already-open Today view can create and read Tasks offline; offline page navigation/reload awaits the PWA shell in a later ticket. `POST /api/sync/push` and `GET /api/sync/pull?after=<seq>&limit=<1–100>` require a Better Auth session and scope every response to that User. The server migrates an existing auth-only SQLite database to the Task schema automatically at startup.

## Google sign-in configuration

Create a Google OAuth **web** client for each origin (local and public). Configure authorized JavaScript origins and redirect URIs `http://localhost:3000/api/auth/callback/google` and `https://<app-domain>/api/auth/callback/google` respectively. Set `BETTER_AUTH_URL` to exactly the app origin (no trailing slash; use `http://127.0.0.1:3000` if browsing there), `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the matching client's values, and `BETTER_AUTH_SECRET` to a high-entropy random string of at least 32 characters. Set `DATABASE_PATH` to a writable persistent SQLite path (default `.data/habit-tracker.sqlite`). The schema is initialized on first start with foreign keys and WAL enabled. Keep the same signing secret across restarts; do not prefix secrets with `VITE_`, which exposes them to browsers.

The browser smoke tests stub the external Google authorization page and inject real Better Auth test sessions. **Completing a live Google consent and callback requires operator-provided Google OAuth credentials and an authorized origin.** No passwords or example OAuth credentials are committed.

Never commit `.env.local`, other credentials, SQLite databases, generated output, or local test artifacts. The committed `pnpm-lock.yaml` pins the release set; use `pnpm install --frozen-lockfile`.
