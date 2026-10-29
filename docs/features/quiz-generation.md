# AI question generation: Curate, Expand quiz, Suggested, E.V.I.E.

Everything that makes questions with AI: Curate (evidence check, history, copy), Expand quiz styles / regions, the Suggested popup, custom links, batch quota.

## How to get to it (user POV)

Admin: Quiz Editor ▸ ✨ Curate / Expand quiz / Suggested questions.

## Scripts that drive it

- `quiz-curate-qa` — Curate responsive 320–1024, routing, validation, safe text; an active quiz is not refused on Remove / Split — the confirm says it will be deactivated first and the same transaction writes `isActive:false` (V102.513)
- `quiz-curate-compact-qa` — one-row Curate controls (mockup #4)
- `quiz-curate-copy-check` — questionPlainText for the Copy button
- `quiz-curate-evidence-check` — tolerant evidence check (snapQuote / validateProposal)
- `quiz-curate-history-qa` — curate history: canonical keys, latest five, idempotent
- `curate-diag-check` — precise Curate failure messages + OpenRouter diagnostics wiring
- `suggest-popup-tools-qa` — Suggested popup: copy, Add all, ⭐ Score all
- `exam-styles-check` — SQM_EXAM_STYLES sliced from admin.html
- `expand-quiz-regions-qa` — style chips grouped by region, EN-first captions
- `fetch-link-text-check` — fetchLinkText function: SSRF guard + HTML → text
- `evie-quota-check` — exhausted-credit batches stop, answers preserved, skipped rows explained

## What usually lies

- Never `JSON.parse` AI output raw in a fixture — the real code tolerates prose around JSON; a strict fixture tests the wrong contract.
- `quiz-marker-fields-check` uses a two-key exam-style mock and cannot see new styles — `exam-styles-check` exists for that.
