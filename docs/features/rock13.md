# 🪨 Carry 13 · practice vs 🤖 + 🌐 online rooms

Owner 2026-11-27. Game 4 in `docs/MIND-GAMES-PLAN.md` §8 (OneDrive copy, untracked). It uses a game-show mechanic only; the name and look are our own (owner picked the name Carry 13). Picks (mockup-rock13/):
- A3: each carrier holds a board above the shoulders, and the stones sit on it as numbered cubes, 3 to a row
- 3–7 players
- the 6th tile in the games row, plus 🪨 in the PC 🎮 menu
- a ❓ tour of the rules only, read aloud in Thai. It never teaches tactics (owner: "ไม่เผยเทคนิคของเกม"); the tactics live in the bots.

Files:
- `public/rock13-rules.js`: the rules and the bots, pure (`window.Rock13Rules`). `functions/rock13-rules.js` is a copy for the room referee: copy it again after any rules change (`room-rock13-check` fails if they differ).
- `public/rock13-online.js` (V101.389): the 🌐 rooms (`window.R13Online`). `functions/room-rock13.js`: the referee, reached through `roomAct` with game `rock13`.
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
- **Sound** (`public/rock13-sound.js`, owner pick A2): a 13 s music-box loop in a minor key over a soft heartbeat, built in the phone with no file so it loops with no seam. It fades in only on your turn (picking, or placing). Cues: a stone down, stones falling 💥, ⏭, your turn, the end. 🔊/🔇 in the header, kept as `r13Sound`.
- **Lobby** (V101.397, owner pick A, mockup-rock13-lobby-lean/): your pixel face on the title row (tap = ✏️; `PixelAvatar.faceBtn` + `readyLine` once), 🤖 Practice │ 🌐 Friends, one EN rules line, 👥 3–7 and 🔁 7 │ 14 as number chips in one rail (each emoji once; the 👥 chip's title says You + 🤖 n−1), ▸ Start. The 🏆 line hides while the week is empty (all games). Kept as `r13Cfg`. The tour shows on the first open (`r13TourSeen`); 🔊/🔇 is kept as `r13Voice`. V101.396 (owner pick B, mock-carry13-tour/): **one page**, English first — the 5 rules as lines (the Thai line the voice reads under each), the 3 carriers picture under line 1 only, no Next / dots / Skip; the voice reads t1…t5 one after another and frames the line it is on; ▸ Start stays in sight when a short phone scrolls the lines (was 5 pages of 430 px, pages 2 · 3 · 5 half empty).
- **`game_plays`:** game `rock13`, mode `bot`, win `w` when you rank first, score = your 🪨. 🏆 counts wins.
- **Rules:** `game_plays.game` now allows `rock13`. Deploy with `firebase deploy --only firestore:rules,functions:gameTop`.

## 🌐 With friends (V101.389)

Owner picks 2026-11-27: ค = live rooms only, ⚡ 60 s for every pick and every turn (no 1 h room) · layout B (mockup-rock13-online/), the look of the live เลขลับ room · English only apart from names.
- **Lobby:** 🤖 Practice │ 🌐 With friends, 7 │ 14 rounds, ＋ New room, join by the 4-digit code, 📤 invite in LINE (`?r13=<code>`). 2–7 friends; with 2, 🤖 fill the room to 3. Only the host starts.
- **Secret pick:** a ring round every face still picking; my pick shows only on my phone (🔒 You sent), the others see ✓. The picks wait in `rooms/{id}/secret/subs` (no client reads them); my own in `rooms/{id}/hand/{login}`.
- **Placing:** the faces in placing order with chip + card · 🪨; one ring round the one placing, running down 60 s. 👉 Your turn pulses; the others see Name's turn + 👋 Nudge (`?r13=1`), then ⏭ Skip once late.
- **Time out:** any phone in the room calls `claim` a little after 60 s. A missing pick is drawn at random; a late turn is placed without passing, and 🌈 goes to the lightest carrier.
- **Bots** act inside the same `roomAct` call. 🏳 Leave game turns your seat into a 🤖; when everyone has left the game ends.
- **`game_plays`:** game `rock13`, mode `live`, the same 🏆 board as practice (wins).
- **Deploy:** `firebase deploy --only functions:roomAct`. No rules change (the `rooms` rules already cover it).

## 🏛 Greek C (V101.390)

Owner picks 2026-11-28: carrier look **C + animation** (mockup-rock13-carrier/), then blended with a Greek theme **drawn in code** (mockup-rock13-greek/; an outside AI picture was the reference, its coins / shop / ranks / "Lose 1 move" were left out).
- **Carriers:** toga, sash and cape in the carrier colour, gold band, sandals; the board wrapped in cloth. Weight in the pose: knees bend, the face goes calm → strained (8) → about to drop (11), 💦 from 8, strain lines from 11.
- **Stones:** marble cubes 24 px, serif numbers, shadows; the newest stone outlined in gold.
- **Frames:** 8+ orange, 11+ red with a small shake. Under the sum: "n left" (no stone count: the stones are on the board).
- **Animation, once:** a new stone drops in; on 💥 the old stones tumble off. `changes()` compares with the last picture, so bots and friends trigger it too. Off under reduced motion.
- **Popup:** marble background, serif gold title, gold ▸ Place / ▸ วาง (48 px) with the outcome (`→ 9` / `💥 🪨3`, red), marble ⏭ Pass and cards, 44 px chips. Practice: the turn box says only "👉 ตาคุณ".
- **Online:** a turn the clock played says `⏱ Name ran out · placed 5 → 🟢` once (the referee marks it `auto`); the faces / queue rows scroll sideways instead of wrapping.
- **Deploy:** `functions:roomAct` again (the `auto` mark).

## QA

- `scripts/rock13-rules-check.cjs`:
  - placing order, ⏭, 🌈, taking stones at 13, 👑, ranking
  - 2000 bot-only games, 3–7 players, all legal to the end
- `scripts/rock13-qa.cjs` (real page, 390 px):
  - the 6th tile and the one-page tour: rules only, 5 lines + the carriers picture, no paging, no scrolling at 390 × 844, t1…t5 read line after line with the line framed, 🔇 kept, ▸ Start in sight at 320 × 568
  - the lobby rails
  - a full 7-round game with ⏭, 🌈 and 💥
  - the log entry, and a 320 px fit
  - V101.390: the outcome in ▸ วาง (red on 💥), "n left" tags, drop / fall play once, none under reduced motion
- `scripts/room-rock13-check.cjs` (referee, no browser): rules copy matches, seats, picks hidden until all are in, the queue step by step against rock13-rules to the end, claim, 🏳, cancel.
- `scripts/rock13-online-qa.cjs` (3 phones on the real page + the real referee): rail, room, invite, rings, 👉 Your turn, 👋 Nudge, English, 🌈, the same winner on every phone, late pick, 🏳, 320 px. `R13_SHOTS=<dir>` saves pictures.
- `games-row-qa` (6 games), `cereal-header-qa` (🎮 menu), `secret-qa` (6 tiles).

## What usually lies

- Audio is stubbed in QA, so real sound needs a phone.
- The bots play on a fixed seed in QA. Real games vary.
- The online QA polls an in-memory Firestore; real listeners, real LINE sign-in and two real phones racing a `claim` are not tested.
