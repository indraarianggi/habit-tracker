# Define the daily focus item

Type: grilling
Status: resolved

## Question

What exactly is the concrete, Day-specific work item at the center of the corrected product, and what canonical term should the domain model and UI use for it?

Settle at least:

- Whether **Task**, **Focus Task**, or another term replaces **Habit**, including whether the product name should change.
- Whether every item belongs to exactly one Day and exists independently of any Pomodoro Session.
- The minimum identity and fields of an item: title, optional detail, Day, and any status that is intrinsic to the item.
- The boundary between an item being completed and focused time merely being recorded against it.
- Whether two items may have the same title, and what makes an item distinct.
- Concrete scenarios such as one item receiving several Pomodoro Sessions, an item receiving no session, and two same-named items on different Days.

Use `grilling` and `domain-modeling`. Challenge the old glossary directly: its Habit is a reusable label, while the corrected object is a concrete item for a Day.

## Answer

Resolved with the User in two grilling rounds:

- **Canonical object.** The domain and UI term is **Task**. A Task is a concrete to-do item for exactly one Day, not a recurring Habit label. **Habit Tracker** remains the product name only; **Habit** is not a domain or UI term.
- **Independent existence.** A Task exists before and independently of any Pomodoro Session. A Task with no Session is still a valid Task for its Day, and one Task may receive zero, one, or many Sessions.
- **Completion versus focus.** Completion is an explicit Task state controlled independently from focused time. Finishing a Pomodoro Session records effort but never marks the Task complete automatically.
- **Minimal fields.** In v1 a Task has a stable identity, title, Day, and binary completion state. It has no description, colour, priority, estimate, category, or tag.
- **Title validation.** The title is required after trimming leading and trailing whitespace, preserves the User's capitalization, and is at most 120 characters.
- **Duplicates.** Titles are not unique. Same-titled Tasks are allowed on the same or different Days because stable identity, not title, distinguishes them.

Consequences handed to later decisions: Task movement and completion reversal belong to [Decide the daily task lifecycle](02-decide-daily-task-lifecycle.md); Session and historical-record behavior belongs to [Redefine Pomodoro records around tasks](03-redefine-pomodoro-records.md).
