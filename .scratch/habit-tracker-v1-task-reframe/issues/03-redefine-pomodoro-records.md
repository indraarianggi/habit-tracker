# Redefine Pomodoro records around tasks

Type: grilling
Status: resolved
Blocked by: 01

## Question

How do Pomodoro Sessions and manually recorded focus relate to a concrete Day-specific task?

Settle at least:

- Whether one task can receive multiple Pomodoro Sessions and whether a Session can ever be unassigned.
- What a normally finished, stopped-early, paused, recovered, or discarded Session changes on the task.
- Whether finishing a Pomodoro marks the task complete, leaves completion independent, or asks the User.
- What historical record replaces or retains the old Check-in concept, including its Day, duration, origin, and task relationship.
- Whether manual focus recording remains, and whether focused time can be added to completed, deleted, moved, past, or future tasks.
- Which Day owns a Session that crosses midnight or is recovered later.
- What the Timer preselects now that tasks are Day-specific.
- Exactly-once and one-active-session invariants that should remain from the old specification.

Preserve the settled timer mechanics unless the task relationship directly requires a change.

## Answer

Resolved with the User in three grilling rounds:

- **Check-in remains the focus record.** One Check-in retains one burst of focused work against exactly one Task. It has a positive whole-minute duration, an origin of `session` or `manual`, and the same Day as its Task. A Task may have any number of Check-ins.
- **Session assignment.** Every Pomodoro Session must target exactly one Task belonging to Today; unassigned Sessions do not exist. The Task may be complete or incomplete. A live Session cannot start against a past or future Task.
- **Task completion stays independent.** Finishing, stopping, recovering, or discarding a Session never changes Task completion. Completing or reopening a Task does not stop its active Session.
- **Normal and early finalization.** A normal finish automatically creates one Check-in for the planned focus duration. Pause and resume create nothing. Stopping before one full minute discards the Session without prompting; after at least one minute, the User saves the elapsed whole minutes as one Check-in or discards them.
- **Recovery and Breaks.** Recovery after absence retains the existing full, partial-minutes, or none choice. Full or partial creates one Check-in; none creates nothing. Choosing, skipping, or completing a Break never changes the Task or its Check-ins.
- **Day ownership.** A Check-in always inherits its Task's Day. A Session crossing midnight or finalized through later recovery still records its Check-in on the Task's Day; focus is not split across Days.
- **Manual focus.** Manual Check-ins remain available for an existing Task belonging to Today or a past Day, whether complete or incomplete. Future and deleted Tasks are ineligible. The User cannot create a past Task through manual recording, and does not select the Check-in Day separately.
- **Corrections.** A manual or Session-origin Check-in may be reassigned to any eligible Today or past Task and may have its duration corrected. Reassignment makes it inherit the replacement Task's Day. Origin and Day are not directly editable. Deleting a Check-in requires confirmation, does not affect Task completion, and does not reopen or re-finalize its source Session.
- **Validation.** Check-in duration is a whole number from 1 through 480 minutes. Check-ins have no note, start time, end time, or independent status.
- **Timer preselection.** The Timer first reuses the most recently Session-used Task if it belongs to Today. Otherwise it selects Today's first incomplete Task in manual order, then the first Task if all are complete. With no Task Today, nothing is selected and the empty state offers Task creation.
- **Cross-device invariants remain.** At most one running or paused Session exists per User across all devices. Starting requires connectivity; an active Session can be seen and stopped from another device, continues through a later connectivity loss, and finalizes exactly once as one Check-in or one discard outcome.

Consequences handed forward: focus aggregation and history meaning continue in [Redefine focus progress without recurring Habits](04-redefine-focus-progress.md); interaction details continue in [Prototype the task-first daily workflow](05-prototype-task-first-workflow.md); persistence, conflict, and deleted-target behavior continue in [Align task data and sync semantics](06-align-task-data-and-sync.md).
