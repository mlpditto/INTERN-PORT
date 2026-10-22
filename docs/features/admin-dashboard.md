# Admin Dashboard, Kanban, archive & delete requests

The Dashboard home: Review Kanban, Archive modal, LINE quota chip, the Delete requests queue.

## How to get to it (user POV)

Admin: Dashboard (first screen after login).

## Scripts that drive it

- `archive-modal-qa` — two panes behind tabs with counts; Clear All only with cards
- `line-usage-chip-qa` — "✈ 12/300" chip in the board toolbar; card folds out
- `delete-request-context-check` — delete-requests.js context: profile / photo / quiz / legacy refs
- `delete-request-quiz-check` — Delete on a quiz-attempt request really deletes and takes the score back
- `note-delete-request-qa` — deletion queue includes archived notes, newest first

## What usually lies

- Dashboard widgets moved around a lot (sidebar → tabs); a static assertion on `#dashboard-summary` children is the first thing a widget move breaks — check the destination tab too.
