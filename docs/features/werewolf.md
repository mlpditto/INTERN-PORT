# 🐺 Werewolf (solo on LIFF · Telegram later)

A secret-role party game for 5–10 players, played in a Telegram group with a bot (not LINE: no monthly push quota, the bot can DM roles). Plan, phases and the owner's decisions: [`docs/WEREWOLF-PLAN.md`](../WEREWOLF-PLAN.md) (Thai).

**Solo vs 🤖 on the intern app (V101.353).** The 🐺 button beside 🥣 on Schedule (`wolfOpen()`) opens `#wolfModal`: pick 5 / 7 / 9 players and 🥄–🥄🥄🥄 bots, get a random role, play night → day → vote until a side wins. Owner pick B (mockup-werewolf-solo/): every player is a seat; what a bot said today is a tag under its name (🤨 / 👍 / 🔮 X 🐺|👤); you tap a seat, then a chip. A player's role shows when they die. No timer. State = localStorage `wolf_v1_<userId>` (10 games); nothing in Firestore. The Telegram bot (Phase 1, PR #2437) is separate and not merged. Roles (owner pick, §8 Q3): 🐺 wolf · 🔮 seer · 🛡️ guard · 🧪 witch (7+ players) · 👤 villager.

Files: `public/wolf-rules.js` (a byte copy of `functions/wolf-rules.js`, UMD) · `public/wolf-ai.js` (the bots) · `public/wolf.js` (screens + storage) · `public/wolf.css`.

## How the bots think (wolf-ai.js)

- A bot knows only its own role, its wolf mates, its own 🔮 checks and the roles of the dead.
- Village bots score suspicion: own checks ±50, believed 🔮 claims (+8 🐺 / −5 👤, split between rival claimants), table talk (+1 🤨 / −0.5 👍, a hunch ×0.3), and from 🥄🥄 on: claims the dead disprove (+20), trusting a dead wolf, voting out a villager. Noise per (bot, target, day) is a hash, so a bot's tag and vote agree.
- The 🔮 bot claims at once when it finds a wolf, otherwise from day 2 at 🥄🥄+. Wolves at 🥄🥄+ counter-claim a seer who named a mate; at 🥄🥄🥄 one may fake-claim first. Fake claims are marked and shown 🤥 at the end.
- Wolves bite the claimed seer / their accusers, vote with the table, never accuse or vote a mate.

## What the engine decides

- `defaultCounts(n)` / `countsError(counts, n)` / `deal(ids, counts, rng)` — the deck per player count and the host's custom deck (one 🔮 🛡️ 🧪 at most, ≥ 1 🐺, wolves < half).
- `nightTurns` / `pickError` — who presses a button tonight and which picks are refused (dead, wrong role, 🐺 on 🐺, 🛡️ the same player two nights running, spent potions, 🔮 / ☠️ on self).
- `wolfTarget` (majority, tie = rng) → `resolveNight` in the order guard → heal → bite → poison (🛡️ and 💚 save the bitten; nothing stops ☠️).
- `tallyVotes` (secret day vote, any tie or skip-tie = nobody out) → `eliminate` → `winner` ('village' / 'wolf').

## Scripts that drive it

- `wolf-solo-qa` (A, phone harness): whole games by tapping until "me" held all 5 roles; 🐺 beside 🥣; lobby deck; role card + mates; dark night, 🔮 answer before ☀️, 🧪 sees the bite; day tags + 🤨/👍/🔮 chips; vote counts on seats + ⏭; dead show roles; end lists everyone; lobby bar; reopen keeps the game; no sideways scroll at 320 px. V101.355: role tiles + inline tip (tap again closes), 🌆 / 🌙 / 🌕 night levels (dark tiles), ▸ เริ่มเกม · สุ่มบท, the card's 🏆 goal, tap 👤 คุณ = the card again (↩ กลับเกม).
- `wolf-tutorial-qa` (A, phone harness) — V101.357 owner picks tutorial A + B and sound B: 📖 6-scene tour on the first open (dark night scene, ▶ auto remembered, seen, ❓ replays, Thai VISIBLE = innerText, 320 px), first-turn hints once each under the seats + ข้ามคำใบ้, the lobby header on one row, cues in order (night … vote … win/lose), nothing before a tap, 🔇 remembered and silent (no Web Audio made).
- `wolf-ai-check` (D, node): 1350 all-bot games (5/7/9 × 🥄 levels) — every pick passes pickError, no mate accused or voted, true claims match checks, fakes only from wolves, one claim per bot per day, all games end, 🥄🥄🥄 village beats 🥄 at 7.
- `wolf-rules-check` (D, node): every default deck 5–10 deals exactly its roles; bad decks refused by code; each refused pick; night order cases; wolf tie by rng; vote ties / skips / dead voters; both win conditions; two scripted 7-player games (village win, wolf win); inputs never mutated; public/wolf-rules.js = functions/wolf-rules.js.

## What usually lies

- "Played every role" when the seat was dead: the harness only taps when p1 is alive — a dead p1 just presses ▸.
- Win rates in wolf-ai-check are bots vs bots, not how hard it feels for a person.
- A check that only calls `resolveNight` with legal picks: the bot must call `pickError` first, the engine trusts its input.
