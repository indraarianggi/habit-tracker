# 09: Record and correct manual Check-ins

**What to build:** A User records focused work against an existing Task, sees Today's records on Timer, and corrects or removes mistakes without changing Task completion or restarting a Session.

**Blocked by:** 06: Run and control a focus interval.

**Status:** resolved

- [x] Timer shows Today's Check-ins with Task title, origin (“Pomodoro” or “Added by hand”), minutes, and Edit, or “No focus recorded today yet.”; “+” opens manual entry.
- [x] Manual entry chooses an existing complete or incomplete Task on Today or a past Day, never invents a past Task or targets a future Task; whole-minute duration defaults to focus length and accepts only 1–480.
- [x] Edit can correct duration or reassign to another eligible Task regardless of origin; Day always derives from the selected Task, not a separately editable field, and focused totals update on both Days.
- [x] Confirmed Check-in deletion removes its time but leaves completion unchanged and never reopens or re-finalizes its Session; all entry and correction actions work offline and later sync.
- [x] Headless checks cover duration boundaries, past/future eligibility, reassignment across Days, deletion, and Session independence; a browser check covers add and Edit from Timer.

## Verification

`pnpm run typecheck`, `pnpm run build`, `pnpm run smoke:browser` (47 passed), and `SMOKE_SERVER=production pnpm run smoke:browser` (47 passed) on 2026-09-25. Headless checks cover owned Task eligibility, minute limits, reassignment, Session receipts, deletion, offline convergence, and two-device behavior. The browser check creates Tasks and a Check-in offline, edits and deletes from Timer, then observes server sync; phone-width Timer and entry sheet screenshots were inspected, and the wide viewport has no horizontal overflow. Live Google consent/callback still requires operator-provided OAuth web client credentials and an authorized origin; browser checks use test-only credentials and Better Auth sessions.
