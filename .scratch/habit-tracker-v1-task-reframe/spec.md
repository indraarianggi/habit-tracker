# Spec: Habit Tracker v1 (Task reframe)

Status: ready-for-agent

Sources: [map](map.md) and its resolved tickets 01–06 in `issues/`, the accepted UI design in [`habit-tracker.pen`](../../habit-tracker.pen), the [task-first prototype](prototypes/05-task-first-workflow/index.html), [CONTEXT.md](../../CONTEXT.md), [ADR 0001](../../docs/adr/0001-server-backed-multi-user-local-first.md), [ADR 0002](../../docs/adr/0002-single-node-homelab-sqlite-litestream.md).

This spec **supersedes** [`.scratch/habit-tracker-v1/spec.md`](../habit-tracker-v1/spec.md). That spec's decisions are carried over wherever the Task reframe does not contradict them; where the two disagree, this one wins. Its tickets 01–10 remain useful decision history, but any decision that assumes a recurring **Habit** label is no longer authoritative. Where this spec and a task-reframe ticket disagree, the ticket wins and this spec should be corrected.

**Habit is not a domain or UI term.** *Habit Tracker* is the product name only.

## Problem Statement

A person who wants to get focused work done has no single place that both runs the focus session and remembers what the effort went into. Timer apps forget what the time was spent on. To-do apps record only "done / not done" and say nothing about how much effort a thing actually took. Nothing shows, at a glance, how consistently the person has put in focused work over weeks and months.

The history is what keeps them going: seeing a streak survive and a calendar fill in. But that history usually lives on one device, so switching phones or clearing a browser wipes it. They want to decide what they will work on today, focus on it in concrete intervals, and then look back across months — on any device, even without a connection.

## Solution

An installable, offline-capable web app (PWA) where a User signs in with Google and:

- Plans **Tasks** — concrete to-do items, each belonging to exactly one **Day**, with a title and a reversible completion state. A Task never moves between Days; unfinished work can only be **copied forward** as a new, distinct Task.
- Runs a **Pomodoro Session** against one of Today's Tasks. When the focus interval ends, a **Check-in** carrying that duration is recorded against the Task automatically. The User can also record Check-ins by hand against any Task on Today or a past Day.
- Sees their consistency on **Progress**: a GitHub-style **Activity Grid** shaded by total focused minutes per Day across all Tasks, an all-time **Focus Streak**, range totals, and a per-Day history that lists that Day's Tasks and the focus recorded against each.
- Uses it on any device. Every read and write goes to the device first and syncs to the server in the background, so the app keeps working offline and history is never lost with a browser.

Completion and focus are deliberately independent: finishing a Pomodoro never ticks a Task off, and ticking a Task off never stops its timer or changes the grid.

The app has three tabs — **Timer** (default), **Tasks**, **Progress** — plus a Settings screen, with a mobile layout on every device (a maximum width on desktop).

## User Stories

### Signing in and accounts

1. As a new visitor, I want to sign in with my Google account, so that I can start without creating a password.
2. As a new visitor, I want my first Google sign-in to create my account automatically, so that there is no separate sign-up step.
3. As a User, I want my data to be completely private from other Users, so that nobody else can see my Tasks or Check-ins.
4. As a User, I want to read the privacy policy from the sign-in screen before signing in, so that I know what is stored about me.
5. As a User, I want to stay signed in for about a week of normal use, so that I am not asked to sign in every day.
6. As a User whose sign-in has expired, I want the app to still open on my local data, so that I can keep working and sign in again later.
7. As a User whose sign-in has expired, I want a "Sign in to sync" status that opens Google sign-in, so that I can resume syncing in one tap.
8. As a User signing back in with the same account, I want my Pending changes uploaded, so that nothing I did while signed out of sync is lost.
9. As a User signing in with a different account on the same device, I want the previous account's local data left untouched, so that each account's data stays separate.

### Planning Tasks

10. As a User, I want to create a Task by typing a title and pressing Enter, so that planning my day costs one gesture.
11. As a User, I want the add-Task input to be the first element of every Task list, so that I never hunt for a floating button.
12. As a User, I want my Task title kept exactly as I typed it apart from trimmed leading and trailing spaces, so that my own capitalization survives.
13. As a User, I want an empty or whitespace-only title rejected, so that I cannot create a Task with nothing in it.
14. As a User, I want titles capped at 120 characters with a clear message, so that I know the limit before I lose text.
15. As a User, I want to create Tasks for Today or any future Day, so that I can plan ahead.
16. As a User, I want past Days to offer no create action, so that I cannot invent history I did not plan.
17. As a User, I want two Tasks to be allowed to have the same title, on the same Day or on different Days, so that repeating work needs no workaround.
18. As a User, I want a Task to need nothing but a title — no colour, category, priority, estimate or description — so that planning stays as fast as a paper list.
19. As a User, I want Today to be the default view everywhere, so that the app opens on what I am doing now.
20. As a User, I want new and copied Tasks appended to the end of their Day's list, so that the order I see is the order I built.
21. As a User, I want to move a Task up or down within its Day, so that I can order my work by hand.
22. As a User, I want completing or reopening a Task never to reorder it, so that my list does not jump under my finger.
23. As a User, I want to rename any Task, including a completed one and one on a past Day, so that I can fix a typo without losing its history.
24. As a User, I want a rename to show everywhere the Task appears, including in past focus history, so that my records stay consistent.
25. As a User, I want the Task's Day to be fixed and not editable, so that my history cannot be quietly rewritten.

### Completing and carrying work over

26. As a User, I want to tick a Task complete with an explicit control, so that I decide when something is done.
27. As a User, I want completion to require no focused minutes, so that work done away from the timer still counts as done.
28. As a User, I want to untick a completed Task, so that a mistaken tick is reversible.
29. As a User, I want reopening a Task to keep its Day and every Check-in, so that reversing completion never destroys effort.
30. As a User, I want a completed Task shown struck through but still present, so that my Day reads as a record of what I planned.
31. As a User, I want an unfinished Task to stay on its own Day forever, so that a missed Day stays honest instead of piling onto today.
32. As a User, I want midnight to move, copy, complete or prompt about nothing, so that the app never rearranges my plan while I sleep.
33. As a User, I want to copy an unfinished Task forward to a later Day, so that I can carry work over deliberately.
34. As a User, I want a copy to be a distinct, incomplete Task carrying only the title, so that the original Day keeps its true record.
35. As a User, I want the copy destination restricted to a Day later than the source and never earlier than Today, so that copying can only ever move work forward.
36. As a User, I want unfinished Tasks on a past Day to show a "Copy →" affordance and a hint that they stay on that Day, so that I understand why they did not follow me here.
37. As a User, I want no archive, trash, restore or automatic rollover, so that there is only one place a Task can be: its Day.

### Deleting Tasks

38. As a User, I want to delete a Task permanently after a confirmation, so that I can remove something I never meant to plan.
39. As a User, I want a confirmation for a Task with no focus records to simply name the Task, so that a trivial removal stays quick.
40. As a User, I want a confirmation for a Task with focus records to also name how many Check-ins and how many total minutes will go, so that I never destroy effort unknowingly.
41. As a User, I want confirming deletion to remove the Task and all of its Check-ins together, so that no orphan history is left behind.
42. As a User, I want delete blocked while that Task has a running or paused Pomodoro Session, with "Stop or finish the session first", so that a Session never loses its Task.
43. As a User, I want rename, reorder, completion toggle and Copy to stay available while a Session runs against that Task, so that only the genuinely unsafe action is blocked.

### Pomodoro Sessions

44. As a User, I want to pick one of Today's Tasks and press Start, so that focus is always attached to something concrete.
45. As a User, I want **Start Session** to sit directly under the timer ring, so that the main action is where my eye already is.
46. As a User, I want the Timer to preselect the Task I last ran a Session against when it belongs to Today, so that a repeat session takes one tap.
47. As a User with no such Task, I want the Timer to preselect Today's first incomplete Task in my manual order, so that the obvious next thing is already chosen.
48. As a User whose Today Tasks are all complete, I want the first Task preselected, so that extra focus on finished work is still one tap away.
49. As a User with no Tasks Today, I want nothing preselected, no Start, and a "What will you focus on today?" empty state above the add input, so that the next step is to plan something.
50. As a User, I want a Task created from the Timer tab selected automatically, so that I can type a title and press Start immediately.
51. As a User, I want to start a Session against a completed Task, so that I can keep working on something I already ticked off.
52. As a User, I want Sessions to be startable only against a Task belonging to Today, so that focus always lands on the Day I am living in.
53. As a User, I want a focus interval of 25 minutes by default, so that I get the classic Pomodoro without setup.
54. As a User, I want to pause and resume the focus interval, with paused time not counted, so that interruptions don't inflate my minutes.
55. As a User, I want a paused Session never to expire by itself, and to see "Resume or Stop" when I come back, so that I decide what happens to it.
56. As a User, I want to stop early and choose to save the elapsed focus time (whole minutes, rounded down) or discard it, so that partial work can still count.
57. As a User, I want a stop under one minute discarded without asking, so that I am not bothered about meaningless Check-ins.
58. As a User, I want a Check-in with the planned duration created automatically the moment focus ends, so that I don't have to confirm anything.
59. As a User, I want finishing, stopping, recovering or discarding a Session never to change my Task's completion, so that "done" always means I said it was done.
60. As a User, I want completing or reopening a Task never to stop its running Session, so that ticking something off does not throw away the minutes I am putting in.
61. As a User, I want an on-screen alert and a sound when focus ends, so that I notice even if I'm looking away.
62. As a User, I want to choose a short Break, a long Break or no Break after each focus interval, so that I rest the way I need.
63. As a User, I want a Break to be skippable but not pausable, so that the rules stay simple.
64. As a User on a Break, I want to see which Task it followed, so that I know what I am coming back to.
65. As a User, I want an on-screen "Break is over!" alert with "Start Next Session" (reusing the same Task when it is still eligible), plus a different sound, so that I know when to go back to work.
66. As a User, I want the next Session never to start by itself, so that I stay in control.
67. As a User, I want the countdown to stay accurate when the tab is in the background, the screen is locked or the device sleeps, so that the timer never drifts.
68. As a User who was away when focus ended, I want to be asked on return whether I finished fully, partly (entering minutes) or not at all, so that the Check-in reflects what really happened.
69. As a User who was away, I want the resulting Check-in to land on its Task's Day rather than the Day I reopened the app, so that my grid stays truthful.
70. As a User running a Session across midnight, I want its Check-in recorded on its Task's Day and never split, so that the rule is simple and predictable.
71. As a User, I want a Session to become exactly one Check-in or exactly one discard, even if it is recovered on several devices or after a reload, so that I never get duplicates.
72. As a User, I want the screen kept awake during focus (with a setting to turn that off), so that the countdown stays visible.
73. As a User, I want only one running or paused Session at a time across all my devices, so that I cannot accidentally double-count time.
74. As a User, I want to see and stop my running Session from any of my devices, so that I can switch devices mid-session.
75. As a User offline, I want Start disabled with "Connect to the internet to start a session.", so that I understand why.
76. As a User who loses connection with a Session already running, I want it to finish normally and record its Check-in, so that losing connection never loses work.
77. As a User, I want Start to re-enable by itself when the connection returns, so that I don't need to reload.
78. As a User, I want a Session to keep the durations it started with even if I change settings mid-session, so that settings changes are never retroactive.
79. As a User, I want the Task picker hidden while a Session runs, replaced by "Focusing on <Task>", so that the running screen says only what matters.
80. As a User, I want no completion control on the Timer tab at all, so that the timer can never tick something off by accident.

### Check-ins

81. As a User, I want each Check-in to belong to exactly one Task and take that Task's Day, so that focused time is never floating or ambiguous.
82. As a User, I want many Check-ins on one Task, so that separate bursts of work each count.
83. As a User, I want to record a Check-in by hand against an existing Task, so that I can log work done away from the timer.
84. As a User, I want manual recording to offer Tasks on Today and past Days, complete or incomplete, so that I can fill in history I forgot.
85. As a User, I want future Tasks ineligible for Check-ins, so that my history can only contain what has happened.
86. As a User, I want to pick a Task rather than a date when recording by hand, so that there is one place the Day can come from.
87. As a User, I want to be unable to invent a past Task through manual recording, so that the Day's plan stays the record of what I actually planned.
88. As a User, I want the duration to default to my focus length, so that the common case needs no typing.
89. As a User, I want duration in whole minutes, at least 1 and at most 480, so that typos like "4500" are caught.
90. As a User, I want to correct a Check-in's duration whether it came from a Session or was entered by hand, so that I can fix a mistake.
91. As a User, I want to reassign a Check-in to any other eligible Today or past Task, so that I can correct which work the time went into.
92. As a User, I want a reassigned Check-in to take its new Task's Day, so that the grid follows the correction.
93. As a User, I want origin and Day not directly editable, so that the record cannot disagree with itself.
94. As a User, I want to delete a Check-in after a confirmation, so that I can remove one recorded by mistake.
95. As a User, I want deleting a Check-in to leave Task completion alone and never re-open or re-finalize its Session, so that one correction does not cascade.
96. As a User, I want Today's Check-ins listed under the timer with Task title, origin ("Pomodoro" / "Added by hand"), minutes and Edit, so that I can fix a wrong one quickly.
97. As a User, I want "No focus recorded today yet." when there are none, so that the empty case reads plainly.
98. As a User, I want a "+" for a manual Check-in on the Timer tab, so that recording by hand is always one tap away.
99. As a User, I want to record and correct Check-ins while offline, so that I can log work anywhere.

### Tasks tab

100. As a User, I want a Monday-start week strip with previous/next-week arrows, so that I can move between Days without a date picker.
101. As a User, I want dots on the Days that have Tasks, so that I can see where my plans are at a glance.
102. As a User, I want the selected Day's header to show the date, focused minutes, Check-in count and done/total, so that I can read the Day in one line.
103. As a User, I want the add-Task input shown only for Today and future Days, so that the interface matches the rule.
104. As a User, I want each row to show a completion checkbox, the title, and its focused-minute total, so that effort and status sit together.
105. As a User, I want a "···" menu per Task offering rename, complete/reopen, move up, move down, Copy to a later Day and Delete, so that everything about a Task is in one place.
106. As a User, I want no play buttons on the Tasks tab, so that there is exactly one place a Session can start.
107. As a User, I want a past Day with no Tasks to say "No Tasks for this Day." and offer no create action, so that the rule is visible rather than mysterious.
108. As a User with no Tasks at all, I want the ordinary Today empty state rather than an onboarding flow, so that I can just start typing.

### Activity Grid and Progress

109. As a User, I want a GitHub-style Activity Grid (weeks as columns, Monday start, Mon/Wed/Fri and month labels) that fits the screen width without scrolling, so that I see my consistency at a glance on a phone.
110. As a User, I want each Day shaded by total Check-in minutes across all my Tasks in five levels, so that effort, not just presence, is visible.
111. As a User, I want Task completion never to affect a cell's shade, so that the grid measures focus and nothing else.
112. As a User, I want levels relative to my own history (quartiles of my non-zero Days), so that the grid is meaningful whether I do 10 or 200 minutes a day.
113. As a new User with fewer than 8 non-zero Days, I want fixed thresholds (1–15, 16–30, 31–60, over 60 minutes), so that the grid is meaningful before quartiles make sense.
114. As a User, I want a legend stating the minute ranges currently in force, so that I can read the shades exactly.
115. As a User, I want the default range to be the last 3 months ending today, with 6 months as the alternative, so that cells are large enough to read and tap.
116. As a User, I want the day of the month visible inside cells at the 3-month range, so that I can find a date without hovering.
117. As a User, I want today outlined, so that I know where I am.
118. As a User, I want no cells drawn after today, so that the grid shows nothing that can't have happened.
119. As a User, I want switching range never to recolour a Day, because levels come from my whole history, so that the grid is stable.
120. As a User, I want hovering (desktop) or tapping (touch) a Day to show a tooltip with the date, total minutes, Check-in count and Tasks done out of total, so that I can see what that Day held.
121. As a User on a touch screen, I want taps to resolve to the nearest cell, so that small cells are still easy to hit.
122. As a User, I want no item filter chips of any kind, so that Progress stays one honest picture of all my focus.
123. As a User, I want a selected-Day panel (Today by default) listing every Task of that Day in my manual order, so that I can see what I planned, not only what I focused on.
124. As a User, I want each Task in that panel to show its current complete/incomplete state, its focused-minute total and its Check-ins, so that plan and effort sit side by side.
125. As a User, I want a Task with no focus to say "No focus recorded.", so that the absence is stated rather than implied.
126. As a User, I want to add, edit and delete eligible Check-ins from that panel, so that backdating and fixes happen right where I noticed them.
127. As a User, I want the add-Task input at the top of that panel for Today only, so that I can plan from Progress without breaking the no-past-Tasks rule.
128. As a User, I want one all-time Current Focus Streak and one all-time Longest Focus Streak, so that I can see my consistency without choosing a scope.
129. As a User, I want an Active Day to mean a Day with at least one Check-in, so that streaks measure focus rather than planning.
130. As a User, I want today's missing Check-in not to break my Streak until the Day is over, so that I don't see my Streak reset every morning.
131. As a User, I want Streaks recomputed immediately when I add, correct, reassign or delete a Check-in, so that they are always correct.
132. As a User, I want Focused time, Check-ins, Active Days and "Tasks completed" as completed / all for the selected range, labelled with the range, so that I know what period they cover.
133. As a User, I want Streak tiles labelled as all-time even while a range is selected, so that I do not misread them.
134. As a User, I want stat tiles to show real zeros ("0 min", "0", "0 days", "0 / 0") rather than dashes, so that an empty state reads plainly.
135. As a User with no Tasks, I want the empty grid visible with an invitation to create my first Task for Today, so that I know the next step.
136. As a User with Tasks but no Check-ins, I want the empty grid with "Your first Check-in will light up today.", so that I know what to expect.
137. As a User, I want renaming a Task to update its title in every historical Day panel, so that history reads correctly.
138. As a User, I want deleting a Task to remove it and its Check-ins from every total, grid level and streak, so that aggregates never count what no longer exists.
139. As a User, I want no averages, trends, "best Day", Pomodoro counts or per-Task analytics, so that Progress stays one readable page.

### Accessibility and theme

140. As a keyboard User, I want the grid to be one tab stop with arrow keys (weeks left/right, weekdays up/down, Home/End for the week), so that I can explore it without a mouse.
141. As a keyboard User, I want Enter or Space to open a Day, with focus showing the same tooltip as hover, so that I have the same abilities as a pointer User.
142. As a screen-reader User, I want every cell labelled in full ("12 September, 45 minutes, 2 Check-ins, 2 of 3 Tasks completed" / "13 September, no Check-ins"), so that the grid is understandable without colour.
143. As a User with low vision or colour-vision differences, I want level 1 to stand out from level 0 and the levels to rise in luminance (readable in greyscale), so that shade differences are perceivable.
144. As a User, I want the day-of-month numbers readable at every level, so that the grid is legible in both themes.
145. As a screen-reader User, I want a Task row to announce its title, completion state and focused minutes together, so that I do not have to hunt for the checkbox meaning.
146. As a User, I want the app to follow my system light/dark setting by default, with a System/Light/Dark override, so that it looks right on my device.

### Offline, sync and install

147. As a User, I want everything I do to save on the device first, so that the app is fast and works without a connection.
148. As a User, I want my Tasks, Check-ins and timer durations to sync across every device I sign in on, so that I can switch devices freely.
149. As a User, I want my manual Task order to end up the same on every device, so that my plan does not shuffle between phone and laptop.
150. As a User, I want a header status pill only when something needs attention ("Offline", "N changes waiting", "Can't sync", "Sign in to sync"), so that the header stays calm when all is well.
151. As a User, I want tapping the pill to explain the status in plain words and offer "Sync now", so that I can recover without technical knowledge.
152. As a User, I want failed syncs retried automatically with backoff and immediately on reconnect or return to the app, so that I rarely need to do anything.
153. As a User, I want "Can't sync" only after three consecutive failures while online, so that a single hiccup doesn't alarm me.
154. As a User, I want edits made on two devices resolved in favour of the last one the server received, and a deletion to beat an edit, so that conflicts resolve predictably.
155. As a User who ticked a Task complete on one device and reopened it on another, I want the later of the two to win outright, so that completion never lands in a state neither device chose.
156. As a User, I want edits that lost to a later change updated silently, so that I am not interrupted over small conflicts.
157. As a User whose offline Check-in was dropped because its Task was deleted on another device, I want a dismissible banner naming the minutes, the Task and the Day, so that I know data was lost and why.
158. As a User whose Check-in reassignment was rejected because the target Task was deleted elsewhere, I want the Check-in left on its original Task with a message that only the move failed, so that no focused time is lost to a failed correction.
159. As a User, I want the server to refuse to delete a Task whose Session has not yet resolved, so that a legitimate Session can always finish and record its minutes.
160. As a User whose device is offline mid-Session, I want that protection to hold anyway, so that a delete on another device cannot race my finishing focus.
161. As a User, I want one stale change never to block my other Pending changes from syncing, so that one bad record cannot freeze my whole queue.
162. As a User signing in on a new device, I want a full "Loading your data…" screen until my data arrives, so that I never mistake an empty state for lost history.
163. As a User whose first load is interrupted, I want "Connect to the internet to load your data." with "Try again", resuming by itself, so that I can recover.
164. As a User, after my first Check-in, I want a dismissible card inviting me to install the app (browser prompt on Chrome/Android, Share → Add to Home Screen steps and the reason on iOS), so that I get durable storage without being nagged on first visit.
165. As a User who dismissed the install card, I want "Install app" in Settings (hidden when already installed), so that I can install later.
166. As a User, I want the app to ask the browser for durable storage silently after my first Check-in, so that my Pending changes aren't evicted.
167. As a User, I want a "New version available" banner with Reload, disabled during a running or paused focus interval ("Update after your session"), so that an update never kills a Session.

### Settings and account

168. As a User, I want to open Settings from my Google profile photo in the header, so that it is always reachable without a fourth tab.
169. As a User, I want the header to also show my current Focus Streak, so that my run is visible from every tab.
170. As a User, I want to see which Google account is signed in (photo, name, email), so that I know whose data I'm looking at.
171. As a User, I want to set focus (1–120), short Break (1–30) and long Break (1–60) minutes with steppers that can also be typed into, saving immediately, so that the timer fits me.
172. As a User, I want an invalid duration to revert with a small message, and "Reset to defaults" to restore 25/5/15, so that I can't break my settings.
173. As a User, I want my durations synced across devices, so that the timer behaves the same everywhere.
174. As a User, I want separate on/off toggles for the focus-end and Break-end sounds, per device, so that I can silence one device without affecting others.
175. As a User, I want device-only settings marked "Only on this device", so that I know which settings sync.
176. As a User, I want the Wake Lock setting shown disabled with "Not supported on this device" where it isn't supported, so that I understand why it has no effect.
177. As a User, I want to sign out, with a quick sync first and a warning only if some changes couldn't sync, so that I know what stays on the device.
178. As a User, I want to delete my account from a clearly separated Danger zone, see real counts of the Tasks and Check-ins that will be lost, learn that backups keep a copy for up to 30 days, and type `DELETE` to confirm, so that I can leave safely and knowingly.
179. As a User offline, I want Delete account disabled with a reason, so that I don't think it silently failed.
180. As a User who deleted their account, I want this device wiped for me and a confirmation line on the sign-in screen, so that I know it's done.
181. As a User whose account was deleted on another device, I want this device to wipe my data and tell me on the sign-in screen, so that nothing stale remains.
182. As a User, I want a static privacy policy at `/privacy` that works offline, so that I can always read what is stored.

### Operator (the developer running the homelab)

183. As the operator, I want the app deployed from GitHub Actions to GHCR and to the homelab over SSH through Tailscale, so that releases are one push.
184. As the operator, I want schema migrations to run at start-up before traffic, so that deploys don't need manual steps.
185. As the operator, I want the database continuously replicated off-site with 30-day retention, and a restore drill before launch and every quarter, so that a disk or house failure never loses Users' history.
186. As the operator, I want an alert when the homelab stops or replication falls behind, so that I find out before Users do.
187. As the operator, I want per-IP and per-User rate limits (looser on sync, stricter on sign-in) that trust the client IP only from the tunnel and proxy, so that open sign-up can't be abused.

## Implementation Decisions

### Stack and architecture

Unchanged from the baseline spec; the Task reframe creates no conflict here.

- **Client:** TypeScript, React, TanStack Start in SPA mode (static shell, client-rendered UI). A service worker precaches the shell, assets and `/privacy`. IndexedDB via Dexie is the device store, with `liveQuery` driving the UI. It holds data per User. Pin the TanStack Start version (its release status is unconfirmed).
- **Server:** TypeScript in the same repo and package through TanStack Start server routes and server functions. SQLite in WAL mode through `better-sqlite3` and Drizzle. No separate backend.
- **Shared contract module:** Zod schemas for every synced record and every endpoint payload, used by client and server. Validation rules (Task title required after trim and ≤ 120 characters, Check-in duration 1–480 whole minutes, `day` a valid local date string, duration setting limits) live here once.
- **Auth:** Better Auth with the Google provider, open sign-up (first sign-in creates the User). Sessions last 7 days and are refreshed at most once a day when used. Check Better Auth's compatibility with TanStack Start and SQLite early.
- **Hosting:** follows ADR 0002. A single homelab node running Docker Compose (Node app, Nginx, Litestream) behind the existing `cloudflared` tunnel, on an isolated network with no open ports. Nginx trusts the real-IP header only from `cloudflared`. Litestream replicates to R2 or B2 with 30-day retention, and a restore runbook is written. A healthchecks.io or UptimeRobot ping plus a check on replica age.
- **Release:** GitHub Actions builds and pushes the image to GHCR, then deploys over SSH through Tailscale with a deploy-only account and a limited ACL. Migrations run on start before traffic.
- **Rate limiting:** in the app, in memory (one instance), per IP and per User.
- **UI copy:** English only, no i18n layer. Strings quoted in this spec are final text.

### Modules (deep modules, small interfaces)

1. **Domain rules.** Pure functions with no I/O:
   - *Task validation.* Title required after trimming, ≤ 120 characters, capitalization preserved, duplicates allowed. Creation `day` ≥ today. `day` immutable after creation. Copy-forward target must be strictly later than the source `day` and not earlier than today.
   - *Ordering.* Given a Day's Tasks, produce the manual order: sort by `orderKey`, ties broken by Task id. Append (create, copy) allocates a key after the last Task the device knows; a move up or down allocates a key between its new neighbours. Only the moved Task changes.
   - *Check-in validation.* The target Task must exist, be owned by the User, and have `day ≤ today`; duration a whole number 1–480. A Check-in has no `day` of its own — it is derived from the Task, in every read path.
   - *Focus Streak.* Current and longest, over all Tasks, over the User's whole history. A Day counts when it has at least one Check-in. The current run counts back from today if today has a Check-in, otherwise from yesterday.
   - *Grid shading.* Fixed thresholds 1–15 / 16–30 / 31–60 / >60 while the User has fewer than 8 non-zero Days, then quartiles of non-zero Days over the User's whole history. Returns levels plus the legend ranges in force. No filter parameter exists.
   - *Range statistics.* Focused time, Check-ins, Active Days, and Tasks completed as `completed / all` for the range. No per-item breakdown.
   - *Day computation.* Local calendar date string (e.g. `2026-09-19`) from a wall-clock instant, in device local time.
2. **Pomodoro Session state machine.** Pure transitions over a persisted record with an injected clock. States: running, paused, completed, abandoned, plus Break (short/long) and ready. Events: start, pause, resume, stop(save|discard), tick/visibility, focus-end, choose-break, skip-break, break-end, recover-on-open(full|partial minutes|none). Its outputs are "create Check-in (Task id, minutes)" and "raise alert" — **the Day is not an output**, because the Check-in inherits it from the Task. The alert-delivered/finalised flag guarantees a Check-in is created or discarded exactly once. Remaining time is always computed from stored wall-clock timestamps (`Date.now()`), never from counted ticks and never from `performance.now()`.
   - Persisted Session record: target Task id, session id, planned focus duration and Break durations in force at start, wall-clock start/end, pause data, status, alert-delivered flag.
   - The machine never emits a completion change for the Task, in any transition.
3. **Task selection (Timer preselection).** A pure function over Today's Tasks, the most recently Session-used Task id, and the manual order: last-used-if-Today → first incomplete → first → none.
4. **Local store (repository).** A Dexie-backed API for Tasks, Check-ins, the settings record and the active Pomodoro Session. Every mutation writes the record and an outbox entry in one transaction. Scoped per User, and wiping one User leaves other Users' data untouched. Deleting a Task writes its tombstone and the tombstones of its local Check-ins in one transaction.
5. **Sync client.** Pushes the outbox in batches, pulls changes since the last `seq` in pages, applies them to the local store, and handles tombstones. It orders each batch by client dependency (a Task before a Check-in that references it) and consumes a per-change accepted/rejected result. It exposes a status for the pill (synced / offline / N pending / can't sync / sign in to sync), backoff (seconds, rising to a 5-minute cap; immediate on `online`, foreground and "Sync now"), a consecutive-failure count (≥ 3 online → "Can't sync"), lost-focus notices, failed-reassignment recovery, and "account gone" handling.
6. **Sync server.** Server routes for push and pull, plus server functions for starting/stopping the active Pomodoro Session, finalizing it, and account deletion. It owns the `seq` counter, tombstones, the Task delete guard and the finalization receipts.
7. **Grid view model.** Turns local data, the selected range and today into cells: weeks × weekdays with Monday start, no future cells, level, label text, today flag and tooltip data (date, minutes, Check-in count, Tasks completed of total). The rendered grid component stays thin over it. It implements `role="grid"` with a roving tabindex and the key bindings above, plus nearest-cell pointer resolution.
8. **Timer runtime adapter.** The browser side of the state machine: tick loop, `visibilitychange`/`pageshow` recompute, Web Audio unlocked by the Start gesture (two distinct tones), Screen Wake Lock requested during focus and re-requested on visibility, and feature detection for the disabled "Not supported on this device" state.
9. **PWA shell.** Service worker, update banner (Reload is gated by an active focus interval), install card logic (after the first Check-in, dismissible, never shown when installed, iOS instructions), and a silent `navigator.storage.persist()` after the first Check-in.

### Data model and sync contract

**Synced record types.** A User owns Tasks, Check-ins, one settings record, and at most one active Pomodoro Session. **Day is a value, not a record** — there is no Day table and no Day id anywhere.

- **Task:** id, User id, `day` (local date string, immutable), `title`, `completed` (boolean), `orderKey` (opaque string), created metadata, sync metadata (`seq`, updated).
- **Check-in:** id, User id, `taskId`, `durationMinutes`, `origin` (`session` | `manual`), `sourceSessionId` (present only for `session` origin, unique), created metadata, sync metadata. **It has no `day` field**, no note, no start time, no end time and no status of its own.
- **Settings:** one per User — focus, short Break, long Break minutes.
- **Active Pomodoro Session:** one per User — the record described in module 2, including its target `taskId`.

**Ids and idempotency.** Ids are UUIDv7, generated by the client. Resent changes are idempotent because each change carries its own id. The server assigns a monotonically increasing `seq` to every accepted change (single writer, ADR 0002).

**Conflict resolution.** Last-write-wins on the whole record, in server order (not device clocks). This covers `title`, `completed` and `orderKey`. `completed` is an absolute state, never a toggle operation, so two devices disagreeing converge on the value the server received last. `day` is immutable, so a Task can never move between Days and a Copy is an independent Task whose fate is unrelated to its source.

**Manual order.** Each Task carries an opaque `orderKey`; the Day's order is `orderKey` ascending with ties broken by Task id. Creation and Copy append after the last Task the device knows about; a reorder rewrites only the moved Task. Concurrent creates or moves therefore converge deterministically without a per-Day order record and without bulk renumbering.

**Deletion.**
- A deletion is a **tombstone** (id plus `seq`, no content) kept while the account exists. A deletion beats a later-arriving edit or restore of the same record.
- **Task deletion cascades atomically:** the Task tombstone and a tombstone for each accepted Check-in of that Task are written in one transaction.
- A Pending Check-in pushed for a deleted Task is **rejected**, removed locally, and produces a dismissible lost-focus banner: *"1 Check-in (25 min on "Draft the report", 12 Sep) wasn't saved because that Task was deleted on another device."*
- A Pending **reassignment** whose new target Task was deleted is rejected; the accepted Check-in stays on its original Task and the client reports that only the move failed: *"That Task was deleted on another device, so the 25 min stayed on "Draft the report"."*
- Edits to Check-ins already removed by an intentional Task cascade are dropped silently.

**The Task delete guard.** The server **rejects Task deletion while the authoritative active Session targets that Task and its focus outcome is unresolved** — including while the originating device is offline. Once the outcome is finalized (save or discard), the protection ends; a following Break does not extend it. This removes the deleted-target race for legitimate Session finalization. The client mirrors the guard locally with "Stop or finish the session first".

**Session finalization is exactly once.** The server keeps an internal **finalization receipt** keyed by Session id for as long as the User exists. The first terminal outcome the server accepts — one Check-in or one discard — wins. Receipt creation, the optional Check-in creation, and release of the active Session are **one transaction**. Later retries or conflicting device outcomes are idempotent no-ops that receive the authoritative result. `sourceSessionId` on a Session-origin Check-in is unique. Receipts are server mechanics and are never synced as domain history.

**One active Session.** Start requires a connection and atomically validates that no other active Session exists for the User. Any device may finalize it. Losing connectivity after Start neither stops local timing nor prevents the terminal outcome from syncing later.

**Temporal eligibility is evaluated when the action occurs, not when it syncs.** The client enforces Task creation for Today or later, manual Check-ins against Today or past Tasks, and Session Start against a Today Task. Delayed sync never re-evaluates these with receipt time. Online Start uses the **initiating device's local Day**, not the homelab's time zone. The server validates date syntax, ownership, relationships, duration bounds and tombstones.

**Sync batches are not globally atomic.** Ordinary outbox changes are processed in client dependency order and each returns its own accepted/rejected result, so one stale change never blocks unrelated Pending changes. A Check-in that depends on a newly created Task is sent after that Task and is rejected if the Task was not accepted. Three things stay transactional: Task deletion with its Check-in tombstones; Session finalization with its Check-in or discard plus the active-Session release; and account deletion with all User data.

**Device-only settings** (two sound toggles, Wake Lock, theme) live in local storage per device and never sync.

**Account deletion** is a server function. It removes the User and all rows immediately (backups keep them up to 30 days). Other devices learn about it on their next sync ("account gone"), then wipe that User's local data, including Pending changes.

**Sign-out:** when online, try a short sync first. If it fails or the device is offline, show the dialog with the Pending change count. Pending changes stay on the device for that User.

### Screens (final structure)

Three tabs — **Timer**, **Tasks**, **Progress** — replacing the baseline's Timer / Progress / Habits. There is no Habits tab and no "Create Habit" card.

**The visual reference is [`habit-tracker.pen`](../../habit-tracker.pen)** (pen.dev), the User-accepted design. It supersedes the variant-B prototype, which remains as decision history for ticket 05. Every string quoted below is taken from that file; where prose here and the design disagree, the design wins and this spec should be corrected.

- **Header** (all tabs): the status pill (only when needed), the Focus Streak chip, and the profile photo, which opens Settings.
- **Timer (default tab), idle:** the timer ring; **"Start Session"** directly beneath it; a "Focus on" heading; the **add-Task input first**, placeholder "New Task…"; Today's Tasks as a **single-select radio list** (completed Tasks stay selectable, struck through and dimmed); then "Today's focus". With no Tasks Today: the ring, "What will you focus on today?" with "Add a task below to start your focus session.", the add input, and no Start.
- **Timer, running:** the ring, "Focusing on <Task>", "Pause"/"Resume Session" and "Stop", then Today's focus. The picker is hidden. **No completion control appears on this tab in any state.** A Break shows "Break after <Task>", "Break is skippable, but not pausable." and "Skip Break".
- **Today's focus (Check-in log):** Today's Check-ins with Task title, origin ("Pomodoro" / "Added by hand"), minutes and Edit, plus "+" for a manual Check-in. The edit sheet reassigns to any eligible Today or past Task, adjusts minutes, and deletes behind a confirmation. Empty: "No focus recorded today yet."
- **Tasks:** a Monday-start week strip with previous/next arrows and dots on Days that have Tasks; then the selected Day's header — date line ("Today · Friday, 18 Sep") over a summary line in the form **"50m focused • 2 Check-ins • 1 of 3 tasks completed"**; the **add-Task input at the top** ("Add a Task…") for Today and future Days only; then rows with completion checkbox, title, focused-minute label and a "···" menu (rename, complete/reopen, move up, move down, Copy to a later Day, Delete — Delete blocked while a Session targets it). Unfinished Tasks on a past Day carry a "Copy →" pill and a hint that they stay on that Day. No play buttons.
- **Progress:** the Activity Grid hero tile in bento style (flat pastel tiles, large radii, warm background), the 3 mo / 6 mo toggle, the legend of active minute ranges, **no filter chips**, six stat tiles (Current Focus Streak, Longest Focus Streak, Focused time, Check-ins, Active Days, Tasks completed `x / y`), and the selected-Day panel (Today by default) with the same two-line header, the **add-Task input at the top for Today only** ("Add a Task to Today…"), and one row per Task of that Day in manual order carrying the title, a state badge ("Open" / "Done", the completed title struck through) and either its focused total ("50m (2 Check-ins)") or "No focus recorded." Tapping a grid Day opens the same panel as a bottom sheet listing that Day's Check-ins with origin ("Pomodoro" / "Added by hand"), edit and delete, plus "Add Check-in for <date>".
- **Settings (full screen with back):** Account card with a neutral Sign out; Timer group (durations, Reset to defaults, two sound toggles, Keep screen awake); Appearance (System/Light/Dark); App (Install app, Privacy policy); Danger zone (Delete account sheet with real Task and Check-in counts and a typed `DELETE`, disabled offline).
- **Sign-in screen:** Google button, `/privacy` link, and the one-line notes for "account deleted" (on another device vs by you).
- **Loading screen** for the first download on a new device, with offline and "Try again" handling.

### Screens drawn in `habit-tracker.pen`

Two reusable components (`Component/AppHeader`, `Component/BottomNav`) and twenty screens, all at 414 px:

| Group | Screens |
| --- | --- |
| Auth | `Auth-SignIn`, `Auth-FirstLoad` |
| Timer | `Timer-Empty`, `Timer-Ready`, `Timer-Running`, `Timer-Paused`, `Timer-BreakChoice`, `Timer-BreakRunning`, `Timer-BreakOver`, `Timer-UserAway` |
| Tasks | `Tasks-Today`, `Tasks-PastDay`, `Tasks-TaskMenuSheet` |
| Progress | `Progress-Main`, `Progress-DayDetails` |
| Settings | `Settings-Main`, `Settings-DeleteAccountSheet` |
| Modals & pages | `Modal-SyncStatus`, `Modal-OfflineSignOut`, `Page-PrivacyPolicy` |

`AppHeader` carries the product title, the status pill and the Focus Streak chip beside the profile avatar. `BottomNav` carries the three tabs.

### States still to be designed

The design covers the main flows; these states are specified above but have no screen yet, and the build should treat the nearest existing screen as their visual basis:

- the Delete-Task confirmation (naming the Check-in count and total minutes), on the pattern of `Settings-DeleteAccountSheet`;
- the lost-focus banner and the failed-reassignment message, on the pattern of the Timer tab's install card;
- the "New version available" / "Update after your session" banner;
- the sign-in screen's two "account deleted" notes;
- a Task list for a **future** Day on the Tasks tab (add input present, no Copy pill);
- the Timer tab's manual Check-in sheet and the Check-in edit sheet reached from "Edit".
- **Dark theme.** `habit-tracker.pen` defines one light value per colour token, with no theme axis. The dark palette must be derived during the build and must satisfy the contrast rules in Testing Decisions at every grid level.

### Carried-over visual decisions

- **Range options:** 3 months (default) and 6 months only. 12 months stays dropped because cells fall to about 4–5 px.
- **Grid hue:** mint, the prototype default. There is now exactly one hue, because per-item colours no longer exist. Tasks have no colour.
- `prototypes/05-activity-grid-look/b-bento.html` in the baseline effort informed the Progress tile style; `habit-tracker.pen` now supersedes it.
- **Design tokens** are defined in `habit-tracker.pen`: surfaces `bg-app` `#F8F6F1`, `surface` `#FFFFFF`, `surface-subtle` `#F2EFE9`; text `text-primary` `#1F1A24`, `text-secondary` `#76707D`, `text-tertiary` `#A39EA8`; borders `border` `#E9E5DC`, `border-subtle` `#F0ECE5`; `danger` `#E53E3E` on `danger-bg` `#FDE8E8`; grid levels `grid-l0` `#EBE8DF` → `grid-l1` `#C6EFD9` → `grid-l2` `#95DEC0` → `grid-l3` `#58C397` → `grid-l4` `#269865`; accent pair `mint-surface` `#E2F5EB` / `mint-accent` `#2DA46F`. Type is **Plus Jakarta Sans**. Icons are Lucide. The reference viewport is 414 px wide.
- The palette also defines coral, sky, grape and amber accent pairs. They are **not** item colours — Tasks have no colour — and are reserved for status and alert surfaces.

## Testing Decisions

- **What makes a good test:** it exercises behaviour through a public interface, as a User or another device would observe it, and never asserts on internal state, private helpers or call counts. Tests read like the user stories above: given Check-ins and a clock, the Focus Streak is N; given two devices editing offline, both end with value X. A test should survive any refactor that keeps behaviour the same.
- **Seams are unchanged from the baseline spec.** The reframe changes the scenarios, not the shape of the test surface. There are still exactly two automated seams.

**Seam 1: the headless app core (Vitest).** The main seam. Tests drive the app core through its public API (local store, domain rules, Pomodoro Session state machine, sync client) with a **fake clock** (wall-clock time, local time zone, Day rollover, device sleep and "user away" gaps) and **several simulated devices**, each with its own local store (fake IndexedDB), talking to the **real server sync routes on in-memory SQLite**. It covers:

  - **Task rules:** title trim/required/120-character cap, duplicates allowed on one Day and across Days, creation allowed for today and future and rejected for past, `day` immutable, rename visible in historical reads, completion reversible and independent of Check-ins, no archive path.
  - **Copy forward:** copies only the title, produces an incomplete Task with new identity, leaves the source untouched, rejects targets that are not strictly later than the source or are earlier than today, and survives deletion of the source.
  - **Ordering:** append on create and copy; move up/down changes only the moved Task; completion and reopening do not reorder; **`orderKey` convergence** — two devices creating or moving concurrently reach the same order, ties broken by Task id, with no renumbering.
  - **Check-in rules:** Day derived from the Task in every read path; duration 1–480 whole minutes; many Check-ins per Task; manual recording allowed for Today and past Tasks, rejected for future Tasks; reassignment moves the Day and recomputes both Days; duration correction updates totals, levels and thresholds; delete leaves completion alone.
  - **Pomodoro Sessions:** finish, pause and resume, stop-early save/discard/under-a-minute, user-away full/partial/none, crossing midnight landing on the Task's Day, Start rejected against past or future Tasks, Start allowed against a completed Task, completion toggles never stopping a Session and Sessions never changing completion, **exactly-once finalization** across reloads and several devices (receipt idempotence, unique `sourceSessionId`), and one active Session per User.
  - **Progress derivation:** shading levels and legend ranges including the switch at 8 non-zero Days; Focus Streak current and longest, all-time, with today's gap not breaking the current run until the Day ends; range totals including `Tasks completed = completed / all`; Task deletion removing its Check-ins from every aggregate; rename updating historical titles.
  - **Multi-device sync:** offline edits, idempotent resend, whole-record last-write-wins in server order (title, completion, order), deletion beating a later edit or restore, Task deletion cascading to Check-in tombstones, the lost-focus notice for a Check-in whose Task was deleted elsewhere, a rejected reassignment leaving the Check-in on its original Task, **the delete guard rejecting deletion of a Task with an unresolved Session (including with the owning device offline) and releasing it after finalization**, per-change accept/reject so one stale change does not block the queue, dependency order for a Check-in created with its Task, per-User isolation on a shared device, sign-out keeping Pending changes, and account deletion wiping other devices.
  - **Palette contrast test**, on the same seam: for the single grid hue in light and dark, level 1 vs level 0 ≥ 3:1 against the tile background, luminance strictly rising across levels, and day-number text ≥ 4.5:1 at every level.
  - **Grid view model** tests: no future cells, Monday start, cell labels including the Tasks-completed clause, and keyboard navigation outcomes.

**Seam 2: Playwright end to end.** A small set of critical journeys against the built app with a stubbed Google sign-in:

  - first run → type a Task on the Timer tab → it is selected → Start → focus ends → the Check-in appears in Today's focus;
  - plan on the Tasks tab, tick a Task complete, confirm the Timer tab still offers no completion control and the running Session is unaffected;
  - copy an unfinished past Task forward and confirm the source Day still shows it unfinished;
  - add and correct a Check-in for a past Task from the Progress Day panel;
  - offline emulation (Start disabled with its message, manual Check-in queues, pill shows "N changes waiting", syncs on reconnect);
  - update banner gating during a Session;
  - PWA install and precached `/privacy` offline;
  - keyboard navigation of the grid.

**Manual device checks** (not automated): iOS lock-screen timer behaviour, the alert sounds with the iOS mute switch, Wake Lock on installed iOS before and after 18.4, and install flows on real iOS and Android.

**Prior art:** none. The repo has no code yet, so these tests set the patterns.

Coverage thresholds and CI gates are left to `to-tickets`. At a minimum, both seams run in GitHub Actions before an image is pushed.

## Out of Scope

- **Recurrence of any kind:** repeating Tasks, templates, schedules, frequency targets ("3x a week"), and reminders.
- Moving a Task between Days, and any automatic rollover of unfinished work.
- Archive, restore, trash or undo for Tasks and Check-ins.
- Task descriptions, notes, colours, priorities, estimates, due times, subtasks, categories and tags.
- Per-item filters, per-Task analytics, and any breakdown by Task on Progress.
- Reminders and notifications of any kind: system notifications, Web Push, daily reminders.
- Export and import of data.
- Sharing and social features (seeing another User's grid, leaderboards, shared Tasks).
- Sign-in methods other than Google, and with them password reset and email verification.
- Auto-start of Breaks or Sessions, and an "every 4th session" long-Break rule.
- Per-Task timer durations, Check-in notes, and start/end times on Check-ins.
- A global scrolling list of all Check-ins.
- Averages, trends, "best Day", Pomodoro counts, and any statistic beyond the six tiles listed.
- A 12-month grid range.
- Language, week-start, time-zone and day-cutoff settings.
- A "sign out and erase this device" option.
- Google re-authentication before account deletion.
- Terms of Service.
- Analytics and trackers.
- Horizontal scaling or Postgres (see ADR 0002).
- Migrating existing production data. No application has shipped, so there is no data to migrate and no backward-compatible Habit-to-Task conversion to build.

## Further Notes

- **Terminology is load-bearing.** `Habit` must not appear as a type name, table name, route segment, UI string or test fixture. `Habit Tracker` remains the product name in the manifest, the title and the sign-in screen only.
- **The one structural trap in this reframe:** Check-in has no `day` column. Every aggregate — grid, streaks, range stats, the Day panel — reads the Day through the Task. Resist adding a denormalised `day` to Check-in for query convenience; reassignment would then have two sources of truth. If a read path needs speed, index on `taskId` and join, or cache a derived view that is rebuilt from the Task.
- **Build-time risks, not blockers:** iOS behaviour on a locked screen, worker timers under throttling, Web Audio with the iOS mute switch, TanStack Start's release status, and Better Auth working with TanStack Start and SQLite. The design holds either way: the "user away" flow is the safety net for any missed alert.
- **Tunables:** the threshold of 8 non-zero Days for switching to quartiles may be tuned during the build. Sync backoff constants may be tuned within "seconds, up to 5 minutes". The `orderKey` encoding is an implementation choice (fractional index or lexicographic key) as long as it is opaque, per-Task and append/insert-capable without renumbering.
- **Accepted trade-offs:**
  - a User's Pending changes can remain on a shared device after sign-out;
  - switching once from fixed thresholds to quartiles may recolour some cells;
  - starting a Session needs a connection (revisit if it hurts);
  - deleted data stays in backups for up to 30 days, and Users are told so;
  - an unfinished Task stays on its Day and must be copied by hand, which is more friction than automatic rollover — this is deliberate, so the grid and the Day history stay truthful.
- The privacy policy's full text is written during the build. Its outline is fixed in the baseline effort's ticket 10, adjusted to name Tasks and Check-ins.
- The repo is not a git repository yet. Initialise one before the build so work can go on branches.
