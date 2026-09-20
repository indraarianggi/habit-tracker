# Pomodoro Session rules

Type: grilling
Status: resolved

## Question

How does a Pomodoro Session behave, and when does it become a Check-in?

Cover at least:

- Focus, short-break and long-break lengths: fixed defaults or user-configurable, and per Habit or global.
- Pause, resume and stop.
- What a session that is stopped or abandoned partway does: discarded, or recorded as a Check-in with the elapsed time.
- Whether a finished session creates its Check-in automatically or asks the user to confirm.
- Whether breaks count toward a Check-in's duration.
- Whether a session must be started against a Habit or can run without one.

Domain context: see `CONTEXT.md` (Pomodoro Session, Check-in). A Check-in's duration is measured when it comes from a session.

## Answer

Resolved with the user in two grilling rounds. Vocabulary added to `CONTEXT.md`: **Break**; **Pomodoro Session** redefined as one focus interval followed by a Break the user chooses.

- **Durations.** One global, user-configurable setting: focus 25 min, short Break 5 min, long Break 15 min by default. No per-Habit timer settings. A session stores the durations in force when it started; changing the settings never affects a running session.
- **Shape.** A session is one focus interval against one Habit (a Habit is required), then a Break. No auto-start: when the focus interval ends the user picks a short Break, a long Break, or skips it, and starts the next session by hand. There is no "every 4th session" long-break rule.
- **Pause and resume.** The focus interval can be paused and resumed. Paused time does not count. There is no cap on pause length. A Break cannot be paused but can be skipped.
- **Stop early.** The user chooses to save or discard. Saving creates a Check-in with the active focus time rounded down to whole minutes. Under 1 minute is discarded without asking, since a Check-in must have a duration above zero.
- **Finish (user present).** The Check-in is created automatically, with the planned focus duration, the moment the focus interval ends. Break time never counts toward duration, and the Check-in does not wait for the Break. Fixing or deleting a wrong one belongs to Check-in rules.
- **Finish (user away).** If the end time has passed when the app is next opened (tab closed, screen locked, device asleep), the app asks whether the user finished fully, partly (user enters minutes), or not at all, and creates the Check-in or discards the session accordingly. The Break prompt is skipped; the app offers to start another session. This is the only case where a session asks for confirmation.
- **Forgotten paused session.** No auto-expiry. On open, a paused session shows "Resume or Stop" first; Stop goes through the save-or-discard prompt above.
- **Concurrency.** Exactly one active session across the whole app.
- **End-of-focus alert.** On-screen display and a sound only (audio unlocked by the Start gesture). No system notifications and no Web Push in v1; see the map's Out of scope.

Handed to other tickets: which calendar day a Check-in belongs to, including a session that crosses midnight or is resumed on a later day (Check-in rules); the state a session must persist, which follows from the timestamp-based recovery above (Reliable browser timers, Tech stack and hosting).

## Amendments

Amended by [Settings and account screen](10-settings-and-account-screen.md): a Break also ends with an alert. An on-screen "Break over" with a "Start next session" button, plus a sound (a different tone from the end-of-focus sound). Each sound has its own on/off setting, kept per device. There is still no auto-start.
