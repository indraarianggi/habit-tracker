# 07: Recover focus after absence

**What to build:** A User returning after sleep, tab closure, or an elapsed focus interval decides how much focus actually happened, and every device reaches the same single terminal outcome.

**Blocked by:** 06: Run and control a focus interval.

**Status:** ready-for-agent

- [ ] Remaining focus time is reconstructed from persisted wall-clock timestamps after backgrounding, reload, sleep, and visibility return; a paused Session stays paused and requests Resume or Stop.
- [ ] The away flow offers fully finished, partly finished with whole minutes, or no focus; the resulting Check-in inherits its Task's Day even across midnight or later recovery.
- [ ] Finalization atomically records either one Check-in or one discard, releases the active focus slot, and returns the authoritative result on every retry or conflicting device outcome; a Session cannot create duplicate Check-ins.
- [ ] A Session keeps the durations captured at Start despite later settings changes, and normal completion produces an on-screen focus-end alert exactly once when the app is present.
- [ ] Headless checks with a fake wall clock and separate devices cover sleep gaps, midnight, full/partial/none recovery, conflicting retries, and the paused state; a browser check exercises the return prompt.
