# Reliable browser timers

Type: research
Status: resolved

## Question

How can a web app run an accurate Pomodoro countdown when the tab is in the background, the screen is locked, or the browser throttles timers?

Find, from primary sources (MDN, browser vendor docs, specs):

- How `setInterval`/`setTimeout` are throttled in background tabs on Chrome, Safari and Firefox, on desktop and mobile.
- Whether timestamp-based timing (store the start time, compute remaining time on each tick) is enough, and what a Web Worker adds.
- What the Notification API, the Web Audio API and the Screen Wake Lock API offer for alerting the user when a session ends, and their permission and platform limits (especially iOS Safari).
- What happens to a running timer if the tab is closed or the browser is restarted, and what state must be persisted to recover it.

Scope note: system notifications and Web Push are out of scope for v1 (see the map and [Pomodoro Session rules](01-pomodoro-session-rules.md), which settles an on-screen and sound alert only). The Notification API findings are context, not decision input; the facts that matter are throttling, timestamp-based timing, Web Audio unlock, Wake Lock, and what to persist for recovery after a closed tab.

Findings go to `.scratch/habit-tracker-v1/research/04-reliable-browser-timers.md`. The ticket is resolved when a human has read them and recorded the decision-relevant facts as its answer.

## Research

Page timers are only "at least this long": browsers may delay them, hidden tabs are throttled (about 1 second; Chrome drops to once per minute after 5 minutes hidden; Firefox Android 15 minutes), and nothing in page code runs when a tab is frozen, discarded or closed, so a countdown has to be computed from a stored wall-clock timestamp rather than counted in ticks. A Web Worker dies with the page and no primary source confirms its timers escape throttling. Notifications need HTTPS, a user-gesture permission prompt, a service worker on mobile, and on iOS a Home Screen install (16.4+). Web Audio needs a user-gesture unlock. Screen Wake Lock only works while the page is visible. Alerting with the page closed needs server-sent Web Push, because scheduled local notifications were discontinued. iOS lock-screen timer behaviour is unverified and needs a device test. Full findings: [research/04-reliable-browser-timers.md](../research/04-reliable-browser-timers.md).

## Answer

Resolved with the user after they read [the research](../research/04-reliable-browser-timers.md). No new vocabulary.

- **Timing.** A running focus interval is stored as a wall-clock timestamp (`Date.now()`); the remaining time is recomputed on every tick and on `visibilitychange` and `pageshow`. Ticks are only a display refresh, never the source of truth. `performance.now()` is not used because it stops during device sleep. The device clock is trusted: there is no protection against clock changes, since Check-ins are editable anyway ([Check-in rules](02-check-in-rules.md)).
- **Alert is best-effort.** The end-of-focus alert stays on-screen and sound only. Page code does not run when a tab is frozen, discarded or closed, and a Web Worker dies with the page, so the alert can be late (up to about a minute in a hidden Chrome tab) or missing (a locked iOS screen). The "user away" flow of [Pomodoro Session rules](01-pomodoro-session-rules.md) (full, partial or none) is the safety net and the only recovery path. Web Push stays out of scope. The AudioContext is unlocked by the Start button gesture.
- **Screen Wake Lock is in v1.** It is requested automatically during the focus interval, has an on/off setting, and is requested again whenever the page becomes visible. It only helps while the app is in the foreground, and it does not work in an installed iOS web app before iOS 18.4.
- **State persisted for recovery.** Habit, session id, planned duration, wall-clock start or end time, pause data, status (running, paused, completed, abandoned) and an alert-delivered flag, so a restored session past its end time becomes a Check-in or is discarded exactly once. This record is part of the one synced active session per User ([Storage and accounts](03-storage-and-accounts.md)).
- **Storage durability facts for later tickets.** Safari tabs lose script-writable data after 7 idle days; installed Home Screen web apps are exempt. `navigator.storage.persist()` opts an origin out of eviction.
- **Open risk, not a blocker.** iOS timer behaviour on a locked screen, worker timers under throttling, and Web Audio with the iOS mute switch are unverified. The design holds either way, so they are verified during the build, not before the spec.
