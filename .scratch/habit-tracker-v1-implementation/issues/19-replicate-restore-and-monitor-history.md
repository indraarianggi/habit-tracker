# 19: Replicate, restore, and monitor history

**What to build:** The operator can recover Users’ focus history after a node failure and learn when either the app or off-site replica stops being healthy.

**Blocked by:** 18: Serve the app securely from the homelab.

**Status:** ready-for-agent

- [ ] Continuously replicate the SQLite database off-site to R2 or B2 with 30-day retention; backups are not treated as immediately purged by account deletion, matching the User-facing warning.
- [ ] Provide a reproducible restore procedure, perform a pre-launch restore drill against representative Tasks, Check-ins, and settings, and specify quarterly repeats with a record of outcome.
- [ ] Alert when the public app stops responding or replica age exceeds the configured healthy bound; distinguish a healthy empty database from failed replication.
- [ ] A deliberate replica/restore smoke check compares recovered User history with the source and verifies an unhealthy replica-age signal.
