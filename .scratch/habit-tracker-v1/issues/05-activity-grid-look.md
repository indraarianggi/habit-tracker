# Activity Grid look

Type: prototype
Status: resolved

## Question

What should the Activity Grid look like and how should it behave? Make a cheap, rough prototype with fake data to react to.

Cover at least:

- How total minutes per day map onto the five shading levels: fixed thresholds or relative to the user's own history.
- Colour scheme, including light and dark modes.
- What a tooltip shows on hover (date, total minutes, number of Check-ins, per-Habit breakdown?).
- The time range shown (rolling year, calendar year, selectable) and whether the week starts on Monday or Sunday.
- How the grid looks when filtered to a single Habit.
- How it fits the mobile-width layout (see [Storage and accounts](03-storage-and-accounts.md)): every device uses a mobile layout with a maximum width, so roughly a year of weeks must read clearly in under about 430 px. Consider scrolling, a shorter default range, or larger cells.

Reference: a GitHub contribution graph (weeks as columns, weekdays as rows, five intensity levels from Less to More).

Domain context: see `CONTEXT.md` (Activity Grid).

## Answer

Chosen: variant **B (fit to screen)** in a **bento** visual style. Prototype: `prototypes/05-activity-grid-look/b-bento.html` (`index.html` in the same folder holds the three rejected structural variants: A scrolling year, C weeks as rows). Screenshots sit beside them.

Decided by the user:

- **Layout.** The grid's cell size is derived from the available width, so the whole range fits without scrolling. Weeks are columns and weekdays are rows, GitHub-style. Weekday labels show Mon/Wed/Fri, month labels sit above the columns.
- **Shading.** Five levels: level 0 is a Day with no Check-ins, levels 1 to 4 are the quartiles of the User's own non-zero Days. It is relative, not fixed. As prototyped, the quartiles come from the User's whole history (not just the visible range, so switching range never recolours a Day) and are recomputed for the selected Habit filter. The legend states the current minute ranges.
- **Range.** Rolling, ending on today. The default is the last **3 months**, which gives cells of roughly 22 px that also show the day of the month. The range selector stays on the card.
- **Week starts on Monday.**
- **Tooltip.** Date, total minutes, number of Check-ins, and a per-Habit breakdown (Habit, minutes). Hover on desktop; tap on touch, where it stays until the same Day is tapped again. Small cells resolve taps by nearest cell, so the gaps between cells are not dead zones.
- **Single-Habit filter.** A row of chips (All plus one per Habit), one selected at a time. Filtering re-shades the grid by that Habit's minutes only and recolours it in that Habit's hue. "All" uses one fixed hue (the prototype's default, mint).
- **Colour and theme.** Cheerful, flat pastel palette. Follows the system light/dark setting; no in-app theme switch in v1.
- **Visual style.** Bento: flat tiles with large radii on a warm background, minimal chrome. The Activity Grid is the hero tile.

Taken from the recommendations without being contested, so worth a glance when writing the spec:

- **12-month range.** Cells fall to about 4 to 5 px at 12 months, too small to read or tap. The recommendation was to offer 3 and 6 months only; the user set the default (3) but did not rule on dropping 12.
- **"All" hue.** The user accepted "as recommended" for grid colour, which fixed the single-Habit behaviour above but never named the hue. Mint is only the prototype default; Grape, Coral and Sky were also shown.

Not settled here, and deliberately not decided by this prototype:

- The stat tiles beside the grid (Focused, Check-ins, Active days, minutes per Habit) are illustrative. Which stats exist is decided in [Habit lifecycle and stats](06-habit-lifecycle-and-stats.md).
- Keyboard use of the grid, grid contrast, and how relative shading behaves for a User with very little history (quartiles of two or three Days). See "Accessibility and first-run empty states" in the map.

The repo is not a git repository, so the prototype could not go on a throwaway branch. It stays under `prototypes/` in this effort's folder and is not part of the app.

## Amendments

Amended by [Settings and account screen](10-settings-and-account-screen.md): the theme is no longer system-only. Settings has a System / Light / Dark control, default System and stored on the device only. The colours and levels decided here are unchanged and must hold in both modes.
