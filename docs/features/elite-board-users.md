# Elite Board & Users rows

The admin Users / Elite Board list: toolbar, division rail, lean rows with Q·J·C chips, last seen, hidden (Camp) users.

## How to get to it (user POV)

Admin: Dashboard ▸ Users / Elite Board.

## Scripts that drive it

- `elite-board-lean-qa` — empty chips vanish, flood words, 🧪 Beta tester for a > 365-day period
- `elite-toolbar-one-line-qa` — toolbar + rail on one line
- `elite-share-memberships-qa` — "All" share text follows userInScope with memberships
- `users-rail-divisions-qa` — chip rail follows Divisions & Groups with sub-rows
- `users-row-summary-qa` — Q·J·C chips, last seen, ⧉ copy folded into rows
- `users-rows-lean-qa` — less duplication per row; ⏳ days + hours block
- `row-avatar-show-on-boards-qa` — tapping a hidden user's photo brings them back

## What usually lies

- **After-midnight trap.** `users-rows-lean-qa` builds its dates with `toISOString()` (UTC) and fails locally between 00:00 and 07:00 Bangkok; it passes on CI and on an untouched production checkout at the same hour. Re-run after 07:00 before blaming a PR.
- The "5d left · 41d" text is computed from `Date.now()`; a fixture `endDate` that is a fixed string drifts daily.
