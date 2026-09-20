# Decide the daily task lifecycle

Type: grilling
Status: resolved
Blocked by: 01

## Question

How is a Day-specific task created, ordered, completed, left unfinished, moved, copied, edited, and removed across Days?

Settle at least:

- Which Days can receive new tasks: today only, future Days, and/or past Days.
- The default Day and the primary planning horizon shown to the User.
- Whether completion is manual, automatic, or both, and whether focused minutes are required for completion.
- What happens at midnight to unfinished tasks: remain on their original Day, move, copy, or prompt the User.
- Whether moving versus copying preserves focus history, and how an overdue or unfinished item appears later.
- Ordering and reordering within a Day.
- Edit, delete, and any archive/history behavior that replaces the old Habit lifecycle.
- Empty-Day and no-task scenarios.

Keep recurrence, repeating templates, schedules, frequency targets, and reminders out of scope.

## Answer

Resolved with the User in three grilling rounds:

- **Creation and planning horizon.** A Task can be created for Today or any future Day, never for a past Day. Today is the default and primary planning view. Past Days remain viewable but offer no create action.
- **Completion.** Completion remains the explicit, reversible toggle settled in [Define the daily focus item](01-define-daily-focus-item.md). It requires no focused minutes. Reopening a Task preserves its Day and all focused-time history.
- **End of Day.** An unfinished Task stays on its original Day indefinitely. Midnight does not move, copy, complete, or prompt about it.
- **No Move.** A Task never changes Day. There is no Move action or free editing of the Day field.
- **Copy forward.** Copy creates a distinct, incomplete Task containing only the source title; completion and focused-time history are not copied, and the source remains unchanged. The destination must be later than the source Day and cannot be earlier than Today. Thus yesterday can copy to Today, Today can copy only to tomorrow or later, and a future Task can copy only to a later future Day.
- **Editing.** Title and completion can be corrected on any Task, including completed Tasks and Tasks on past Days. Day cannot be edited.
- **Ordering.** Each Day has a stable manual order. New and copied Tasks append to the end. Completion and reopening never reorder a Task.
- **History and archive.** Completed and unfinished Tasks remain visible as part of their Day's history. There is no archive, restore, trash, or automatic rollover.
- **Deletion.** Delete is permanent and always asks for confirmation. With no focus records, the confirmation names the Task. With focus records, it also names the record count and total minutes; confirmation deletes the Task and all related focus records.
- **Active Session guard.** While a Task has a running or paused Pomodoro Session, rename, reorder, completion toggle, and Copy remain allowed. Delete is blocked. Completing the Task does not stop its Session.
- **Empty Days.** Today and future empty states offer direct Task creation without separate onboarding. A past empty Day shows a neutral no-Tasks message and no create action. A User with no Tasks sees the ordinary Today empty state.

No new decision ticket is needed. Session-record details and the active-session interaction continue in [Redefine Pomodoro records around tasks](03-redefine-pomodoro-records.md); final layout and copy continue in [Prototype the task-first daily workflow](05-prototype-task-first-workflow.md).
