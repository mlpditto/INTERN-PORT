# Quiz Insight & tag drill-down

Learning performance rows per cluster and the tag drill-down (wrong questions) inside the User Hub.

## How to get to it (user POV)

Admin: User Hub ▸ Quiz Insight ▸ ☰ on a cluster.

## Scripts that drive it

- `quiz-insight-cache-qa` — reads approved attempts from the listener cache, no re-query
- `quiz-insight-rows-qa` — one row per cluster; compact two-per-row on wide screens
- `tag-drilldown-header-qa` — one-line drill-down header
- `tag-drilldown-wrong-qa` — each wrong question one folded line; tap expands

## What usually lies

- "limited" (thin) rows appear only below a sample size; fixtures with many attempts never render them.
