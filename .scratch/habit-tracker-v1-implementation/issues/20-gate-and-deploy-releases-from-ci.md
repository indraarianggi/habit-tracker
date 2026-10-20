# 20: Gate and deploy releases from CI

**What to build:** A passing change can publish an image and deploy the complete app from GitHub Actions through the homelab's Cloudflare Tunnel deploy path; failing core or browser journeys cannot become a release.

**Blocked by:** 11: Converge conflicting devices and explain losses; 12: Recover sync and preserve work through sign-out; 15: Inspect and amend a Day from Progress; 16: Delete a User's data deliberately; 17: Install and safely update the offline app; 19: Replicate, restore, and monitor history.

**Status:** ready-for-agent

- [ ] CI runs the headless core against fake time, separate device stores, real sync routes and in-memory SQLite, plus critical Playwright journeys with stubbed Google sign-in, including offline sync, Task copy, Session focus, past Check-in correction, grid keyboard use, update gating, and offline privacy.
- [ ] Both test seams must pass before the container image is published to GHCR; coverage gates target meaningful public behavior, not private implementation or a numeric threshold alone.
- [ ] After a passing build, the deploy job installs `cloudflared`, authenticates through this repo's Cloudflare Access service token, and SSHes to `ssh.indraarianggi.xyz` as `deploy` with a key whose `authorized_keys` entry forces exactly `sudo /usr/local/bin/redeploy habit-tracker` (`docs/deployment-home-server.md` §12.2, §14.6-14.7) — not Tailscale, which the guide reserves for the operator's own admin access, never CI. Migrations already precede traffic (the startup migration in `src/server/db.ts`, gated by the container healthcheck under `docker compose up --wait`); a failed `redeploy` or healthcheck fails the job rather than claiming success.
- [ ] Release instructions document the four required GitHub secrets (`DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, per §12.3), the pre-launch restore prerequisite from ticket 19, and manual real-device checks for iOS lock-screen timing, sounds/mute switch, Wake Lock, and iOS/Android installation.
- [ ] A CI run or equivalent isolated pipeline exercise shows failing tests block publish and a passing build reaches the deployment stage without requiring manual schema steps.

## Comments

**2026-10-20:** Corrected against `docs/deployment-home-server.md`: the original acceptance criteria said deployment goes "over Tailscale," copying ADR-0002's now-outdated text. The guide draws a hard line between the two SSH paths — `ssh.indraarianggi.xyz` behind Cloudflare Tunnel + Access is the machine/CI deploy path (forced-command, scoped to one `redeploy <project>` call), while Tailscale is reserved for the operator's own ad hoc admin access and is explicitly told not to be used for deploy. ADR-0002 has been updated to match; this ticket's secrets list and deploy-step description now follow §12.2/§12.3/§14.7 exactly.
