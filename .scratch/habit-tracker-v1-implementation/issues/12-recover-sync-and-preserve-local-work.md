# 12: Recover sync and preserve work through sign-out

**What to build:** A User sees sync trouble only when action is needed, can recover it, and never loses this device's Pending changes when a sign-in expires or they switch Google Users.

**Blocked by:** 03: Create a Task locally and sync it; 11: Converge conflicting devices and explain losses.

**Status:** ready-for-agent

- [ ] The header hides status when synced; otherwise it shows “Offline”, “N changes waiting”, “Can't sync” only after three consecutive online failures, or “Sign in to sync”, with a plain-language status sheet and “Sync now”.
- [ ] Failed sync attempts back off from seconds to no more than five minutes; network reconnect, returning to the app, and “Sync now” retry immediately, and Start becomes available automatically when online.
- [ ] Expiry leaves locally owned Tasks, Check-ins, and settings readable and editable; the status pill opens Google sign-in, and signing back into the same User uploads their Pending changes.
- [ ] Sign out tries a short sync first; only offline or failed sync shows a warning with the actual Pending count. Pending changes remain scoped to that User, and a different User on the same device never sees, modifies, or wipes them.
- [ ] Browser and multi-device headless checks cover online failure thresholds, recovery, sign-out with Pending changes, same-User resumption, and User switching.
