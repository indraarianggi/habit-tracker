#!/usr/bin/env bash
# Litestream restore smoke check (ticket 19, ADR-0002).
#
# `litestream restore` exiting 0 only proves it wrote a file — not that the
# file's contents match what was actually recorded. Run this after every
# restore (the pre-launch drill and each quarterly repeat; see
# docs/replication-and-restore.md) against one representative User's row
# set, comparing the restored copy to the live source database.
set -euo pipefail

usage() {
  echo "usage: $0 --source PATH --restored PATH --user-id ID" >&2
  exit 1
}

source_db=""
restored_db=""
user_id=""

while [ $# -gt 0 ]; do
  case "$1" in
    --source) source_db=$2; shift 2 ;;
    --restored) restored_db=$2; shift 2 ;;
    --user-id) user_id=$2; shift 2 ;;
    *) usage ;;
  esac
done

[ -n "$source_db" ] && [ -n "$restored_db" ] && [ -n "$user_id" ] || usage
[ -f "$source_db" ] || { echo "source database not found: $source_db" >&2; exit 1; }
[ -f "$restored_db" ] || { echo "restored database not found: $restored_db" >&2; exit 1; }

dump() {
  local db=$1
  sqlite3 "$db" <<SQL
.mode list
.separator '|'
select 'task', id, title, completed, day, orderKey from task where userId = '$user_id' order by id;
select 'checkin', id, taskId, durationMinutes, origin, createdAt from session_checkin where userId = '$user_id' order by id;
select 'settings', focusMinutes, shortBreakMinutes, longBreakMinutes from duration_settings where userId = '$user_id';
SQL
}

source_dump=$(dump "$source_db")
restored_dump=$(dump "$restored_db")

if [ "$source_dump" = "$restored_dump" ]; then
  echo "OK: restored history for user $user_id matches source"
  exit 0
fi

echo "MISMATCH: restored history for user $user_id differs from source" >&2
diff <(echo "$source_dump") <(echo "$restored_dump") >&2 || true
exit 1
