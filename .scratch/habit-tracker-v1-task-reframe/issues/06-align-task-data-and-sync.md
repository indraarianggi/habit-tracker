# Align task data and sync semantics

Type: grilling
Status: resolved
Blocked by: 02, 03, 04

## Question

How should the corrected Task, focus-history, and active-session records behave under the existing local-first, multi-device sync architecture?

Settle at least:

- The corrected record types and ownership relationships among User, Day, Task, focus record, settings, and active Pomodoro Session.
- Which task fields and state transitions sync, and which settings remain device-only.
- Conflicts when two devices edit, complete, move, or delete the same task.
- What happens when an offline device finishes a Session for a task moved or deleted elsewhere.
- Whether deletion removes focus history, detaches it, or is constrained by history.
- How exactly-once focus recording and one active Session per User survive the reframe.
- Whether server-ordered whole-record last-write-wins and tombstones remain sufficient or need a targeted adjustment.

Preserve the existing authentication, IndexedDB-first storage, server sequence, and single-node hosting decisions unless this model demonstrates a direct conflict.

## Answer

Resolved with the User in two grilling rounds:

- **Synced ownership and records.** A User owns Tasks, Check-ins, one synced settings record, and at most one active Pomodoro Session. Day remains a local-date value rather than a record. A Task carries stable identity, User, immutable Day, title, completion state, opaque manual-order key, creation metadata, and sync metadata. A Check-in carries stable identity, User, Task identity, duration, origin, optional source Session identity, and sync metadata; it derives Day exclusively from its Task. The active Session carries its target Task and the previously settled timer state.
- **Settings remain split.** Focus, short-Break, and long-Break durations continue to sync. The two sound toggles, Wake Lock preference, and theme remain device-only.
- **Whole-record conflict resolution remains.** Server-ordered whole-record last-write-wins applies to Task title, completion, and ordering state; completion is an absolute state, never a toggle operation. A Task never moves between Days. Copy creates an independent Task, so later deletion of the source cannot affect the copy.
- **Manual order converges through each Task.** Each Task has an opaque `orderKey`. Creation and Copy append after the last Task known to that device; reorder changes the moved Task. Concurrent changes to the same Task follow whole-record last-write-wins. Equal keys are ordered by stable Task identity, so concurrent creation or movement always converges deterministically without a separate per-Day order record or bulk renumbering.
- **Deletion remains authoritative and cascading.** Task deletion atomically creates the Task tombstone and tombstones all accepted Check-ins belonging to it. The tombstone defeats later Pending rename, completion, reorder, Check-in, or restore changes. A new Pending Check-in rejected because its Task was deleted is removed locally and produces a dismissible lost-focus banner. A rejected reassignment to a deleted target restores the accepted Check-in on its original Task and reports that the target change failed without losing focused time. Edits to Check-ins already removed by an intentional Task cascade lose silently.
- **An unresolved focus outcome protects its Task.** The server rejects Task deletion while its authoritative active Pomodoro Session still targets that Task and its focus outcome is unresolved, including while the originating device is offline. After save or discard finalizes, the Task is no longer protected; a subsequent Break does not extend the guard. This removes the deleted-target race for legitimate Session finalization.
- **Session finalization remains exactly once.** The server retains an internal finalization receipt keyed by Session identity while the User exists. The first terminal outcome accepted by the server—one Check-in or discard—wins. Receipt creation, optional Check-in creation, and release of the active Session are one transaction. Later retries or conflicting device outcomes are idempotent no-ops that receive the authoritative result. A Session-origin Check-in's source Session identity is unique. Receipts are server mechanics, not synced domain history.
- **One active Session remains server-enforced.** Start still requires connectivity and atomically validates that no other active Session exists for the User. Any device may finalize the authoritative Session; losing connectivity after Start does not stop local timing or prevent its terminal outcome from syncing later.
- **Temporal eligibility is evaluated when the action occurs.** The client enforces Task creation for Today or later, manual Check-ins for Today or past Tasks, and Session Start for a Today Task. Delayed sync does not re-evaluate those rules using receipt time. The server validates date syntax, ownership, relationships, duration, and tombstones. Online Start uses the initiating device's local Day rather than the homelab time zone. Task Day stays immutable.
- **Sync batches are not globally atomic.** Ordinary outbox changes are processed in client dependency order with an accepted or rejected result per change, so one stale change does not block unrelated Pending changes. Cross-record invariants remain transactional: Task deletion with its Check-in tombstones; Session finalization with its Check-in or discard receipt and active-Session release; and account deletion with all User data. A Check-in dependent on a newly created Task is sent after that Task and is rejected if the Task was not accepted.
- **Existing architecture stands.** IndexedDB-first writes, per-User local isolation, UUID client identities, server sequence ordering, pull pagination, tombstones, retry behavior, sign-out retention of Pending changes, account-deletion propagation, and single-node hosting remain unchanged.

No further decision ticket is needed. The corrected data contract, user stories, and multi-device test scenarios can now be written directly into the corrected specification.
