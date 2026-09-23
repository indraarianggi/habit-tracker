# 04: Edit, complete, and order Tasks

**What to build:** A User changes a Task title, explicitly marks it complete or open, and moves it up or down within its Day; the plan stays stable across visits and devices.

**Blocked by:** 03: Create a Task locally and sync it.

**Status:** resolved

- [x] Rename a Task, including one that is complete or on a past Day, without moving its Day; reads of its focus history use the current title.
- [x] An explicit completion control toggles absolute complete/open states with no focused-time requirement; reopening preserves the Task's Day and Check-ins, and neither action reorders it.
- [x] Completed Tasks stay visible, struck through, with an accessible row announcing title, completion, and focused minutes; Task actions include rename, complete/reopen, move up and move down, with no Session play control in the Tasks list.
- [x] Move only the selected Task in its Day; appends and order-key ties produce a deterministic order on every device without renumbering other Tasks.
- [x] A headless check proves reversibility, immutable Day, and stable order; a browser check exercises the visible controls.

## Verification

`pnpm run typecheck`, `pnpm run build`, `pnpm run smoke:browser` (12 passed), and `SMOKE_SERVER=production pnpm run smoke:browser` (12 passed) completed on 2026-09-24. The headless check covers offline Pending changes, cross-device rename/reopen/reorder, server Day rejection, User isolation, and tied-key deterministic reads. The browser check covers menu actions, past-Day rename, reload, accessible rows, and no Session play control; the Tasks list and action sheet were visually inspected at 375×812 and 1024×768. Check-in storage/history is not present until later tickets; the edit operations keep Task identity and Day unchanged, and focused minutes are zero until Check-ins exist. Live Google consent/callback still requires the operator's OAuth web client credentials and authorized origin.
