# Testing

Rules for writing or changing tests, and for running the suite. The runner is Playwright — there is no unit-test runner.

## Location and naming

Tests colocate with the code under test as `__tests__/*.test.ts`: route tests in `src/routes/__tests__/`, server tests in `src/server/__tests__/`. Playwright discovers them via `testDir: './src'` + `testMatch: '**/__tests__/*.test.ts'` and resolves `@/` imports from `tsconfig.json` paths on its own.

The `__tests__` folder is load-bearing: route generation ignores it through `routeFileIgnorePattern: '__tests__'` (vite.config.ts), and that pattern matches directory basenames — a test file sitting directly in `src/routes/` is not ignored and leaks into route generation. Keep every test inside a `__tests__/` folder.

## Hermetic suite

`playwright.config.ts` sets the full environment before any worker imports `@/server/auth`: `BETTER_AUTH_*`, test-only Google client credentials, `DATABASE_PATH: .data/browser-smoke.sqlite`, and `VITE_PRIVACY_CONTACT_EMAIL` (a test address — `vite.config.ts` throws at config load without it). Any newly required env var joins that block; the suite stays independent of any developer's `.env.local`.

## Auth fixtures

- Derive user emails from `crypto.randomUUID()` (`alice-smoke-${crypto.randomUUID()}@invalid.test`). Fixed emails collide with rows an aborted run left behind (`user.email` is unique) and fail the next run for an unrelated reason.
- Clean up with `helpers.deleteUser(...)` in `finally`. Row mutation goes through `authOptions.database` (see `code-conventions.md`, server modules).

## What to assert

Observable behavior only: roles, visible text, API status codes, layout invariants (`scrollWidth <= innerWidth`). CSS class names are implementation detail — styling is free to change under them. New protected routes get the standard treatment: an unauthenticated request returns 401, and each User's data stays isolated from every other User's.

## Running

`pnpm run smoke:browser` boots the dev server itself (it owns port 3000 — stop other local servers first) and runs every `src/**/__tests__/*.test.ts`; `SMOKE_SERVER=production` runs the same paths against a built server. README holds the full command matrix.
