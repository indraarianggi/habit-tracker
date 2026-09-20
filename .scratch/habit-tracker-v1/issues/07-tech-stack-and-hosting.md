# Tech stack and hosting

Type: grilling
Status: resolved
Blocked by: 03, 04

## Question

Which framework, language, data layer and hosting does the app use?

Take the answers to Storage and accounts and Reliable browser timers as given. Cover at least:

- Front-end framework and language.
- Data layer implied by the storage decision.
- Where the app is hosted and deployed.
- Testing approach at a high level.
- How the app meets [Storage and accounts](03-storage-and-accounts.md): Google sign-in with a User table, a PWA that reads and writes to the device first and syncs in the background, server-ordered last-write-wins with deletion tombstones, and a synced active Pomodoro Session.
- Server data safety: backups and retention, since the decision is that history must not be lost. Also whether a User can delete their account and data (deferred from that ticket).

## Answer

Resolved with the user over three grilling rounds. No new vocabulary. Recorded as [0002 Single-node homelab with SQLite and Litestream](../../../docs/adr/0002-single-node-homelab-sqlite-litestream.md).

- **Client:** TypeScript, React and TanStack Start in SPA mode (static shell, UI rendered on the client). Local data in IndexedDB via Dexie (`liveQuery`), kept per User, with `navigator.storage.persist()` requested. Service worker for the shell and assets.
- **Server code:** TypeScript in the same repo through TanStack Start server routes and server functions; no separate backend language. One repo, one package, one shared contract module (Zod schemas) used by client and server.
- **Data layer:** SQLite in WAL mode through `better-sqlite3` and Drizzle.
- **Sync (built in-house, no sync engine):** client-generated UUIDv7 ids; a server-assigned `seq` on every change; the client pushes its outbox in batches whose changes carry their own ids, so resends are idempotent; the client pulls changes since its last `seq`, in pages; a deletion is a tombstone row (id and `seq`, no content) kept while the account exists; last-write-wins on the whole record, not per field. Sync endpoints are server routes (stable URLs, easy to test and rate-limit); the active Pomodoro Session and account deletion use server functions.
- **Auth:** Better Auth with the Google provider. A session lasts 7 days and is refreshed at most once a day when used. When the session expires or the device is offline, the app still opens on the last User's local data, changes queue, and a "sign in again to sync" banner shows; signing in as the same User uploads the queue, signing in as another User leaves it untouched ([Storage and accounts](03-storage-and-accounts.md)).
- **Hosting:** the user's own homelab, on an isolated network, running Docker Compose (Node app, Nginx, Litestream). The user already runs a `cloudflared` Compose stack and owns a domain; the app is reached through that tunnel, with no open router ports, and Nginx trusts the real-IP header only from `cloudflared`.
- **Release:** GitHub Actions builds the image to GHCR and deploys over SSH through Tailscale (limited ACL, a deploy-only account). Schema migrations run when the app starts, before it takes traffic.
- **Rate limiting:** in the app, in memory (one instance), per IP and per User; looser on sync endpoints than on sign-in.
- **Backups and retention:** Litestream replicates to R2 or B2 off-site, 30 days of retention. A restore is tested onto a clean machine before launch and every quarter, with a runbook. A healthchecks.io or UptimeRobot ping alerts when the homelab stops, plus a check on the age of the newest replica.
- **Account deletion (deferred from [Storage and accounts](03-storage-and-accounts.md)):** in v1, a self-serve "Delete account" removes the User and all their data, with confirmation and no undo. The data stays in backups until the retention window passes, and the User is told so, also in the privacy policy. Other devices of that User wipe all local data for them (including unsent changes) on the next sync, when the server reports the account gone, and return to sign-in; another User's local data on that device is untouched.
- **Testing:** Vitest for rules and the timestamp-based timer with a fake clock; multi-device sync tests against in-memory SQLite (offline, resend, delete versus edit); Playwright end to end with offline emulation and PWA install. iOS lock-screen behaviour and the alert sound are tested by hand on devices ([Reliable browser timers](04-reliable-browser-timers.md)). Coverage and CI gates are left to `to-spec` and `to-tickets`.
- **Risks carried to the build, not decided here:** TanStack Start's release status could not be confirmed from its docs, so pin the version; check that Better Auth works with TanStack Start and SQLite.
