---
status: accepted
---

# Single-node homelab with SQLite and Litestream

The server runs on one personal homelab machine (`fairy-vearth`) as a Docker Compose stack (Node app, Litestream), reached through the existing `cloudflared` tunnel and a single Caddy edge proxy shared by every project on that host — not a per-project Nginx. Data lives in a single SQLite file (WAL mode) that Litestream replicates continuously to off-site object storage (Cloudflare R2 or Backblaze B2) with 30 days of retention. We chose this because the expected scale is hundreds of Users with small data, the cost target is near zero, and a single writer makes the server-assigned sync sequence of [0001](0001-server-backed-multi-user-local-first.md) trivial. Local-first clients keep working when the server is down, so a home machine's uptime is acceptable.

## Considered options

- **Managed platform with a managed database.** Least operations work, but the running cost is higher than the near-zero target, and it ties the sync design to a vendor. Rejected.
- **Rented VPS with Postgres.** Standard and has room to grow, but adds a monthly cost, a database process to patch and back up, and headroom the app does not need at this scale. Rejected.
- **Homelab with Postgres.** Same operational weight as the VPS option without its uptime. Rejected in favour of SQLite.

## Consequences

- The database can only run on one node; scaling out or moving to Postgres later means a data migration.
- A homelab loses service to power or ISP outages. Clients keep working offline; only sync and starting a Pomodoro Session wait. Off-site replication is the only copy that survives a disk or house failure, so restore drills and an alert on replication age are part of running it.
- Deleting an account removes the User's rows immediately, but their data stays in backups until the 30-day retention window passes; the User is told so.
- The server is publicly reachable with open sign-up, so it sits on an isolated network, the tunnel is the only way in, and the per-IP rate limiter must trust the client IP header only from the one hop the shared Caddy edge injects — never a header arriving any other way.
- Releases go from GitHub Actions to GHCR, then to the server over SSH through the Cloudflare Tunnel, authenticated by a Cloudflare Access service token and a forced-command deploy key scoped to one redeploy call. Tailscale is reserved for the operator's own admin access and is never used for CI deploy. Schema migrations run when the app starts, before it accepts traffic.
