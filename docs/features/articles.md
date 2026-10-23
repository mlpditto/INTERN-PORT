# Articles (admin editor, intern popup, Codex links)

Admin 📰 Articles list / editor with AI draft, translate, Codex drafts and links; the intern daily article sheet; 📰 blocks on Codex entries.

## How to get to it (user POV)

Admin: Dashboard ▸ 📰 Articles. Intern: the daily popup, History row, Codex entry ▸ 📰 block.

## Scripts that drive it

- `articles-admin-qa` — list, editor blend, read counts, 👥 who read + CSV, ✨ draft / translate
- `articles-intern-qa` — intern sheet on a 390 px phone with a fake Firestore
- `articles-codex-draft-qa` — 🩺 drafts a PENDING Disease Codex entry from the article (dx)
- `articles-drug-draft-qa` — 💊 drafts a PENDING Drug Codex entry from the article (dc)
- `articles-disease-link-qa` — ＋ Disease link by hand; the intern Disease entry lists its articles
- `articles-drug-codex-block-qa` — the intern Drug entry lists its linked articles
- `articles-link-hint-qa` — after Save, a "… is in the Disease Codex — link?" banner
- `articles-draft-all-qa` — 🩺 Draft all: one draft per article in neither Codex, press again to stop
- `articles-tags-qa` — 🏷 tags: editor chip field with suggestions, row chips (3 + n), tap a chip to filter the list, saved as `tags[]`

## What usually lies

- Intern harness: set `myUserDoc.articlePopDay = internArticles._bkkDay(new Date())` or the daily popup opens over everything on load.
- `Articles.load()` rejects unless the fake db has `collection().get()`; the codex listeners also need `where / orderBy / limit`.
- Markdown needs `window.marked` + `DOMPurify` stubs in the harness or `**bold**` stays literal.
- A fixture array passed into a later step must be snapshotted (`calls.slice()`) — the page mutates it.
