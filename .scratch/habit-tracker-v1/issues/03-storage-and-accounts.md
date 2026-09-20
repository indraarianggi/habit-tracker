# Storage and accounts

Type: grilling
Status: resolved

## Question

Where does the user's data live, and are there accounts?

Options to weigh: browser-only storage (no backend, single device, data lost if the browser is cleared) versus accounts with a backend (sync across devices, more to build and run).

Cover at least:

- Whether one user on one device is enough for v1.
- How data loss is handled if storage is browser-only.
- What accounts would need: sign-in method, hosting, privacy.
- What the choice means for a later move from one option to the other.

This decision shapes the tech stack. Reminders and notifications are out of scope for v1 (see the map), so they are no longer a factor.

## Answer

Server-backed, multi-user, local-first PWA. Browser-only storage is rejected; there is no later "migration" to plan for.

- **Users:** many Users, each with a row in a User table. Data is fully isolated per User; there are no sharing or social features in v1. Sign-in is Google only (OAuth); no passwords, so no password reset or email verification. Sign-up is open: a first Google sign-in creates the User.
- **Data safety:** history must never be lost, so it lives on the server and syncs across every device the User signs in on. Backups and retention are handed to [Tech stack and hosting](07-tech-stack-and-hosting.md).
- **Client:** an installable PWA. Every read and write, including a Check-in from a Pomodoro Session that ends offline, goes to the device first and syncs to the server in the background. The layout is mobile on every device, with a maximum width on desktop.
- **Conflicts:** Check-ins created on different devices never collide; all are kept. When the same record is changed twice, the change the server sees last wins (the server's ordering, not device clocks). A deletion beats an edit; deletions are recorded so they sync to other devices.
- **Pomodoro Session:** one active session per User, synced across devices; any device can stop it. Starting a session requires a connection ("for now"; revisit if it hurts). Offline, a running session can still finish, Check-ins can be entered manually and data can be read. This refines the "one active session" rule of [Pomodoro Session rules](01-pomodoro-session-rules.md) from per device to per User.
- **Sign-out:** allowed at any time. Changes not yet synced stay on the device, kept per User, and upload the next time that User signs in. Accepted trade-off: a User's unsynced data can remain on a shared device after sign-out.
- **Deferred:** deleting an account and its data, and server backup and retention.
- **Glossary:** added **User** to `CONTEXT.md`.
- **ADR:** recorded as [0001 Server-backed, multi-user, local-first sync](../../../docs/adr/0001-server-backed-multi-user-local-first.md).
