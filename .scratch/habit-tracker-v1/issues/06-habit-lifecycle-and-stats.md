# Habit lifecycle and stats

Type: grilling
Status: resolved

## Question

How does a Habit live and end, and what does the user see about their progress?

Cover at least:

- Creating and renaming a Habit; any per-Habit settings.
- Archiving versus deleting: what happens to that Habit's existing Check-ins and its contribution to the Activity Grid.
- Which stats appear: current Streak, longest Streak, total minutes, per-Habit and overall.
- Whether a Streak stays alive while today has no Check-in yet (handed over from [Check-in rules](02-check-in-rules.md), which fixed a Day as midnight to midnight local time).
- How the per-Habit filter on the Activity Grid works. Its look is settled by [Activity Grid look](05-activity-grid-look.md): chips (All plus one per Habit), single-select, re-shading and recolouring the grid; what remains here is how archived Habits appear in it.
- The main screens and how the user moves between them (Pomodoro timer, Activity Grid, Habit list, stats). The layout is mobile-first on every device, with a maximum width on desktop (see [Storage and accounts](03-storage-and-accounts.md)).
- Whether archiving and deleting a Habit sync like any other change, and how an archive or delete interacts with a Check-in recorded offline on another device (the deletion wins over an edit).

Domain context: see `CONTEXT.md` (Habit, Streak, Activity Grid). Habits have no target in v1.

Handed over from [Activity Grid look](05-activity-grid-look.md): the Activity Grid screen is a bento layout with the grid as its hero tile, and the prototype put illustrative stat tiles beside it (total focused time, Check-in count, active days, minutes per Habit). Those were placeholders; decide here which stats really exist and where they sit.

## Answer

Resolved with the user in two grilling rounds; every recommendation was accepted. Vocabulary added to `CONTEXT.md`: **Archived Habit**; **Streak** now counts for one Habit or for all Habits together, stays alive through a Day with no Check-in yet, and is always recomputed from Check-ins.

- **Habit identity.** Names are unique per User across active and archived Habits (case-insensitive), at most 40 characters, with no limit on the number of Habits. Renaming changes the name everywhere; Check-ins point at the Habit, not the name.
- **Colour.** The only per-Habit setting. Assigned automatically from a fixed pastel palette (next unused colour), changeable by the User when creating or editing. When the palette runs out, colours repeat. No free colour picker.
- **Order.** By creation time, oldest first, with no manual reordering. The Timer's Habit picker preselects the Habit last used for a session or Check-in.
- **Archive and delete.** Archive is reversible (restore any time); an Archived Habit keeps its Check-ins, which still count in the Activity Grid and stats. Delete exists only for an Archived Habit, removes the Habit and all its Check-ins, asks for confirmation naming the number of Check-ins, and has no undo. Archive and delete are blocked while the Habit has a running or paused focus interval ("Stop or finish the session first"); a Break does not block.
- **Archived Habits and new Check-ins.** Not offered in the Timer picker, the manual Check-in form or the Check-in edit form. To record against one, restore it first. An existing Check-in of an Archived Habit can still have its duration and Day edited, and can be moved to an active Habit but not to an archived one.
- **Streaks.** Counted for one Habit or for all Habits, following the selected filter chip. Alive through today until midnight: the count runs back from today if it has a Check-in, otherwise from yesterday, and breaks only after a whole Day is missed. Recomputed from Check-ins, so backdating, editing and deleting change it immediately, and Longest streak is recomputed the same way. For an Archived Habit the Current streak tile shows "Archived" instead of a number.
- **Stats.** All follow the filter chip. Current streak and Longest streak are all-time. Focused time, Check-ins and Active days cover the selected grid range and are labelled with it. The per-Habit minutes breakdown appears only under "All" and includes Archived Habits, marked "archived". No other stats in v1 (no averages, trends or best day).
- **Filter chips.** "All" plus one chip per active Habit, single-select (as in [Activity Grid look](05-activity-grid-look.md)). A trailing "Archived" chip opens a list of Archived Habits; picking one selects it as the filter and the chip shows its name, with the grid in that Habit's colour.
- **Screens.** Bottom tab bar with three tabs. **Timer** is the default: pick a Habit and start, plus today's Check-ins listed under the timer for quick fixes, plus a "+" for a manual Check-in. **Progress**: Activity Grid, chips and stat tiles; the Day tooltip has a "Details" action that opens a sheet with that Day's Check-ins (edit, delete, and "Add Check-in" pre-filled with the Day). **Habits**: active Habits, a collapsible "Archived" section, an add button; rename, colour, archive, restore and delete live on the Habit's detail screen. There is no global scrolling list of Check-ins in v1.
- **Sync.** Archive, restore, rename and colour changes sync like any other edit (server-ordered last-write-wins). A deletion beats a restore or an edit, and the cascade removes the Habit's Check-ins. A Check-in recorded offline for a Habit that was deleted elsewhere is dropped; what the User is told about that is for [Offline and sync experience](08-offline-and-sync-experience.md). A Check-in recorded offline for a Habit that was only archived elsewhere is kept and the Habit stays archived.

Not decided here: what a User with no Habits or no Check-ins sees on each tab, grid contrast and keyboard use, and shading with very little history. These graduated to [Empty states and grid accessibility](09-empty-states-and-grid-accessibility.md).
