# Habit Tracker

Tickets 01–05 publish `/privacy`, Google sign-in, a private Today view, local-first Task creation/editing, and a Tasks tab for planning Today or future Days. The Monday-start strip shows planned Days; an unfinished Task can be deliberately copied to a later Day without altering the source. IndexedDB writes and Pending changes are atomic; authenticated sync uploads idempotently and downloads in pages. A new device holds the loading screen until its first download finishes. Focus sessions, Check-ins, Progress, safe synced Task deletion, service-worker offline navigation, and account deletion belong to later tickets. The single TypeScript package uses React and TanStack Start in SPA mode; its production output includes a Node server.

UI styling uses Tailwind CSS v4 design tokens in `src/styles.css` and locally owned shadcn/ui primitives in `src/components/ui/`, customized to match `habit-tracker.pen`. Import application code through `@/` (mapped to `src/` in TypeScript and Vite). Playwright tests live alongside their routes/server code in `__tests__/*.test.ts`; route generation ignores those folders.

## Run

Requires Node 22.12+ and pnpm 11.20.0 (pinned in `package.json`). Run `pnpm install --frozen-lockfile`, copy `.env.example` to `.env.local`, and set `VITE_PRIVACY_CONTACT_EMAIL` to a real monitored mailbox. This address appears publicly on `/privacy`; it is bundled at build time. Set the Google and server credentials below before using the app. `.env.local` is read by the development, build and start scripts; existing process environment variables take precedence. Local `.env*` files other than `.env.example` are ignored.

- `pnpm run dev` — development server on http://localhost:3000
- `pnpm run build` — production build (requires the contact at **build time**)
- `pnpm run start` — serve that build on port 3000 (`PORT` can override the port)
- `pnpm run typecheck` — TypeScript check after the router generates `src/routeTree.gen.ts`
- `pnpm exec playwright install chromium` — one-time browser installation
- `pnpm run smoke:browser` — launch the development server and exercise privacy, auth, private Today, Task entry/editing, week navigation, future planning, and copy-forward in a mobile browser; headless checks cover two-store sync, copy restrictions, source preservation, and authenticated routes
- `SMOKE_SERVER=production pnpm run smoke:browser` — exercise the same paths against a previously built server

The smoke runner owns port 3000 and supplies **test-only** OAuth configuration, a test-only privacy contact, and isolated SQLite data; it does not contact Google or create a public test login. It seeds Better Auth sessions outside the production app to test the private routes. Stop another local server on that port first. For public deployment provide the contact at build time and all server variables at runtime; keep the SQLite file and its WAL files on persistent storage. Runtime changes to `VITE_` values do not alter built assets.

Tasks live in IndexedDB per User, including Pending changes after a disconnect. An already-open view can create, read, edit, and copy Tasks offline; offline page navigation/reload awaits the PWA shell in a later ticket. Tasks can be created for Today or a future Day, never a past Day. Copying an unfinished Task creates a distinct incomplete Task on a Day after its source and no earlier than Today. There is no automatic midnight rollover. User-facing synced deletion and its active-session guard belong to ticket 10. `POST /api/sync/push` and `GET /api/sync/pull?after=<seq>&limit=<1–100>` require a Better Auth session and scope every response to that User. The server migrates an existing auth-only SQLite database to the Task schema automatically at startup.

## Google sign-in configuration

Create a Google OAuth **web** client for each origin (local and public). Configure authorized JavaScript origins and redirect URIs `http://localhost:3000/api/auth/callback/google` and `https://<app-domain>/api/auth/callback/google` respectively. Set `BETTER_AUTH_URL` to exactly the app origin (no trailing slash; use `http://127.0.0.1:3000` if browsing there), `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the matching client's values, and `BETTER_AUTH_SECRET` to a high-entropy random string of at least 32 characters. Set `DATABASE_PATH` to a writable persistent SQLite path (default `.data/habit-tracker.sqlite`). The schema is initialized on first start with foreign keys and WAL enabled. Keep the same signing secret across restarts; do not prefix secrets with `VITE_`, which exposes them to browsers.

The browser smoke tests stub the external Google authorization page and inject real Better Auth test sessions. **Completing a live Google consent and callback requires operator-provided Google OAuth credentials and an authorized origin.** No passwords or example OAuth credentials are committed.

Never commit `.env.local`, other credentials, SQLite databases, generated output, or local test artifacts. The committed `pnpm-lock.yaml` pins the release set; use `pnpm install --frozen-lockfile`.
