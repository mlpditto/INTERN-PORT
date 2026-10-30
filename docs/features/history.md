# History (intern Work accordion)

The home History accordion: header totals, rows, bucket labels by language, reflective detail, rail cards, delete menu.

## How to get to it (user POV)

Intern: home ▸ History accordion (desktop: right rail with flood + news cards).

## Scripts that drive it

- `history-header-qa` — accordion titled History, totals in the header even when folded
- `history-header-clip-qa` — the last totals pill is not clipped by overflow:hidden
- `history-lean-qa` — rows via history-lean.js in a vm (no browser)
- `history-consistency-qa` — date / bucket / status pills follow the UI language (EN TH KR)
- `history-reflective-detail-qa` — a Reflective Log card shows the text and the mentor comment
- `history-delete-menu-qa` — 🗑 ▸ Request delete form is not clipped near the bottom
- `history-news-qa` — news rail card: parseDrugNews on a live-shaped fixture
- `history-flood-rail-qa` — flood rail card: at-risk places, wide screens only
- `intern-messages-history-qa` — ✉️ To admin rows (`public/intern-messages.js`, V101.247): the intern's own copy of a Journal message + the admin's 💬 reply (↩ Replied pill, new dot for a day, row moves to the reply time); score 0, never pending, not in the streak / Schedule heatmap, no 🗑; only `intern_messages where authUid == me`

## What usually lies

- The submissions mirror keeps reflective text as `description`; a fixture using `content` reproduces the old "No reflection content" bug instead of testing the fix.
- Rail cards exist only ≥ 701 px — the phone harness never sees them.
