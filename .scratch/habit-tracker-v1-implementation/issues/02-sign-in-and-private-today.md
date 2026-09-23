# 02: Sign in and open a private Today view

**What to build:** A visitor signs in with Google and sees their own empty Today view rather than another User's data. The sign-in screen explains how to read the privacy policy before signing in.

**Blocked by:** 01: Initialize the project and publish privacy.

**Status:** ready-for-agent

- [ ] First Google sign-in creates a User without a separate sign-up step; subsequent sign-ins reopen that User, with a seven-day session refreshed at most daily during use.
- [ ] A signed-in User reaches a mobile-width Today view; unsigned visitors cannot read another User's private records or protected endpoints.
- [ ] The sign-in screen links to the real public privacy policy established in ticket 01.
- [ ] Integrate Google authentication with the pinned app version and SQLite, then prove the sign-in/private-view journey with a browser smoke check and authenticated/unauthenticated server checks.
