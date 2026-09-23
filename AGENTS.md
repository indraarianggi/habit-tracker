## Agent skills

### Issue tracker

Issues and specs are local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Project conventions

### UI styling

Tailwind v4 utilities + shadcn/ui primitives; `habit-tracker.pen` is the design reference, and the sign-in screen is an accepted deviation from it. See `docs/agents/ui-styling.md` before any screen or styling change.

### Code conventions

`@/` imports, exact-pinned dependencies, generated route tree, import-time auth module. See `docs/agents/code-conventions.md` before any source or config change.

### Testing

Playwright only, colocated `__tests__/*.test.ts`, hermetic env from `playwright.config.ts`. See `docs/agents/testing.md` when writing or running tests.
