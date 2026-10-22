# Reviewing attempts & participants

Admin review of a quiz attempt, pending-table recounts, practice attempts, re-scoring multi-answer choices, the Participants table.

## How to get to it (user POV)

Admin: Kanban ▸ a quiz attempt ▸ Review; Quiz Engine row ▸ 👥 Participants.

## Scripts that drive it

- `review-lean-qa` — Review Quiz Attempt: one-row header, Full / Actual marks
- `pending-multi-recount-qa` — two-answer questions recounted correctly in the pending table
- `choice-rescore-check` — seven admin paths score a joined multi-answer correctly
- `quiz-practice-review-qa` — practice attempts keep practiceAnswers; Review / PDF use them
- `quiz-participants-score-qa` — one-time practice attempt shows a score and joins the average
- `participants-header-qa` — lean Participants header: title, Avg, "need 10+"
- `participants-division-avg-qa` — 🏷️ division, ⏱ total + ⌀ per question, amber slow pill
- `participants-active-highlight-qa` — active intern rows highlighted (hwIsActiveUser)

## What usually lies

- A multi-select answer is stored joined (`"0\n---\n2"`); a fixture storing an array passes every path that the real data breaks.
