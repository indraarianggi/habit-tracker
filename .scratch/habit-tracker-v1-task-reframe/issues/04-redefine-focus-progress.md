# Redefine focus progress without recurring Habits

Type: grilling
Status: resolved
Blocked by: 02, 03

## Question

What should Progress mean when the tracked items are one-off daily tasks rather than recurring Habit labels?

Settle at least:

- Whether the Activity Grid remains based on focused minutes, task completion, or a clearly defined combination.
- Whether an overall focus Streak is still useful and what event keeps it alive.
- Which old per-Habit filters and statistics disappear, and what—if anything—replaces them.
- Whether Users need a useful historical view of task titles, completed versus unfinished tasks, and focus records for a selected Day.
- Which totals belong to a selected range: focused time, Pomodoro count, completed tasks, active Days, or others.
- How deleted or moved tasks affect history and aggregates.
- What the Progress empty states should communicate.

Keep the history surface simple and aligned with the stated goal: see what received focus on each Day, not simulate recurring Habit analytics over one-off tasks.

## Answer

Resolved with the User in three grilling rounds:

- **Progress measures focus effort.** The Activity Grid remains a calendar of Days shaded only by total Check-in duration across all Tasks. Task completion never affects a cell's level because completion and focus are independent.
- **Grid mechanics remain.** Level 0 means no Check-ins. Levels 1 through 4 use the existing fixed minute thresholds while the User has fewer than eight non-zero Days, then quartiles from all non-zero Days in the User's full history. A legend states the active ranges. The rolling range is three months by default with six months as the only alternative; changing range does not recolour a Day. Future Days are not drawn or counted.
- **One overall Focus Streak.** An Active Day is a Day with at least one Check-in. Progress shows all-time Current and Longest Focus Streaks across all Tasks. Today without a Check-in does not break the current streak until Today ends. Check-in edits, reassignment, and deletion recompute both streaks.
- **No item filters.** All per-Habit filters, archived filters, colours, and breakdowns disappear. They are not replaced by per-Task or completion-state filters. The grid always aggregates all Tasks; only the time-range selector remains.
- **Selected-Day history.** A selected Day summarizes its date, focused minutes, Check-in count, completed Task count, and total Task count. It lists every Task in stable manual order, including Tasks with no focus, with title, current complete/incomplete state, focused-minute total, and its Check-ins. A Task with none says "No focus recorded." Eligible Check-ins can be added, edited, or deleted from this history.
- **Range statistics.** The selected range shows Focused time, Check-ins, Active Days, and Tasks completed as `completed / all Tasks`. Current and Longest Focus Streak remain all-time. Progress does not add Pomodoro count, averages, trends, best Day, or cross-range per-Task analytics.
- **Live derivation from current records.** A Check-in duration correction updates totals, grid levels, thresholds, and statistics. Reassigning a Check-in moves its contribution to the replacement Task's Day and recomputes both Days. Completion changes affect only Task completion details and totals. Renaming a Task updates its historical title. Deleting a Task removes it and its Check-ins from every aggregate, grid level, and streak. Tasks never move between Days.
- **Empty states distinguish missing plans from missing focus.** With no Tasks, the empty grid remains visible and invites creation of the first Task for Today. With Tasks but no Check-ins, it explains that the first Check-in will light up its Day. A zero-focus selected range shows real zero values rather than dashes. A selected Day with Tasks lists them with "No focus recorded"; a Day without Tasks says "No Tasks for this Day."

The exact surface name, layout, responsive interaction, and final copy continue in [Prototype the task-first daily workflow](05-prototype-task-first-workflow.md). Record representation and aggregate consistency under sync continue in [Align task data and sync semantics](06-align-task-data-and-sync.md).
