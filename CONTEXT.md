# Habit Tracker

A web app for choosing concrete tasks for a Day, doing focused work on them with a Pomodoro timer, and reviewing focus history over time. **Habit Tracker** is the product name only; Habit is not a domain object.

## Language

**User**:
A person who signs in and owns their own Tasks, Check-ins and Pomodoro Sessions. The same data is available from every device the User signs in on.
_Avoid_: Account, member, owner

**Task**:
A concrete to-do item the User intends to work on during exactly one Day; it exists independently of any Pomodoro Session and never moves between Days. It has a title and reversible completion state, is identified independently of its title, and can be copied only as a distinct incomplete Task for a later non-past Day.
_Avoid_: Habit, Focus Task, Goal

**Check-in**:
One countable record of focused time retained against exactly one Task and assigned to that Task's Day. It always carries a duration greater than zero and an origin of Pomodoro Session or manual entry. A Task can have many Check-ins.
_Avoid_: Completion, log, tick, Focus Record

**Pomodoro Session**:
One timed focus interval run against a Task for the current Day; the Task may already be complete. Every Pomodoro Session has a Task, and at most one is active per User across all devices. Finalizing its focus interval exactly once either produces one Check-in or records that the focus was discarded.
_Avoid_: Timer, sprint, focus block

**Break**:
The rest after a Pomodoro Session's focus interval, short or long, chosen by the user each time, or skipped. Break time never counts toward a Check-in's duration.
_Avoid_: Rest, pause

**Day**:
A calendar day from midnight to midnight in the User's local time; every Task belongs to exactly one Day and never moves to another. Every Check-in inherits its Task's Day, including when its Pomodoro Session crosses midnight or is recovered later.
_Avoid_: Date (when meaning the whole 24 hours), cutoff day


**Pending change**:
Anything the User created, edited or deleted on a device that the server has not received yet, such as a Check-in recorded offline. It stays on the device until it syncs, including after the User signs out.
_Avoid_: Unsynced data, dirty record, queued item

**Activity Grid**:
The GitHub-style calendar of Days, each shaded by the total Check-in duration that Day, across all Tasks.
_Avoid_: Heatmap, contribution graph, streak chart

**Active Day**:
A Day with at least one Check-in. Task creation or completion without focused time does not make a Day active.
_Avoid_: Productive Day, completed Day

**Focus Streak**:
A consecutive run of Active Days across all Tasks. It is never scoped to one Task, and Today does not break the current run until Today ends.
_Avoid_: Habit Streak, Task streak
