# Offline and sync experience

Type: grilling
Status: resolved

## Question

What does the User see and do while the app is offline, waiting to sync, or installed as a PWA?

Cover at least:

- The connection and sync status the User sees: offline indicator, pending (unsynced) changes, sync failure, and how they recover.
- What is available offline versus what needs a connection. Already settled: reading data, manual Check-ins and finishing a running session work offline; starting a Pomodoro Session needs a connection ([Storage and accounts](03-storage-and-accounts.md)). What the User sees when they try to start a session offline.
- What the User sees after a change loses to a deletion or a later edit made elsewhere (last-write-wins, deletion beats edit), if anything.
- The install experience: whether and how to prompt "add to Home Screen", and how the app behaves on iOS as an installed PWA versus in a Safari tab.
- What the User is told about unsynced data left on the device after sign-out.

Facts to take as given from [Reliable browser timers](04-reliable-browser-timers.md): Safari tabs lose script-writable data after 7 idle days while installed Home Screen web apps are exempt (an argument for prompting an install on iOS); `navigator.storage.persist()` opts an origin out of eviction; Screen Wake Lock does not work in an installed iOS web app before iOS 18.4.

Domain context: see `CONTEXT.md`. The layout is mobile-first on every device with a maximum width on desktop.

Handed over from [Habit lifecycle and stats](06-habit-lifecycle-and-stats.md): a Check-in recorded offline for a Habit that another device deleted is dropped when it syncs (deletion beats edit, and delete cascades to Check-ins). Decide here what the User is told, if anything. A Check-in for a Habit that was only archived elsewhere is kept, so that case needs no message.

## Answer

Resolved with the user in two grilling rounds; every recommendation was accepted. Vocabulary added to `CONTEXT.md`: **Pending change** (anything created, edited or deleted on a device that the server has not received yet; it survives sign-out). No ADR: nothing here is hard to reverse.

- **Status pill.** A small pill in the header of all three tabs, shown only when something needs attention: "Offline", "N changes waiting", "Can't sync", or "Sign in to sync". Nothing is shown when everything is synced (no permanent "Synced" mark). Tapping it opens a small sheet with the status in plain words and a "Sync now" button (active when online).
- **Starting a session offline.** The Start button is disabled with the text "Connect to the internet to start a session." under it. The Habit picker and the "+" manual Check-in stay usable, and a running session can still be finished. Start re-enables by itself when the connection returns.
- **Check-in dropped because its Habit was deleted elsewhere.** A dismissible banner on the Timer tab that stays until closed, naming the Check-in and the Habit: "1 Check-in (25 min on Reading, 12 Sep) wasn't saved because Reading was deleted on another device." A Habit that was only archived elsewhere shows nothing.
- **Edits that lose last-write-wins.** Silent. The device simply shows the newer value after the next sync. The dropped-Check-in banner is the only exception, because it is the only case where data disappears.
- **Sync failure and recovery.** A failure while online retries automatically with backoff (a few seconds, rising to a 5-minute maximum), and immediately on the `online` event, when the app returns to the foreground, and on "Sync now". One-off failures show nothing; after 3 failures in a row while online the pill becomes "Can't sync". The sheet explains it without technical detail ("We couldn't reach the server. Your changes are safe on this device and will upload automatically.") and offers "Try again".
- **Session expiry with Pending changes.** The app stays open with all local data and Pending changes intact; the pill becomes "Sign in to sync" and opens Google sign-in. Signing in with the same account uploads the Pending changes. Signing in with a different account behaves like a normal sign-out: the old account's data stays on the device for that account.
- **Account deleted on another device.** The device returns to the sign-in screen with one line above the Google button: "This account was deleted. Data on this device has been removed." Pending changes on that device are lost with it, with no extra warning there (the warning belongs to the delete-account dialog).
- **First load on a new device.** A full "Loading your data…" screen covers all three tabs until the initial download finishes, so an empty state is never shown to a returning User. If the connection drops mid-way it changes to "Connect to the internet to load your data." with "Try again" and resumes by itself when the connection returns. After that the app opens offline like normal.
- **Install prompt.** Not on first visit and never a modal. After the User's first Check-in, a dismissible card on the Timer tab: on Chrome/Android its button uses the browser's install prompt; on iOS Safari it shows "Share → Add to Home Screen" with the honest reason (an installed app keeps unsynced local data past 7 idle days). Once dismissed it does not reappear by itself; an "Install app" entry stays in Settings. It is never shown when the app already runs installed.
- **iOS and durable storage.** `navigator.storage.persist()` is called silently right after the first Check-in, with no UI and the result ignored. The app works fully in a Safari tab, with no block and no eviction warning. Where Screen Wake Lock is unsupported (installed iOS web app before 18.4), its setting stays visible but disabled with the note "Not supported on this device".
- **Sign-out with Pending changes.** When online, tapping Sign out first tries a short sync; if it succeeds, sign-out proceeds with no dialog. If offline or the sync fails, a dialog: "You have 3 changes that haven't synced. They'll stay on this device and upload the next time you sign in with this Google account." with "Stay signed in" and "Sign out anyway". No "sign out and erase this device" option in v1 (the shared-device trade-off was accepted in [Storage and accounts](03-storage-and-accounts.md)). This wording is settled here; [Settings and account screen](10-settings-and-account-screen.md) only decides where the button lives.
- **App updates.** A "New version available" banner with a "Reload" button. While a focus interval is running or paused, Reload is disabled and reads "Update after your session"; during a Break or with no session it is free to use. If the banner is ignored, the new version takes over on the next launch.
