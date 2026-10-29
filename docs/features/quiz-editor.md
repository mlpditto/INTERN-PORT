# Quiz Editor, bulk paste, materials & covers

The admin quiz editor: header pill, toolbar, Bulk Paste, resource rows, materials modal, covers and the Read first AI draft.

## How to get to it (user POV)

Admin: Quiz Engine ▸ Edit / ＋ New quiz.

## Scripts that drive it

- `quiz-editor-lean-b1-qa` — header status pill, Points / Beri as − n +
- `quiz-deadline-editor-qa` — the Deadline alert (LINE) chip: ON for new / legacy quizzes, OFF reads back `notifyDeadline:false`, independent of Notify LINE every submit
- `quiz-editor-toolbar-lean-qa` — one strip: answer type | this question | whole quiz
- `quiz-editor-toolbar-handlers-qa` — 🐑 clone and answer-type handlers do not throw
- `bulk-paste-head-qa` — one-row Bulk Paste header + progress ring
- `bulk-paste-parser-qa` — parseBulkQuestions on pastes with options in own paragraphs
- `bulk-paste-insert-qa` — ➕ Add selected replaces the empty starter question
- `quiz-resource-cards-qa` — one lean row per resource (domain chip, ✎, 💬, 🗑)
- `materials-link-edit-qa` — 📎 materials modal edits the link too
- `quiz-cover-check` — AI cover 3:4 normalisation (letterbox wide, crop tall)
- `quiz-cover-ref-qa` — 🧬 reference strip: ≤ 2 ticked covers
- `quiz-primer-ai-qa` — ✨ Read first draft never sends the correct answer
- `primer-model-rail-qa` — Read first model picker = the page's vendor-first rail per question (V102.509, was a <select>): hidden `input.q-primer-model` bound by `addQuestionUI` via `bindRegistryModelInput`, pick remembered under `ai_primer_model`, ✨ sends it
- `primer-review-all-qa` — 📖 All (V102.512): every question's Read first in one popup, local duplicate check (bold terms with bracket aliases, identical lines), Repeated-only filter, term chips, ✎ Qn jumps the pager and focuses the box, Esc closes; V102.517: cards never widen past the popup (grid minmax(0,1fr)), a quiz with no Read first shows one line + ✨ All
- `quiz-system-select-check` — every CASE_SYSTEMS key has an intern icon + select option

## What usually lies

- The toolbar swaps icons on `<i>` children that emoji buttons do not have — a stubbed button fixture must use the real markup or the clone handler cannot regress.
- The "correct answer is never sent" check reads the prompt string; add new prompt fields to the same assertion.

## Rank card — answer mode (V102.484)

The Rank card has **Interns answer by [Order] [Tier-box]**. A new card has neither selected and Save asks you to choose; a saved Rank question without a mode reads as Order. Order saves no `mode` field (the old shape); Tier-box saves `mode:'tier'`. Levels (Best / OK / Avoid), ⚠ and “why” per option are the same in both modes — in Tier-box mode a ⚠ option must be level Avoid (Save blocks otherwise). The Review / PDF text, the attempt review card and re-grading read the mode: a Tier-box answer lists the level the learner gave each option next to the key; “typed, not ranked” (Order) / “tiers not locked” (Tier-box) is shown apart from “nothing typed”. QA: `rank-quiz-admin-qa`, `rank-tier-qa`.
- `gemini-tts-38-check` — Laboon Gemini TTS: 3.8 Flash TTS is the default model, spoken through the Interactions API (speech_metadata style / speaker annotations, speech_config, audio/wav); the 2.5 / 3.1 generateContent path stays (V102.518)
