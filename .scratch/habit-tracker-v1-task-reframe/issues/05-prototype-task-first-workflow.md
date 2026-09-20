# Prototype the task-first daily workflow

Type: prototype  
Status: resolved  
Blocked by: 02, 03, 04

## Question

What is the simplest task-first interface for choosing what to do on a Day, starting Pomodoro Sessions against it, and reviewing focus history?

Create a cheap interactive or otherwise concrete prototype and resolve through live User reaction. Cover at least:

- The default screen and the relationship between the Day's task list and the Timer.
- Creating a task with minimal friction, selecting it, starting another Pomodoro, and marking it complete.
- Navigating to another Day and handling unfinished work.
- Today's focus records and corrections.
- The Progress/history surface after its semantics are settled.
- Whether the old Timer, Progress, and Habits tabs survive, merge, or are renamed.
- Empty, active-session, completed-task, and no-focus states on a phone-width layout.

Link the prototype asset from the resolution rather than pasting it into this ticket.

## Answer

Resolved through live User reaction to a three-variant prototype. The User chose **Variant B (Timer first)** with five adjustments, applied to the prototype and verified.

- **Tabs.** Three tabs: **Timer** (default), **Tasks**, **Progress**. The User explicitly confirmed keeping the name **Timer**. The old Habits tab is removed; Task management lives in the Tasks tab. The old "Create Habit" card is replaced by the add-Task input on the Timer tab. Header keeps the streak chip and the profile avatar that opens Settings.
- **Timer tab, idle.** Top to bottom: the timer ring, the **Start** button directly beneath it, a "Focus on" heading, the **add-Task input at the top of the list**, Today's Tasks as a single-select list, then "Today's focus" (Check-in log). A Task created here is selected automatically. Preselection follows [Redefine Pomodoro records around tasks](03-redefine-pomodoro-records.md). Completed Tasks stay selectable and are shown struck through. With no Task Today the ring and a "What will you focus on today?" empty state sit above the add input, and there is no Start.
- **Timer tab, running.** The ring, "Focusing on <Task>", Pause/Resume and Stop, then Today's focus. The picker is hidden while a Session runs. **There is no "Mark Task complete" control on the Timer tab.** Completion is toggled only from the Tasks tab or a Progress Day's list, and never by the Timer. A Break shows "Skip break" and the Task it followed.
- **Today's focus (Check-in log).** Lists Today's Check-ins with Task title, origin (Pomodoro / Added by hand), minutes and Edit, plus a "+" for manual Check-ins. The edit sheet reassigns to any eligible Today or past Task, adjusts minutes, and deletes behind a confirmation. Empty text: "No focus recorded today yet."
- **Tasks tab.** A Monday-start week strip with previous/next-week arrows and dots for Days that have Tasks, then the selected Day's list: header (date, focused minutes, Check-ins, done/total), the **add-Task input at the top** for Today and future Days only, then rows with completion checkbox, title, focused-minute label and a "···" menu. The menu offers rename, complete/reopen, move up/down, Copy to a later Day, and Delete (blocked while that Task has a running or paused Session). Unfinished Tasks on a past Day show a "Copy →" pill and a hint that they stay on that Day. The tab has no play buttons; Sessions start only from the Timer tab.
- **Progress tab.** The Activity Grid card with the 3 mo / 6 mo toggle and a legend of active minute ranges, six tiles (Current and Longest Focus Streak, Focused time, Check-ins, Active Days, Tasks completed `x / y`), and the selected Day's panel (Today by default). That panel expands each Task's Check-ins for edit/delete, offers manual recording, and puts the **add-Task input at the top** (Today only, since the grid draws no future Days). Empty-state copy follows [Redefine focus progress without recurring Habits](04-redefine-focus-progress.md).
- **Add-Task input.** In every Task list it is the first element, above the rows, with the placeholder "New Task…" on the Timer tab and "Add a Task" elsewhere. Enter or Add submits; titles are trimmed and capped at 120 characters.
- **Not chosen.** Variant A (Today list plus mini-player) and Variant C (one canvas with a sticky Start bar) are rejected. No mini-player or full-screen timer takeover is needed because the Timer is its own tab.

Consequences for later decisions: the corrected spec replaces the Timer / Progress / Habits tab list with Timer / Tasks / Progress; there is no Habit Create card. Persistence and conflict semantics for these interactions continue in [Align task data and sync semantics](06-align-task-data-and-sync.md).

## Prototype asset

Throwaway interactive prototype: [`prototypes/05-task-first-workflow/index.html`](../prototypes/05-task-first-workflow/index.html). Open the file directly (or `python3 -m http.server -d .scratch/habit-tracker-v1-task-reframe/prototypes/05-task-first-workflow`) at phone width.

Winner: **B**, updated with the User's five adjustments (its header comment records the outcome). Three structurally different variants were compared, switched with `?variant=`, the bottom bar, or ← →:

- **A · Task list first**: tabs Today | Progress. The Day's list is home, each Today Task has a play button, a mini-player opens a full timer sheet, and Days are navigated with chevrons.
- **B · Timer first**: tabs Timer | Tasks | Progress. Pick a Today Task and press Start; the Tasks tab is the planner with a week strip; Today's Check-ins sit under the timer.
- **C · One canvas**: no tabs. Grid, stats and the selected Day share one page, with a sticky "Focus on / Start" bar and a full-screen timer takeover.

The **Demo** button switches scenarios (seeded week, active Session, Tasks with no focus, all done, brand-new) and fast-forwards the timer. Screenshots sit beside the file.
