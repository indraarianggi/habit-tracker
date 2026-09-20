# Map: Habit Tracker v1

## Destination

A **Habit Tracker v1 spec** with every product and technical decision locked, ready to hand to `to-spec` and then `to-tickets`. The way is clear when no open decision remains between here and that spec.

## Notes

- Vocabulary lives in `CONTEXT.md` (User, Habit, Check-in, Pomodoro Session, Streak, Activity Grid). Use those terms; challenge any drift.
- The user converses in Indonesian; repo artifacts (tickets, CONTEXT.md, spec) are in English.
- Plan, don't do: tickets resolve decisions. Nothing here builds the app.
- Grilling and prototype tickets are HITL: the user answers for themselves.
- Settled while charting (see `CONTEXT.md` for the definitions):
  - A **Check-in** is the single unit of recorded activity. A Habit can have many per day; each always has a duration greater than zero.
  - A Pomodoro Session sets a Check-in's duration automatically. Manual Check-ins take a user-entered duration.
  - The **Activity Grid** is GitHub-style and shaded by total minutes per day, across all Habits.
  - A **Habit** has no schedule or target. A **Streak** is consecutive days with at least one Check-in.
  - A Pomodoro Session runs against a Habit.
- v1 scope: manage Habits, per-Habit Activity Grid filter, Streak and basic stats, backdated Check-ins, multi-User sign-in with cross-device sync, and an offline-capable PWA with a mobile layout on every device (maximum width on desktop).
- When the map is clear, hand it to `to-spec`.

## Decisions so far

<!-- one line per resolved ticket: [title](issues/NN-slug.md): gist -->

- [Pomodoro Session rules](issues/01-pomodoro-session-rules.md): global configurable durations (25/5/15); no auto-start, user picks short/long/no Break; Check-in auto-created when focus ends, stop-early asks save or discard; a session that ends while the user is away asks "full, partial, or none"; one active session; on-screen and sound alert only, for the end of focus and (added later) the end of a Break.

- [Check-in rules](issues/02-check-in-rules.md): a Day is midnight-to-midnight local time, fixed on the Check-in when recorded; a session's Check-in lands on the Day its focus ends; one Check-in = one Day + whole-minute duration (max 480), no start/end times, so none spans midnight; manual entry is Habit + Day + duration; backdate without limit, never the future; all three fields editable; delete asks for confirmation, no undo.

- [Storage and accounts](issues/03-storage-and-accounts.md): server-backed multi-User app, Google sign-in with open sign-up, Users fully isolated; local-first PWA with a mobile layout everywhere; server-ordered last-write-wins, deletion beats edit; one synced active Pomodoro Session per User that needs a connection to start; unsynced changes stay on the device after sign-out.

- [Reliable browser timers](issues/04-reliable-browser-timers.md): countdown from a stored wall-clock timestamp, recomputed on tick and on visibility change; end-of-focus alert is best-effort (the "user away" flow is the safety net, Web Push stays out); Screen Wake Lock in v1 with a setting; persist the active-session state; iOS lock-screen behaviour left as a build-time risk.

- [Activity Grid look](issues/05-activity-grid-look.md): "fit to screen" grid (weeks as columns, Monday start) in a bento style with cheerful pastel colours; five levels, relative to the User's own non-zero Days and recomputed per Habit filter; rolling range, default last 3 months with a range selector; tooltip shows date, minutes, Check-in count and per-Habit breakdown; filter chips recolour the grid in the Habit's hue; follows system light/dark by default (the User can override it, see [Settings and account screen](issues/10-settings-and-account-screen.md)).

- [Habit lifecycle and stats](issues/06-habit-lifecycle-and-stats.md): a Habit has a unique name and an auto-assigned, changeable pastel colour; archive is reversible and keeps history, delete is permanent, cascades to Check-ins and is offered only for an Archived Habit; Streak is per Habit or for all, follows the filter chip, stays alive through today; six stats (streaks all-time, totals by grid range); three tabs (Timer, Progress, Habits); a deletion beats offline Check-ins for that Habit.

- [Tech stack and hosting](issues/07-tech-stack-and-hosting.md): TypeScript, React and TanStack Start in SPA mode; Dexie on the device, SQLite (Drizzle) on the server, in-house sync (client UUIDv7 ids, server `seq`, tombstones, whole-record last-write-wins); Better Auth with Google (7-day session); homelab behind the existing `cloudflared` tunnel with Docker Compose, Nginx and Litestream to off-site storage (30-day retention); GitHub Actions to GHCR and SSH over Tailscale; in-app rate limiting; self-serve account deletion (kept in backups up to 30 days, other devices wipe local data); Vitest, multi-device sync tests and Playwright. See [ADR 0002](../../docs/adr/0002-single-node-homelab-sqlite-litestream.md).

- [Offline and sync experience](issues/08-offline-and-sync-experience.md): a header pill shows only "Offline", "N changes waiting", "Can't sync" or "Sign in to sync", and opens a sheet with "Sync now"; Start is disabled offline with a reason; a Check-in dropped by a remote deletion gets a dismissible banner, lost edits are silent; auto-retry with backoff, an expired sign-in keeps local data, a deleted account returns to the sign-in screen with a note, and a new device shows a full loading screen; an install card after the first Check-in (iOS shows Home Screen steps), silent `persist()`, Wake Lock shown disabled where unsupported; sign-out syncs first and warns only if that fails; update banner whose Reload waits for a running session.

- [Empty states and grid accessibility](issues/09-empty-states-and-grid-accessibility.md): no onboarding screen, a one-step "Create Habit" card on Timer and a prompt on Habits and Progress; the grid stays visible and empty until the first Check-in; fixed minute thresholds until 8 non-zero Days, then quartiles; tiles show real zeros and the Archived chip hides when empty; contrast targets (3:1 level 1 vs 0, 4.5:1 for numbers, ordered luminance) tested automatically; the grid is a keyboard-navigable `role="grid"` with full cell labels; empty Days keep Details, future cells are not drawn.

- [Settings and account screen](issues/10-settings-and-account-screen.md): opened from the profile photo in the header as a full screen; durations (synced), two per-device sound toggles (focus end, Break end), Wake Lock, and a System/Light/Dark theme; Install app; a static `/privacy` page also linked from sign-in; an account card with a neutral Sign out; Delete account in a bottom Danger zone with a sheet showing real counts and a typed `DELETE`; English-only UI; Break end gets its own alert.

## Not yet specified

<!-- nothing in the fog right now -->


## Out of scope

- Habit targets or frequency ("3x a week"). Ruled out of v1 by the user; Habits carry no target.
- Export/import of data.
- Habit categories or tags.
- Sharing and social features (viewing another User's Activity Grid, leaderboards, shared Habits). Ruled out of v1 by the user while resolving [Storage and accounts](issues/03-storage-and-accounts.md); Users are fully isolated.
- Sign-in methods other than Google (email and password, magic link, other providers), and with them password reset and email verification.
- Reminders and notifications of any kind (system notifications, Web Push, daily reminders). Ruled out of v1 by the user while resolving [Pomodoro Session rules](issues/01-pomodoro-session-rules.md); the end-of-focus alert is on-screen and sound only.
