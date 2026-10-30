# Journal (intern) & Reflective Review (admin)

The one-page Journal, admin Reflective Review (model rows, writing analysis, diff preview, bonus, tip), note review.

## How to get to it (user POV)

Intern: home ▸ Journal. Admin: Kanban ▸ a reflective card ▸ Reflective Review.

## Scripts that drive it

- `journal-one-page-qa` — Journal design A: no tabs, entry · Note fold · recent; V101.247: Message → `admin_notifications` + the intern's own copy `intern_messages/{same id}` in ONE batch (a failed send writes neither) — the copy shows in History (`history.md`)
- `reflective-model-row-qa` — vendor-first MODEL rows, trial chips survive a reload
- `reflective-grammar-lean-qa` — Writing Analysis column: Issues → Suggestions → Why; Apply per change / all
- `reflective-diff-runs-qa` — Edited preview word diff: Thai phrase whole, no side padding, space is a space
- `reflective-writing-tip-qa` — ➕ Add tip to reply in the reply language with a reference
- `reflective-bonus-footer-qa` — Bonus in the footer beside Save; AI pick ringed 💡
- `reflective-mood-emoji-qa` — admin shows the saved mood emoji, not 📝
- `note-review-qa` — note review: paired deletion, award history, concurrent edit guard
- `writing-progress-qa` — the intern's Journal progress card (`public/writing-progress.js`): weekday-aware streak (Sat / Sun never break it, Fri → Mon is consecutive, a weekend entry counts, today not written keeps it alive), 8-week heatmap (number + latest mood + grade bar in each cell, tint = words, detail line, month labels, weekend strips), month chip = `monthlyProgress.summary()` (target → n/target + green ✓, none → just n, tap = goal editor), mentor-grade strip (`latestGrammarGrade`: hidden under 2, caption from 3, calm colours), new-intern short view, EN/TH/KO

## The intern's progress card (V101.232)

Journal page ▸ the card under the tabs — one heatmap that holds everything (owner's pick "A + C + check", mockup "Heatmap all-in-one v1"). Each cell carries the **day number**, the **mood emoji** (the latest entry's; a neutral · when none) and the mentor's **writing check** as a coloured bar along the bottom (ดี green · พอใช้ amber · ควรปรับ calm indigo, never red; drawn only once ≥2 entries are graded); the tint is that day's words. Collapsed: 🔥 streak · 📅 month (n or n/target) · ○ Today, then the last 4 weeks at 34 px cells with the tapped day's one-line detail + a legend beside them. Tap the header: 8 weeks, the detail line, the legend and the old stats (words, active days, language bar, top moods, plus "recent checks mostly X · getting better" from 3 / 6 graded entries). Empty weekend days are 6 px strips; a weekend day with an entry is a 16 px cell; a month label sits above the column holding the 1st. The streak is weekday-aware (Sat/Sun never break it, Fri → Mon is consecutive, a weekend entry counts, today not written keeps it alive) and is its own helper — History's `getReflectiveStreak` and the Daily Streak (badges / Beri) are unchanged. The month chip is `monthlyProgress.summary()`'s Journal row (target → n/target + green ✓, none → just n; tap = the goal editor). The grades are `latestGrammarGrade` / `latestGrammarTs` on the intern's own `reflective_logs` docs, written by admin `persistGrammarGrade`; the intern already receives those docs, so no rules change.

## What usually lies

- `renderWordDiff` / `diffWords` are module-scoped — not on `window`. Drive them through `renderGrammarAnalysis` → `grammarApplyAll()` and read the preview DOM.
- A Thai-edged diff run gets `padding:0`; asserting on the class alone misses a regression in the inline style rule.
