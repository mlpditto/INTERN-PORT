# Quiz Engine list (admin)

The Assignments ▸ Quiz Engine page: rows, pills, pager, filters, coverage, the blank-quiz sweep.

## How to get to it (user POV)

Admin: Assignments ▸ Quiz Engine.

## Scripts that drive it

- `quiz-row-lean-qa` — row = title + badges, icon chips line, actions
- `quiz-deadline-check` — LINE deadline alerts (`notifyQuizDeadlines`): T-24 h group bubble, T-3 h personal bubble to interns who have not submitted, quiet hours 22:00–07:00, idempotent markers, daily cap, quota guard, truthful Beri line; the digest shares `scanQuizPending`
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

## Deadline alerts (LINE)

Hourly `notifyQuizDeadlines` (functions/quiz-deadline.js is the pure part). For every ACTIVE quiz with a deadline in the next 24 h: ONE bubble to the LINE group (counts only, never names), then — 3 h before — one personal bubble per intern who has NOT submitted (same cohort and "done" rules as the 16:00 digest, through the shared `scanQuizPending`). On by default; the quiz editor chip **Deadline alert (LINE)** (`quizzes.notifyDeadline === false`) opts one quiz out. Nothing goes out 22:00–07:00 (an 08:00 deadline is chased at 21:00 the evening before). Personal pushes stop at 15 per Bangkok day and when `line_usage` for the month is ≥ 90 % of 300; the group bubble stops at 300. Markers live in `quiz_deadline_alerts/{quizId_deadlineSec}` (moving the deadline re-arms; written only after a successful push) and `_cap_{YYYY-MM-DD}`. Pushes are tagged `quizDeadlineGroup` / `quizDeadlineDM` in the dashboard quota card.

## What usually lies

- **Known local failures.** `empty-quiz-sweep-qa` fails on a CRLF checkout (the vm slice compares line endings); `quiz-chips-fit-qa` and `quiz-filters-lean-qa` are load-timing flakes. All three pass on CI — re-run alone before suspecting a change.
- The list is rendered by `renderQuizzesNow` from fixture quizzes; a fixture without `isActive` / `deadline` lands in Templates and the Live assertions find nothing.
- The Beri line in the deadline bubble is the tier really on offer inside the last 24 h (20 % of `deadlineBeriMax`, default 5 → +1, nothing under 6 h) — the full "+5" only exists 48 h out.

## Rank questions — order mode and tier-box mode (V101.231)

One question type `rank`, two ways to answer, chosen per question by `mode` (admin Quiz Editor chips **Order | Tier-box**; a saved question without `mode` is Order).
- **Order** (no `mode`): the intern types an answer, then taps the options best → worst; credit = 0.2 typed + 0.8 ranking (first pick best ½ + pairs in order ½, pairs inside one level ignored).
- **Tier-box** (`mode:'tier'`): the intern puts EACH option in Best / OK / Avoid — one tap per row, nothing pre-selected, Lock waits for every row; the answer is `typed ⏐ t0,t1,… ⏐ m:n` with `t_i` = the level chosen for option i in the ORIGINAL option order. Credit = 0.2 typed + 0.8 × mean over all options (exact 1 · one level off ½ · Best↔Avoid 0); an option flagged ⚠ unsafe that is not put in Avoid caps the credit at 0.6 (≤ ★3). Same stars (≥95 ★5 · ≥80 ★4 · ≥60 ★3 · ≥40 ★2).
- **Reveal timing**: practice (incl. ONE-TIME first-time practice) reveals each Rank question right after its lock; a counted quiz shows only the locked state and reveals everything after Submit. The typed answer’s “Did your answer mean one of these?” is asked once before Submit’s confirm for every locked question the typed answer did not auto-match (skipped = none). Rank Beri (★4 +1, ★5 +2, 50/day cap) is paid at Submit through the ledger row that is also the dedupe record.
- Pure scoring lives in `public/rank-quiz.js` (`score/parse/phase/pack/valid`, tier mode dispatches on `q.mode`); QA `rank-quiz-qa`, `rank-tier-qa`, `rank-quiz-runner-qa`.
