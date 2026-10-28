# Admin Dashboard, Kanban, archive & delete requests

The Dashboard home: Review Kanban, Archive modal, LINE quota chip (LINE's own count + the daily `watchLineQuota` mail), the Delete requests queue.

## How to get to it (user POV)

Admin: Dashboard (first screen after login).

## Scripts that drive it

- `archive-modal-qa` — two panes behind tabs with counts; Clear All only with cards
- `line-usage-chip-qa` — "✈ 12/300" chip in the board toolbar; card folds out
- `line-quota-chip-qa` — the chip / card show LINE's own count from `line_usage/{month}.api` while it is fresh (< 36 h): number, limit, colour of the worse tier, projection note, Send-digest gate on LINE's cap; stale / error / unlimited fall back to the counter
- `line-quota-check` — `functions/line-quota.js` (tier maths: day-1 spike no alarm, pace projection + run-out day, 70 / 90 / 100 %, unlimited plan; the Thai owner mail) and the real `runWatchLineQuota` in a vm: writes the `api` block, mails once per tier per month, API failure recorded without mail, mail failure leaves `lastMailedTier`, never a LINE push
- `delete-request-context-check` — delete-requests.js context: profile / photo / quiz / legacy refs
- `delete-request-quiz-check` — Delete on a quiz-attempt request really deletes and takes the score back
- `note-delete-request-qa` — deletion queue includes archived notes, newest first

## What usually lies

- The `line_usage` counter only sees pushes made through `pushLineFlex`; anything sent from OA Manager or another tool never reaches it. `watchLineQuota` (daily 07:00 Bangkok) stores LINE's own `quota` / `consumption` under `line_usage/{month}.api`; until it is deployed and has run once the chip shows the counter only. A mail goes to the owner when the tier rises (watch → critical → full), once per tier per month — never a LINE push.

- Dashboard widgets moved around a lot (sidebar → tabs); a static assertion on `#dashboard-summary` children is the first thing a widget move breaks — check the destination tab too.
