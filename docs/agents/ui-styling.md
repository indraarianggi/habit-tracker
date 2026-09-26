# UI Styling

Rules for any change that renders or restyles a screen: `src/routes/*.tsx`, `src/components/ui/*`, and the token block in `src/styles.css`.

## Stack

Styling is Tailwind CSS v4 utilities in `className`. `src/styles.css` holds the `tailwindcss` import (first), font imports, `@theme` tokens, and base layer (including the dark token overrides, tap-highlight, body colors, `touch-action`). A new page-level CSS class belongs in utilities instead.

Components come from shadcn/ui: primitives live in `src/components/ui/` (button, card, avatar), added with `pnpm dlx shadcn@latest add <name>`. After each add:

1. Remove hard-coded `dark:` utilities when token-based colors already cover both themes; preserve necessary stateful behavior.
2. Keep `src/lib/utils.ts` — the `cn` re-export — so both `cn` and `@/lib/utils` imports resolve.
3. `pnpm run typecheck` passes with the new primitive imported somewhere real.

## Tokens

`@theme` mirrors the `habit-tracker.pen` variables: `mint`/`mint-surface`/`mint-ink`, `amber`, `sky`, `border`, `muted-foreground`, and so on. When the pen file introduces a variable, add the matching `--color-*` token and use its utility. One-off shades (the sign-in button's `#18543a` hover) stay inline in the component.

Fonts: `font-display` = Plus Jakarta Sans (headlines), `font-sans` = IBM Plex Sans (body, data, feature lists).

## Device appearance

Settings offers System, Light, and Dark per device. `src/lib/device-preferences.ts` persists the choice locally; `src/routes/__root.tsx` resolves System against `prefers-color-scheme` and sets `data-theme` on `<html>`. Dark colors override the shared `--color-*` tokens in `src/styles.css`, so existing Tailwind utilities follow the selected theme without separate `dark:` copies. New UI must remain legible in both themes.

## Design source and accepted deviations

`habit-tracker.pen` is the design reference for every screen — except accepted deviations, which the pen file knows nothing about. One is on file:

- **Sign-in** (`src/routes/index.tsx`): left-aligned headline "Make room for the work that matters.", ✓ mark, green Google button — accepted by the operator over the pen's `Screen/Auth-SignIn` frame. Preserve its layout and copy; redesigning that screen to match the pen frame needs explicit operator approval.

When the operator accepts a screen that differs from the pen file, record it here (screen, what differs). This list is the single source of truth for what "follows the design" means.

## Mobile-first layout

- Today centers in a `max-w-[414px]` column; sign-in uses `max-w-[30rem]`; privacy uses `max-w-3xl`.
- Phone-specific adjustments use the `max-[480px]:` breakpoint, matching the existing screens.
- The root viewport is `viewport-fit=cover`; `theme-color` tracks the selected theme (`#f8f6f1` light, `#141b1b` dark); bottom bars pad with `env(safe-area-inset-bottom)`.

## Done means seen

A styling change is complete when the screen has been opened in a real browser at a phone viewport (≈375×812) and matches the intended design — compiling utilities is the halfway point. Check the phone viewport and one wider viewport before calling it done.
