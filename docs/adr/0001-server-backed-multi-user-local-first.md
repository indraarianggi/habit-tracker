---
status: accepted
---

# Server-backed, multi-user, local-first sync

The app stores each User's data on a server and syncs it across their devices, instead of keeping it only in the browser. Users sign in with Google (open sign-up) and are fully isolated from each other. The client is an installable PWA that reads and writes to the device first and syncs in the background, so it works offline. We chose this because a User's history (Streaks, Activity Grid) is the point of the app and must not be lost when a browser is cleared or a device is replaced.

## Considered options

- **Browser-only storage, single device.** Simplest to build, but loses history when the browser clears site data (Safari also evicts data from sites left unopened) and cannot sync across devices. Rejected because losing history was ruled unacceptable.
- **Server-backed but online-first.** Simpler sync, but a Pomodoro Session that ends without a connection could lose its Check-in. Rejected in favour of local-first.
- **Email and password sign-in.** Rejected for v1: it needs password reset and email verification, and without a reset, a forgotten password loses the history.

## Consequences

- Concurrent offline edits to the same record are resolved by last-write-wins in server order, and a deletion beats an edit. Deletions must be recorded so they reach other devices.
- There is one active Pomodoro Session per User, synced across devices. Starting one requires a connection; revisit if that hurts.
- Unsynced changes stay on the device per User after sign-out, so they can remain on a shared device.
- Backups, retention and account deletion are not yet decided (see the map's Tech stack and hosting ticket).
