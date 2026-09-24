# 07: Recover focus after absence

**What to build:** A User returning after sleep, tab closure, or an elapsed focus interval decides how much focus actually happened, and every device reaches the same single terminal outcome.

**Blocked by:** 06: Run and control a focus interval.

**Status:** resolved

- [x] Remaining focus time is reconstructed from persisted wall-clock timestamps after backgrounding, reload, sleep, and visibility return; a paused Session stays paused and requests Resume or Stop.
- [x] The away flow offers fully finished, partly finished with whole minutes, or no focus; the resulting Check-in inherits its Task's Day even across midnight or later recovery.
- [x] Finalization atomically records either one Check-in or one discard, releases the active focus slot, and returns the authoritative result on every retry or conflicting device outcome; a Session cannot create duplicate Check-ins.
- [x] A Session keeps the durations captured at Start despite later settings changes, and normal completion produces an on-screen focus-end alert exactly once when the app is present.
- [x] Headless checks with a fake wall clock and separate devices cover sleep gaps, midnight, full/partial/none recovery, conflicting retries, and the paused state; a browser check exercises the return prompt.

## Verification

`pnpm run typecheck`, `pnpm run build`, `pnpm run smoke:browser` (28 passed), and `SMOKE_SERVER=production pnpm run smoke:browser` (28 passed) on 2026-09-24. Headless checks exercise fake elapsed wall time, paused absence, midnight Task Day, three outcomes, authoritative retries and two-device local convergence. Browser checks exercise reload recovery, partial/no-focus choices, offline full recovery, paused reload, and the once-only visible completion alert. The recovery sheet was inspected at phone and desktop widths; Pencil desktop could not be connected for direct `.pen` inspection. A live Google consent/callback requires the operator's OAuth web client ID and secret with an authorized origin/callback; the smoke suite uses test-only credentials.

Timer settings are not editable until ticket 13; the currently captured 25-minute duration is persisted with the Session, and normal finish ignores a later conflicting duration in the request. This verifies the snapshot contract without claiming that a settings-change UI was exercised.
