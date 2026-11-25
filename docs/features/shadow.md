# ⚫⚪ ไพ่เงา (Shadow tiles)

A hidden-number duel vs 🤖 (owner pick C + 🧠 at 🥄🥄🥄, 2026-11-25, mockup-black-white/). Phone: ⚫ ไพ่เงา in the games row under History (V101.368, was after 🧊 on Schedule); PC (≥ 768 px): the ⚫ circle left of 🧊 in the header rail. Both call `bwOpen()` → `#bwModal`.

Rules: each side holds 0–8 once (evens ⚫, odds ⚪). The leader puts a tile face down, the other answers; each sees only the other's colour. Higher number takes the round, equal = nobody; the round's winner leads next (a draw keeps the leader); the first leader is random. 9 rounds or first to 5. Numbers stay hidden until the end screen opens every 🤖 tile.

Look (V101.366, pick B): dark popup, the 🤖 tile glows violet (⚫) / white (⚪), the 📓 folds to one bar that pulls up a sheet; the end screen opens the 🤖 tiles one by one (at once with reduced motion) with 📤 LINE (a Flex card whose button opens ?bw=1).

Screen (pick C): dots for the 9 rounds (green / red / grey, ringed by the 🤖 colour), the 🤖 tile face down, a 3×3 hand, ▸ ลง, then the result and ▸ ต่อ; 📓 notebook: my number vs the 🤖 colour + result, and how many ⚫ / ⚪ the 🤖 still holds. 🥄🥄🥄 = 🧠 memory mode: used tiles look unused (a tap says "ลงไปแล้ว"), the notebook hides my numbers.

Bot: 🥄 random; 🥄🥄 / 🥄🥄🥄 list every hand I may still hold that fits each colour and result so far, then for each tile play the round and the rest out many times (60 samples at 🥄🥄🥄, 14 + noise at 🥄🥄) and keep the best. Vs a random hand: 🥄 ≈ even, 🥄🥄🥄 wins ~47% / loses ~28%.

Record per level in localStorage `shadowStats`; nothing in Firestore. File: `public/shadow.js` (game + CSS).

## QA

- `scripts/shadow-qa.cjs` — 300 games through the real module (each tile once, results, leader rule, end at 5 / 9, the bot never rules out a tile I hold), 🥄🥄🥄 beats a random hand, doorways, the 🤖 number never on the page before the end, 📓, 🧠 mode, end reveal + record, 320 px, PC chip. V101.366 (pick B + end screen): dark popup + glow by colour, the 📓 bar → bottom sheet, the reveal one by one (a tap opens the rest), 📤 LINE → clipboard outside LINE, ?bw=1 opens.
