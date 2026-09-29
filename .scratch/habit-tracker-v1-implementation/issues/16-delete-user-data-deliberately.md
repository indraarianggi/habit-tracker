# 16: Delete a User’s data deliberately

**What to build:** A User can permanently delete their account and all live history with an informed online confirmation; every device then removes only that User’s local data.

**Blocked by:** 10: Delete a Task safely; 12: Recover sync and preserve work through sign-out.

**Status:** resolved

- [x] Settings’ separated Danger zone opens a full confirmation sheet with real Task and Check-in counts, irreversibility, and the warning that off-site backups retain a copy for up to 30 days; the destructive action requires typing `DELETE`.
- [x] Offline deletion is disabled with “Connect to the internet to delete your account.”; online deletion atomically removes the User and all associated live records, including Session receipts and Pending server state.
- [x] This device wipes that User’s local data and displays a confirmation on sign-in; another device recognizes “account gone” on sync, wipes that same User including Pending changes, and explains that deletion occurred elsewhere.
- [x] Another signed-in User’s local records on a shared device remain untouched; deleted credentials cannot continue syncing private data.
- [x] A multi-device headless check and browser confirmation journey prove deletion, propagation, isolation, and accurate counts.

## Verification

`pnpm run typecheck` and `pnpm run smoke:browser` (106 passed, 2 skipped) pass on 2026-09-29. `src/server/account.ts` tombstones the user id and deletes the `user` row in one `better-sqlite3` transaction, relying on FK cascade for every owned table; `src/server/__tests__/account-delete.test.ts` confirms `user`, `session`, `account`, `task`, `task_change`, `active_session`, `session_receipt`, `session_checkin` and `duration_settings` rows are all gone, `foreign_key_check` is clean, the deletion requires the exact `DELETE` confirmation, and a mismatched `X-Local-User` header is rejected with 403. The 410-vs-401 distinction (`src/server/account.ts` `unauthorizedResponse`) lets a still-cookied peer device tell "account deleted" apart from an ordinary expired session; `src/routes/__tests__/account-delete.test.ts` drives this through the real UI — Danger zone counts, typed-DELETE gating, offline disablement, this-device wipe with sign-in confirmation, a second device auto-wiping on sync, and a second signed-in User's data on a shared device staying untouched. Client-side 410 handling (`wipeAndRedirect('elsewhere')` vs the local `'here'` path) is in `src/routes/today.tsx`.

This ticket's checklist and Status were still `ready-for-agent` in the tracker despite the feature being implemented and merged in `2eff075`; verified against current code and the passing suite before flipping it to `resolved`.
