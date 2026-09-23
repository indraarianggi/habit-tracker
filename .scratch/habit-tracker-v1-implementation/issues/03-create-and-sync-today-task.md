# 03: Create a Task locally and sync it

**What to build:** A User types a Task title at the top of Today's list and presses Enter; the Task appears immediately on this device, survives disconnection, and arrives on another device without confusing first-load emptiness with lost data.

**Blocked by:** 02: Sign in and open a private Today view.

**Status:** resolved

- [x] Trim only surrounding whitespace, preserve capitalization, reject empty titles and titles over 120 characters with a clear message, and permit duplicate titles.
- [x] Today is the default Day; a new Task is incomplete, belongs permanently to Today, and appears at the end of the Day's list without an extra category, priority, or estimate.
- [x] A local Task write and its Pending change are atomic; offline creation remains readable, then an idempotent upload and paginated download deliver it to the same User on another device without exposing another User's data.
- [x] A new device shows “Loading your data…” until the first download finishes; interruption shows “Connect to the internet to load your data.” and “Try again”, then resumes on reconnect.
- [x] A headless check across two separate local stores and the real sync routes proves offline creation, resend, first-load recovery, and User isolation.

## Verification

`pnpm run typecheck`, `pnpm run smoke:browser` (9 passed), `pnpm run build`, and `SMOKE_SERVER=production pnpm run smoke:browser` (9 passed) completed on 2026-09-24. The browser smoke covers first-load interruption, retry, Enter creation, title errors, offline creation, reconnect upload and reload. The headless check uses separate IndexedDB stores with real authenticated sync routes, interrupted pagination, repeated upload and another User. The actual Today view was checked at phone and wide viewports. Live Google consent/callback still needs the operator's OAuth web client credentials and authorized origin; smoke uses test-only sessions. Offline navigation/reload of the app shell awaits the later PWA ticket; an already-loaded view reads and writes Tasks offline.
