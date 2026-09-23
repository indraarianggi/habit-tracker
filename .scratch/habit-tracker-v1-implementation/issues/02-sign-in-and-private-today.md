# 02: Sign in and open a private Today view

**What to build:** A visitor signs in with Google and sees their own empty Today view rather than another User's data. The sign-in screen explains how to read the privacy policy before signing in.

**Blocked by:** 01: Initialize the project and publish privacy.

**Status:** resolved

- [x] First Google sign-in creates a User without a separate sign-up step; subsequent sign-ins reopen that User, with a seven-day session refreshed at most daily during use.
- [x] A signed-in User reaches a mobile-width Today view; unsigned visitors cannot read another User's private records or protected endpoints.
- [x] The sign-in screen links to the real public privacy policy established in ticket 01.
- [x] Integrate Google authentication with the pinned app version and SQLite, then prove the sign-in/private-view journey with a browser smoke check and authenticated/unauthenticated server checks.

## Verification

`pnpm run typecheck`, `pnpm run build`, `pnpm run smoke:browser`, and `SMOKE_SERVER=production pnpm run smoke:browser` passed on 2026-09-23. Browser smoke stubs the external Google page, exercises the Google authorization redirect, and uses real Better Auth sessions in SQLite for signed-in isolation; an in-process stubbed Google token exchange verifies first and returning sign-ins. A live Google consent/callback requires the operator's OAuth web client credentials and authorized origin.
