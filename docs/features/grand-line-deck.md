# Grand Line Deck, clips, design hub & Log Pose

The admin design / video hub: composer, deck workflow stepper, styles, image engines, clips with captions, the deck guide, Log Pose knowledge search.

## How to get to it (user POV)

Admin: 🏴‍☠️ Grand Line Deck tab; how-to = 📖 Admin guide (header) → 🏴‍☠️ Deck chapter.

## Scripts that drive it

- `deck-workflow-qa` — Intent → Brief → Style → Plan → Render → Review stepper
- `deck-modes-qa` — mode bar as icon chips in the top tab row
- `deck-style-qa` — Visual Style in the Brief; pharmacy chips first
- `deck-friction-qa` — style tile survives a reload; clip mode keeps the series
- `deck-guide-qa` — the Deck chapter of the Admin guide (images · video · Thai clip · audio · Log Pose)
- `genmage-composer-qa` — composer: 🪄 Vision, ghost formula, enhancer rail
- `design-image-models-qa` — Seedream / GPT Image via OpenRouter Image API
- `grand-line-clips-qa` — Clip 9:16: 10 episodes, ▶ renders one through the proxy
- `clips-codex-gallery-qa` — every rendered clip kept in Codex Gallery, deletable
- `clip-captions-qa` — Thai caption band follows the playhead
- `clip-prompt-lang-qa` — spoken language follows the narration line
- `logpose-kb-search-qa` — Thai-aware knowledge-base search (Intl.Segmenter)

## What usually lies

- Guide shots need an `https://qa.test` route serving `public/` with the `marked` / `purify` CDN let through; file:// cannot load the guide.
- Render → poll is simulated by the script's own proxy stub; a stub that resolves immediately skips the "busy" UI states.
