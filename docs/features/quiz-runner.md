# Mission cards & quiz runner (intern)

Quiz cards on the home Mission list, the start card, Read first page, the runner, term highlight.

## How to get to it (user POV)

Intern: home ▸ Mission ▸ a quiz card ▸ Start.

## Scripts that drive it

- `quiz-cover-fold-qa` — corner fold on a not-started cover; ▶ pulses twice; "nobody yet" gold
- `quiz-card-details-toggle-qa` — "✦ Be the first" call; Details is a ▾ button
- `quiz-done-count-qa` — "👥 n" did it + your own avatar only (live users rule applied)
- `quiz-material-ribbon-qa` — pre-quiz materials ribbon on the cover, floating list for several
- `quiz-start-confirm-qa` — lean start card: quote card is the read-aloud button, one rule, Cancel / Start
- `quiz-primer-qa` — per-question Read first page before the timer starts
- `quiz-run-lean-qa` — lean runner: one progress row, language capsule, answer layout
- `quiz-term-highlight-qa` — drugs / classes / conditions / doses / labs wrapped in the question text
- `quiz-browse-tags-check` — intern Browse tag chips (qbTag* helpers with a DOM stub)

## What usually lies

- Never show other interns' faces: `quiz-done-count-qa` applies the live `users` rule to the fake db — a stub that returns every user hides a real privacy regression.
- Reduce Motion: the pulse / breathe animations must not run under `prefers-reduced-motion`; emulate it in the page context or the animation assertion flips.
- The runner renders into a modal that is hidden until `renderQuizStep` finishes; measure after a rAF.
