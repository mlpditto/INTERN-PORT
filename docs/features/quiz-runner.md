# Mission cards & quiz runner (intern)

Quiz cards on the home Mission list, the start card, Read first page, the runner, term highlight.

## How to get to it (user POV)

Intern: home ▸ Mission ▸ a quiz card ▸ Start.

## Scripts that drive it

- `quiz-cover-fold-qa` — corner fold on a not-started cover; ▶ pulses twice; "nobody yet" gold
- `quiz-deadline-chip-qa` — deadline chip on the quiz card + preview sheet: red <24 h (pulse last 3 h), amber 24–72 h, calm 📅 beyond 3 days (card only; the preview sheet and in-button countdown still hide it); EN/TH/KO; no DOM writes while unchanged
- `start-chip-qa` — V101.228 the chip IS the Start button (Aurora Pastel liquid glass): 32px pill + 24px ▶ orb, invisible 44px hit area, tiers calm/amber/red/plain "Start"/⏱ Late all start the quiz, cards that keep their footer keep the orange cover ▶, one line EN/TH, sheen only while on screen (3 sweeps), none under Reduce Motion, solid fallback without backdrop-filter, AA at every gradient stop
- `quiz-card-details-toggle-qa` — "✦ Be the first" call; Details is a ▾ button
- `quiz-done-count-qa` — "👥 n" did it + your own avatar only (live users rule applied)
- `quiz-material-ribbon-qa` — pre-quiz materials ribbon on the cover, floating list for several
- `quiz-start-confirm-qa` — lean start card: quote card is the read-aloud button, one rule, Cancel / Start
- `rank-quiz-runner-qa` — Rank (order mode) in the real runner: type → lock → tap order → reveal; a COUNTED quiz shows only “✓ Order locked — answers show after you submit” (key, ★, points, Beri wait for Submit; the typed answer’s self-match is asked once before Submit’s confirm), PRACTICE reveals at once; lean action row ‹ · n/N · ↺ · 🔒 Lock · Next (Submit on the last question), the shared footer hidden on Rank steps only, hit areas ≥ 40–44 px
- `rank-tier-qa` — Rank TIER-BOX mode (`mode:'tier'`): each option gets Best / OK / Avoid (nothing pre-selected, Lock waits for every row, stored in option order); scoring exact 1 · one level off ½ · Best↔Avoid 0, ⚠ not in Avoid caps ★3; DDD-1 Q2 = 0.72 ★3 / 0.92 ★4
- `quiz-primer-qa` — per-question Read first page before the timer starts
- `quiz-run-lean-qa` — lean runner: one progress row, language capsule, answer layout
- `quiz-term-highlight-qa` — drugs / classes / conditions / doses / labs wrapped in the question text
- `quiz-browse-tags-check` — intern Browse tag chips (qbTag* helpers with a DOM stub)

## What usually lies

- Rank reveal timing: a counted quiz (not practice, not a poll) reveals Rank answers only after Submit — so `rankAwardBeri` returns early unless called quiet (`rankAwardBeri(i, true)` from `submitQuiz`); a QA that calls it without `true` sees nothing paid. The Rank step hides the shared footer with `#quizModal.rk-on`, cleared at the top of every `renderQuizStep` — a Rank test that renders another step must expect the footer back.

- Other interns' faces stay off the quiz CARD: `quiz-done-count-qa` applies the live `users` rule to the fake db — a stub that returns every user hides a real privacy regression. Owner changed the rule 2026-10-30: the Start popup may show photos (no names) of ACTIVE members only — V101.253, `active` from `getLeaderboard` (not a camp user, and `notAnInternship` or inside start–end dates, Bangkok); no list = plain 👥 n; pinned by `quiz-card-preview-qa` and `user-division-field-qa`.
- Reduce Motion: the pulse / breathe animations must not run under `prefers-reduced-motion`; emulate it in the page context or the animation assertion flips.
- The runner renders into a modal that is hidden until `renderQuizStep` finishes; measure after a rAF.
