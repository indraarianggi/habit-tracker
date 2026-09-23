# 05: Plan future Days and copy forward

**What to build:** A User navigates Days, plans ahead, and deliberately copies unfinished work forward without moving or rewriting the source Day.

**Blocked by:** 03: Create a Task locally and sync it.

**Status:** ready-for-agent

- [ ] A Monday-start week strip with previous/next navigation and dots for Days containing Tasks opens a selected Day; its header shows the Day, focused minutes, Check-in count, and completed/total Tasks.
- [ ] Today and future Days put the add-Task input first; past Days have no create action and an empty past Day says “No Tasks for this Day.”
- [ ] An unfinished Task may be copied only to a Day strictly later than its source and no earlier than Today; the copy has a new identity, only the title, incomplete state, and an appended position.
- [ ] Past unfinished Tasks show “Copy →” and a hint that they remain on their original Day; midnight never copies, moves, completes, or prompts about them.
- [ ] A headless and browser check proves source preservation, target restrictions, independent later deletion, and the future/past empty states.
