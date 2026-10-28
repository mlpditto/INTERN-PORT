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
- `quiz-system-select-check` — every CASE_SYSTEMS key has an intern icon + select option

## What usually lies

- The toolbar swaps icons on `<i>` children that emoji buttons do not have — a stubbed button fixture must use the real markup or the clone handler cannot regress.
- The "correct answer is never sent" check reads the prompt string; add new prompt fields to the same assertion.
