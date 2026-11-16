# AI question generation: Curate, Expand quiz, Suggested, E.V.I.E.

Everything that makes questions with AI: Curate (evidence check, history, copy), Expand quiz styles / regions, the Suggested popup, custom links, batch quota.

## How to get to it (user POV)

Admin: Quiz Editor ▸ ✨ Curate / Expand quiz / Suggested questions.

## Scripts that drive it

- `quiz-curate-qa` — Curate responsive 320–1024, routing, validation, safe text; an active quiz is not refused on Remove / Split — the confirm says it will be deactivated first and the same transaction writes `isActive:false` (V102.513)
- `quiz-curate-reopen-qa` — AI Curate opened again (V102.647): a fresh open adopts the newest saved run of the same questions (model · Keep · strategy · pins · instructions) and shows its result with no AI call; edited questions → defaults; ↻ keeps current settings
- `quiz-curate-oldset-qa` — AI Curate "old set" (V102.648): runs keep a key per question; after questions change an amber chip `↩ old set m/n` in the tools row offers the last result; tap carries verdicts over with today's numbers (pins + comparisons follow, a changed question = kept + "not assessed"), chip turns `⚠️ old set m/n`, tap again clears
- `quiz-curate-compact-qa` — one-row Curate controls (mockup #4)
- `quiz-curate-steps-qa` — Curate as three steps (① Set → ② Review → ③ Save): a result opens on Review with the tools folded into the ① chip, Save = summary + one of three ways + one button; V102.660 every question is one line (↔ twin · Keep · 📌), ▾ opens one in place; V102.665 at ≥ 1,300 px Review is two panes — the list left, the picked question beside its twin (or alone) right; the other Curate scripts reach a control through `scripts/curate-step-nav.cjs` (presses the real step button first)
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
