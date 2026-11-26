# 🔢 เลขลับ (Secret number) · practice vs 🤖

Owner 2026-11-26. Game 1 of the three game-show-inspired games in `docs/MIND-GAMES-PLAN.md` (OneDrive copy, untracked). It uses the game's mechanic only; the name and look are our own. Picks (mockup-secret-number/):
- the 5th tile in the games row, plus 🔢 in the PC header rail
- four help levels
- a ❓ tour read aloud in Thai (every game has one)

File: `public/secret.js` (game, CSS and tour; `window.SN`, `window.secretOpen`). Voice: `public/secret-voice/t1…t4.mp3` (Paxa foithong, made once, 40 kbps mono).

## How it plays

- 🤖 picks 1–100. Each question from the menu costs 🎫 1 and is always answered truthfully. The menu: `> __ ?`, even, divisible by 3, prime, units digit = __, in __–__.
- A wrong guess costs 🎫 1 more and is marked on the board. Fewer 🎫 is better. The best score is kept per help level as `snBest_h<n>`.
- Help levels:
  - 🟩 the app crosses out numbers for you; tap a live number to guess
  - ✏️ you cross out numbers yourself (✏️ ขีด / 🎯 ทาย)
  - 📏 only the live range is shown
  - 🧠 no help, just the answer log
- The first open plays the tour (`snTourSeen`); ❓ replays it. 🔊/🔇 is kept as `snVoice`.
- `game_plays`: game `secret`, mode `h<n>`, win `w`, score = 🎫 used. 🏆 Top 3 counts 🧠 games only, fewest 🎫 first (`game-top-rank.js`).
- Rules: `game_plays.game` now allows `secret`, so the owner must run `firebase deploy --only firestore:rules`.

## QA

- `scripts/secret-qa.cjs`:
  - the 5th tile; the tour t1…t4 read aloud with 🔇 kept
  - every question answers truthfully over 2000 random pairs, and the secret is never crossed out over 300 random games
  - 🟩 crosses out and a tap guesses; ✏️ crosses out only what you tap; 📏 shows the range; 🧠 shows the log only
  - a wrong guess costs 🎫 1; the best is kept per level; the log records mode h<n> and win w
  - fits at 320 px
- `scripts/games-row-qa.cjs` (5 games) and `scripts/game-top-qa.cjs` (🔢 ranking).

## What usually lies

- Audio is stubbed in QA, so real sound needs a phone.
- The 🏆 line shows only after `gameTop` answers (signed in).
