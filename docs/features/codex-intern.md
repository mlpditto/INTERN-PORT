# Codex on the intern side (DD Codex, My Path, entries, submit forms)

The intern DD Codex home, My Path queue, the lean Drug / Disease entry pages, and the Drug / Disease submit forms with Fill-from-image.

## How to get to it (user POV)

Intern: home ▸ DD Codex; Poneglyph ▸ My Path; Submit New ▸ ⋯ ▸ Drug / Disease.

## Scripts that drive it

- `dd-codex-lean-qa` — one row of Drugs / Diseases chips + My Drafts; swipeable A–Z rail
- `pk-deck-qa` — 🧠 n beside the drug search (listed drugs with card lines, hidden at 0) → PK flash cards: covered A·D·M·E·T lines on the ADMET picture or in five slots, 👁, 🔁 Again / ✓ Got it kept on the device only (`pk-deck.js`)
- `mypath-queue-qa` — My Path: one header rail, queue as one slim line
- `drug-page-lean-qa` — Drug entry: TH ⌄ | ✨ pill, full-width chips, sticky folding head, lit rail, dosing lines
- `drug-detail-c-qa` — V101.309 owner pick C (mockup-drug-detail-lean): the drug entry is grouped by the counter questions — 💊 How to give · ⛔ Who must not · ⚠️ What to watch · 🗣 Tell the patient · 🧬 Why it works · 🔗 (👶 first when there is a peds dose); same fields regrouped, Thai titles + field names on a Thai page, an empty question is left out
- `drug-story-card-qa` — V101.322 owner pick B (mockup-drug-story): the first file of an entry is a card at the top of the body (⬇ Download), other files stay head chips; 🚩 Refer now (`redFlags`) after ⛔; 🇹🇭 Indication (Thai FDA) (`indicationThFda`) first under 💊; a section 📋 starts with the drug name; admin textareas for both fields, kept out of DCA_FIELD_KEYS (no AI draft, no %)
- `ir-calculator-qa` — 🧮 insulin resistance (ir-calc.js): first section on ATC A10 drugs only; FBS · HbA1c · TG · HDL · insulin → ADA bands + TyG / HOMA-IR / TG/HDL chips as you type, tap a chip for formula + source; numbers kept for the visit; nothing saved or sent
- `disease-page-lean-qa` — Disease entry gets the same lean head (codexLeanHead)
- `drug-submit-lean-qa` — Drug + Disease submit forms: one header row, hidden empty preview
- `nika-links-qa` — 🌞 Nika tab: 🫘 Kidney risk screening one-click link (V101.303), TH/EN label, new tab in a browser / LINE external window, stays while Nika is paused
- `nika-chips-qa` — 🌞 Nika chips follow the intern (V101.305): ❌ questions answered wrong in passed quizzes only (score > 0), newest first, ≤ 3, tap asks stem → key; samples fill the rest
- `nika-lv5-icon-qa` — Nika tab = icon only (V101.308); LV.5+ = nika-lv5.png, first time flash + toast once. `ask-nika-qa` covers pick C: badge = questions left, 🛟 in the placeholder, ➤, chips step aside with an answer (↺), 📋 copy, 🇬🇧→🇹🇭→🇰🇷 re-ask (askNika `lang`, kept once asked)
- `nika-think-qa` — 💭 think questions (V101.307): 🌅 the day's question on top of Nika with 🔥 n days in a row, 💭 general ones as purple chips (tap → card ✕), 📰 the article's box after Got it (sheet stays); one answer = nika_think_answers/{qid}_{authUid}; the admin's 👍 / reply show on the card. Rules: `rules-nika-think.emu.cjs` (emulator, not CI)
- `codex-image-fill-check` — "Fill from image" dd* helpers with a DOM stub + storage.rules wiring
- `codex-vision-shared-check` — shared CodexVision contract + admin "Re-extract from image"

## What usually lies

- `dcRenderDetail` runs while the modal is hidden, so every height is 0 on the first pass; `codexLeanHead.start()` re-measures on a rAF — assert after it, and give the fixture enough sections to scroll.
- The scroll listener must read `body._dcPlace`, not a closure from the first render (stale closure measured a detached rail).
- The scroll-spy marks the topmost section with > 24 px visible; "most visible" picks Discussion on short bodies.
