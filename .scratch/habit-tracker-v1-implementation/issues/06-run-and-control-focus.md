# 06: Run and control a focus interval

**What to build:** The default Timer tab lets a User pick one of Today's Tasks, start a focus interval, pause or resume, finish, or stop early; focused time becomes a Check-in without completing the Task.

**Blocked by:** 03: Create a Task locally and sync it.

**Status:** ready-for-agent

- [ ] The Timer preselects the most recently Session-used Task if it belongs to Today, otherwise the first incomplete Task in manual order, otherwise the first Task; a Task created there is selected. Completed Tasks remain eligible.
- [ ] “Start Session” sits below the ring; no Task or no connection disables Start with the specified empty/offline guidance. Start re-enables on reconnect and atomically permits only one running or paused Session per User across devices, using the initiating device's local Day.
- [ ] Running shows “Focusing on <Task>” instead of the picker, and offers Pause/Resume and Stop; paused time does not count or expire, and stopping saves elapsed whole minutes only when at least one minute has elapsed, otherwise discarding without a prompt.
- [ ] Normal focus end creates exactly one Check-in with planned duration and Session origin, even when connection is lost after Start; finish, stop, and Task completion controls never change each other's state. No completion control appears on Timer.
- [ ] A headless multi-device check covers competing Starts, offline finish, completed Task selection, pause/resume, early-save/discard boundaries, and no completion coupling; a browser check exercises the Timer.
