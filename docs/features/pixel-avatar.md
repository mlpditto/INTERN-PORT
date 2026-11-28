# 🧑‍🎨 My pixel · the intern's face in the games (V101.391)

Owner 2026-11-28 asked: "อยากให้ user สร้าง pixel character ได้" (after seeing a pixel-people web game).

Picks:
- **where:** the game faces
- **how:** pick parts
- **layout:** D + A (`mockup-pixel-avatar/builder.png`)

The style is our own: 16 × 16 pixels, head and shoulders only, made for small round faces.

## What it is

- **`public/pixel-avatar.js`** (`window.PixelAvatar`) draws a character in code from 7 digits, one per part (≈ 32,000 looks):

  | Digit | Part | Choices |
  |---|---|---|
  | 1 | skin | 5 |
  | 2 | hair | 6: short, side part, long, bun, curly, buzz |
  | 3 | hair colour | 6 |
  | 4 | eyes | 3 |
  | 5 | outfit | 4: 🩺 scrubs, 🥼 white coat, polo, hoodie |
  | 6 | outfit colour | 5 |
  | 7 | extra | 6: none, 👓, 😷, nurse cap, stethoscope, headband |

  - No image file and no AI call.
  - Kept as **`users.pixel`**, written with `update` (never `set`, so a deleted user is never re-created). A copy is kept on the phone as `pxMine`.
- **D — the lobby row:** the Carry 13, เลขลับ and ไพ่เงา lobbies show your face, your name and ✏️.
  - The first time a lobby asks, a 🎲 random character is made and saved, and the row says "🎲 Your pixel is ready", so nobody plays faceless.
- **A — the builder:** ✏️ opens one sheet:
  - a big preview
  - 7 chip rails, each choice drawn on you (colours are dots)
  - 🎲 random and 💾 Save
  - It sits over the game (`#pxModal`, z-index 10050). After a save, the lobby row redraws.
- **Where it shows:** every face helper draws the pixel first, then the LINE photo, then the initial.
  - Online rooms (`rock13-online`, `secret-online`, `shadow-online`): `roomAct` `me()` copies `users.pixel` into the room as `players[x].px` when you create or join a room, so a new pixel shows from the next room.
  - 🏆 Top 3 (`game-top.js`): `gameTop` now reads `pixel` too, and `game-top-rank.js` hands `px` through. The public and functions copies of that file must stay the same.

**Rules:** none to change. An intern may already update their own user doc, apart from `score` and `beri`.

**Deploy:** `firebase deploy --only functions:roomAct,functions:gameTop`.

## QA

`scripts/pixel-avatar-qa.cjs` checks:
- every random code draws; bad codes draw nothing
- the first lobby visit makes and saves a 🎲 pixel (`update` on `users/{userId}`, and on the phone)
- the second visit shows your name
- ✏️ opens the 7 rails over the game; a tap changes the preview; targets are 44 px; 💾 saves and the row redraws
- the row is in the 🔢 and ⚫ lobbies too
- the face helpers draw the pixel before the photo
- the Top 3 ranker (both copies) and `roomAct` hand the pixel on
- 320 px fits
