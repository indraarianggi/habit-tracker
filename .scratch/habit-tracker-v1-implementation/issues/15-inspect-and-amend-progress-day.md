# 15: Inspect and amend a Day from Progress

**What to build:** A User opens a Day from the Activity Grid, sees what was planned and focused on, and fixes Check-ins or adds a Task when viewing Today.

**Blocked by:** 05: Plan future Days and copy forward; 09: Record and correct manual Check-ins; 14: Explore an accessible Activity Grid and stats.

**Status:** ready-for-agent

- [ ] Today is selected by default; choosing any past Day opens the selected-Day panel or details sheet with its date, focused minutes, Check-in count, and completed/total Tasks.
- [ ] Every Task of that Day appears in manual order with its current title, complete/open state, focused-minute total and Check-ins, or “No focus recorded.”; renaming and deletion update this history immediately.
- [ ] Eligible Check-ins can be added, edited, reassigned, or deleted from the selected Day; the target is an existing Today or past Task, never an invented past Task or separate editable Day.
- [ ] The add-Task input is first in Today’s panel only; past Days offer none. An empty Day still opens and explains its lack of planned work.
- [ ] A browser journey adds and corrects a past Check-in from the Day panel and confirms the grid and streak totals update; a headless check proves the Day is derived through the Task.
