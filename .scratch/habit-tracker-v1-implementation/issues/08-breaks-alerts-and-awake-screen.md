# 08: Take Breaks and receive alerts

**What to build:** After focus, a User chooses a short Break, long Break, or none, receives distinct end alerts, and can keep the countdown screen awake where supported.

**Blocked by:** 06: Run and control a focus interval; 07: Recover focus after absence.

**Status:** resolved

- [x] Focus end offers a short Break, long Break, or none; the Break names the preceding Task, may be skipped, cannot be paused, and never adds focused minutes.
- [x] Break end displays “Break is over!” with “Start Next Session”; the same Task is reused only while eligible and no next Session starts automatically. A missed Break-end alert does not open a focus-recovery prompt.
- [x] Focus and Break ends use distinguishable on-screen and Web Audio alerts, unlocked by a User gesture, with countdowns corrected on foreground return rather than counting background ticks.
- [x] Screen Wake Lock is requested during focus and reacquired on visibility when available; unsupported browsers expose a disabled state with “Not supported on this device”.
- [x] Browser checks exercise Break choice, skip, next-Session consent, background time correction, and feature detection; the headless clock seam covers Break transitions.

## Verification

`pnpm run typecheck`, `pnpm run build`, `pnpm run smoke:browser` (33 passed), and `SMOKE_SERVER=production pnpm run smoke:browser` (33 passed) on 2026-09-24. Browser checks cover both Break lengths, no Break, skip, explicit next-Session start, disabling reuse of a Task after its Day, a missed Break end after backgrounding/reload, distinct gesture-unlocked audio tones, supported Wake Lock release/reacquisition, and the unsupported disabled state. Headless fake-clock and two-device checks cover break deadlines, no extra Check-in, and clearing a break offer when a conflicting server outcome discarded the focus. The Break choice and running views were visually inspected at 375×812 and 1024×768. Pencil desktop was unavailable for direct `.pen` inspection; the existing design tokens and Timer layout were preserved.

A live Google consent/callback still requires the operator's Google OAuth web client ID/secret, authorized app origin and callback, plus `BETTER_AUTH_URL` and a 32+-character `BETTER_AUTH_SECRET`. The automated smoke suite supplies test-only values. Actual mobile audio output and Wake Lock behavior still need a real-device check.
