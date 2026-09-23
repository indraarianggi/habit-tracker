# 10: Delete a Task safely

**What to build:** A User permanently deletes an unwanted Task with an accurate warning, while a Task receiving unresolved focus remains protected on this and other devices.

**Blocked by:** 06: Run and control a focus interval; 09: Record and correct manual Check-ins.

**Status:** ready-for-agent

- [ ] Confirmation names the Task and, where applicable, the real Check-in count and total focused minutes; cancellation leaves everything unchanged.
- [ ] Confirmation atomically deletes the Task and its accepted Check-ins with deletion records so every device removes both; no orphan Check-in or aggregate remains.
- [ ] Local controls say “Stop or finish the session first” for a running or paused Session targeting that Task; rename, reorder, completion, and Copy remain available.
- [ ] The server rejects deletion while its authoritative Session focus outcome is unresolved even if the originating device is offline; a finalized save or discard releases the guard, and a following Break does not extend it.
- [ ] A headless multi-device check proves the offline-owner guard, atomic cascade and release after finalization; a browser check covers warning and blocked action.
