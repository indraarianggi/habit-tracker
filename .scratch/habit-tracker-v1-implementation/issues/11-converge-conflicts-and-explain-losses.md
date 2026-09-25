# 11: Converge conflicting devices and explain losses

**What to build:** When devices change the same work independently, their records converge predictably; a lost Check-in or failed reassignment is explained without silently discarding unrelated Pending changes.

**Blocked by:** 04: Edit, complete, and order Tasks; 09: Record and correct manual Check-ins; 10: Delete a Task safely.

**Status:** resolved

- [x] Later server-received whole-record edits win, including absolute completion and order; equal order keys break ties by Task identity. A deletion defeats later stale edit or restore, and repeated changes are idempotent.
- [x] The server processes Pending changes in dependency order with per-change accepted/rejected outcomes; a rejected Task cannot acquire a Check-in and one stale change never freezes other Pending changes.
- [x] A rejected new Check-in for a Task deleted elsewhere is removed locally and shows a dismissible notice with its minutes, Task title, and Day; edits already removed by an intentional Task cascade vanish silently.
- [x] A rejected reassignment to a deleted Task leaves the accepted Check-in on its original Task and states that only the move failed, preserving focused minutes.
- [x] Headless checks use two or more independent device stores and the real sync routes to prove convergence, cascade, idempotence, partial batch success, and both distinct failure notices.

## Verification

`pnpm run typecheck`, `pnpm run build`, `pnpm run smoke:browser` (61 passed), and `SMOKE_SERVER=production pnpm run smoke:browser` (61 passed) on 2026-09-25. Real-route headless checks use independent IndexedDB stores and authenticated sessions to cover server-received whole-record order, tombstones, replay, per-change outcomes, Task-before-Check-in dependency, intentional cascades, stale edits, and distinct loss notices. A two-browser-context check confirms each dismissible notice, retained original focused minutes, and no horizontal overflow at 375×812 and 1024×768; both banner layouts were visually inspected. Live Google consent/callback still requires the operator's OAuth web client credentials and an authorized origin; checks use isolated test credentials.
