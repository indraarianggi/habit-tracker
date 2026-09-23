# 08: Take Breaks and receive alerts

**What to build:** After focus, a User chooses a short Break, long Break, or none, receives distinct end alerts, and can keep the countdown screen awake where supported.

**Blocked by:** 06: Run and control a focus interval; 07: Recover focus after absence.

**Status:** ready-for-agent

- [ ] Focus end offers a short Break, long Break, or none; the Break names the preceding Task, may be skipped, cannot be paused, and never adds focused minutes.
- [ ] Break end displays “Break is over!” with “Start Next Session”; the same Task is reused only while eligible and no next Session starts automatically. A missed Break-end alert does not open a focus-recovery prompt.
- [ ] Focus and Break ends use distinguishable on-screen and Web Audio alerts, unlocked by a User gesture, with countdowns corrected on foreground return rather than counting background ticks.
- [ ] Screen Wake Lock is requested during focus and reacquired on visibility when available; unsupported browsers expose a disabled state with “Not supported on this device”.
- [ ] Browser checks exercise Break choice, skip, next-Session consent, background time correction, and feature detection; the headless clock seam covers Break transitions.
