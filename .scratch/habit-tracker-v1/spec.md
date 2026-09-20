# Spec: Habit Tracker v1

Status: ready-for-agent

Sources: [map](map.md) and its resolved tickets 01–10 in `issues/`, [CONTEXT.md](../../CONTEXT.md), [ADR 0001](../../docs/adr/0001-server-backed-multi-user-local-first.md), [ADR 0002](../../docs/adr/0002-single-node-homelab-sqlite-litestream.md). Where this spec and a ticket disagree, the ticket's latest amendment wins and this spec should be corrected.

## Problem Statement

A person trying to build habits has no single place that both helps them do the focused work and shows them, at a glance, how consistent they have been. Timer apps forget what the time was spent on. Habit checklists only record "done / not done" and say nothing about how much effort went in. Both usually live on one device, so switching phones or clearing a browser can wipe the history that makes a habit visible. The history is what keeps them going. They want to see a streak grow and a calendar fill in, on any device, even without a connection.

## Solution

An installable, offline-capable web app (PWA) where a User signs in with Google and:

- Defines **Habits** (a name and a pastel colour, with no schedule or target).
- Runs a **Pomodoro Session** against a Habit. When the focus interval ends, a **Check-in** with that duration is recorded automatically. The User can also record Check-ins by hand, for any past **Day**.
- Sees their consistency on **Progress**: a GitHub-style **Activity Grid** shaded by minutes per Day, filterable to one Habit, next to **Streak** and total stats.
- Uses it on any device. Every read and write goes to the device first and syncs to the server in the background, so the app keeps working offline and history is never lost with a browser.

The app has three tabs (Timer, Progress, Habits) plus a Settings screen, with a mobile layout on every device (a maximum width on desktop).

## User Stories

### Signing in and accounts

1. As a new visitor, I want to sign in with my Google account, so that I can start without creating a password.
2. As a new visitor, I want my first Google sign-in to create my account automatically, so that there is no separate sign-up step.
3. As a User, I want my data to be completely private from other Users, so that nobody else can see my Habits or Check-ins.
4. As a User, I want to read the privacy policy from the sign-in screen before signing in, so that I know what is stored about me.
5. As a User, I want to stay signed in for about a week of normal use, so that I am not asked to sign in every day.
6. As a User whose sign-in has expired, I want the app to still open on my local data, so that I can keep working and sign in again later.
7. As a User whose sign-in has expired, I want a "Sign in to sync" status that opens Google sign-in, so that I can resume syncing in one tap.
8. As a User signing back in with the same account, I want my Pending changes uploaded, so that nothing I did while signed out of sync is lost.
9. As a User signing in with a different account on the same device, I want the previous account's local data left untouched, so that each account's data stays separate.

### Habits

10. As a new User with no Habits, I want a one-step "Create Habit" card on the Timer tab, so that I can start without an onboarding flow.
11. As a User, I want to create a Habit by giving it a name, so that I have something to record Check-ins against.
12. As a User, I want a new Habit to get a pastel colour automatically (the next unused one), so that my Habits are easy to tell apart without extra choices.
13. As a User, I want to pick a different colour from a fixed pastel palette when creating or editing a Habit, so that I can match colours to my taste.
14. As a User, I want Habit names to be unique regardless of case, so that I never have two Habits that look the same.
15. As a User, I want a clear message if a name is taken (including by an Archived Habit) or longer than 40 characters, so that I can fix it.
16. As a User, I want to rename a Habit and have the new name show everywhere, including on past Check-ins, so that my history stays consistent.
17. As a User, I want my Habits listed oldest first, so that the order is stable and predictable.
18. As a User, I want to archive a Habit I no longer do, so that it leaves my everyday lists without losing its history.
19. As a User, I want an Archived Habit's Check-ins to still count in the Activity Grid and stats, so that archiving never rewrites my past.
20. As a User, I want to restore an Archived Habit, so that I can pick it up again.
21. As a User, I want to permanently delete an Archived Habit and all its Check-ins, after a confirmation that names how many Check-ins will go, so that I can remove what I truly don't want.
22. As a User, I want Delete offered only for Archived Habits, so that I cannot wipe an active Habit by accident.
23. As a User, I want archive and delete blocked while that Habit has a running or paused focus interval ("Stop or finish the session first"), so that a session never loses its Habit.
24. As a User, I want the Habits tab to show active Habits, a collapsible "Archived" section (hidden when empty) and an add button, so that I can manage them in one place.
25. As a User, I want rename, colour, archive, restore and delete on a Habit's detail screen, so that the list stays simple.

### Pomodoro Sessions

26. As a User, I want to pick a Habit and press Start, so that I can begin a focused interval against it.
27. As a User, I want the Timer's Habit picker to preselect the Habit I last used, so that starting a repeat session takes one tap.
28. As a User, I want Archived Habits left out of the Timer picker, so that I only see Habits I am working on.
29. As a User, I want a focus interval of 25 minutes by default, so that I get the classic Pomodoro without setup.
30. As a User, I want to pause and resume the focus interval, with paused time not counted, so that interruptions don't inflate my minutes.
31. As a User, I want a paused session never to expire by itself, and to see "Resume or Stop" when I come back, so that I decide what happens to it.
32. As a User, I want to stop early and choose to save the elapsed focus time (whole minutes, rounded down) or discard it, so that partial work can still count.
33. As a User, I want a stop under one minute discarded without asking, so that I am not bothered about meaningless Check-ins.
34. As a User, I want a Check-in with the planned duration created automatically the moment focus ends, so that I don't have to confirm anything.
35. As a User, I want an on-screen alert and a sound when focus ends, so that I notice even if I'm looking away.
36. As a User, I want to choose a short Break, a long Break or no Break after each focus interval, so that I rest the way I need.
37. As a User, I want a Break to be skippable but not pausable, so that the rules stay simple.
38. As a User, I want an on-screen "Break over" alert with "Start next session" (using the last Habit), plus a different sound, so that I know when to go back to work.
39. As a User, I want the next session never to start by itself, so that I stay in control.
40. As a User, I want the countdown to stay accurate when the tab is in the background, the screen is locked or the device sleeps, so that the timer never drifts.
41. As a User who was away when focus ended (tab closed, screen locked), I want to be asked on return whether I finished fully, partly (entering minutes) or not at all, so that the Check-in reflects what really happened.
42. As a User who was away, I want that Check-in to land on the Day the focus was planned to end, not the Day I reopened the app, so that my grid stays truthful.
43. As a User, I want a session to become a Check-in or be discarded exactly once, even if it is recovered on several devices or after a reload, so that I never get duplicates.
44. As a User, I want the screen kept awake during focus (with a setting to turn that off), so that the countdown stays visible.
45. As a User, I want only one active session at a time across all my devices, so that I cannot accidentally double-count time.
46. As a User, I want to see and stop my running session from any of my devices, so that I can switch devices mid-session.
47. As a User offline, I want Start disabled with "Connect to the internet to start a session.", so that I understand why.
48. As a User offline with a session already running, I want it to finish normally and record its Check-in, so that losing connection never loses work.
49. As a User, I want Start to re-enable by itself when the connection returns, so that I don't need to reload.
50. As a User, I want a session to keep the durations it started with even if I change settings mid-session, so that settings changes are never retroactive.

### Check-ins

51. As a User, I want to add a Check-in by hand with Habit, Day (defaulting to today) and duration (defaulting to my focus length), so that I can record work done away from the timer.
52. As a User, I want to backdate a Check-in to any past Day, so that I can fill in history I forgot.
53. As a User, I want future Days rejected, so that my history can only contain what has happened.
54. As a User, I want duration in whole minutes, above zero and at most 480, so that typos like "4500" are caught.
55. As a User, I want many Check-ins for the same Habit on one Day, so that separate bursts of work each count.
56. As a User, I want each Check-in's Day fixed when it is recorded, so that travelling across time zones never moves my history or breaks my Streak.
57. As a User, I want a session that crosses midnight to count on the Day its focus ended, so that the rule is simple and predictable.
58. As a User, I want to edit a Check-in's Habit, Day and duration, whether it came from a session or was entered by hand, so that I can fix mistakes.
59. As a User, I want to move a Check-in of an Archived Habit to an active Habit, but not to another Archived Habit, so that I can correct history without reviving old Habits.
60. As a User, I want to delete a Check-in after a confirmation, so that I can remove one recorded by mistake.
61. As a User, I want today's Check-ins listed under the timer (or "No Check-ins today yet."), so that I can fix a wrong one quickly.
62. As a User, I want a "+" on the Timer for a manual Check-in, so that recording by hand is always one tap away.
63. As a User, I want to record Check-ins while offline, so that I can log work anywhere.

### Activity Grid and Progress

64. As a User, I want a GitHub-style Activity Grid (weeks as columns, Monday start, Mon/Wed/Fri and month labels) that fits the screen width without scrolling, so that I see my consistency at a glance on a phone.
65. As a User, I want each Day shaded by total minutes across my Check-ins in five levels, so that effort, not just presence, is visible.
66. As a User, I want levels relative to my own history (quartiles of my non-zero Days), so that the grid is meaningful whether I do 10 or 200 minutes a day.
67. As a new User with fewer than 8 non-zero Days, I want fixed thresholds (1–15, 16–30, 31–60, over 60 minutes), so that the grid is meaningful before quartiles make sense.
68. As a User, I want a legend stating the minute ranges currently in force, so that I can read the shades exactly.
69. As a User, I want the default range to be the last 3 months, ending today, with a selector for a longer range, so that cells are large enough to read and tap.
70. As a User, I want the day of the month visible inside cells at the 3-month range, so that I can find a date without hovering.
71. As a User, I want today outlined, so that I know where I am.
72. As a User, I want no cells drawn after today, so that the grid shows nothing that can't have happened.
73. As a User, I want hovering (desktop) or tapping (touch) a Day to show a tooltip with date, total minutes, Check-in count and a per-Habit breakdown, so that I can see exactly what happened.
74. As a User on a touch screen, I want taps to resolve to the nearest cell, so that small cells are still easy to hit.
75. As a User, I want a "Details" action on the tooltip that opens a sheet listing that Day's Check-ins with edit, delete and "Add Check-in" pre-filled with the Day, so that backdating and fixes happen right from the grid.
76. As a User, I want "Details" on empty Days too, so that I can add a Check-in to a Day I missed.
77. As a User, I want filter chips ("All" plus one per active Habit, single-select), so that I can see one Habit's grid.
78. As a User, I want a filtered grid shaded by that Habit's minutes only and recoloured in its hue, so that the view clearly belongs to that Habit.
79. As a User, I want an "Archived" chip (hidden when there are none) that lets me pick an Archived Habit as the filter, so that old history stays viewable.
80. As a User, I want switching range never to recolour a Day (levels come from my whole history under the filter), so that the grid is stable.
81. As a User with Habits but no Check-ins, I want the empty grid visible with "Your first Check-in will light up today.", so that I know what to expect.
82. As a User with no Habits, I want Progress to show the empty grid and "Create a Habit to start tracking" leading to Habits, so that I know the next step.
83. As a User, I want a Current streak and a Longest streak, following the filter chip, so that I can see my consistency for one Habit or for all.
84. As a User, I want today's missing Check-in not to break my Streak until the Day is over, so that I don't see my Streak reset every morning.
85. As a User, I want Streaks recomputed immediately when I backdate, edit or delete a Check-in, so that they are always correct.
86. As a User viewing an Archived Habit, I want its Current streak tile to read "Archived", so that a stopped Habit doesn't look like a failure.
87. As a User, I want Focused time, Check-ins and Active days for the selected range, labelled with the range, so that I know what period they cover.
88. As a User, I want a per-Habit minutes breakdown under "All" (including Archived Habits marked "archived", only Habits with minutes, hidden when empty), so that I see where my time went.
89. As a User, I want stat tiles to show real zeros ("0 min", "0", "0 days") rather than dashes, so that an empty state reads plainly.

### Accessibility and theme

90. As a keyboard User, I want the grid to be one tab stop with arrow keys (weeks left/right, weekdays up/down, Home/End for the week), so that I can explore it without a mouse.
91. As a keyboard User, I want Enter or Space to open a Day's Details sheet, and focus to show the same tooltip as hover, so that I have the same abilities as a pointer User.
92. As a screen-reader User, I want every cell labelled in full ("12 September, 45 minutes, 2 Check-ins" / "13 September, no Check-ins"), so that the grid is understandable without colour.
93. As a User with low vision or colour-vision differences, I want level 1 to stand out from level 0 and the levels to rise in luminance (readable in greyscale), so that shade differences are perceivable.
94. As a User, I want the day-of-month numbers readable at every level, so that the grid is legible in both themes.
95. As a User, I want the app to follow my system light/dark setting by default, with a System/Light/Dark override, so that it looks right on my device.

### Offline, sync and install

96. As a User, I want everything I do to save on the device first, so that the app is fast and works without a connection.
97. As a User, I want my data to sync across all devices I sign in on, so that I can switch devices freely.
98. As a User, I want a header status pill only when something needs attention ("Offline", "N changes waiting", "Can't sync", "Sign in to sync"), so that the header stays calm when all is well.
99. As a User, I want tapping the pill to explain the status in plain words and offer "Sync now", so that I can recover without technical knowledge.
100. As a User, I want failed syncs retried automatically with backoff and immediately on reconnect or return to the app, so that I rarely need to do anything.
101. As a User, I want "Can't sync" only after three consecutive failures while online, so that a single hiccup doesn't alarm me.
102. As a User, I want edits made on two devices resolved in favour of the last one the server received, and a deletion to beat an edit, so that conflicts resolve predictably.
103. As a User, I want edits that lost to a later change updated silently, so that I am not interrupted over small conflicts.
104. As a User whose offline Check-in was dropped because its Habit was deleted on another device, I want a dismissible banner naming the Check-in and the Habit, so that I know data was lost and why.
105. As a User signing in on a new device, I want a full "Loading your data…" screen until my data arrives, so that I never mistake an empty state for lost history.
106. As a User whose first load is interrupted, I want "Connect to the internet to load your data." with "Try again", resuming by itself, so that I can recover.
107. As a User, after my first Check-in, I want a dismissible card inviting me to install the app (browser prompt on Chrome/Android, Share → Add to Home Screen steps and the reason on iOS), so that I get durable storage without being nagged on first visit.
108. As a User who dismissed the install card, I want "Install app" in Settings (hidden when already installed), so that I can install later.
109. As a User, I want the app to ask the browser for durable storage silently after my first Check-in, so that my Pending changes aren't evicted.
110. As a User, I want a "New version available" banner with Reload, disabled during a running or paused focus interval ("Update after your session"), so that an update never kills a session.

### Settings and account

111. As a User, I want to open Settings from my Google profile photo in the header, so that it is always reachable without a fourth tab.
112. As a User, I want to see which Google account is signed in (photo, name, email), so that I know whose data I'm looking at.
113. As a User, I want to set focus (1–120), short Break (1–30) and long Break (1–60) minutes with steppers that can also be typed into, saving immediately, so that the timer fits me.
114. As a User, I want an invalid duration to revert with a small message, and "Reset to defaults" to restore 25/5/15, so that I can't break my settings.
115. As a User, I want my durations synced across devices, so that the timer behaves the same everywhere.
116. As a User, I want separate on/off toggles for the focus-end and Break-end sounds, per device, so that I can silence one device without affecting others.
117. As a User, I want device-only settings marked "Only on this device", so that I know which settings sync.
118. As a User, I want the Wake Lock setting shown disabled with "Not supported on this device" where it isn't supported, so that I understand why it has no effect.
119. As a User, I want to sign out, with a quick sync first and a warning only if some changes couldn't sync, so that I know what stays on the device.
120. As a User, I want to delete my account from a clearly separated Danger zone, see real counts of what will be lost, learn that backups keep a copy for up to 30 days, and type `DELETE` to confirm, so that I can leave safely and knowingly.
121. As a User offline, I want Delete account disabled with a reason, so that I don't think it silently failed.
122. As a User who deleted their account, I want this device wiped for me and a confirmation line on the sign-in screen, so that I know it's done.
123. As a User whose account was deleted on another device, I want this device to wipe my data and tell me on the sign-in screen, so that nothing stale remains.
124. As a User, I want a static privacy policy at `/privacy` that works offline, so that I can always read what is stored.

### Operator (the developer running the homelab)

125. As the operator, I want the app deployed from GitHub Actions to GHCR and to the homelab over SSH through Tailscale, so that releases are one push.
126. As the operator, I want schema migrations to run at start-up before traffic, so that deploys don't need manual steps.
127. As the operator, I want the database continuously replicated off-site with 30-day retention, and a restore drill before launch and every quarter, so that a disk or house failure never loses Users' history.
128. As the operator, I want an alert when the homelab stops or replication falls behind, so that I find out before Users do.
129. As the operator, I want per-IP and per-User rate limits (looser on sync, stricter on sign-in) that trust the client IP only from the tunnel and proxy, so that open sign-up can't be abused.

## Implementation Decisions

### Stack and architecture

- **Client:** TypeScript, React, TanStack Start in SPA mode (static shell, client-rendered UI). A service worker precaches the shell, assets and `/privacy`. IndexedDB via Dexie is the device store, with `liveQuery` driving the UI. It holds data per User. Pin the TanStack Start version (its release status is unconfirmed).
- **Server:** TypeScript in the same repo and package through TanStack Start server routes and server functions. SQLite in WAL mode through `better-sqlite3` and Drizzle. No separate backend.
- **Shared contract module:** Zod schemas for every synced record and every endpoint payload, used by client and server. Validation rules (duration 1–480 whole minutes, Day not in the future, name ≤ 40 characters, duration setting limits) live here once.
- **Auth:** Better Auth with the Google provider, open sign-up (first sign-in creates the User). Sessions last 7 days and are refreshed at most once a day when used. Check Better Auth's compatibility with TanStack Start and SQLite early.
- **Hosting:** follows ADR 0002. A single homelab node running Docker Compose (Node app, Nginx, Litestream) behind the existing `cloudflared` tunnel, on an isolated network with no open ports. Nginx trusts the real-IP header only from `cloudflared`. Litestream replicates to R2 or B2 with 30-day retention, and a restore runbook is written. A healthchecks.io or UptimeRobot ping plus a check on replica age.
- **Release:** GitHub Actions builds and pushes the image to GHCR, then deploys over SSH through Tailscale with a deploy-only account and a limited ACL. Migrations run on start before traffic.
- **Rate limiting:** in the app, in memory (one instance), per IP and per User.
- **UI copy:** English only, no i18n layer. Strings quoted in this spec and in tickets 08–10 are final text.

### Modules (deep modules, small interfaces)

1. **Domain rules.** Pure functions with no I/O:
   - Check-in validation (Habit active for new Check-ins, Day ≤ today, 1–480 whole minutes). A move to an Archived Habit is rejected.
   - Habit name uniqueness (case-insensitive, across active and archived) and colour auto-assignment (next unused colour from the fixed pastel palette, repeating when exhausted).
   - Streak: current and longest, for one Habit or all. It runs back from today if today has a Check-in, otherwise from yesterday.
   - Grid shading: fixed thresholds 1–15 / 16–30 / 31–60 / >60 while there are fewer than 8 non-zero Days under the filter, then quartiles of non-zero Days over the User's whole history under the filter. Returns levels plus the legend ranges in force.
   - Stats for a range and filter (Focused time, Check-ins, Active days, per-Habit breakdown).
   - Day computation: local calendar date string (e.g. `2026-09-19`) from a wall-clock instant, in device local time.
2. **Pomodoro Session state machine.** Pure transitions over a persisted record with an injected clock. States: running, paused, completed, abandoned, plus Break (short/long) and ready. Events: start, pause, resume, stop(save|discard), tick/visibility, focus-end, choose-break, skip-break, break-end, recover-on-open(full|partial minutes|none). Its outputs are "create Check-in (Habit, Day, minutes)" and "raise alert". The alert-delivered/finalised flag guarantees a Check-in is created or discarded exactly once. Remaining time is always computed from stored wall-clock timestamps (`Date.now()`), never from counted ticks and never from `performance.now()`.
   - Persisted session record (from ticket 04): Habit, session id, planned focus duration and Break durations in force at start, wall-clock start/end, pause data, status, alert-delivered flag.
   - Day of the resulting Check-in: focus end (normal), the moment Stop was pressed (stop early), or the planned end time (user away).
3. **Local store (repository).** A Dexie-backed API for Habits, Check-ins, the settings record and the active Pomodoro Session. Every mutation writes the record and an outbox entry in one transaction. Scoped per User, and wiping one User leaves other Users' data untouched.
4. **Sync client.** Pushes the outbox in batches, pulls changes since the last `seq` in pages, applies them to the local store, and handles tombstones. It exposes a status for the pill (synced / offline / N pending / can't sync / sign in to sync), backoff (seconds, rising to a 5-minute cap; immediate on `online`, foreground and "Sync now"), a consecutive-failure count (≥ 3 online → "Can't sync"), dropped-Check-in notices, and "account gone" handling (wipe that User's local data, return to sign-in).
5. **Sync server.** Server routes for push and pull, plus server functions for the active Pomodoro Session and account deletion.
6. **Grid view model.** Turns local data, the selected range, the filter and today into cells: weeks × weekdays with Monday start, no future cells, level, label text, today flag and tooltip data. The rendered grid component stays thin over it. It implements `role="grid"` with a roving tabindex and the key bindings above, plus nearest-cell pointer resolution.
7. **Timer runtime adapter.** The browser side of the state machine: tick loop, `visibilitychange`/`pageshow` recompute, Web Audio unlocked by the Start gesture (two distinct tones), Screen Wake Lock requested during focus and re-requested on visibility, and feature detection for the disabled "Not supported on this device" state.
8. **PWA shell.** Service worker, update banner (Reload is gated by an active focus interval), install card logic (after the first Check-in, dismissible, never shown when installed, iOS instructions), and a silent `navigator.storage.persist()` after the first Check-in.

### Data model and sync contract

- Synced record types: **Habit** (id, name, colour, archived flag, created time), **Check-in** (id, Habit id, Day as a local date string, duration in minutes, origin: session or manual), **settings** (one record per User: focus, short Break, long Break minutes), **active Pomodoro Session** (one per User, the record above). Every record carries User id, server `seq` and updated metadata.
- There is no start or end time on a Check-in, and no note field.
- Ids are UUIDv7, generated by the client. Resent changes are idempotent because each change carries its own id.
- The server assigns a monotonically increasing `seq` to every accepted change (single writer, ADR 0002).
- **Last-write-wins on the whole record**, in server order (not device clocks).
- A **deletion is a tombstone** (id plus `seq`, no content) kept while the account exists. A deletion beats a later-arriving edit or restore of the same record.
- **Habit delete cascades** to its Check-ins, with a tombstone for each. A Check-in pushed later for a deleted Habit is rejected, and the client shows the dropped-Check-in banner ("1 Check-in (25 min on Reading, 12 Sep) wasn't saved because Reading was deleted on another device."). A Check-in pushed for a Habit that was only archived is accepted, and the Habit stays archived.
- **Active Pomodoro Session:** at most one per User on the server. Start requires a connection (a server function that fails if one is already active). Any device can stop it. Offline, a running session can still finish locally, and its Check-in syncs later.
- **Device-only settings** (two sound toggles, Wake Lock, theme) live in local storage per device and never sync.
- **Account deletion** is a server function. It removes the User and all rows immediately (backups keep them up to 30 days). Other devices learn about it on their next sync ("account gone"), then wipe that User's local data, including Pending changes.
- **Sign-out:** when online, try a short sync first. If it fails or the device is offline, show the dialog with the Pending change count. Pending changes stay on the device for that User.

### Screens (final structure)

- **Header** on all tabs: status pill (only when needed) and the profile photo, which opens Settings.
- **Timer (default tab):** the Habit picker (preselects the last used, excludes archived), Start (disabled offline with its reason), the running, paused and Break views, today's Check-ins or "No Check-ins today yet.", "+" for a manual Check-in, the install card, and the dropped-Check-in banner. With no Habits, the "What do you want to build a habit around?" create card replaces the picker and Start.
- **Progress:** the Activity Grid hero tile in bento style (flat pastel tiles, large radii, warm background), range selector, legend, filter chips (All, active Habits, "Archived" chip when any exist), stat tiles, per-Habit breakdown, and the Details sheet.
- **Habits:** active list, collapsible Archived section, add button, and a Habit detail screen (rename, colour, archive/restore, delete when archived).
- **Settings (full screen with back):** Account card with a neutral Sign out; Timer group (durations, Reset to defaults, two sound toggles, Keep screen awake); Appearance (System/Light/Dark); App (Install app, Privacy policy); Danger zone (Delete account sheet with real counts and a typed `DELETE`, disabled offline).
- **Sign-in screen:** Google button, `/privacy` link, and the one-line notes for "account deleted" (on another device vs by you).
- **Loading screen** for the first download on a new device, with offline and "Try again" handling.

### Resolved leftovers (taken from uncontested recommendations in ticket 05)

- **Range options:** 3 months (default) and 6 months only. 12 months is dropped because cells fall to about 4–5 px.
- **"All" hue:** mint, the prototype default. Habit hues come from the same pastel palette as Habit colours.

## Testing Decisions

- **What makes a good test:** it exercises behaviour through a public interface, as a User or another device would observe it, and never asserts on internal state, private helpers or call counts. Tests read like the user stories above: given Check-ins and a clock, the Streak is N; given two devices editing offline, both end with value X. A test should survive any refactor that keeps behaviour the same.
- **Seam 1: the headless app core (Vitest).** This is the main seam. Tests drive the app core through its public API (local store, domain rules, Pomodoro Session state machine, sync client) with:
  - a **fake clock** (wall-clock time, local time zone, Day rollover, device sleep and "user away" gaps);
  - **several simulated devices**, each with its own local store (fake IndexedDB), talking to the **real server sync routes on in-memory SQLite**.
  
  This covers Streak and stats, shading levels and legend ranges (including the change at 8 non-zero Days), Check-in validation, Habit rules, every Pomodoro Session path (finish, pause and resume, stop-early save/discard/under a minute, user away full/partial/none, exactly-once creation, crossing midnight), and multi-device sync (offline edits, idempotent resend, last-write-wins in server order, deletion beats edit or restore, cascade and dropped-Check-in notices, archived-Habit Check-ins kept, one active session per User, account deletion wiping other devices, per-User isolation on a shared device, sign-out keeping Pending changes).
  - **Palette contrast test**, on the same seam: for every hue ("All" and each Habit colour) in light and dark, level 1 vs level 0 ≥ 3:1 against the tile background, luminance strictly rising across levels, and day-number text ≥ 4.5:1 at every level.
  - **Grid view model** tests: no future cells, Monday start, cell labels, and keyboard navigation outcomes.
- **Seam 2: Playwright end to end.** A small set of critical journeys against the built app with a stubbed Google sign-in:
  - first-run create Habit → Start → focus ends → Check-in appears;
  - manual and backdated Check-in via the Details sheet;
  - offline emulation (Start disabled, manual Check-in queues, pill shows "N changes waiting", syncs on reconnect);
  - update banner gating;
  - PWA install and precached `/privacy` offline;
  - keyboard navigation of the grid.
- **Manual device checks** (not automated): iOS lock-screen timer behaviour, the alert sounds with the iOS mute switch, Wake Lock on installed iOS before and after 18.4, and install flows on real iOS and Android.
- **Prior art:** none. The repo has no code yet, so these tests set the patterns. Ticket 07 already names Vitest with a fake clock, multi-device sync tests on in-memory SQLite, and Playwright with offline emulation.
- Coverage thresholds and CI gates are left to `to-tickets`. At a minimum, both seams run in GitHub Actions before an image is pushed.

## Out of Scope

- Habit targets, schedules or frequency ("3x a week").
- Export and import of data.
- Habit categories or tags.
- Sharing and social features (seeing another User's grid, leaderboards, shared Habits).
- Sign-in methods other than Google, and with them password reset and email verification.
- Reminders and notifications of any kind: system notifications, Web Push, daily reminders.
- Auto-start of Breaks or sessions, and an "every 4th session" long-Break rule.
- Per-Habit timer durations, Check-in notes, and start/end times on Check-ins.
- Undo or trash for deleted Check-ins or Habits.
- A global scrolling list of all Check-ins.
- Manual Habit reordering and a free colour picker.
- Averages, trends, "best day" and any stats beyond the six listed.
- A 12-month grid range.
- Language, week-start, time-zone and day-cutoff settings.
- A "sign out and erase this device" option.
- Google re-authentication before account deletion.
- Terms of Service.
- Analytics and trackers.
- Horizontal scaling or Postgres (see ADR 0002).

## Further Notes

- **Build-time risks, not blockers:** iOS behaviour on a locked screen, worker timers under throttling, Web Audio with the iOS mute switch, TanStack Start's release status, and Better Auth working with TanStack Start and SQLite. The design holds either way: the "user away" flow is the safety net for any missed alert.
- **Tunables:** the threshold of 8 non-zero Days for switching to quartiles may be tuned during the build. Sync backoff constants may be tuned within "seconds, up to 5 minutes".
- **Accepted trade-offs:**
  - a User's Pending changes can remain on a shared device after sign-out;
  - switching once from fixed thresholds to quartiles may recolour some cells;
  - starting a session needs a connection (revisit if it hurts);
  - deleted data stays in backups for up to 30 days, and Users are told so.
- The privacy policy's full text is written during the build. Its outline is fixed in ticket 10.
- The prototype `prototypes/05-activity-grid-look/b-bento.html` is the visual reference for the Progress tab.
- The repo is not a git repository yet. Initialise one before the build so work can go on branches.
