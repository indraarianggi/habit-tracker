# Habit Tracker

Plan Tasks, run focus Sessions, and see your consistency — on any device, even offline.

Habit Tracker is a local-first, server-synced Pomodoro and task app. Users sign in with Google and get a private, per-account Today view; Tasks and Check-ins are created and edited offline in IndexedDB and sync to a shared SQLite backend in the background. Domain vocabulary (User, Task, Check-in, Pomodoro Session, Day, Focus Streak, …) is defined once in [`CONTEXT.md`](./CONTEXT.md) — read that before touching domain logic.

## Status

Implemented: sign-in, Today (create/edit/complete/reorder/delete Tasks, plan ahead, copy work forward), Pomodoro Sessions with Breaks, manual Check-ins, multi-device sync with conflict convergence and recovery, the Activity Grid and Progress stats, per-device/device-synced Settings, deliberate account deletion, and the installable offline PWA shell.

Not yet built: production hosting, backup/replication/monitoring, and CI-gated deploys (see [`docs/adr/0002-single-node-homelab-sqlite-litestream.md`](./docs/adr/0002-single-node-homelab-sqlite-litestream.md) for the target design). Implementation tickets and their acceptance criteria live under [`.scratch/habit-tracker-v1-implementation/issues/`](./.scratch/habit-tracker-v1-implementation/issues/).

## Features

- **Sign-in** — Google OAuth via Better Auth; every User's data is fully isolated.
- **Today** — create, edit, complete, reorder and delete Tasks for Today or a future Day; copy unfinished work forward without moving the original.
- **Focus** — Pomodoro Sessions with short/long Breaks, Wake Lock, sound alerts, and recovery after the tab sleeps or closes mid-session.
- **Check-ins** — add, edit, reassign or delete focused-time records by hand; a Check-in always inherits its Task's Day.
- **Progress** — an accessible Activity Grid (Monday-start weeks, 3/6-month views, keyboard and touch navigation, light/dark contrast-checked), all-time Focus Streaks, and a Day panel to inspect or amend history.
- **Settings** — Pomodoro durations sync across devices; sound, Wake Lock and theme stay per-device.
- **Account deletion** — an online-only, typed-confirmation Danger Zone that atomically removes a User's data and propagates to every signed-in device.
- **Offline / installable** — a service-worker shell precaches the app and privacy policy; install prompts and version updates never interrupt a running focus interval.
- **Sync recovery** — offline work, failed-sync backoff, sign-out with Pending changes, and expired-session resumption all keep this device's data intact.

## Tech stack

- [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) (React 19), file-based routes under `src/routes/`
- [Better Auth](https://www.better-auth.com/) for Google OAuth and sessions
- [Dexie](https://dexie.org/) (IndexedDB) on the client for offline-first storage
- `better-sqlite3` on the server, migrated in-process at startup (see `src/server/db.ts`)
- Tailwind CSS v4 design tokens (`src/styles.css`) + locally owned shadcn/ui primitives (`src/components/ui/`), matching `habit-tracker.pen`
- [Playwright](https://playwright.dev/) for both browser journeys and headless server/multi-device checks

## Getting started

### Prerequisites

Node 22.12+ and pnpm 11.20.0, pinned in `package.json`.

### Install

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
```

`.env.local` is read by the dev, build and start scripts; real process environment variables take precedence, and only `.env.example` is tracked in git.

### Configure environment

| Variable | Required for | Notes |
|---|---|---|
| `VITE_PRIVACY_CONTACT_EMAIL` | dev, build | A real, monitored inbox. Shown publicly on `/privacy` and bundled at **build time** — runtime changes don't affect already-built assets. |
| `BETTER_AUTH_URL` | live Google sign-in | The exact app origin, no trailing slash (use `http://127.0.0.1:3000` if you browse there). |
| `BETTER_AUTH_SECRET` | live Google sign-in | Random string, 32+ characters. Keep it stable across restarts. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | live Google sign-in | From the OAuth client below. Never prefix secrets with `VITE_` — that exposes them to the browser. |
| `DATABASE_PATH` | optional | Writable, persistent SQLite path. Defaults to `.data/habit-tracker.sqlite`; parent directory is created automatically. |

### Google sign-in configuration

Create a Google OAuth **web** client per origin (local and public):

1. Authorized JavaScript origin: your app origin.
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (local) or `https://<app-domain>/api/auth/callback/google` (public).
3. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to that client's values.

The Playwright smoke suite stubs the external Google consent screen and injects real Better Auth test sessions — it never contacts Google or creates a public test login. Completing a **live** Google consent flow requires your own OAuth credentials and an authorized origin; no example credentials are committed.

### Run it

```sh
pnpm run dev          # http://localhost:3000
```

## Scripts

| Command | Does |
|---|---|
| `pnpm run dev` | Development server on `http://localhost:3000`. |
| `pnpm run build` | Production build. Requires `VITE_PRIVACY_CONTACT_EMAIL` at build time. |
| `pnpm run start` | Serve that build on port 3000 (`PORT` overrides). |
| `pnpm run typecheck` | `tsc --noEmit`, after the router generates `src/routeTree.gen.ts`. |
| `pnpm exec playwright install chromium` | One-time browser install for the smoke suite. |
| `pnpm run smoke:browser` | Full Playwright suite: browser journeys (offline/reconnect, sign-in expiry, sync recovery, sign-out with Pending changes, account switching, account deletion, PWA install/update) plus headless multi-device/server checks (sync isolation, conflict convergence, focus/session state). |
| `SMOKE_SERVER=production pnpm run smoke:browser` | Same suite against a previously built (`pnpm run build`) server — needed for the two PWA tests that only exercise meaningfully against real per-route SSR. |

The smoke runner owns port 3000 and supplies test-only OAuth config, a test-only privacy contact, and isolated SQLite data — stop any other local server on that port first.

## Testing

Tests are colocated Playwright specs in `__tests__/*.test.ts` next to the routes or modules they cover (see `docs/agents/testing.md`), and the router ignores those folders when generating routes. Run `pnpm run typecheck && pnpm run smoke:browser` before opening a PR; a handful of PWA specs additionally need `SMOKE_SERVER=production pnpm run smoke:browser` since dev doesn't SSR per-route.

## How data flows

- **Offline-first sync.** Tasks, Check-ins, Session state and Settings are created and edited in IndexedDB first, then pushed through `POST /api/sync/push` / `GET /api/sync/pull` scoped to the signed-in User. Conflicts resolve last-write-wins in server-received order, with deletions beating stale edits.
- **Sync recovery.** The header hides sync status when current; failed pushes back off exponentially, capped at five minutes, and retry immediately on reconnect, on returning to the app, or via "Sync now." An expired sign-in keeps local data readable/editable, and signing back into the same account uploads its Pending changes.
- **Account deletion.** The Danger Zone is online-only and requires typing `DELETE`; the server tombstones and atomically cascades the delete, and every other signed-in device recognizes "account gone" (HTTP 410) distinctly from an ordinary expired session (401) on its next sync.
- **Offline shell.** A hand-rolled service worker (`public/sw.js`) precaches the shell, `/today` and `/privacy`; updates wait for user consent and are gated off while a focus interval is running or paused.

## Project structure

```
src/
  routes/        file-based routes (TanStack Router) — today.tsx, privacy.tsx, api/*
  components/    screen-level React components + shadcn/ui primitives (components/ui/)
  lib/           client stores, sync clients, contracts shared with the server
  server/        SQLite access, migrations, auth config, account deletion
docs/
  adr/           architecture decisions (sync design, hosting)
  agents/        conventions for AI coding agents working in this repo
.scratch/        feature specs and per-ticket implementation status
```

## Further reading

- [`AGENTS.md`](./AGENTS.md) — conventions for AI coding agents contributing here (issue tracker, triage labels, UI/code/testing conventions).
- [`CONTEXT.md`](./CONTEXT.md) — the domain model and vocabulary.
- [`docs/adr/`](./docs/adr/) — why the app is server-backed and local-first, and the planned single-node/SQLite/Litestream hosting design.

## Security

Never commit `.env.local`, other credentials, SQLite databases, generated output, or local test artifacts. The committed `pnpm-lock.yaml` pins the exact dependency set — always install with `pnpm install --frozen-lockfile`.
