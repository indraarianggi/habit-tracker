# 16: Delete a User’s data deliberately

**What to build:** A User can permanently delete their account and all live history with an informed online confirmation; every device then removes only that User’s local data.

**Blocked by:** 10: Delete a Task safely; 12: Recover sync and preserve work through sign-out.

**Status:** ready-for-agent

- [ ] Settings’ separated Danger zone opens a full confirmation sheet with real Task and Check-in counts, irreversibility, and the warning that off-site backups retain a copy for up to 30 days; the destructive action requires typing `DELETE`.
- [ ] Offline deletion is disabled with “Connect to the internet to delete your account.”; online deletion atomically removes the User and all associated live records, including Session receipts and Pending server state.
- [ ] This device wipes that User’s local data and displays a confirmation on sign-in; another device recognizes “account gone” on sync, wipes that same User including Pending changes, and explains that deletion occurred elsewhere.
- [ ] Another signed-in User’s local records on a shared device remain untouched; deleted credentials cannot continue syncing private data.
- [ ] A multi-device headless check and browser confirmation journey prove deletion, propagation, isolation, and accurate counts.
