# 05: Plan future Days and copy forward

**What to build:** A User navigates Days, plans ahead, and deliberately copies unfinished work forward without moving or rewriting the source Day.

**Blocked by:** 03: Create a Task locally and sync it.

**Status:** resolved

- [x] A Monday-start week strip with previous/next navigation and dots for Days containing Tasks opens a selected Day; its header shows the Day, focused minutes, Check-in count, and completed/total Tasks.
- [x] Today and future Days put the add-Task input first; past Days have no create action and an empty past Day says “No Tasks for this Day.”
- [x] An unfinished Task may be copied only to a Day strictly later than its source and no earlier than Today; the copy has a new identity, only the title, incomplete state, and an appended position.
- [x] Past unfinished Tasks show “Copy →” and a hint that they remain on their original Day; midnight never copies, moves, completes, or prompts about them.
- [x] A headless and browser check proves source preservation, target restrictions, independent later deletion, and the future/past empty states.

## Verification

`pnpm run typecheck`, `pnpm run build`, `pnpm run smoke:browser` (14 passed), and `SMOKE_SERVER=production pnpm run smoke:browser` (14 passed) completed on 2026-09-24. The headless check exercises local copy restrictions, append order, offline Pending changes, cross-device source preservation, ownership/isolation, and independent SQLite row deletion; the browser check exercises Monday-start weeks, dots, past hint and Copy →, destination minimum, future creation, both empty states, and phone/wide overflow. The production Tasks view, past copy sheet, Today after copy, and future empty view were visually inspected at 375×812 and 1024×768. Task deletion here is a schema-level independence check, not the user-facing synced deletion reserved for ticket 10. Check-ins do not exist until ticket 09, so focused minutes and Check-in count currently display zero. Live Google consent/callback still requires the operator's OAuth web client credentials and authorized origin; the checks use test-only sessions.
