# 10: Delete a Task safely

**What to build:** A User permanently deletes an unwanted Task with an accurate warning, while a Task receiving unresolved focus remains protected on this and other devices.

**Blocked by:** 06: Run and control a focus interval; 09: Record and correct manual Check-ins.

**Status:** resolved

- [x] Confirmation names the Task and, where applicable, the real Check-in count and total focused minutes; cancellation leaves everything unchanged.
- [x] Confirmation atomically deletes the Task and its accepted Check-ins with deletion records so every device removes both; no orphan Check-in or aggregate remains.
- [x] Local controls say “Stop or finish the session first” for a running or paused Session targeting that Task; rename, reorder, completion, and Copy remain available.
- [x] The server rejects deletion while its authoritative Session focus outcome is unresolved even if the originating device is offline; a finalized save or discard releases the guard, and a following Break does not extend it.
- [x] A headless multi-device check proves the offline-owner guard, atomic cascade and release after finalization; a browser check covers warning and blocked action.

## Verification

`pnpm run typecheck`, `pnpm run build`, `pnpm run smoke:browser` (54 passed), and `SMOKE_SERVER=production pnpm run smoke:browser` (54 passed) on 2026-09-25. Headless checks cover offline-owner rejection, save/discard release, Break non-blocking behavior, Check-in tombstones and cascading removal on independent devices, replay, access isolation, and queued offline finalization before deletion. Browser checks cover actual warning totals, cancellation, running/paused local guard, and eventual removal. Phone (375×812) and wide (1024×768) warning screenshots were inspected. Live Google consent/callback still requires the operator's OAuth web client credentials and an authorized origin; browser tests use isolated test credentials.
