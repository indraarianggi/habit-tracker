# 17: Install and safely update the offline app

**What to build:** After recording focus, a User can install the app and return to an offline-capable shell and privacy page; an available update never interrupts unresolved focus.

**Blocked by:** 02: Sign in and open a private Today view; 06: Run and control a focus interval; 09: Record and correct manual Check-ins.

**Status:** ready-for-agent

- [ ] The installable shell, assets, and privacy policy load offline; locally stored data remains usable and Pending changes stay on this device until sync can resume.
- [ ] After the first Check-in, a dismissible install card offers the browser prompt on supported Chrome/Android or actionable Share → Add to Home Screen instructions and a storage reason on iOS; it does not reappear after dismissal or when installed.
- [ ] Settings provides “Install app” after dismissal but hides it when already installed; after the first Check-in the app silently requests durable browser storage without blocking recording.
- [ ] A new-version banner offers Reload, but a running or paused focus interval disables it with “Update after your session”; the User can update once focus is resolved.
- [ ] Browser checks exercise install eligibility, precached offline privacy, retained Pending changes, and update gating during focus.
