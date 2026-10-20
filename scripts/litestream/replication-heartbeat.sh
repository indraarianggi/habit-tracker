#!/usr/bin/env bash
# Litestream replication staleness heartbeat (ticket 19, ADR-0002).
#
# The host-wide restic heartbeat (docs/deployment-home-server.md §9) only
# proves the nightly backup *job ran* — it says nothing about whether this
# project's continuous off-site replication is actually keeping up. A
# `litestream replicate` process can stay alive (so a naive process-liveness
# ping would still fire) while every upload silently fails, leaving a
# healthy-looking but stale replica. This script instead asks the replica
# itself how fresh its newest file is, and only pings healthchecks.io when
# that is true — a dead man's switch: no recent-enough ping, and
# healthchecks.io alerts after its own grace period.
#
# Run on its own short-interval systemd timer, separate from backup.timer
# (see docs/replication-and-restore.md).
set -euo pipefail

: "${LITESTREAM_DB_PATH:=/app/.data/habit-tracker.sqlite}"
: "${LITESTREAM_CONFIG:=/etc/litestream.yml}"
: "${LITESTREAM_MAX_AGE_SECONDS:=600}"
: "${COMPOSE_FILE:=/opt/stack/apps/habit-tracker/compose.yaml}"
: "${HEALTHCHECKS_LITESTREAM_PING_URL:?set to the dedicated healthchecks.io check URL for replication staleness, separate from the backup check}"

latest=$(docker compose -f "$COMPOSE_FILE" exec -T litestream \
  litestream ltx -config "$LITESTREAM_CONFIG" -json -level all "$LITESTREAM_DB_PATH" \
  | jq -r 'if length == 0 then "" else (map(.timestamp) | max) end')

if [ -z "$latest" ]; then
  echo "no LTX files found in the replica yet — withholding heartbeat" >&2
  exit 1
fi

latest_epoch=$(date -d "$latest" +%s)
now_epoch=$(date +%s)
age=$(( now_epoch - latest_epoch ))

echo "newest remote LTX file is ${age}s old (threshold ${LITESTREAM_MAX_AGE_SECONDS}s, timestamp $latest)"

if [ "$age" -gt "$LITESTREAM_MAX_AGE_SECONDS" ]; then
  echo "replica is stale — withholding heartbeat so healthchecks.io alerts" >&2
  exit 1
fi

curl -fsS -m 10 --retry 5 "$HEALTHCHECKS_LITESTREAM_PING_URL" > /dev/null
