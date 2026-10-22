# Quiz Engine list (admin)

The Assignments ▸ Quiz Engine page: rows, pills, pager, filters, coverage, the blank-quiz sweep.

## How to get to it (user POV)

Admin: Assignments ▸ Quiz Engine.

## Scripts that drive it

- `quiz-row-lean-qa` — row = title + badges, icon chips line, actions
- `quiz-chips-fit-qa` — chips fold into "+n" only when the line has no room
- `quiz-tools-rail-qa` — row tools as one icon grid > 1100 px, ⋯ below
- `quiz-list-phone-qa` — phone rows are cards; desktop one card + header
- `quiz-status-pills-qa` — LIVE / PAUSED / TEMPLATES filter pills with counts
- `quiz-live-pill-news-cafe-qa` — live pill is an icon; news card hidden in CAFE
- `live-band-rewrites-gap-qa` — header on top, 🟢 Live band under it; Rewrites gap
- `quiz-paused-fold-qa` — Paused / Templates divider folds, remembered per browser
- `quiz-filters-lean-qa` — icon-only toolbar pills, one sort button, folded Style / Tags
- `quiz-engine-pager-filter-qa` — numbered pager + coverage chips as a list filter
- `quiz-engine-lean4-qa` — coverage badge colours and three more small things
- `quiz-last-attempt-pts-qa` — "🕒 16 Oct 14:20" under the Live pill; pts with two decimals
- `quiz-row-active-done-qa` — 👥 blue = people who did it, green = active now
- `quiz-coverage-move-qa` — Coverage by System lives inside the Quiz Engine tab
- `quiz-coverage-delete-qa` — 🗑️ per quiz row in the coverage list modal
- `coverage-neuro-mental-qa` — Mental Health + Neurological are one system
- `coverage-supplements-qa` — Supplements is a system before Other
- `empty-quiz-sweep-qa` — blank quizzes older than 12 h deleted once per session, logged

## What usually lies

- **Known local failures.** `empty-quiz-sweep-qa` fails on a CRLF checkout (the vm slice compares line endings); `quiz-chips-fit-qa` and `quiz-filters-lean-qa` are load-timing flakes. All three pass on CI — re-run alone before suspecting a change.
- The list is rendered by `renderQuizzesNow` from fixture quizzes; a fixture without `isActive` / `deadline` lands in Templates and the Live assertions find nothing.
