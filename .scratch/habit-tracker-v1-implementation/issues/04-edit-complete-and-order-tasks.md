# 04: Edit, complete, and order Tasks

**What to build:** A User changes a Task title, explicitly marks it complete or open, and moves it up or down within its Day; the plan stays stable across visits and devices.

**Blocked by:** 03: Create a Task locally and sync it.

**Status:** ready-for-agent

- [ ] Rename a Task, including one that is complete or on a past Day, without moving its Day; reads of its focus history use the current title.
- [ ] An explicit completion control toggles absolute complete/open states with no focused-time requirement; reopening preserves the Task's Day and Check-ins, and neither action reorders it.
- [ ] Completed Tasks stay visible, struck through, with an accessible row announcing title, completion, and focused minutes; Task actions include rename, complete/reopen, move up and move down, with no Session play control in the Tasks list.
- [ ] Move only the selected Task in its Day; appends and order-key ties produce a deterministic order on every device without renumbering other Tasks.
- [ ] A headless check proves reversibility, immutable Day, and stable order; a browser check exercises the visible controls.
