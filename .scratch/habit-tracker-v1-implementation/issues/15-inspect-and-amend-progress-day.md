# 15: Inspect and amend a Day from Progress

**What to build:** A User opens a Day from the Activity Grid, sees what was planned and focused on, and fixes Check-ins or adds a Task when viewing Today.

**Blocked by:** 05: Plan future Days and copy forward; 09: Record and correct manual Check-ins; 14: Explore an accessible Activity Grid and stats.

**Status:** resolved

- [x] Today is selected by default; choosing any past Day opens the selected-Day panel or details sheet with its date, focused minutes, Check-in count, and completed/total Tasks.
- [x] Every Task of that Day appears in manual order with its current title, complete/open state, focused-minute total and Check-ins, or “No focus recorded.”; renaming and deletion update this history immediately.
- [x] Eligible Check-ins can be added, edited, reassigned, or deleted from the selected Day; the target is an existing Today or past Task, never an invented past Task or separate editable Day.
- [x] The add-Task input is first in Today’s panel only; past Days offer none. An empty Day still opens and explains its lack of planned work.
- [x] A browser journey adds and corrects a past Check-in from the Day panel and confirms the grid and streak totals update; a headless check proves the Day is derived through the Task.

## Verification

`pnpm run typecheck` and `pnpm run smoke:browser` (106 passed, 2 skipped) pass on 2026-09-29. The selected-Day panel and details sheet are the same `src/components/progress-screen.tsx` markup ticket 14 introduced; the Check-in editor (add/edit/reassign/delete via a `<select>` of eligible Tasks only, never free text) lives in `src/routes/today.tsx` and is shared between Today and the Day panel through `onAddCheckin`/`onEditCheckin`. `src/routes/__tests__/progress-day.test.ts` is a real-browser journey that opens a past Day from the grid, confirms the add-Task input and only the add-Task input is absent on that Day, adds a Check-in, edits it, and asserts the grid cell's `aria-label` and the Focused time/streak/Active Days stat tiles update immediately. `src/lib/__tests__/progress.test.ts`'s reassignment/correction/cascading-deletion case is the headless proof that a Day's totals are derived through Task ownership, not stored independently.

This ticket's checklist and Status were still `ready-for-agent` in the tracker despite the feature being implemented and merged across `23fe1c4` and `bcccaeb`; verified against current code and the passing suite before flipping it to `resolved`.
