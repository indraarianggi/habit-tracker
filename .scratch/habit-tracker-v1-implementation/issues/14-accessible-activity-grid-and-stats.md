# 14: Explore an accessible Activity Grid and stats

**What to build:** A User sees their focused minutes over time in one Activity Grid, reads accurate totals and Focus Streaks, and can explore Days with touch, keyboard, or a screen reader in either theme.

**Blocked by:** 04: Edit, complete, and order Tasks; 09: Record and correct manual Check-ins; 13: Configure timer and device preferences.

**Status:** ready-for-agent

- [ ] The grid uses Monday-start weeks, month and weekday labels, no future cells, an outlined Today, 3 months by default or 6 months, fitting the mobile width without horizontal scrolling; 3-month cells show the day number.
- [ ] Shade each Day by summed Check-in minutes through its Tasks, never completion: fixed 1–15/16–30/31–60/>60 thresholds below eight non-zero Days, then whole-history quartiles, with the exact current legend. Changing range does not recolour a Day.
- [ ] Hover, focus, or nearest-cell touch reveals the Day, minutes, Check-in count, and completed/total Tasks; one grid tab stop with week/weekday arrows, Home/End, and Enter/Space opens the Day.
- [ ] Current and Longest Focus Streaks are all-time across Active Days and ignore Today's missing Check-in until the Day ends; selected-range tiles show focused time, Check-ins, Active Days, and completed/all Tasks with zero values and clear range labels. Corrections and cascades immediately recompute every derived value.
- [ ] The empty grid distinguishes no Tasks from Tasks without Check-ins; screen-reader labels expose full Day facts, level 1 differs from 0 at 3:1, levels increase in luminance, and cell numbers reach 4.5:1 at every level in light and dark.
- [ ] Headless checks cover threshold transition, streak gap, reassignment, range and contrast invariants; browser checks cover grid keyboard/touch navigation and themes.
