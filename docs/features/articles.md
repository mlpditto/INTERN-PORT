# Articles (admin editor, intern popup, Codex links)

Admin 📰 Articles list / editor with AI draft, translate, Codex drafts and links; the intern daily article sheet; 📰 blocks on Codex entries.

## How to get to it (user POV)

Admin: Dashboard ▸ 📰 Articles. Intern: the daily popup, History row, Codex entry ▸ 📰 block.

## Scripts that drive it

- `articles-admin-qa` — list, editor blend, read counts, 👥 who read + CSV, ✨ draft / translate
- `articles-story-draft-qa` — ✨ Draft = a short story (scene → decision → practice, ≤ 2000 hard limit, V102.511); a "➡️ Next:" line → ✨ Episode 2 chip, refused until saved, then a NEW article "(2)" from the same source with the earlier episode in the prompt
- `articles-intern-qa` — intern sheet on a 390 px phone with a fake Firestore
- `articles-codex-draft-qa` — 🩺 drafts a PENDING Disease Codex entry from the article (dx)
- `articles-drug-draft-qa` — 💊 drafts a PENDING Drug Codex entry from the article (dc)
- `articles-disease-link-qa` — ＋ Disease link by hand; the intern Disease entry lists its articles
- `articles-drug-codex-block-qa` — the intern Drug entry lists its linked articles
- `articles-link-hint-qa` — after Save, a "… is in the Disease Codex — link?" banner
- `articles-draft-all-qa` — 🩺 Draft all: one draft per article in neither Codex, press again to stop
- `articles-tags-qa` — 🏷 tags: editor chip field with suggestions, row chips (3 + n), tap a chip to filter the list, saved as `tags[]`
- `owed-remind-qa` — 🔔 "still to do" sheet on open (`owed-remind.js`): Journal / Case not sent today (from 16:00 Bangkok, Mon–Fri only) + unread 📰 articles (any hour, weekends too), chime once a day with a 🔔/🔕 toggle and a "tap anywhere" path when audio is locked; it holds the day's ONE popup slot (the 📰 popup, feedback reminder and Know thyself stay quiet while it is pending / shown, and it gives way if one of them already showed today)

## What usually lies

- The 📰 popup yields to the "still to do" sheet (`owedRemind.holds()`) when the sheet will show; the same article is then a row in it. Outside the internship period or with nothing owed the popup is unchanged.
- Intern harness: set `myUserDoc.articlePopDay = internArticles._bkkDay(new Date())` or the daily popup opens over everything on load.
- `Articles.load()` rejects unless the fake db has `collection().get()`; the codex listeners also need `where / orderBy / limit`.
- Markdown needs `window.marked` + `DOMPurify` stubs in the harness or `**bold**` stays literal.
- A fixture array passed into a later step must be snapshotted (`calls.slice()`) — the page mutates it.
