# Languages & translations

EN / TH / KO toggle, Translate Missing, stale quiz translations, the Korean gap ratchet.

## How to get to it (user POV)

Admin: EN/TH switch in the header, 🌐 Translate Missing. Intern: language capsule in the runner / sheets.

## Scripts that drive it

- `backfill-list-thai-qa` — Thai titles show in the Translate Missing list under lang-toggle
- `lang-toggle-flags-qa` — V102.529 / V101.248 (owner): the header language toggle shows the country flag 🇺🇸 → 🇰🇷 → 🇹🇭 → 🇰🇷🇹🇭 (letters stay in aria-label / title, two flags = a short pill, twemoji draws the flag where it is loaded — admin; LINE draws it natively)
- `quiz-translation-stale-qa` — a stored translation is used only while it still fits the quiz
- `kr-gap-ratchet-check` — Korean gap counts may only go down (new label without Korean fails CI)

## What usually lies

- `lang-toggle.js` hides every `.lang-th` run while the admin page is in EN — "blank" text in a harness is usually this, not missing data.
- The ratchet counts from `scripts/kr-gap-report.cjs`; a new English or Thai label needs its Korean run in the same PR.
