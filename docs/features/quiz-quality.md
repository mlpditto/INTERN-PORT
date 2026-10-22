# Quality Audit, Rewrites, Compare & Jev

The review toolbar: Quality Audit scorecard, Rewrites, Clinical angle, the Comparison modal with Model B and Jev, duplicate cleanup.

## How to get to it (user POV)

Admin: Quiz Engine ▸ a quiz ▸ Review / Compare.

## Scripts that drive it

- `audit-model-rail-check` — audit / rewrites model rail: a tab per provider
- `audit-progress-check` — audit progress clock + model line
- `audit-multi-fix-qa` — scorecard multi-select → one ✦ fix call
- `audit-readfirst-qa` — Read first scored as an optional 8th dimension; rule badge
- `graphite-toolbar-qa` — audit / rewrite popup: Sakura tabs, 13 compact chips, 320–1024
- `clinical-angle-chip-qa` — 🩺 Clinical angle block in batch + single prompts
- `compare-top-bar-qa` — Comparison controls as two top lines
- `compare-footer-lean-qa` — Model B on one row + one icon action row
- `compare-modelb-rail-check` — Model B chips carry owner logos; Grok trial kept
- `quiz-compare-close-qa` — Compare modal closes and reopens by click / Enter / Space
- `jev-compare-check` — Jev "same fact?" scoring: batching, cache, symmetry
- `jev-chip-qa` — Jev chip beside each n-gram match
- `quiz-cleanup-qa` — duplicate cleanup: multi-quiz marking, whole-quiz removal

## What usually lies

- The rails are built from the model registry; a registry sync normalises trial models, so a hard-coded chip count breaks on the next registry PR.
