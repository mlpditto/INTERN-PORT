# 🥣 Cereal Killer

A turn-based deduction game for 2–3 interns (Killer vs Detective, plus Lola the police dog), built in phases — plan and board transcription in [`docs/CEREAL-KILLER-PLAN.md`](../CEREAL-KILLER-PLAN.md).

**Built so far: Phase 0 (board + engine), Phase 1 PR 1 (pass-and-play game on one phone, V101.327) PR 2 (the animated tutorial + first-turn coach marks, V101.328) and Phase 1½ (play against the bot, V101.329).** Online play (Phase 2) and Lola (Phase 3) are not built.

## How to get to it (user POV)

Schedule ▸ the round `🥣` button beside `💰` (goals row) ▸ lobby: map side A/B, two names, ▸ Start. The phone goes to the killer first; every turn ends on a tint hand-off screen ("Pass the phone to …") that shows only public state, and the next player taps through. Killer: tap a house (home, day 1 only), tap 3 cells, pick 🥣 house + 🌳 witness park chips, 🔒 Lock. Detective: tap a café (day 1), tap cells (dots = legal), ask one card when on / next to 👁️, 🛡️ arrest = tap own / neighbour cell then the red confirm, ▸ End turn. Game over opens the reveal (day rail, the killer's notebook). My games list resumes or replays; 🆕 swaps roles. **Tutorial:** the first 🥣 on a device opens *How to play* — 8 scenes on a demo board that animates by itself (Thai first, small English line, ถัดไป / ‹ / ข้าม, ▶ auto = every 6 s, remembered); `?` in the lobby replays it. On the first real turns a violet coach card with a pulsing ring follows the step (home → 3 cells → 🥣 👁️ chips → 🔒 · café → move → ask → 🛡️ / ▸ End), each once; `ข้ามคำใบ้` stops them for good. Flags: localStorage `cerealTourSeen`, `cerealCoachSeen`, `cerealTourAuto`. **Vs 🤖:** the lobby's 🤖 chip shows 🥄 / 🥄🥄 / 🥄🥄🥄 and "You play 🕵️ / 🔪" chips; the bot's seat reads 🤖 Bot. No hand-off screens; the bot's turn shows a short "🤖 thinking…" beat, then the board. The bot detective keeps a candidate set from everything public (`g.bot.k.cands`); the bot killer scores paths. The reveal shows the bot's notebook like a human's. State: localStorage `cereal_v1_<userId>` — the killer's path is in there (trust-based until Phase 2).

## Scripts that drive it

- `cereal-maps-check` — `public/cereal-maps.js` against the photo transcription (Appendix A): tallies per side, contiguous ids, connected board, the subway pair, the train chain, one bowl, the five seam edges, orphan parks noted
- `cereal-board-qa` — the whole Phase 1 flow on the real page: 🥣 button beside 💰, lobby, killer day 1 (home · 8›3›2›1 · kill 3 · witness 4 · lock), hand-off hides the turn, detective café / walk / ask / missed arrest, reload + resume, day 2 kill without a park, correct arrest → reveal, 320 px fit
- `cereal-bot-check` — 200 seeded games bot vs bot through the engine: every action legal, the true killer cell never leaves the candidate set, level order (🥄 < 🥄🥄 < 🥄🥄🥄 detective; 🥄 killer easiest), every game ends by day 7, < 50 ms a game
- `cereal-bot-ui-qa` — the 🤖 chip and level / seat rows, detective vs 🥄🥄🥄 killer (no hand-off, thinking beat, kills on day 1 and 2, close + resume), killer vs 🥄🥄 detective (café start, candidate invariant from the page's own state, arrest or day 3), 320 px
- `cereal-tutorial-qa` — auto-open once, 8 Thai-first scenes with CSS animation, ▸ เริ่มเกม / ข้าม / Esc / ? replay, ▶ auto advances and is remembered, the 8 coach marks follow the real turn and ring the real element(s) with the card off them, skip-all, reduced motion = still cards, 320 px
- `cereal-rules-check` — `public/cereal-rules.js` on the rulebook's worked examples: exact-3 killer path with subway / blocking / cornering, kill + witness placement, the one no-kill day, calendar minimums, all six question cards, the detective's café bonus and arrest reach, Lola's moves, abilities, Sniff and Bark, the side-B train, the seam

## What usually lies

- `userId` in index.html is a top-level `let`: `window.userId` is undefined in a module file, so the storage key silently became `cereal_v1_anon` until the harness read localStorage back. Read the bare global.
- A bot that "walks anyway" when no fresh house is in reach and the quiet day is spent submits an illegal turn; the rules leave that killer no move, so the game ends (good side wins) — same for a human (`killerHtml` checks it).
- Level ladders invert easily: a detective that arrests at ≤ 3 candidates with 4 tries beats a careful one. Measure with the 200-game check before trusting a level's name.
- A coach card placed below its target covers the row that appears next (the witness row under the kill row, ▸ End turn under 🛡️ arrest). A hint rings every element of its step (`#ck-kill, #ck-wit`) and the card goes below the union; Playwright's retry-scroll also exposed a one-frame lag, so the card re-places synchronously on scroll.
- The hand-off screen must be checked by what is NOT in the DOM (no `.ck-cell`, no `.ck-nb`, no path string), not by what is.
- A hand-typed adjacency. The engine derives neighbours from `x,y`; the maps file holds only the per-row letter strings, so compare those to the photo, never a neighbour list.
- "Adjacent" means orthogonal everywhere except Lola's Bark — a test that passes a diagonal arrest or witness is wrong, not the rule.
- The seam between city and suburb is an assumption (plan §7 Q1); `buildMap(…, { seam: false })` exists so the day the printed rules say otherwise is a one-flag change.
