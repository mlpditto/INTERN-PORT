# Articles (admin editor, intern popup, Codex links)

Admin 📰 Articles list / editor with AI draft, translate, Codex drafts and links; the intern daily article sheet; 📰 blocks on Codex entries.

## How to get to it (user POV)

Admin: Dashboard ▸ 📰 Articles. Intern: the daily popup, History row, Codex entry ▸ 📰 block.

## Scripts that drive it

- `articles-admin-qa` — list, editor blend, read counts, 👥 who read + CSV, ✨ draft / translate
- `articles-story-draft-qa` — ✨ Draft = a short story (scene → decision → practice, ≤ 2000 hard limit, V102.511); a "➡️ Next:" line → ✨ Episode 2 chip, refused until saved, then a NEW article "(2)" from the same source with the earlier episode in the prompt
- `articles-episode-long-qa` — a reopened episode with a "➡️ Next:" line still offers ✨ Episode n+1 (V102.622); ⤢ Long lets a body pass 2000 (amber count, `long: true`, ceiling 6000)
- `articles-editor-lean-qa` — lean editor (V102.624, picks 1A 2A 3A 4C 5B 6A 7A 8C): one-line rows, −n count / amber / no banner, one-line footer, softer formatting, cover + 🩺 💊 🔗 in the title box, Links via 🔗, BKK + 🔁 chip + 🏷 +, EN red dot
- `articles-clip-qa` — 🎬 Clip composer (V102.625, look C chat story · admin A): preview column → chat clip, ✨ Q/RX/KEY script, invented numbers ⚠️, edit / speaker / add / remove, ▶ Play, saved with the article
- `articles-clip-intern-qa` — intern popup opens on the 🎬 clip (V101.302, pick C): muted + captions one line at a time, tap = phone voice, ⌃ / ✕ / swipe up = the text, TH → EN fallback, no clip = as before
- `articles-clip-voice-qa` — 🎬 Clip ▶ Play with the AI voice (V102.626; V102.636 owner pick C+): a Thai clip reads with iApp Chinda through callAIProxy `iapp_tts` (🙋 ไข่มุก friendly · 🧑‍⚕️/💡 ไข่ต้ม calm), EN / KO with Gemini TTS (🙋 Kore · 🧑‍⚕️/💡 Puck); two chips under ▶ — tap = next voice of that family (remembered per article in localStorage, and as the next article's start), hold ≈ 0.8 s = hear that side's first line, the speaking side pulses, Space/Enter works; ▶ hover = ≈ IC · characters (Thai); Chinda fails → Gemini goes on with one line saying so → computer voice; cached on replay; no key (EN / KO) = computer voice. V102.639 (owner pick 1 + A): lines in a row by one speaker (🧑‍⚕️ + 💡 = one voice) go in ONE request and the bubbles step across that audio, 0.15 s between speakers; a Thai clip's English words get a Thai reading once (AI `clip_reading`, kept on the article as `clipReading`, captions stay English, a word with no Thai reading is kept as written so it is not asked again); 🔤 n shows / fixes them (fixed = `e: true`, for a shared list later)
- `iapp-tts-route-check` — callAIProxy `iapp_tts` (V102.636): admin-gated, secret `IAPP_API_KEY` sent only as the `apikey` header, 3 voices / 8 styles / 1–1200 characters, MP3 back as base64
- `articles-nika-qa` — 🌞 in the intern sheet footer (V101.306): Nika answers from THIS article only (askNika + articleId), 📝 Summary · 🎯 Key points · ❓ Ask, not in this article, paused / limit / busy, fits 360 px
- `articles-nika-gaps-qa` — admin ❔ n (V102.630): questions Nika could not answer (30 days, ×n alike), ✨ Draft = new article titled with the question, 🙈 hide (app_settings/nika_gaps)
- `nika-think-admin-qa` — admin 💭 n (V102.632, nika-think-admin.js): n = answers with no 👍 / reply; write 🌅 day / 📰 open article / 💭 general → app_settings/nika_think; ✨ 3 from the open article; answers with names, 👍, ↵ reply; 🗑
- `articles-copy-qa` — 📋 left of ✨ Draft copies title + body as typed (V102.605)
- `articles-editor-hints-qa` — empty TH/KO body says interns see 🇬🇧 · ✨ From EN; Saved n h / d ago; When & who remembers open/folded per browser (V102.606)
- `articles-share-qa` — History row: language pill after the title; Source line `· 📤 LINE f` (FB only with a link); +0.1 score once per article; only the tapped icon turns wave blue; admin sees 📤 n (V101.291 / V102.612)
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
