# 20: Gate and deploy releases from CI

**What to build:** A passing change can publish an image and deploy the complete app from GitHub Actions through Tailscale; failing core or browser journeys cannot become a release.

**Blocked by:** 11: Converge conflicting devices and explain losses; 12: Recover sync and preserve work through sign-out; 15: Inspect and amend a Day from Progress; 16: Delete a User’s data deliberately; 17: Install and safely update the offline app; 19: Replicate, restore, and monitor history.

**Status:** ready-for-agent

- [ ] CI runs the headless core against fake time, separate device stores, real sync routes and in-memory SQLite, plus critical Playwright journeys with stubbed Google sign-in, including offline sync, Task copy, Session focus, past Check-in correction, grid keyboard use, update gating, and offline privacy.
- [ ] Both test seams must pass before the container image is published to GHCR; coverage gates target meaningful public behavior, not private implementation or a numeric threshold alone.
- [ ] After a passing build, deployment uses SSH over Tailscale with a deploy-only identity and limited ACL; migrations precede traffic and a failed deployment does not claim success.
- [ ] Release instructions include required secrets, the pre-launch restore prerequisite, and manual real-device checks for iOS lock-screen timing, sounds/mute switch, Wake Lock and iOS/Android installation.
- [ ] A CI run or equivalent isolated pipeline exercise shows failing tests block publish and a passing build reaches the deployment stage without requiring manual schema steps.
