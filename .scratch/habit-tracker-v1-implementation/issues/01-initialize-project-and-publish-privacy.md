# 01: Initialize the project and publish privacy

**What to build:** A visitor can open the app's real, public privacy policy while the operator has a runnable and testable project ready for the first signed-in journey. This is the narrow technical prefactor before Google sign-in, not an empty scaffold.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Initialize version control and a single TypeScript project using React and a pinned, compatible TanStack Start release in SPA mode; provide repeatable development, production-build, and browser-smoke commands without creating a second backend package.
- [x] Serve a real English `/privacy` page on the app's domain, without authentication. Explain the decided Google identity, Tasks, Check-ins, Pomodoro Sessions, settings, User isolation, homelab storage, no analytics or trackers, off-site backup retention up to 30 days, account deletion, and a configured contact address.
- [x] The public page renders at mobile width and loads through a real app server in development and after a production build. No nonfunctional Google button, fake account data, or placeholder privacy text is shipped.
- [x] Keep credentials and local databases out of version control, and document the configuration needed for Google sign-in and the privacy contact address without committing real secrets.
- [x] Run the development server, open `/privacy` in a browser, and exercise the built output; keep one meaningful browser smoke check covering the public route for subsequent tickets.
