# 06: Run and control a focus interval

**What to build:** The default Timer tab lets a User pick one of Today's Tasks, start a focus interval, pause or resume, finish, or stop early; focused time becomes a Check-in without completing the Task.

**Blocked by:** 03: Create a Task locally and sync it.

**Status:** resolved

- [x] The Timer preselects the most recently Session-used Task if it belongs to Today, otherwise the first incomplete Task in manual order, otherwise the first Task; a Task created there is selected. Completed Tasks remain eligible.
- [x] “Start Session” sits below the ring; no Task or no connection disables Start with the specified empty/offline guidance. Start re-enables on reconnect and atomically permits only one running or paused Session per User across devices, using the initiating device's local Day.
- [x] Running shows “Focusing on <Task>” instead of the picker, and offers Pause/Resume and Stop; paused time does not count or expire, and stopping saves elapsed whole minutes only when at least one minute has elapsed, otherwise discarding without a prompt.
- [x] Normal focus end creates exactly one Check-in with planned duration and Session origin, even when connection is lost after Start; finish, stop, and Task completion controls never change each other's state. No completion control appears on Timer.
- [x] A headless multi-device check covers competing Starts, offline finish, completed Task selection, pause/resume, early-save/discard boundaries, and no completion coupling; a browser check exercises the Timer.

## Verification

`pnpm run typecheck`, `pnpm run build`, `pnpm run smoke:browser` (22 passed), and `SMOKE_SERVER=production pnpm run smoke:browser` (22 passed) completed on 2026-09-24. Headless checks exercise competing Starts, ownership, pause/resume and offline control replay, minute boundaries, save/discard, first-wins finalization, two separate local stores, offline finish/reconnect, and completion independence. The browser exercises Task creation/selection, offline Start guidance, reconnect, Task completion during focus, pause, early discard, offline normal finish and Check-in display. The Timer was visually inspected at 375×812 and 1024×768. Live Google consent/callback still needs operator OAuth web client credentials and an authorized origin; the smoke suite uses test-only Better Auth sessions. Absence recovery and Breaks remain ticket 07/08.
