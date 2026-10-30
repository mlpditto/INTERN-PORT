# Reviewing attempts & participants

Admin review of a quiz attempt, pending-table recounts, practice attempts, re-scoring multi-answer choices, the Participants table.

## How to get to it (user POV)

Admin: Kanban ▸ a quiz attempt ▸ Review; Quiz Engine row ▸ 👥 Participants.

## Scripts that drive it

- `review-lean-qa` — Review Quiz Attempt: one-row header, Full / Actual marks
- `review-lean2-qa` — Review round 2: ONE status helper (skipped / typed-not-ranked / correct / partial / wrong / review), chip rail + filter, compact bars + Expand all (a skipped or typed-not-ranked Rank card starts folded), ⚠ Low active + points chips on the Cheat / Timing strip (the two approve buttons stay separate), Rank 📋 Copy key, orange unsaved dot on 💾, leaner controls row
- `pending-multi-recount-qa` — two-answer questions recounted correctly in the pending table
- `choice-rescore-check` — seven admin paths score a joined multi-answer correctly
- `quiz-practice-review-qa` — practice attempts keep practiceAnswers; Review / PDF use them
- `review-writeup-qa` — 📰 personal review for THIS intern (V102.507): panel under the Review header, AI drafts a formal bullet summary grouped by concept from the wrong answers (no name in the prompt, no pronouns / particles / praise) and ends with a 2–4 item "Read more" list (names, no URLs), ✨ asks before replacing, Send = `quiz_attempts.adminComment` only; intern side escapes + keeps line breaks. V102.525: the panel is two rows — title · one flag chip (tap = next language 🇹🇭→🇺🇸→🇰🇷, remembered) · model rail · note · ✨ · Send at the right corner — then the box
- `quiz-participants-score-qa` — one-time practice attempt shows a score and joins the average
- `participants-header-qa` — lean Participants header: title, Avg, "need 10+"
- `participants-division-avg-qa` — 🏷️ division, ⏱ total + ⌀ per question, amber slow pill
- `participants-active-highlight-qa` — active intern rows highlighted (hwIsActiveUser)

## What usually lies

- Review cards are `.rv-q` wrappers (a one-line `.rv-bar` + the `.rv-card`); folded = the bar shows, open = the card shows. A test that reads a folded card by visibility finds nothing — open it first (Expand all) or read `textContent`.
- `rvStatusOf` is the only place that decides a card's status; the rail counts, the bar chips and the opening rule all read it. A Moderate timing reading whose only flag is Low active stays folded behind its ⚠ chip; any other flag, or High, still opens the Timing card by itself.
- The 📰 panel (`#rv-writeup`) folds with the `hidden` attribute; its inline `display:flex` would win over `[hidden]`, so `#rv-writeup[hidden]{display:none !important}` is what actually hides it — a harness that asserts visibility without that rule passes for the wrong reason.
- Filter / open-card state lives in `window._rvUi` per attempt so the re-render after Save score / Mark correct does not undo it.
- Font Awesome does not load offline, so icon-only buttons measure a few px high in a harness; the ≥ 40 px hit area is the `::after` (`.rv-ctl`, `.rv-chip`, …), assert it with `elementFromPoint`.
- A multi-select answer is stored joined (`"0\n---\n2"`); a fixture storing an array passes every path that the real data breaks.
