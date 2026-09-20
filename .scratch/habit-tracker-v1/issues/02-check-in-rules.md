# Check-in rules

Type: grilling
Status: resolved

## Question

What are the rules for recording and changing a Check-in?

Cover at least:

- Where a "day" begins and ends, and which timezone it uses. A session ending at 00:30 belongs to which day?
- How manual Check-ins are entered: fields, a sensible default duration, and any upper limit.
- Editing and deleting a Check-in, including undoing an accidental one.
- Backdating: how far back a Check-in can be added, and how the user picks the day.
- Whether a Check-in can span midnight.

Domain context: see `CONTEXT.md` (Check-in, Streak). Duration is always greater than zero; a Streak counts consecutive days with at least one Check-in, so the day boundary directly affects it.

## Answer

Resolved with the user in two grilling rounds. Vocabulary added to `CONTEXT.md`: **Day**; **Streak** now counts Days.

- **Day boundary.** A Day runs midnight to midnight in the device's local time. No configurable cutoff hour.
- **Time zones.** Each Check-in stores its own Day, computed when it is recorded, and never recomputed. Changing time zone later does not move existing Check-ins or alter Streaks.
- **Which Day a session lands on.** The Day on which the focus interval ends, which is also the moment the Check-in is created. This covers a session that crosses midnight and one paused and resumed on a later day. Stop early: the Day the user pressed Stop. User away: the Day of the planned end time, not the Day the app was reopened.
- **No spanning.** A Check-in has one Day and one duration, with no start or end time, so it cannot span midnight. Work from 22:00 to 02:00 is two manual Check-ins.
- **Manual entry.** Fields are Habit, Day (date picker, defaults to today) and duration in whole minutes. Default duration is the currently configured focus length (25 min out of the box). Maximum 480 minutes per Check-in. No note field in v1.
- **Backdating.** Any past Day, no limit. Future Days are rejected.
- **Editing.** Habit, Day and duration are editable on every Check-in, whether it came from a session or was entered manually, under the same validation as creation (duration above zero, at most 480, Day not in the future).
- **Deleting.** A confirmation dialog, then the Check-in is deleted permanently. No undo toast and no trash. The user chose this over the recommended undo toast.

Handed to other tickets:
- Habit lifecycle and stats: whether a Streak stays alive while today has no Check-in yet; what archiving or deleting a Habit does to its Check-ins and to the Activity Grid.
- Tech stack and hosting: a Check-in's Day is stored as a local calendar date (e.g. `2026-09-19`), not derived from a UTC timestamp.
