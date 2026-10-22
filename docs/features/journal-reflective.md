# Journal (intern) & Reflective Review (admin)

The one-page Journal, admin Reflective Review (model rows, writing analysis, diff preview, bonus, tip), note review.

## How to get to it (user POV)

Intern: home ▸ Journal. Admin: Kanban ▸ a reflective card ▸ Reflective Review.

## Scripts that drive it

- `journal-one-page-qa` — Journal design A: no tabs, entry · Note fold · recent
- `reflective-model-row-qa` — vendor-first MODEL rows, trial chips survive a reload
- `reflective-grammar-lean-qa` — Writing Analysis column: Issues → Suggestions → Why; Apply per change / all
- `reflective-diff-runs-qa` — Edited preview word diff: Thai phrase whole, no side padding, space is a space
- `reflective-writing-tip-qa` — ➕ Add tip to reply in the reply language with a reference
- `reflective-bonus-footer-qa` — Bonus in the footer beside Save; AI pick ringed 💡
- `reflective-mood-emoji-qa` — admin shows the saved mood emoji, not 📝
- `note-review-qa` — note review: paired deletion, award history, concurrent edit guard

## What usually lies

- `renderWordDiff` / `diffWords` are module-scoped — not on `window`. Drive them through `renderGrammarAnalysis` → `grammarApplyAll()` and read the preview DOM.
- A Thai-edged diff run gets `padding:0`; asserting on the class alone misses a regression in the inline style rule.
