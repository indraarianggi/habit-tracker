# Settings and account screen

Type: grilling
Status: resolved

## Question

Where do settings, sign-out and account deletion live, and what does the User see there?

The app has three tabs (Timer, Progress, Habits; see [Habit lifecycle and stats](06-habit-lifecycle-and-stats.md)), and none of them owns these:

- The Pomodoro durations (focus, short Break, long Break) from [Pomodoro Session rules](01-pomodoro-session-rules.md).
- The Screen Wake Lock on/off setting from [Reliable browser timers](04-reliable-browser-timers.md).
- Sign-out, and what the User is told when unsynced changes remain ([Storage and accounts](03-storage-and-accounts.md)). The wording of that message is shared with [Offline and sync experience](08-offline-and-sync-experience.md).
- "Delete account" from [Tech stack and hosting](07-tech-stack-and-hosting.md): confirmation wording, the note that data stays in backups for up to 30 days, and how the User is asked to be sure.
- Which Google identity is signed in, and links to the privacy policy.

Decide the entry point (a fourth tab, a profile or gear icon, a sheet), what is on the screen and in what order, and how destructive actions are set apart. Domain context: see `CONTEXT.md`. Layout is mobile-first on every device with a maximum width on desktop.

Handed over from [Offline and sync experience](08-offline-and-sync-experience.md):

- The sign-out dialog wording for unsynced changes is settled there (try a short sync first; the dialog only appears if that fails or the device is offline); decide here only where the button lives.
- Settings needs an "Install app" entry (the install card on the Timer tab is dismissible and does not return by itself), hidden when the app already runs installed.
- The Screen Wake Lock setting stays visible but disabled with "Not supported on this device" where the browser does not support it.
- The status pill's "Sync now" lives in the pill's own sheet, so it does not need a place here.

## Answer

Resolved with the user in two grilling rounds; every recommendation was accepted except Q3, which the user extended (two sound toggles, a theme setting). No new vocabulary and no ADR: nothing here is hard to reverse. Two earlier decisions are amended by this ticket, and each carries a note: [Activity Grid look](05-activity-grid-look.md) (theme) and [Pomodoro Session rules](01-pomodoro-session-rules.md) (Break-end alert).

- **Entry point.** The User's small Google profile photo in the top-right of the header on all three tabs, next to the status pill from [Offline and sync experience](08-offline-and-sync-experience.md). It opens a full Settings screen with a back button. Settings is not a fourth tab and not a sheet. There is no shortcut from the Timer to the durations.
- **Contents of v1 Settings.** Durations, two sound toggles, Screen Wake Lock, theme, Install app, Privacy policy, sign-out, Delete account, and the signed-in Google identity. Nothing else: no language setting (the UI is English only in v1, so every string in these tickets is final text and there is no i18n layer), no week-start or time-zone setting (Monday start is fixed; a Day follows the device's local time), no notification settings (out of scope).
- **Layout, top to bottom, one column at the same maximum width as the rest of the app.**
  1. **Account card**: photo, name and email from Google, display only because Google manages them, with a neutral (not red) **Sign out** button. Sign-out behaves as settled in [Offline and sync experience](08-offline-and-sync-experience.md): a short sync first, and the dialog only if that fails or the device is offline.
  2. **Timer**: the three durations, "Reset to defaults", the two sound toggles, and "Keep screen awake".
  3. **Appearance**: the theme.
  4. **App**: "Install app" (hidden when the app already runs installed) and "Privacy policy".
  5. **Danger zone**, last, set apart by space and its own heading: a single "Delete account" row in red text with no filled background, opening the sheet described below.
  Settings that stay on the device (sounds, Wake Lock, theme) carry a small note "Only on this device" under their group; the durations do not, because they sync.
- **Durations.** Steppers with +/- buttons that can also be typed into, whole minutes. Limits: focus 1-120, short Break 1-30, long Break 1-60. An out-of-range or empty value reverts to the previous value with a small message under the field. Changes save immediately, with no Save button. "Reset to defaults" restores 25/5/15. A note reads "Applies to your next session. A running session keeps the durations it started with."
- **Sounds.** Two toggles, both on by default: "Sound when focus ends" and "Sound when Break ends". When one is off, the alert is on screen only. No volume slider and no choice of tones. The two sounds use different tones, so the User can tell them apart without looking.
- **Break-end alert (amends Pomodoro Session rules).** When a Break ends, an on-screen "Break over" alert with a "Start next session" button (using the last Habit) and a close button, plus the sound if enabled. No auto-start. Like the end-of-focus alert it is best-effort ([Reliable browser timers](04-reliable-browser-timers.md)): if the Break has already ended by the time the app is opened, there is no extra prompt and the Timer simply shows its ready state. No Check-in is involved, so there is no "full, partial or none" flow for a Break.
- **Screen Wake Lock.** Its toggle lives in the Timer group, per device; where the browser does not support it, it stays visible but disabled with "Not supported on this device" (as in [Offline and sync experience](08-offline-and-sync-experience.md)).
- **Theme (amends Activity Grid look).** A three-segment control: System, Light, Dark, default System, applied immediately, stored on the device only. The contrast targets of [Empty states and grid accessibility](09-empty-states-and-grid-accessibility.md) hold in both modes.
- **What syncs.** The three durations are one settings record per User, synced like other data (whole-record last-write-wins, available offline, deleted with the account). Sounds, Wake Lock and theme are per device, because support and preference differ by device. "Install app" stores nothing.
- **Delete account.** Tapping the red row opens a full sheet, not a small dialog. It names what will be lost with real counts ("3 Habits and 142 Check-ins"), says it cannot be undone, and says a copy stays in backups for up to 30 days and is then removed. The red button "Delete my account and data" only becomes active once the User has typed `DELETE`. There is no Google re-authentication in v1: the data is low-risk and re-authentication adds friction and fails when the session has expired; the risk of an unlocked device in another person's hands is accepted. Offline, the row is disabled with "Connect to the internet to delete your account." because deletion happens on the server. When it completes, the device wipes all local data for that User and returns to the sign-in screen with the line "Your account and data were deleted." (a different line from the one other devices see, in [Offline and sync experience](08-offline-and-sync-experience.md), because here the User did it themselves).
- **Privacy policy.** A static page at `/privacy` on the app's own domain, in English, precached so it opens offline, linked from Settings and from the sign-in screen (Google's production OAuth requires a public policy URL). It states only decided facts: the data kept (Google name, email and photo; Habits, Check-ins, Pomodoro Sessions, settings), stored on the developer's own server, Users isolated from each other, no analytics and no trackers, off-site backups with 30-day retention, how to delete the account and that data stays in backups for up to 30 days, and a contact email. No Terms of Service in v1. The full text is written during the build; the spec only fixes this outline.

The map is now clear: no open ticket and nothing in the fog.
