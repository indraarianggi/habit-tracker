# Empty states and grid accessibility

Type: grilling
Status: resolved

## Question

What does the app show a User with little or no data, and how accessible is the Activity Grid?

Cover at least:

- What each tab ([Habit lifecycle and stats](06-habit-lifecycle-and-stats.md): Timer, Progress, Habits) shows for a User with no Habits, and for a User with Habits but no Check-ins. How a brand-new User is guided to create a first Habit.
- How the relative shading (quartiles of the User's own non-zero Days, see [Activity Grid look](05-activity-grid-look.md)) behaves with only a few non-zero Days, where there are too few values for five levels.
- What the stat tiles and the "Archived" chip show when there is nothing to show (no Archived Habits, no Check-ins in the selected range).
- Grid contrast in light and dark mode, and whether shade is ever the only carrier of information.
- Keyboard and screen-reader use of the Activity Grid: taps resolve by pointer position, so cells are not focusable yet.

Domain context: see `CONTEXT.md`. Layout is mobile-first on every device with a maximum width on desktop.

Handed over from [Offline and sync experience](08-offline-and-sync-experience.md): a new device shows a full "Loading your data…" screen until the first download finishes, so the empty states decided here only ever apply to a User whose data has really loaded and is empty.

## Answer

Resolved with the user in one grilling round; every recommendation was accepted. No new vocabulary and no ADR: nothing here is hard to reverse.

- **New User with no Habits.** No separate onboarding screen. **Timer**: a card "What do you want to build a habit around?" with a name field and an auto-assigned pastel colour and a "Create Habit" button (one step, no tab change); Start is not shown until a Habit exists. **Habits**: the same short prompt with an "Add Habit" button. **Progress**: the empty grid (below) plus one line "Create a Habit to start tracking" that leads to the Habits tab. Once the first Habit exists the Timer card becomes the normal picker and Start.
- **Habits but no Check-ins.** The Activity Grid on Progress stays visible with every cell at level 0 and a caption "Your first Check-in will light up today." The Timer shows the picker and Start as usual, with "No Check-ins today yet." in place of today's list and the "+" manual Check-in still visible. Habits and the filter chips look normal.
- **Shading with little history.** While the User has fewer than 8 non-zero Days (under the selected filter), levels use fixed thresholds: 1-15, 16-30, 31-60, over 60 minutes. From 8 non-zero Days on, the quartiles of [Activity Grid look](05-activity-grid-look.md) apply. The legend always states the minute ranges currently in force. Switching once from fixed thresholds to quartiles may recolour some cells; accepted. The number 8 (two Days per level) is a detail to tune during the build.
- **Empty stat tiles and the Archived chip.** The "Archived" chip, and the collapsible "Archived" section on the Habits tab, are hidden while there are no Archived Habits. Tiles show real zeros, not dashes: "0 min", "0", "0 days" (Focused time, Check-ins, Active days, Current streak, Longest streak). The per-Habit minutes breakdown under "All" lists only Habits with minutes in the range and is hidden when empty. The same holds when a single Habit is filtered and has no Check-ins. The existing exception stays: an Archived Habit's Current streak tile reads "Archived".
- **Contrast and information beyond colour.** Checked in light and dark mode, for the "All" hue and every Habit hue: (1) level 1 differs from level 0 by at least 3:1 against the tile background; (2) the five levels rise in luminance, so they read in greyscale, without forcing 3:1 between adjacent levels; (3) the day-of-month numbers inside cells (3-month range) meet 4.5:1 at every level, with the text colour switching per level. Colour is never the only carrier: exact minutes and Check-in counts are in the tooltip, the Details sheet and the cell labels, the legend states the minute ranges, and today has an outline. Contrast is verified by an automated test on the palette, not by eye.
- **Keyboard and screen reader.** The grid is navigable: `role="grid"` with a roving tabindex, one tab stop; left/right arrows move between weeks, up/down between weekdays, Home/End go to the start or end of the week, Enter or Space opens the Details sheet for that Day (the same action as "Details" in the tooltip). Focus shows the same tooltip as hover. Every cell has a full label, such as "12 September, 45 minutes, 2 Check-ins" or "13 September, no Check-ins". Pointer and touch keep resolving to the nearest cell; the keyboard acts on real cells, so the two do not conflict. Small touch targets at 3 months are covered by that nearest-cell rule, so cell size does not change.
- **Empty Days and future cells.** An empty Day behaves like any other: the tooltip shows the date and "No Check-ins", and "Details" stays, because its sheet holds "Add Check-in" pre-filled with the Day (the main backdating route in [Habit lifecycle and stats](06-habit-lifecycle-and-stats.md)). Cells after today in the current week are not drawn at all: not tappable, not focusable, and not counted in the quartiles, in line with "never the future" in [Check-in rules](02-check-in-rules.md).
