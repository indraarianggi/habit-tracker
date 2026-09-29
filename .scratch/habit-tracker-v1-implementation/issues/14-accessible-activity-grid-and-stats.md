# 14: Explore an accessible Activity Grid and stats

**What to build:** A User sees their focused minutes over time in one Activity Grid, reads accurate totals and Focus Streaks, and can explore Days with touch, keyboard, or a screen reader in either theme.

**Blocked by:** 04: Edit, complete, and order Tasks; 09: Record and correct manual Check-ins; 13: Configure timer and device preferences.

**Status:** resolved

- [x] The grid uses Monday-start weeks, month and weekday labels, no future cells, an outlined Today, 3 months by default or 6 months, fitting the mobile width without horizontal scrolling; 3-month cells show the day number.
- [x] Shade each Day by summed Check-in minutes through its Tasks, never completion: fixed 1–15/16–30/31–60/>60 thresholds below eight non-zero Days, then whole-history quartiles, with the exact current legend. Changing range does not recolour a Day.
- [x] Hover, focus, or nearest-cell touch reveals the Day, minutes, Check-in count, and completed/total Tasks; one grid tab stop with week/weekday arrows, Home/End, and Enter/Space opens the Day.
- [x] Current and Longest Focus Streaks are all-time across Active Days and ignore Today's missing Check-in until the Day ends; selected-range tiles show focused time, Check-ins, Active Days, and completed/all Tasks with zero values and clear range labels. Corrections and cascades immediately recompute every derived value.
- [x] The empty grid distinguishes no Tasks from Tasks without Check-ins; screen-reader labels expose full Day facts, level 1 differs from 0 at 3:1, levels increase in luminance, and cell numbers reach 4.5:1 at every level in light and dark.
- [x] Headless checks cover threshold transition, streak gap, reassignment, range and contrast invariants; browser checks cover grid keyboard/touch navigation and themes.

## Verification

`pnpm run typecheck` and `pnpm run smoke:browser` (106 passed, 2 skipped) pass on 2026-09-29. Implemented in `src/lib/progress.ts` (Monday-week/no-future-cell grid math, fixed→quartile threshold switch, streak derivation, keyboard navigation math) and `src/components/progress-screen.tsx` (grid rendering, range toggle, legend, stat tiles, empty-state copy). `src/lib/__tests__/progress.test.ts` headlessly proves the threshold transition at the eighth active Day, the streak gap/today-pending case, Task-ownership reassignment recomputing both Days, Monday-start/no-future-cell/full-label grid shape, and WCAG contrast (3:1 level-0→1, monotonic luminance, 4.5:1 text at every level, both palettes) by direct computation. `src/routes/__tests__/progress.test.ts` is a real-browser journey at 375×812, 320×640 and 1024×768 covering keyboard grid navigation (arrows/Home/End/Enter/Space, dialog focus trap, Escape), nearest-cell touch tap, live-DOM contrast checks in both themes, range switching without recolouring, and the two distinct empty-state messages.

This ticket's checklist and Status were still `ready-for-agent` in the tracker despite the feature being implemented and merged in `23fe1c4`; verified against current code and the passing suite before flipping it to `resolved`.
