# Badges & badge export

Earned badges, the exported badge board PNG with labels / quote / options, and count parity with the intern app.

## How to get to it (user POV)

Admin: User Hub ▸ badge popover ▸ ⬇ Export.

## Scripts that drive it

- `badge-live-counts-qa` — admin export counts equal the intern app's computed metrics
- `badge-board-export-qa` — card · banner · story layouts, LINE photo in the circle
- `badge-board-labels-qa` — name + exact count under each badge
- `badge-export-options-qa` — score on/off, label modes, corners
- `badge-export-more-qa` — header closes up, singles left out, optional bottom line
- `badge-export-quote-qa` — quote wraps per language (Intl.Segmenter), ≤ 3 lines
- `badge-quote-draft-qa` — ✨ AI quote draft: kind + language reach the prompt

## What usually lies

- Export draws to a canvas; assert on the drawn text calls / layout numbers, not on pixels.
