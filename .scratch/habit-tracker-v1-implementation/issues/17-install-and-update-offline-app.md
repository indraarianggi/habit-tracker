# 17: Install and safely update the offline app

**What to build:** After recording focus, a User can install the app and return to an offline-capable shell and privacy page; an available update never interrupts unresolved focus.

**Blocked by:** 02: Sign in and open a private Today view; 06: Run and control a focus interval; 09: Record and correct manual Check-ins.

**Status:** ready-for-human

- [x] The installable shell, assets, and privacy policy load offline; locally stored data remains usable and Pending changes stay on this device until sync can resume.
- [x] After the first Check-in, a dismissible install card offers the browser prompt on supported Chrome/Android or actionable Share → Add to Home Screen instructions and a storage reason on iOS; it does not reappear after dismissal or when installed.
- [x] Settings provides “Install app” after dismissal but hides it when already installed; after the first Check-in the app silently requests durable browser storage without blocking recording.
- [x] A new-version banner offers Reload, but a running or paused focus interval disables it with “Update after your session”; the User can update once focus is resolved.
- [x] Browser checks exercise install eligibility, precached offline privacy, retained Pending changes, and update gating during focus.

## Comments

Implemented: `public/manifest.webmanifest`, `public/icons/*` (generated placeholder mark — mint rounded-square + ring/dot, any/maskable/apple-touch/favicon), `public/sw.js` (hand-rolled offline shell: eager install-time precache of `/`, `/today`, `/privacy` plus their referenced hashed assets; cache-first only for content-addressed `/assets/`, `/icons/`, `/manifest.webmanifest`; network-first navigation with cache fallback; update lifecycle via install→waiting, gated `skipWaiting` on user action only), `scripts/stamp-service-worker.mjs` (appends a unique build marker to the deployed `sw.js` on every `pnpm run build` so the browser's byte-diff update check actually fires each release), `src/lib/pwa.ts` (install-prompt capture, SW registration/update detection, durable-storage request, device-only dismiss flag), plus wiring in `__root.tsx`, `today.tsx`, `settings-screen.tsx`. New Playwright suite: `src/routes/__tests__/pwa.test.ts`.

Two scenarios (eager precache of an unvisited route, and a full offline reload) only exercise meaningfully against the **production build** — this app does real per-route SSR in production but an unbundled dev-only shell in `pnpm dev`, so those two tests `test.skip` unless `SMOKE_SERVER=production`; verified passing there. A third test (forcing a real `sw.js` byte-diff to check the update banner) only works against the dev server, since the built server caches `sw.js` in memory per process — so that one skips under `SMOKE_SERVER=production` instead. All three are exercising the same real mechanism, just from whichever server actually supports the trick.

Found and fixed two real bugs surfaced by full regression runs, not just PWA-scoped ones: (1) `isStandalone()`/`isIOS()` crashed under SSR (`window`/`navigator` undefined) — only visible in production since dev doesn't SSR the `Today` tree; (2) `controllerchange` fires on the very first SW claim too, not only on real updates — reloading unconditionally caused an intermittent extra reload right after first load that occasionally raced the sign-in OAuth redirect test. Fixed by only reloading after `applyUpdate()` was called locally.

Could not access `habit-tracker.pen` in this environment — the pencil MCP tool requires the pen.dev desktop editor to have the file open, which wasn't available headlessly. The install card, update banner and iOS install sheet were designed to match the app's existing token system and banner/sheet patterns (mint/sky/card-with-backdrop, same as the sync-status and delete-account sheets) rather than the pen file directly. Worth a follow-up pass against the actual `.pen` frames when that tool is available.

No external credentials are needed for this ticket — everything (SW registration, install prompts, storage persistence, the update banner) is client-side browser API surface with no new third-party service.
