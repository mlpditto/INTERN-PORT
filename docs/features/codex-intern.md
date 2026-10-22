# Codex on the intern side (DD Codex, My Path, entries, submit forms)

The intern DD Codex home, My Path queue, the lean Drug / Disease entry pages, and the Drug / Disease submit forms with Fill-from-image.

## How to get to it (user POV)

Intern: home ▸ DD Codex; Poneglyph ▸ My Path; Submit New ▸ ⋯ ▸ Drug / Disease.

## Scripts that drive it

- `dd-codex-lean-qa` — one row of Drugs / Diseases chips + My Drafts; swipeable A–Z rail
- `mypath-queue-qa` — My Path: one header rail, queue as one slim line
- `drug-page-lean-qa` — Drug entry: TH ⌄ | ✨ pill, full-width chips, sticky folding head, lit rail, dosing lines
- `disease-page-lean-qa` — Disease entry gets the same lean head (codexLeanHead)
- `drug-submit-lean-qa` — Drug + Disease submit forms: one header row, hidden empty preview
- `codex-image-fill-check` — "Fill from image" dd* helpers with a DOM stub + storage.rules wiring
- `codex-vision-shared-check` — shared CodexVision contract + admin "Re-extract from image"

## What usually lies

- `dcRenderDetail` runs while the modal is hidden, so every height is 0 on the first pass; `codexLeanHead.start()` re-measures on a rAF — assert after it, and give the fixture enough sections to scroll.
- The scroll listener must read `body._dcPlace`, not a closure from the first render (stale closure measured a detached rail).
- The scroll-spy marks the topmost section with > 24 px visible; "most visible" picks Discussion on short bodies.
