# ⚫⚪ ไพ่เงา (Shadow tiles)

A hidden-number duel vs 🤖 (owner pick C + 🧠 at 🥄🥄🥄, 2026-11-25, mockup-black-white/). Phone: ⚫ ไพ่เงา in the games row under History (V101.368, was after 🧊 on Schedule); PC (≥ 768 px): the ⚫ circle left of 🧊 in the header rail. Both call `bwOpen()` → `#bwModal`.

Rules: each side holds 0–8 once (evens ⚫, odds ⚪). The leader puts a tile face down, the other answers; each sees only the other's colour. Higher number takes the round, equal = nobody; the round's winner leads next (a draw keeps the leader); the first leader is random. 9 rounds or first to 5. Numbers stay hidden until the end screen opens every 🤖 tile.

Look (V101.366, pick B): dark popup, the 🤖 tile glows violet (⚫) / white (⚪), the 📓 folds to one bar that pulls up a sheet; the end screen opens the 🤖 tiles one by one (at once with reduced motion) with 📤 LINE (a Flex card whose button opens ?bw=1).

End screen (V101.369, owner "lean + inline", pick B · การ์ด 3×3, mockup-bw-end-lean/): the result is a chip in the header line, no dots row, one card a round (my tile vs the 🤖 tile, the left bar green / red / grey = its result, still opening one by one), one action row ↺ อีกตา · 📤 (✓ once sent) · 🥄 level. The popup is roomier: near full width on phones (max 440 px), 18 px inside.

Screen (pick C): dots for the 9 rounds (green / red / grey, ringed by the 🤖 colour), the 🤖 tile face down, a 3×3 hand, ▸ ลง, then the result and ▸ ต่อ; 📓 notebook: my number vs the 🤖 colour + result, and how many ⚫ / ⚪ the 🤖 still holds. 🥄🥄🥄 = 🧠 memory mode: used tiles look unused (a tap says "ลงไปแล้ว"), the notebook hides my numbers.

Bot: 🥄 random; 🥄🥄 / 🥄🥄🥄 list every hand I may still hold that fits each colour and result so far, then for each tile play the round and the rest out many times (60 samples at 🥄🥄🥄, 14 + noise at 🥄🥄) and keep the best. Vs a random hand: 🥄 ≈ even, 🥄🥄🥄 wins ~47% / loses ~28%.

Sound (V101.369, owner picked C · เกมตู้, mockup-shadow-sound/): short 8-bit blips from Web Audio, `public/shadow-sound.js` (`window.BWSound`, same shape as Cereal's CKSound). 🤖 thinking → its colour (⚫ low / ⚪ high), pick, ▸ ลง, win / lose / draw, 🧠 oops; a number has a pitch only when the end screen opens the 🤖 tiles (one cue each), then the end tune. 🔊/🔇 in every header, kept in localStorage `shadowSound`.

Record per level in localStorage `shadowStats`; nothing in Firestore. File: `public/shadow.js` (game + CSS).

## QA

- `scripts/shadow-qa.cjs` — V101.369 end screen B (result in the header, no dots, cards 3 a row with the result bar, one action row, 📤 → ✓, 18 px / 34 px tiles); 300 games through the real module (each tile once, results, leader rule, end at 5 / 9, the bot never rules out a tile I hold), 🥄🥄🥄 beats a random hand, doorways, the 🤖 number never on the page before the end, 📓, 🧠 mode, end reveal + record, 320 px, PC chip. V101.366 (pick B + end screen): dark popup + glow by colour, the 📓 bar → bottom sheet, the reveal one by one (a tap opens the rest), 📤 LINE → clipboard outside LINE, ?bw=1 opens.
- `scripts/shadow-sound-qa.cjs` — V101.369 sounds by the cue log: each step's cues over 6 games, no number cue before the end, end: numbers one by one → tune (reduced motion: tune with the last ▸ ลง), 🧠 oops, 🔇 silences and is kept, 320 px header.
- `scripts/shadow-tour-qa.cjs` — V101.374 ❓ วิธีเล่น: the first open plays 4 scenes inside the popup, each read in Thai (`public/shadow-voice/t1…t4.mp3`, Paxa foithong, only with the game's 🔊 on); ถัดไป ▸ fixed; ▸ เริ่ม → lobby, `bwTourSeen`, ❓ in the lobby replays; ข้าม / ✕ / 🔇 stop the voice; 320 px.
- `scripts/shadow-two-qa.cjs` — V101.376 📱 2 คน เครื่องเดียว: 🤖 กับบอท │ 📱 2 คน rail (levels only with the bot); a cover screen before every hand change with no hand and no number on it; the follower sees a colour only; rounds show colours only; 200 random games keep the rules; the end names 1️⃣/2️⃣ and opens every number, no 📤; game_plays mode `two`, no win (2️⃣ has no login, so it never reaches 🏆); 320 px.
