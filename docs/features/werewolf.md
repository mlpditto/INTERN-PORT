# 🐺 Werewolf (Telegram)

A secret-role party game for 5–10 players, played in a Telegram group with a bot (not LINE: no monthly push quota, the bot can DM roles). Plan, phases and the owner's decisions: [`docs/WEREWOLF-PLAN.md`](../WEREWOLF-PLAN.md) (Thai).

**Built so far: Phase 0 only — the pure rules engine `functions/wolf-rules.js`.** No bot, no function export, no Firestore, nothing deployed; no user can reach it yet. Roles (owner pick, §8 Q3): 🐺 wolf · 🔮 seer · 🛡️ guard · 🧪 witch (7+ players) · 👤 villager.

## What the engine decides

- `defaultCounts(n)` / `countsError(counts, n)` / `deal(ids, counts, rng)` — the deck per player count and the host's custom deck (one 🔮 🛡️ 🧪 at most, ≥ 1 🐺, wolves < half).
- `nightTurns` / `pickError` — who presses a button tonight and which picks are refused (dead, wrong role, 🐺 on 🐺, 🛡️ the same player two nights running, spent potions, 🔮 / ☠️ on self).
- `wolfTarget` (majority, tie = rng) → `resolveNight` in the order guard → heal → bite → poison (🛡️ and 💚 save the bitten; nothing stops ☠️).
- `tallyVotes` (secret day vote, any tie or skip-tie = nobody out) → `eliminate` → `winner` ('village' / 'wolf').

## Scripts that drive it

- `wolf-rules-check` (D, node): every default deck 5–10 deals exactly its roles; bad decks refused by code; each refused pick; night order cases; wolf tie by rng; vote ties / skips / dead voters; both win conditions; two scripted 7-player games (village win, wolf win); inputs never mutated.

## What usually lies

- A check that only calls `resolveNight` with legal picks: the bot must call `pickError` first, the engine trusts its input.
