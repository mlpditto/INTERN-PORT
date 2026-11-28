# 🪞 Memory Fracture · practice (V101.400)

Owner 2026-11-28. Game 5 in `docs/MEMORY-SPOT-PLAN.md` (OneDrive copy, untracked). It borrows a game-show idea (remember a picture, then spot the differences) but uses our own name and look.

Owner picks:
- pharmacy scenes first
- real drug names
- 💎 bets from the first build
- 60 s look / 90 s find / 3 rounds
- layout C, the steps rail (`mockup-memory-fracture/screens.png`)

Entry points: the 7th tile in the games row (🪞 Memory), and 🪞 in the PC 🎮 menu.

Files:
- `public/spot-scene.js` (`window.SpotScene`, and node `require`): the shelf and its changes, pure.
  - A seed plus a level always gives the same shelf. The future room referee can therefore make the same shelf on the server.
  - It also holds the scoring and draws the SVG.
- `public/spot.js` (`window.SP`, `window.spotOpen`): the screens, the clock, the CSS, the tour and the sound cues.
  - The cues are made in the phone, with no audio files.
- Voice: `public/spot-voice/t1…t5.mp3` (Paxa foithong, 40 kbps mono).

## How it plays

- **Levels** (kept as `spotLevel`):

  | Level | Grid | Items | Changes | Kinds of change |
  |---|---|---|---|---|
  | 🥄 | 3 × 4 | 10 | 4 | 🎨 ➖ ➕ 🔀 📦 |
  | 🥄🥄 | 3 × 5 | 13 | 6 | + 💊 strength, 🔤 look-alike name |
  | 🥄🥄🥄 | 4 × 5 | 18 | 8 | 💊 and 🔤 come up twice as often |

- **The shelf:** each slot is empty or holds a bottle or a box. A slot shows its colour, the name and strength on the label, and ×1 or ×2 (a second one peeks out behind).
  - Every shelf has 1–3 look-alike pairs side by side, written in Tall Man letters, e.g. hydrALAZINE / hydrOXYzine.
- **The changes** (each slot changes at most once):
  - 🎨 cap or box colour
  - ➖ gone
  - ➕ added
  - 🔀 two slots swap places (tapping either one finds it)
  - 📦 ×1 ↔ ×2
  - 💊 strength (only to a strength the drug really comes in)
  - 🔤 the label turns into its look-alike, at a strength both drugs come in
- **A round:** it walks the rail 👀 → 🎲 → 🔍 → 📊, and the step you are in shows its seconds.
  - 👀 **Look**, 60 s. ▸ Ready goes on early.
  - 🎲 **Bet**, 10 s. The shelf is gone (blurred, 🫥). ×1 is free, ×1.5 costs 💎1, ×2 costs 💎2; a bet you cannot pay is greyed. One tap goes on; no tap means ×1.
  - 🔍 **Find**, 90 s. Tap the slots that changed; tap a ringed slot again to undo it. You get as many taps as there are changes, plus 2 (the amber dots). Press ✓ Done or wait for the clock.
  - 📊 **Reveal:** green = found, dashed = missed, ✗ = wrong. Every change is named, e.g. "💊 Warfarin 3 → 5 mg".
- **Points and 💎:**
  - Each round scores (found − wrong) × the bet, and never goes below 0.
  - You start with 💎 3.
  - With ×2, more than 2 wrong taps costs 💎1 more.
  - Finding every change with no wrong tap gives 💎1 back.
- **End:** after 3 rounds the screen shows ⭐ points against 🎯 (the number of changes), plus one line per round. 🏆 shows when ⭐ ≥ 🎯.
- **Tour:** the rules only, on ONE page like 🔢 and 🪨 (5 lines, English first, the Thai line the voice reads under each; no Next / dots); the voice reads t1…t5 one after another and frames the line it is on; ▸ Start stays in sight on a short phone. It shows on the first open (`spotTourSeen`); 🔊/🔇 is kept as `spotVoice`, and the sound cues as `spotSound`.
- **Fit:** the popup may use the whole phone height (`100dvh − 16px`, other popups stop at 80dvh) and the shelf shrinks to what is left, so 👀 🎲 🔍 never scroll — checked at 360 × 640 on 🥄🥄🥄.
- **Lobby:** one English line (`👀 remember → 🔍 spot the changes · 3 rounds`, Thai + Korean in its `title`), the 3 levels, ▸ Start.
- **`game_plays`:** game `spot`, mode `l1` | `l2` | `l3`. `score` = the points, `res` = found/changes for each round, `win` = `w` when ⭐ ≥ 🎯.
  - No 🏆 board yet; that is PR 3 in the plan.
  - Rules: `game_plays.game` now allows `spot`. Deploy with `firebase deploy --only firestore:rules`.

⚠️ The look-alike pairs and the strengths are real drug data. A pharmacist should check `DRUGS` in `spot-scene.js` before the game is promoted.

## QA

- `scripts/spot-qa.cjs` checks:
  - the changes are real (3 levels × 300 seeds); 🔤 only turns into its partner; scoring and 💎
  - the 7th tile; the one-page tour: 5 lines, no paging, no scrolling at 390 × 844, t1…t5 (the files exist) read line after line with the line framed, rules only, 🔇 kept, ▸ Start in sight at 320 × 568; the English lobby line; the level is kept; 360 × 640 🥄🥄🥄: the timed steps fit without scrolling
  - the clock walks the rail by itself; unpaid bets are grey; taps toggle and stop at the cap; the reveal marks and names every change
  - `game_plays` spot `l2`; 320 px fits
- `scripts/games-row-qa.cjs`, `rock13-qa.cjs`, `secret-qa.cjs`: the row has 7 tiles.
