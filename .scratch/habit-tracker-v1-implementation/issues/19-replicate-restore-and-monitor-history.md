# 19: Replicate, restore, and monitor history

**What to build:** The operator can recover Users' focus history after a node failure and learn when either the app or the off-site replica stops being healthy.

**Blocked by:** 18: Serve the app securely from the homelab.

**Status:** ready-for-agent

- [ ] A Litestream sidecar (per ADR-0002) runs alongside the app container, continuously replicating the WAL-mode SQLite file to R2 or B2 with 30-day retention. This is additional to, not a replacement for, the host-wide nightly restic backup of `/opt/stack` that `docs/deployment-home-server.md` §9 already runs for every project on `fairy-vearth`.
- [ ] Backups are not treated as immediately purged by account deletion — deleted Users' rows stay in both Litestream generations and restic snapshots until the 30-day window passes, matching the User-facing warning.
- [ ] Provide a reproducible restore procedure (`litestream restore` from the R2/B2 generation as primary, `restic restore` of the nightly `/opt/stack` snapshot as fallback), perform a pre-launch restore drill against representative Tasks, Check-ins, and settings, and specify quarterly repeats with a record of outcome.
- [ ] Register `https://habit-tracker.<host>` with the external uptime monitor (§10) for "app stops responding." Add a separate heartbeat/age check for Litestream replication specifically — the generic restic heartbeat (§9) only covers the nightly host-wide backup, not this project's continuous replication — so a healthy-but-empty database is distinguishable from failed replication.
- [ ] A deliberate replica/restore smoke check compares recovered User history with the source and verifies the unhealthy replica-age signal fires correctly.

## Comments

**2026-10-20:** Tailored to `docs/deployment-home-server.md`. The guide's backup/monitoring sections (§9, §10) are generic, host-wide, and Postgres/dump-oriented — they don't conflict with ADR-0002's SQLite + Litestream continuous-replication choice, so Litestream stays as this project's own mechanism, layered on top of (not instead of) the free host-wide restic backup every project already gets. Added an explicit acceptance item for a Litestream-specific heartbeat, since the guide's one heartbeat pattern (healthchecks.io ping on the nightly backup job) doesn't by itself distinguish "continuous replication is stale" from "nightly backup succeeded."
