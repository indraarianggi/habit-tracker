# Map: Daily Task Reframe for Habit Tracker v1

## Destination

A corrected v1 specification, ready to build, in which the primary work item is a concrete task for a particular Day and Pomodoro Sessions record focused work against that task. Every affected product, domain, data, sync, progress, and interface decision is settled without reopening unrelated infrastructure decisions.

## Notes

- This map corrects the perspective in the existing [Habit Tracker v1 spec](../habit-tracker-v1/spec.md). The previous [Habit Tracker v1 map](../habit-tracker-v1/map.md) remains decision history; decisions that assume a recurring Habit label are not authoritative for this correction.
- The User converses in Indonesian; repository artifacts are in English.
- Use `grilling` and `domain-modeling` for decision tickets. Use `prototype` for the workflow ticket.
- Plan, do not build: this map settles decisions and hands the result to the spec-writing step. It does not implement the application.
- Settled while charting:
  - The primary work item is a concrete to-do item for a particular Day, not a general recurring-activity label.
  - Terminology in the domain model, UI, and product name may change to express that meaning accurately.
  - The correction is targeted. Keep authentication, local-first PWA behavior, offline/sync architecture, hosting, theme, security, and other unrelated decisions unless the new work-item model creates a direct conflict.
  - Focus history remains a core product capability, but Habit-dependent Streaks, filters, statistics, and archive behavior must be reconsidered.
  - Recurrence, repeating templates, schedules, frequency targets, and reminders remain outside v1.
- There is no shipped application or user data, so backward-compatible data migration is not part of this effort.
- The User-accepted UI design is [`habit-tracker.pen`](../../habit-tracker.pen) (pen.dev, 20 screens + 2 components). It is the authoritative visual reference for the corrected spec and supersedes the variant-B prototype.

## Decisions so far

<!-- one line per resolved ticket: [title](issues/NN-slug.md): gist -->

- [Define the daily focus item](issues/01-define-daily-focus-item.md): **Task** replaces the Habit domain object—a minimal, Day-specific to-do with independent completion and focus history; duplicate titles are allowed, while Habit Tracker remains the product name.
- [Decide the daily task lifecycle](issues/02-decide-daily-task-lifecycle.md): Tasks are planned for Today or later, never move or roll over, may be copied only forward as distinct incomplete Tasks, remain in Day history, and use reversible completion, stable manual ordering, guarded permanent deletion, and direct empty-state creation.
- [Redefine Pomodoro records around tasks](issues/03-redefine-pomodoro-records.md): Check-ins remain Task-bound focus records on the Task's Day; live and manual focus eligibility, correction rules, Timer preselection, unchanged finalization mechanics, and cross-device exactly-once invariants are settled.
- [Redefine focus progress without recurring Habits](issues/04-redefine-focus-progress.md): Progress remains focus-first—an all-Task minute-based Activity Grid and overall Focus Streak—with Task-aware Day details, four range totals, no item filters, live recomputation, and distinct empty states.
- [Prototype the task-first daily workflow](issues/05-prototype-task-first-workflow.md): Variant B chosen—Timer / Tasks / Progress tabs (Habits tab removed), Start under the timer, add-Task input first in every list, no completion control on the Timer tab; [prototype](prototypes/05-task-first-workflow/index.html).
- [Align task data and sync semantics](issues/06-align-task-data-and-sync.md): The Task-centered record contract keeps server-ordered whole-record conflict resolution and deletion tombstones, adds deterministic per-Task ordering, protects active Session targets, and makes Session finalization transactionally exactly once.

## Not yet specified

- None. The decision route is complete and the corrected specification is written: [spec.md](spec.md) (`ready-for-agent`). It supersedes [the baseline v1 spec](../habit-tracker-v1/spec.md).

## Out of scope

- Implementing the application. This effort ends at a corrected, build-ready specification.
- Recurrence, repeating task templates, schedules, frequency targets, and reminders.
- Reconsidering authentication, deployment, hosting, PWA strategy, theme, or security without a direct conflict from the task reframe.
- Migrating existing production data; no application has been shipped.
