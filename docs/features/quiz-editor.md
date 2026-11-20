# Quiz Editor, bulk paste, materials & covers

The admin quiz editor: header pill, toolbar, Bulk Paste, resource rows, materials modal, covers and the Read first AI draft.

## How to get to it (user POV)

Admin: Quiz Engine ▸ Edit / ＋ New quiz.

## Scripts that drive it

- `quiz-editor-lean-b1-qa` — header status pill, Points / Beri as − n +
- `quiz-editor-head-modes-qa` — header in one line: the nine modes live under ⚙ (first row of the settings panel, every one named), the ON ones show as icons beside ⚙ (tap opens it), hidden on a phone
- `quiz-deadline-editor-qa` — the Deadline alert (LINE) chip: ON for new / legacy quizzes, OFF reads back `notifyDeadline:false`, independent of Notify LINE every submit
- `quiz-editor-toolbar-lean-qa` — one strip: answer type | this question | whole quiz
- `quiz-editor-toolbar-handlers-qa` — 🐑 clone and answer-type handlers do not throw
- `bulk-paste-head-qa` — one-row Bulk Paste header + progress ring (V102.635: the tools wait for the first question)
- `bulk-paste-hybrid-qa` — Bulk Paste on one screen (V102.635, owner pick: hybrid C + B + D): paste left, the list right as you type (no ✂️ Parse / ← back); one line per question, tap = stem + A B C D chips (tap = key, tap the stem = edit); keys / ticks / edits survive a re-parse (rows are keyed by stem without its number + options); the same stem again starts unticked (♊); lines no question took = ⚠️ L n (tap selects them in the text); filter chips ❔ → 🎯 n (E.V.I.E. on the no-key ones only) · 🤖 <80 → ☐ n · ♊ side by side ✓ keep; ⓘ = rules + one example ("Paste this" follows the text's numbering); 📂 JSON / 🧩 image rows sit after the text's rows; 🏷 one tag for the batch; ➕ Add n then ↶ Undo for 8 s (takes them out, reopens as it was); phone = one column
- `bulk-paste-parser-qa` — parseBulkQuestions on pastes with options in own paragraphs
- `bulk-paste-insert-qa` — ➕ Add selected replaces the empty starter question
- `quiz-resource-cards-qa` — one lean row per resource (domain chip, ✎, 💬, 🗑)
- `materials-link-edit-qa` — 📎 materials modal edits the link too
- `material-viewers-qa` — 📎 materials modal: faces of who opened each file in the 👁 chip, tap = photo · name · ×times · last opened; the row 👁 badge opens the list even for one file
- `quiz-cover-check` — AI cover 3:4 normalisation (letterbox wide, crop tall)
- `quiz-cover-ref-qa` — 🧬 reference strip: ≤ 2 ticked covers
- `quiz-primer-ai-qa` — ✨ Read first draft never sends the correct answer
- `primer-model-rail-qa` — Read first lean (V102.631, owner pick B + C): the row = the box + ✨ + this question's model logo in its corner (rail opens on tap, amber = its own model, not remembered); the strip above = n/N · model for all (remembered) · ⚡ m · 📖 All; ✨ / ⚡ send each question's model; the 📖 All popup has no ✨ All / rail. Was V102.509's rail per row
- `primer-review-all-qa` — 📖 All (V102.512; V102.633 owner pick C: Read first is part of Review — the toolbar keeps a 📖 n/N (· ⚡ m) chip beside 🛡 Review, the strip (n/N · model · ⚡) lives in this window and parks when it closes, the Review rail has 📖 n/N too): every question's Read first in one popup, local duplicate check (bold terms with bracket aliases, identical lines), Repeated-only filter, term chips, ✎ Qn jumps the pager and focuses the box, Esc closes; V102.519: compact header (4 Q · 🔤 · ⚠️ in n Q · ≡), pills ⚪ / ⚠️ n / ✅, strip for empty ones + ✨ All, all-empty state, two columns when wide, cards never widen
- `read-first-one-row-qa` — 📖 window lean + inline (V102.682, owner pick A, mockup-read-first-inline): the 🔁 repeated terms are header chips (top 3 + "+n" = every repeating question; a chip shows only its questions, survives a re-check), no band; card frame = state (green / amber / grey), no ✅ / ▾; ✎ on hover, always on touch; Jev = logo pill; the all-empty header seats the strip too, drafting = dots + ■ m:ss
- `read-first-dedupe-qa` — 📖 ✨ n = แก้ข้อหลัง n ข้อ (V102.698, owner pick C, mockup-read-first-dedupe): the first question keeps a repeated **term** / identical line / Jev pair, each later one goes to its own AI model (answer key never sent, "never point to another question" — quizzes shuffle); inline diff on the card (struck = cut, green = new) with ✕ / ✓ ใช้, ✓ writes the editor note and the count drops; a correct option in the new note is flagged; second press stops; Jev rows get ✨ Qn; labels like **แก่นสำคัญ:** are not repeats; another quiz starts clean.
- `before-quiz-chip-qa` — V102.670 (owner pick A2): one chip beside 🛡 Review = 📖 n/N │ 🎬 m, colour = state (no ✓); one window with tabs 📖 Read first / 🎬 Watch first, reopens on the last tab; the Watch first block is parked out of ⚙ and moved into the 🎬 tab.
- `quiz-system-select-check` — every CASE_SYSTEMS key has an intern icon + select option

## What usually lies

- The toolbar swaps icons on `<i>` children that emoji buttons do not have — a stubbed button fixture must use the real markup or the clone handler cannot regress.
- The "correct answer is never sent" check reads the prompt string; add new prompt fields to the same assertion.

## Rank card — answer mode (V102.484)

The Rank card has **Interns answer by [Order] [Tier-box]**. A new card has neither selected and Save asks you to choose; a saved Rank question without a mode reads as Order. Order saves no `mode` field (the old shape); Tier-box saves `mode:'tier'`. Levels (Best / OK / Avoid), ⚠ and “why” per option are the same in both modes — in Tier-box mode a ⚠ option must be level Avoid (Save blocks otherwise). The Review / PDF text, the attempt review card and re-grading read the mode: a Tier-box answer lists the level the learner gave each option next to the key; “typed, not ranked” (Order) / “tiers not locked” (Tier-box) is shown apart from “nothing typed”. QA: `rank-quiz-admin-qa`, `rank-tier-qa`.
- `gemini-tts-38-check` — Laboon Gemini TTS: 3.8 Flash TTS is the default model, spoken through the Interactions API (speech_metadata style / speaker annotations, speech_config, audio/wav); the 2.5 / 3.1 generateContent path stays (V102.518)
