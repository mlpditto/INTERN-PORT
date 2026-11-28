# 🌙 Midnight Market · practice (V101.402)

Owner 2026-11-29. Plan: `docs/VAULT-SWAP-PLAN.md` (OneDrive copy, untracked; draft name "Vault Swap"). It borrows a game-show mechanic (swap face-down cards, guess what the buyer wants, a secret partner) but uses our own name, a heist-film mood and our own drawings — no name, character or picture from a show or a film.

Owner picks:
- heist mood; name **Midnight Market** (the owner asked for the show's name; we do not use it)
- secret partner: the two totals are **multiplied**
- rooms (PR 2): 3–7 people, 🤖 fill up to 4
- screen A, the dark table (`mock-vault/vault-swap-mockups.png` in the agent workspace)

Entry points: the 8th tile in the games row (🌙 Midnight) and 🌙 in the PC 🎮 menu. With 8 games the phone row became 2 rows of 4 (it was one line of 7) — **the owner has not picked this layout yet**.

Files:
- `public/midnight-rules.js` (`window.MidnightRules`, and node `require`): the rules, pure. The dice are one number in `g.rs`, so a seed always deals the same game and the future room referee can store a game and go on.
  - It also keeps what every seat can know (`g.know`) from the public swaps, and holds the bots.
- `public/midnight.js` (`window.MM`, `window.midnightOpen`): the screens, the bots' clock, the CSS, the tour and the sound cues (made in the phone, no audio files).
- Voice: `public/midnight-voice/t1…t5.mp3` — Google Cloud Text-to-Speech, Gemini TTS `gemini-2.5-flash-tts`, voice **Kore** (the same as 🪞), 40 kbps mono, 8–12 s each.

## Rules

- 4–7 seats (you + 3–6 🤖). The deck is **seats + 4** cards:

  | Seats | 💎 Jewels | 🪙 Gold | 🖼 Art | 💵 Cash | 📡 Tracker |
  |---|---|---|---|---|---|
  | 4 | 6 | 4 5 | 2 3 | 1 2 | −5 |
  | 5 | 6 | 4 5 | 2 3 | 1 2 | −6 −4 |
  | 6 | 5 6 | 4 5 | 2 3 | 1 2 | −6 −4 |
  | 7 | 5 6 | 4 5 | 2 3 4 | 1 2 | −6 −4 |

- 3 heists. A heist: one card each, face down (you see yours); 3 cards at the 🕴 Fence; 1 in the 🗑 Bin.
- Everyone **must swap twice**: ➡ pass 1 clockwise from the starter, ⬅ pass 2 the other way round.
- You swap with another player's card, a Fence slot or the Bin. Everyone sees who swapped with what, never the faces.
- 📡 in your hand: you may only swap with a player. When somebody takes a 📡 from you on their turn: **+3** at once.
- 👁 once a game, on your turn: look at one Fence slot or the Bin.
- 📊 All cards turn. Loot scores its number × the Fence cards of its kind (none: 0). A 📡 scores its minus number.
- The holder of the biggest 📡 starts the next heist; nobody holds one: the next seat.
- 🤝 One ring of secret partners through all seats. **You know your partner; you do not know who has you.**
- Final = your total × your partner's total. Most wins; a tie goes to the higher own total.

Ours, not from the show (the agent's drafts, the owner may change them): the deck per number of seats, the free 👁, who starts when no 📡 is in a hand, the tie rule, and that you know your partner (it gives a reason to protect somebody even against bots).

## Screens

- **Lobby**: one English rules line (Thai + Korean on hover), 👥 4–7, 🤖 🥄 1–3 (kept as `mmSeats`, `mmLevel`), ▸ Start.
- **Table**: the queue strip (➡ 1 / ⬅ 2, the face in turn ringed, done ones faded); the dark table with 🕴 FENCE BUYS (3) + 🗑 BIN (1) and one card per other seat with its face badge, name and what it last swapped with; the last swap in one line; your card large with ⭐ total, 🤝 partner and 👁 Peek.
  - Your turn: tap a card → `⇄ Swap with …`. There is no skip. Cards you may not take are faded.
  - A small tag on a face-down card = a card you know (you held it, or you looked). It moves with the public swaps.
- **📊 Reveal**: Fence + Bin turned, one row per seat (best first): note (`🖼 ×2`, `no buyer`, `+3 📡`, `starts next`), the card, the points.
- **Result**: the ranking, each row `total × partner's total = final`; ↻ Again.
- **❓ Tour**: one page, 5 lines (English, the Thai line the voice reads under it), read aloud line after line; rules only, no tactics.

## 🤖

- 🥄 swaps at random. 🥄🥄 takes the card worth most to itself from what its seat knows (and sometimes peeks). 🥄🥄🥄 always peeks and weighs its partner's card through the product.
- In 6000 mixed bot games the first place goes to 🥄 14.7 %, 🥄🥄 17.9 %, 🥄🥄🥄 21.9 % of the time: the partner draw keeps luck in the game.

## Data

- `game_plays`: game `midnight`, mode `<seats>p-l<level>`, score = your final, win `w` when you rank first, `res` = your points per heist. `firestore.rules` lists the game — **deploy the rules by hand**. Admin 🎮: a `midnight` chip (admin V102.716).

## QA

- `scripts/midnight-rules-check.cjs`: decks, deal, two passes, 📡, 👁, knowledge, reveal, starter, partners, final, 3000 bot games.
- `scripts/midnight-qa.cjs`: the real page — tile + menu, tour + voice files, lobby, only your card shows, tags, must swap, 📡, 👁, reveal, result, `game_plays`, 7 seats on 320 × 568 and 360 × 640 without scrolling.

## Next

- PR 2: 🌐 Friends — `functions/room-midnight.js` on `roomAct`, hands in `rooms/{id}/hand/{uid}`, 45 s a swap.
