# Habit Tracker

Tickets 01–07 publish `/privacy`, Google sign-in, a private Today view, local-first Task creation/editing, the Tasks planner, and focus Sessions for Today's Tasks. The Monday-start strip shows planned Days; an unfinished Task can be copied later without altering the source. Starting focus needs a connection and atomically reserves one active Session per User across devices. Pause excludes time; stopping under one minute discards focus, while a normal 25-minute finish records one Session-origin Check-in without completing its Task and shows an on-screen alert. After an elapsed interval away, the User chooses full, whole-minute partial, or no focus; a paused Session stays paused. The Check-in stays with its Task's Day and all devices converge on the first committed outcome. An already-started Session can finish offline; its outcome remains on the device until sync. Breaks, manual Check-ins, Progress, safe synced Task deletion, service-worker offline navigation, and account deletion belong to later tickets. The single TypeScript package uses React and TanStack Start in SPA mode; its production output includes a Node server.

UI styling uses Tailwind CSS v4 design tokens in `src/styles.css` and locally owned shadcn/ui primitives in `src/components/ui/`, customized to match `habit-tracker.pen`. Import application code through `@/` (mapped to `src/` in TypeScript and Vite). Playwright tests live alongside their routes/server code in `__tests__/*.test.ts`; route generation ignores those folders.

## Run

Requires Node 22.12+ and pnpm 11.20.0 (pinned in `package.json`). Run `pnpm install --frozen-lockfile`, copy `.env.example` to `.env.local`, and set `VITE_PRIVACY_CONTACT_EMAIL` to a real monitored mailbox. This address appears publicly on `/privacy`; it is bundled at build time. Set the Google and server credentials below before using the app. `.env.local` is read by the development, build and start scripts; existing process environment variables take precedence. Local `.env*` files other than `.env.example` are ignored.

- `pnpm run dev` — development server on http://localhost:3000
- `pnpm run build` — production build (requires the contact at **build time**)
- `pnpm run start` — serve that build on port 3000 (`PORT` can override the port)
- `pnpm run typecheck` — TypeScript check after the router generates `src/routeTree.gen.ts`
- `pnpm exec playwright install chromium` — one-time browser installation
- `pnpm run smoke:browser` — launch the development server and exercise privacy, auth, private Today, Task planning, Timer controls, offline finish, return-after-absence recovery, and once-only focus-end alert in a mobile browser; headless checks cover separate devices, paused sleep gaps, midnight Task Days, full/partial/discard outcomes, conflicting retries, elapsed-minute boundaries, and authenticated routes
- `SMOKE_SERVER=production pnpm run smoke:browser` — exercise the same paths against a previously built server

The smoke runner owns port 3000 and supplies **test-only** OAuth configuration, a test-only privacy contact, and isolated SQLite data; it does not contact Google or create a public test login. It seeds Better Auth sessions outside the production app to test the private routes. Stop another local server on that port first. For public deployment provide the contact at build time and all server variables at runtime; keep the SQLite file and its WAL files on persistent storage. Runtime changes to `VITE_` values do not alter built assets.

Tasks and focus state live in IndexedDB per User, including Pending Task changes and Session outcomes after disconnection. An already-open view can create, read, edit, and copy Tasks offline, and finish an already-started Session offline; offline page navigation/reload awaits the PWA shell in a later ticket. Tasks can be created for Today or a future Day, never a past Day. Copying an unfinished Task creates a distinct incomplete Task on a Day after its source and no earlier than Today. There is no automatic midnight rollover. User-facing synced deletion and its active-session guard belong to ticket 10. `POST /api/sync/push`, `GET /api/sync/pull?after=<seq>&limit=<1–100>`, and the authenticated `/api/session` read/start/control/finish endpoints scope data to the User. SQLite migrates existing databases through schema version 3 at startup.

## Google sign-in configuration

Create a Google OAuth **web** client for each origin (local and public). Configure authorized JavaScript origins and redirect URIs `http://localhost:3000/api/auth/callback/google` and `https://<app-domain>/api/auth/callback/google` respectively. Set `BETTER_AUTH_URL` to exactly the app origin (no trailing slash; use `http://127.0.0.1:3000` if browsing there), `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the matching client's values, and `BETTER_AUTH_SECRET` to a high-entropy random string of at least 32 characters. Set `DATABASE_PATH` to a writable persistent SQLite path (default `.data/habit-tracker.sqlite`). The schema is initialized on first start with foreign keys and WAL enabled. Keep the same signing secret across restarts; do not prefix secrets with `VITE_`, which exposes them to browsers.

The browser smoke tests stub the external Google authorization page and inject real Better Auth test sessions. **Completing a live Google consent and callback requires operator-provided Google OAuth credentials and an authorized origin.** No passwords or example OAuth credentials are committed.

Never commit `.env.local`, other credentials, SQLite databases, generated output, or local test artifacts. The committed `pnpm-lock.yaml` pins the release set; use `pnpm install --frozen-lockfile`.
