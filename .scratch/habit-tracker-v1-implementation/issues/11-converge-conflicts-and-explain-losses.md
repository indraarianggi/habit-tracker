# 11: Converge conflicting devices and explain losses

**What to build:** When devices change the same work independently, their records converge predictably; a lost Check-in or failed reassignment is explained without silently discarding unrelated Pending changes.

**Blocked by:** 04: Edit, complete, and order Tasks; 09: Record and correct manual Check-ins; 10: Delete a Task safely.

**Status:** ready-for-agent

- [ ] Later server-received whole-record edits win, including absolute completion and order; equal order keys break ties by Task identity. A deletion defeats later stale edit or restore, and repeated changes are idempotent.
- [ ] The server processes Pending changes in dependency order with per-change accepted/rejected outcomes; a rejected Task cannot acquire a Check-in and one stale change never freezes other Pending changes.
- [ ] A rejected new Check-in for a Task deleted elsewhere is removed locally and shows a dismissible notice with its minutes, Task title, and Day; edits already removed by an intentional Task cascade vanish silently.
- [ ] A rejected reassignment to a deleted Task leaves the accepted Check-in on its original Task and states that only the move failed, preserving focused minutes.
- [ ] Headless checks use two or more independent device stores and the real sync routes to prove convergence, cascade, idempotence, partial batch success, and both distinct failure notices.
