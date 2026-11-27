# 🪨 คนแบกหิน 13 · practice vs 🤖

Owner 2026-11-27. Game 4 in `docs/MIND-GAMES-PLAN.md` §8 (OneDrive copy, untracked). It uses a game-show mechanic only; the name and look are our own. Picks (mockup-rock13/):
- A3: each carrier holds a board above the shoulders, and the stones sit on it as numbered cubes, 3 to a row
- 3–7 players
- the 6th tile in the games row, plus 🪨 in the PC 🎮 menu
- a ❓ tour of the rules only, read aloud in Thai. It never teaches tactics (owner: "ไม่เผยเทคนิคของเกม"); the tactics live in the bots.

Files:
- `public/rock13-rules.js`: the rules and the bots, pure (`window.Rock13Rules`). The room referee will reuse it later.
- `public/rock13.js`: the screens, CSS and tour (`window.R13`, `window.rock13Open`).
- Voice: `public/rock13-voice/t1…t5.mp3` (Paxa foithong, 40 kbps mono).

## How it plays

- **Carriers:** 3 of them, 🔴🟢🔵.
- **Each set:** every player has cards 0–6 and chips 🔴🔴🟢🟢🔵🔵🌈, each used once. The game is 7 or 14 rounds; after round 7 everyone gets a new hand and the stones stay.
- **A round:**
  - Everyone picks a card and a chip in secret, then ▸ ส่ง.
  - Stones are placed one by one: 🌈 first, then higher cards first. A tie goes clockwise from 👑.
  - At your turn: ▸ วาง (the box shows the new weight and 💥 when it takes stones), or ⏭ Pass. Pass is allowed once a round and never as the last one left; whoever passed first places last.
  - 🌈 taps a carrier.
- **Reaching 13 or more:** you take every stone that was already there, at 🪨 1 each (a 0 counts too). Your stone stays on the board. The last one to take stones gets 👑 for the next round.
- **Winning:** fewest 🪨 wins. On a tie, whoever took stones longer ago ranks higher.
- **Lobby:** 👥 3–7 and 7 │ 14 รอบ, kept as `r13Cfg`. The tour shows on the first open (`r13TourSeen`); 🔊/🔇 is kept as `r13Voice`.
- **`game_plays`:** game `rock13`, mode `bot`, win `w` when you rank first, score = your 🪨. 🏆 counts wins.
- **Rules:** `game_plays.game` now allows `rock13`. Deploy with `firebase deploy --only firestore:rules,functions:gameTop`.

## QA

- `scripts/rock13-rules-check.cjs`:
  - placing order, ⏭, 🌈, taking stones at 13, 👑, ranking
  - 2000 bot-only games, 3–7 players, all legal to the end
- `scripts/rock13-qa.cjs` (real page, 390 px):
  - the 6th tile and the tour (rules only, voice)
  - the lobby rails
  - a full 7-round game with ⏭, 🌈 and 💥
  - the log entry, and a 320 px fit
- `games-row-qa` (6 games), `cereal-header-qa` (🎮 menu), `secret-qa` (6 tiles).

## What usually lies

- Audio is stubbed in QA, so real sound needs a phone.
- The bots play on a fixed seed in QA. Real games vary.
