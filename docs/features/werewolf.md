# 🐺 Werewolf (solo on LIFF · Telegram later)

A secret-role party game for 5–10 players, played in a Telegram group with a bot (not LINE: no monthly push quota, the bot can DM roles). Plan, phases and the owner's decisions: [`docs/WEREWOLF-PLAN.md`](../WEREWOLF-PLAN.md) (Thai).

**Solo vs 🤖 on the intern app (V101.353).** The 🐺 button beside 🥣 on Schedule (`wolfOpen()`) opens `#wolfModal`: pick 5 / 7 / 9 players and 🥄–🥄🥄🥄 bots, get a random role, play night → day → vote until a side wins. Owner pick B (mockup-werewolf-solo/): every player is a seat; what a bot said today is a tag under its name (🤨 / 👍 / 🔮 X 🐺|👤); you tap a seat, then a chip. A player's role shows when they die. No timer. State = localStorage `wolf_v1_<userId>` (10 games); nothing in Firestore. The Telegram bot (Phase 1, PR #2437) is separate and not merged. Roles (owner pick, §8 Q3): 🐺 wolf · 🔮 seer · 🛡️ guard · 🧪 witch (7+ players) · 👤 villager.

Files: `public/wolf-rules.js` (a byte copy of `functions/wolf-rules.js`, UMD) · `public/wolf-ai.js` (the bots) · `public/wolf.js` (screens + storage) · `public/wolf.css`.

## How the bots think (wolf-ai.js)

- A bot knows only its own role, its wolf mates, its own 🔮 checks and the roles of the dead.
- Village bots score suspicion: own checks ±50, believed 🔮 claims (+8 🐺 / −5 👤, split between rival claimants), table talk (+1 🤨 / −0.5 👍, a hunch ×0.3), and from 🥄🥄 on: claims the dead disprove (+20), trusting a dead wolf, voting out a villager. Noise per (bot, target, day) is a hash, so a bot's tag and vote agree.
- The 🔮 bot claims at once when it finds a wolf, otherwise from day 2 at 🥄🥄+. Wolves at 🥄🥄+ counter-claim a seer who named a mate; at 🥄🥄🥄 one may fake-claim first. Fake claims are marked and shown 🤥 at the end.
- Wolves bite the claimed seer / their accusers, vote with the table, never accuse or vote a mate.

## Telegram (Phase 0–2 built, not deployed)

**Built: Phase 0 (rules `functions/wolf-rules.js`), Phase 1 (rooms) and Phase 2 (the whole game) in `functions/wolf-bot.js` behind `exports.wolfBot` + `exports.wolfTick` (every minute).** Live only after the owner makes the bot and sets its secrets + webhook (plan §9). Owner picks: dead roles stay hidden until the end (Q4) · vote result = counts only (Q5) · 1-minute clock (Q6) · the dead are asked to keep quiet, nothing deleted (Q8).

## How to get to it (user POV)

Add the bot to any Telegram group (owner picks: anyone with Telegram, no app account, any group) ▸ `/werewolf` ▸ the bot posts one lobby: `🐺 มนุษย์หมาป่า · ห้อง CODE · 👥 n/10 · names` with ▸ เข้าร่วม (a deep link `t.me/<bot>?start=CODE`: opens the DM, presses Start, seats you, edits the lobby) and ▸ เริ่ม / ✕ ยกเลิก (host only). At 5–10 the host's ▸ เริ่ม deals the default deck, edits the lobby to the role mix and DMs every player their card (wolves see each other). A failed DM is named in the group. One open room per group, one live room per player.

Then (Phase 2): 🌙 the group gets "คืนที่ n · ⏳ 1:30"; each 🐺 / 🔮 / 🛡️ gets a DM menu of names (one press, final; wolves see each other's picks; 🔮 gets the answer in the same message); when the last wolf has chosen, the 🧪 gets a menu that names the bitten (💚 ชุบ · ☠️ names · ⏭ เสร็จ). Everyone pressed → morning at once, else at the deadline. ☀️ "เช้าวันที่ n · เมื่อคืน 💀 X ตาย · ขอเงียบ…" (no role) + the talk timer + 🗳 โหวตเลย (host). 🗳 one group message with a button per living player + ⏭ ข้าม: secret and changeable, the message shows only "โหวตแล้ว k/n"; all voted → the result at once, else at the deadline: "นนท์ 3 · ต้น 2 · ⏭ ข้าม 1 · 👋 นนท์ ออก…" (no voter names; any tie = nobody). The end message is the only group text with roles: every player with their role emoji and 💀. Buttons carry the round, so a stale press is refused. Data: `wolf_games/{CODE}` (+ `secret/state` roles), `wolf_chats/{chatId}`, `wolf_tg/{tgId}`; rules: all closed, only the function touches them.

## What the engine decides

- `defaultCounts(n)` / `countsError(counts, n)` / `deal(ids, counts, rng)` — the deck per player count and the host's custom deck (one 🔮 🛡️ 🧪 at most, ≥ 1 🐺, wolves < half).
- `nightTurns` / `pickError` — who presses a button tonight and which picks are refused (dead, wrong role, 🐺 on 🐺, 🛡️ the same player two nights running, spent potions, 🔮 / ☠️ on self).
- `wolfTarget` (majority, tie = rng) → `resolveNight` in the order guard → heal → bite → poison (🛡️ and 💚 save the bitten; nothing stops ☠️).
- `tallyVotes` (secret day vote, any tie or skip-tie = nobody out) → `eliminate` → `winner` ('village' / 'wolf').

## Scripts that drive it

- `wolf-solo-qa` (A, phone harness): whole games by tapping until "me" held all 5 roles; 🐺 beside 🥣; lobby deck; role card + mates; dark night, 🔮 answer before ☀️, 🧪 sees the bite; day tags + 🤨/👍/🔮 chips; vote counts on seats + ⏭; dead show roles; end lists everyone; lobby bar; reopen keeps the game; no sideways scroll at 320 px. V101.355: role tiles + inline tip (tap again closes), 🌆 / 🌙 / 🌕 night levels (dark tiles), ▸ เริ่มเกม · สุ่มบท, the card's 🏆 goal, tap 👤 คุณ = the card again (↩ กลับเกม). V101.357 role card (pick A + flip-in): a colour per role (🐺 red · 🔮 violet · 🛡️ blue · 🧪 green · 👤 amber), ✨ บทพิเศษ on power roles, the deck as an icon row with your role framed, the villager line, the card turns in (not on peek; none under reduced motion). V101.358 wolf night (pick A + D on 🌕): as 🐺 your bot mates' wish is a red tag on the seat (pill: เพื่อนเลือกแล้ว), on 🌕 also the bot's own reason and how many agree; your tap is the bite. V101.359 lobby pick C (round3): a clearer chosen tile, the chosen night glows gold and says what the bots do in one line, tiles whose count changes bump once, rows show ชนะ / แพ้ in words (no 🏆 / 💀) with 👁 to see the result, the unfinished game says ▸ เล่นต่อ.
- `wolf-tutorial-qa` (A, phone harness) — V101.357 owner picks tutorial A + B and sound B: 📖 6-scene tour on the first open (dark night scene, ▶ auto remembered, seen, ❓ replays, Thai VISIBLE = innerText, 320 px), first-turn hints once each under the seats + ข้ามคำใบ้, the lobby header on one row, cues in order (night … vote … win/lose), nothing before a tap, 🔇 remembered and silent (no Web Audio made).
- `wolf-ai-check` (D, node): 1350 all-bot games (5/7/9 × 🥄 levels) — every pick passes pickError, no mate accused or voted, true claims match checks, fakes only from wolves, one claim per bot per day, all games end, 🥄🥄🥄 village beats 🥄 at 7.
- `wolf-rules-check` (D, node): every default deck 5–10 deals exactly its roles; bad decks refused by code; each refused pick; night order cases; wolf tie by rng; vote ties / skips / dead voters; both win conditions; two scripted 7-player games (village win, wolf win); inputs never mutated; public/wolf-rules.js = functions/wolf-rules.js.

- `wolf-game-check` (D, node): 90 whole games (5–10 players, some phases left to the clock) on fake Telegram + Firestore — winner = the engine's; only the end names roles; vote results are counts only; the dead are asked to keep quiet; the 🔮 answer is true; the 🧪 sees the bite; stale / dead / outsider / self / double presses refused; phases move early without the clock; chat + players freed; wolfTick every minute with the wolf token only.
- `wolf-bot-check` (D, node): wolfBot export + secret-header 403 + its own secrets; rules keep `wolf_*` closed; lobby + deep link; joins edit the same lobby message; one room per group; host-only ▸ เริ่ม at ≥ 5; 6 players dealt the right deck, each DM card names only its role, wolves see their mate; every text sent to a group is checked for role words; late / full / unknown / other-room joins refused; ✕ frees the chat and players; transactions read before writing.

## What usually lies

- "Played every role" when the seat was dead: the harness only taps when p1 is alive — a dead p1 just presses ▸.
- Win rates in wolf-ai-check are bots vs bots, not how hard it feels for a person.
- The fake Telegram always succeeds unless told to fail: the real API also rate-limits (~20 msgs/min/group) and refuses DMs to people who never pressed Start.

- A check that only calls `resolveNight` with legal picks: the bot must call `pickError` first, the engine trusts its input.
