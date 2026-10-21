# Replication, restore, and monitoring (habit-tracker)

Ground truth for ticket 19 (`.scratch/habit-tracker-v1-implementation/issues/19-replicate-restore-and-monitor-history.md`)
and [ADR-0002](adr/0002-single-node-homelab-sqlite-litestream.md). Project-specific — unlike
`docs/deployment-home-server.md`, which is the generic, host-wide guide shared by every project on
`fairy-vearth`, this doc only concerns habit-tracker's own Litestream sidecar, layered **on top of**
(not instead of) that guide's host-wide nightly restic backup (§9) and uptime monitoring (§10).

## Why two backup mechanisms

| | Host-wide restic (§9) | This project's Litestream |
|---|---|---|
| Covers | All of `/opt/stack`, every project | Only `habit-tracker`'s SQLite file |
| Frequency | Nightly | Continuous (sub-second lag) |
| Worst-case data loss | Up to ~24h | Seconds |
| Heartbeat | One healthchecks.io ping per night | A dedicated staleness check (below) — process liveness alone can't prove uploads are succeeding |

Both exist. Restic is the fallback if Litestream itself is misconfigured or its bucket is
unreachable; Litestream is the primary because it bounds data loss to seconds instead of a day.

## 1. One-time setup (operator)

Needs hands on an R2/B2 dashboard, a healthchecks.io account, and SSH to `fairy-vearth` — an agent
has no credentials for any of these. Use the `wizard` skill to generate a fresh interactive script
for this; the one from ticket 18 was ephemeral and is gone.

### 1.1 Bucket and credentials

1. Create an object storage bucket for this project (Cloudflare R2 or Backblaze B2 — either works,
   ADR-0002 leaves the choice open). Suggested name: `habit-tracker-litestream`.
2. Create a scoped access key/secret for that bucket only (not the account-wide key used by
   `docs/deployment-home-server.md` §9's restic repository — a separate credential limits the
   blast radius of a leak to just this one bucket).
3. Note the S3-compatible endpoint and region:
   - **R2**: `https://<account-id>.r2.cloudflarestorage.com`, region `auto`.
   - **B2**: `https://s3.<region>.backblazeb2.com` (e.g. `us-west-002`), region matches that
     subdomain.

### 1.2 Server files

```bash
PROJECT=habit-tracker
```

Add to `/opt/stack/apps/$PROJECT/.env` (alongside the existing app config from ticket 18):

```bash
LITESTREAM_ENDPOINT=...                 # from 1.1
LITESTREAM_REGION=...                   # from 1.1
LITESTREAM_ACCESS_KEY_ID=...
LITESTREAM_SECRET_ACCESS_KEY=...
LITESTREAM_BUCKET=habit-tracker-litestream
```

Copy this repo's `litestream.yml` to the server:

```bash
install -m 0644 litestream.yml /opt/stack/apps/$PROJECT/litestream.yml
```

Add the sidecar service to `/opt/stack/apps/$PROJECT/compose.yaml` (written directly on the server
per `docs/deployment-home-server.md` §14.3 — that file isn't committed to this repo, so edit it
in place rather than looking for it here):

```yaml
services:
  web:
    # ...existing service from ticket 18, unchanged, except:
    volumes:
      - ./data:/app/.data

  litestream:
    image: litestream/litestream:0.5.17
    container_name: habit-tracker-litestream
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/app/.data
      - ./litestream.yml:/etc/litestream.yml:ro
    command: ['replicate']
    mem_limit: 128m
    security_opt:
      - no-new-privileges:true
```

`web` needs the same `./data:/app/.data` bind mount `litestream` uses so both containers see the
same SQLite file; if ticket 18's compose.yaml didn't already name that mount exactly this way,
match whatever path it actually bind-mounts instead. No `edge`/`db` network: the sidecar only needs
outbound internet to reach the bucket, never inbound traffic.

```bash
docker compose -f /opt/stack/apps/$PROJECT/compose.yaml config -q && echo OK
docker compose -f /opt/stack/apps/$PROJECT/compose.yaml up -d litestream
docker compose -f /opt/stack/apps/$PROJECT/compose.yaml logs -f litestream   # confirm it starts replicating, no auth errors
```

### 1.3 Replication-staleness heartbeat

1. Create a **second**, separate healthchecks.io check (distinct from §9's nightly-backup check) —
   e.g. "habit-tracker replication" — with a short period (a few minutes) and a grace window that
   tolerates one missed run.
2. Copy `scripts/litestream/replication-heartbeat.sh` from this repo to
   `/opt/stack/apps/$PROJECT/bin/replication-heartbeat.sh` on the server (`chmod 0755`).
3. `/etc/systemd/system/habit-tracker-replication-heartbeat.service`:

   ```ini
   [Unit]
   Description=habit-tracker Litestream replication staleness heartbeat
   After=docker.service

   [Service]
   Type=oneshot
   Environment=HEALTHCHECKS_LITESTREAM_PING_URL=https://hc-ping.com/<uuid-from-step-1>
   ExecStart=/opt/stack/apps/habit-tracker/bin/replication-heartbeat.sh
   ```

4. `/etc/systemd/system/habit-tracker-replication-heartbeat.timer`:

   ```ini
   [Unit]
   Description=Run the habit-tracker replication heartbeat every 5 minutes

   [Timer]
   OnCalendar=*:0/5
   Persistent=true

   [Install]
   WantedBy=timers.target
   ```

5. ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now habit-tracker-replication-heartbeat.timer
   sudo systemctl start habit-tracker-replication-heartbeat.service && journalctl -u habit-tracker-replication-heartbeat.service -n 20
   ```

   Requires `jq` on the server (`sudo apt install -y jq` if not already present for another
   project).

### 1.4 Uptime monitor

Register `https://habits.indraarianggi.xyz` with the external uptime monitor from
`docs/deployment-home-server.md` §10 (UptimeRobot, Better Stack, …) for "app stops responding" —
same step as ticket 18/§14.8 item 5, now actually executable once a first deploy exists (ticket 20).

## 2. Restore procedure

**Primary — Litestream from R2/B2:**

```bash
PROJECT=habit-tracker
cd /opt/stack/apps/$PROJECT
docker compose stop web                 # stop writes before restoring in place
docker compose exec -T litestream \
  litestream restore -config /etc/litestream.yml -o /app/.data/habit-tracker.sqlite.restored \
  /app/.data/habit-tracker.sqlite
# inspect/verify the restored copy (see §3) before replacing the live file
mv ./data/habit-tracker.sqlite ./data/habit-tracker.sqlite.bak
docker compose exec -T litestream mv /app/.data/habit-tracker.sqlite.restored /app/.data/habit-tracker.sqlite
docker compose up -d web
```

Add `-timestamp <RFC3339>` to restore to a point before a bad write instead of the latest state.

**Fallback — restic from the nightly host-wide snapshot** (if the Litestream bucket or its
credentials are the thing that's broken):

```bash
sudo sh -c 'set -a; . /etc/restic.env; restic snapshots'
sudo sh -c "set -a; . /etc/restic.env; restic restore latest --target /tmp/restore-test --include /opt/stack/apps/$PROJECT/data"
```

This recovers the file as of the last nightly backup (up to ~24h old), per
`docs/deployment-home-server.md` §9.

## 3. Restore drill

Required once before launch, then every quarter (calendar reminder — this doc has no automation
for the reminder itself).

1. Pick one representative User with real Tasks, Check-ins, and settings (or create one for this
   purpose).
2. Run the primary restore procedure (§2) against a scratch path, **not** the live file:

   ```bash
   docker compose exec -T litestream \
     litestream restore -config /etc/litestream.yml -o /tmp/drill-restore.sqlite \
     /app/.data/habit-tracker.sqlite
   docker compose cp litestream:/tmp/drill-restore.sqlite /tmp/drill-restore.sqlite
   ```

3. Run the smoke check from this repo:

   ```bash
   scripts/litestream/restore-smoke-check.sh \
     --source /opt/stack/apps/habit-tracker/data/habit-tracker.sqlite \
     --restored /tmp/drill-restore.sqlite \
     --user-id <the representative User's id>
   ```

4. Separately, confirm the unhealthy-replica-age signal actually fires: temporarily stop the
   `litestream` container, wait past `LITESTREAM_MAX_AGE_SECONDS` (default 600s), run
   `replication-heartbeat.sh` by hand and confirm it exits non-zero and does **not** ping
   healthchecks.io, then restart the container.
5. Record the outcome below — pass/fail, what (if anything) broke, and what changed as a result.

### Drill log

| Date | Outcome | Notes |
|---|---|---|
| 2026-10-21 | Pass | Pre-launch drill, against the operator's own real account (first live User). `litestream restore` from R2 → `/tmp/drill-restore.sqlite`, `restore-smoke-check.sh` confirmed Tasks/Check-ins/settings match source exactly. Staleness signal verified both ways: with Litestream healthy, `LITESTREAM_MAX_AGE_SECONDS=0` correctly reported the replica as stale and withheld the heartbeat ping (exit 1); the normal heartbeat run separately confirmed a fresh replica pings cleanly (exit 0). Next quarterly repeat: ~2027-01-21. |
