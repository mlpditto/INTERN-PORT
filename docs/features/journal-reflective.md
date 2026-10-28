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
- `writing-progress-qa` — the intern's Journal progress card (`public/writing-progress.js`): weekday-aware streak (Sat / Sun never break it, Fri → Mon is consecutive, a weekend entry counts, today not written keeps it alive), 10-week calendar, mood strip (14 newest, neutral dot, bars capped), month chip = `monthlyProgress.summary()` (target → n/target + green ✓, none → just n, tap = goal editor), mentor-grade strip (`latestGrammarGrade`: hidden under 2, caption from 3, calm colours), new-intern short view, EN/TH/KO

## The intern's progress card (V101.232)

Journal page ▸ the card under the tabs. Collapsed: 🔥 streak · 📅 month (n or n/target) · ○ Today, a 10-week calendar (Mon–Fri full cells, Sat/Sun slim, today ringed), the mood strip (last 14 entries as emoji, newest right, words-per-entry bars under them; no mood = a neutral dot) and, from 2 graded entries, the mentor's writing-check dots. Tap the header for the old stats. The streak here is weekday-aware and is its own helper — History's `getReflectiveStreak` and the Daily Streak (badges / Beri) are unchanged. The grades are `latestGrammarGrade` / `latestGrammarTs` on the intern's own `reflective_logs` docs, written by admin `persistGrammarGrade`; the intern already receives those docs, so no rules change.

## What usually lies

- `renderWordDiff` / `diffWords` are module-scoped — not on `window`. Drive them through `renderGrammarAnalysis` → `grammarApplyAll()` and read the preview DOM.
- A Thai-edged diff run gets `padding:0`; asserting on the class alone misses a regression in the inline style rule.
