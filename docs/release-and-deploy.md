# Release and deploy (habit-tracker)

Ground truth for ticket 20 (`.scratch/habit-tracker-v1-implementation/issues/20-gate-and-deploy-releases-from-ci.md`).
The pipeline itself is `.github/workflows/deploy.yml`; this doc covers what a human must set up
once and check before calling a release "live."

## How a release happens

1. Every push and PR runs the `test` job: full build, typecheck, then the complete Playwright
   suite (`docs/agents/testing.md`) against both the dev server and a production-built server
   (`SMOKE_SERVER=production`) — catching the class of bug that only shows up in one mode (ticket
   17/18 both hit exactly this).
2. Only a push to `main` that passes `test` reaches `build`, which publishes
   `ghcr.io/indraarianggi/habit-tracker:main` and `:<sha>`.
3. `deploy` then SSHes to `ssh.indraarianggi.xyz` as `deploy` (Cloudflare Access + a forced-command
   key scoped to exactly `redeploy habit-tracker` — never the operator's own Tailscale admin
   access, which `docs/deployment-home-server.md` §12.2 reserves for humans). The server's
   `redeploy` script does `docker compose pull && docker compose up -d --wait`, so a failed
   migration or unhealthy container fails the job instead of silently leaving the old version
   running.
4. A final curl against `https://habits.indraarianggi.xyz/api/health` confirms the app is actually
   reachable from the internet, not just healthy inside the container.

## One-time setup (operator)

### Required GitHub repo secrets

Already set from ticket 18 (confirmed via `gh secret list -R indraarianggi/habit-tracker` — no
new secrets needed for this ticket):

| Secret | Source |
|---|---|
| `DEPLOY_SSH_KEY` | `docs/deployment-home-server.md` §12.2 |
| `DEPLOY_KNOWN_HOSTS` | §7.6 step 4 |
| `CF_ACCESS_CLIENT_ID` | §12.1 |
| `CF_ACCESS_CLIENT_SECRET` | §12.1 |

### Required GitHub repo variable (new for this ticket)

`VITE_PRIVACY_CONTACT_EMAIL` — baked into the production image at build time and shown publicly
on `/privacy` (README). This is a **variable**, not a secret (it's public-facing), and must be a
real, monitored inbox — not an agent-chosen placeholder:

```bash
gh variable set VITE_PRIVACY_CONTACT_EMAIL --body "<your real monitored address>"
```

Without it, the `build` job's `docker/build-push-action` step bakes in an empty string, which
fails `vite.config.ts`'s own validation (`Set VITE_PRIVACY_CONTACT_EMAIL to a working contact
address...`) — the build will fail loudly rather than ship a broken `/privacy` page.

### GHCR package visibility

First deploy will fail at `docker compose pull` if the GHCR package is private and the server
isn't logged in (`docs/deployment-home-server.md` §7.6 step 3). Either run `sudo docker login
ghcr.io` on the server with a `read:packages` PAT, or make the package **Public** in its GitHub
settings after the first push.

## Restore prerequisite (ticket 19)

Before calling a release "production-ready" (not before every deploy — this doesn't block routine
pushes), the Litestream restore drill in `docs/replication-and-restore.md` §3 must have been run at
least once against this release's real data, with a logged outcome. That drill itself was blocked
on this ticket's first deploy existing — do it once real Tasks/Check-ins/settings data exists on
`https://habits.indraarianggi.xyz`, then also register the uptime monitor (`docs/replication-and-restore.md` §1.4).

## Manual real-device checks (ticket 17)

The Playwright suite can't exercise real device hardware. Before considering the PWA experience
launch-ready, check by hand on real devices:

- **iOS lock-screen timing**: a running focus Session continues to track elapsed time correctly
  after the screen locks and unlocks.
- **Sounds and the mute (ring/silent) switch**: focus-end alert sound respects the hardware mute
  switch on iOS, and plays audibly on Android.
- **Wake Lock**: the screen actually stays awake during a running Session on both platforms, and
  releases normally once it ends.
- **Installation**: the Chrome/Android install prompt and the iOS Share → Add to Home Screen flow
  both produce a working installed app icon and standalone launch.

## Rollback

Re-run an old successful run from the Actions tab — `build` overwrites the `:main` tag with that
commit's image, then `deploy` pulls it. For an emergency rollback straight from the server, edit
`image:` in `/opt/stack/apps/habit-tracker/compose.yaml` to a specific `:<sha>` tag and run `docker
compose up -d` there directly; revert to `:main` once a fix is pushed.
