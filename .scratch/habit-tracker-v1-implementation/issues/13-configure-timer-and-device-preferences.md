# 13: Configure timer and device preferences

**What to build:** A User opens Settings from their profile, adjusts future Pomodoro durations, and separately chooses this device's sounds, Wake Lock, and light/dark appearance.

**Blocked by:** 03: Create a Task locally and sync it; 08: Take Breaks and receive alerts.

**Status:** resolved

- [x] The header profile opens a full Settings screen with a back action and the signed-in Google name, email, and photo; the current all-Task Focus Streak chip is available when Progress derives it.
- [x] Focus (1–120), short Break (1–30), and long Break (1–60) minutes accept steppers and typed whole numbers, save immediately across devices, reject invalid input with a small message and previous value, and reset to 25/5/15.
- [x] An active Session retains the durations captured at Start; a setting change affects only later Sessions.
- [x] Independent focus-end and Break-end sound toggles, Wake Lock, and System/Light/Dark theme override apply only on this device and are marked “Only on this device”. Unsupported Wake Lock remains visible but disabled with its explanation.
- [x] Settings shows the specified Account, Timer, Appearance, and App groups with a working privacy-policy link; Install app and the separated Danger zone appear when their actions are implemented, not as inactive placeholders.
- [x] Browser and headless checks cover limits, immediate sync, reset, per-device isolation, and non-retroactive timing.

## Verification

`pnpm run typecheck` and `pnpm run smoke:browser` (106 passed, 2 skipped) pass on 2026-09-29. `src/routes/__tests__/settings.test.ts` covers duration bounds/reset/invalid-input recovery, immediate cross-device sync, and per-device isolation of sounds/Wake Lock/theme; `src/routes/__tests__/breaks.test.ts` and `src/routes/__tests__/focus-recovery.test.ts` confirm an active Session keeps its Start-time durations across a later settings change. Bounds (1–120/1–30/1–60) and defaults (25/5/15) confirmed directly in `src/components/settings-screen.tsx`. The Settings screen's Install app and Danger Zone entries are gated on `installEligible`/account state (not static placeholders), now that tickets 16 and 17 are both implemented.

This ticket's checklist and Status were already complete in code (see `0145e66`) but the tracker file wasn't updated to `resolved` after that commit landed; verified against current code before flipping it.
