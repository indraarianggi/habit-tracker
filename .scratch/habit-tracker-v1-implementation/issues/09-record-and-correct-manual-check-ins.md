# 09: Record and correct manual Check-ins

**What to build:** A User records focused work against an existing Task, sees Today's records on Timer, and corrects or removes mistakes without changing Task completion or restarting a Session.

**Blocked by:** 06: Run and control a focus interval.

**Status:** ready-for-agent

- [ ] Timer shows Today's Check-ins with Task title, origin (“Pomodoro” or “Added by hand”), minutes, and Edit, or “No focus recorded today yet.”; “+” opens manual entry.
- [ ] Manual entry chooses an existing complete or incomplete Task on Today or a past Day, never invents a past Task or targets a future Task; whole-minute duration defaults to focus length and accepts only 1–480.
- [ ] Edit can correct duration or reassign to another eligible Task regardless of origin; Day always derives from the selected Task, not a separately editable field, and focused totals update on both Days.
- [ ] Confirmed Check-in deletion removes its time but leaves completion unchanged and never reopens or re-finalizes its Session; all entry and correction actions work offline and later sync.
- [ ] Headless checks cover duration boundaries, past/future eligibility, reassignment across Days, deletion, and Session independence; a browser check covers add and Edit from Timer.
