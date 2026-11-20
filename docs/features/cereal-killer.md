# 🥣 Cereal Killer

A turn-based deduction game for 2–3 interns (Killer vs Detective, plus Lola the police dog), built in phases — plan and board transcription in [`docs/CEREAL-KILLER-PLAN.md`](../CEREAL-KILLER-PLAN.md).

**Built so far: Phase 0 (board + engine) and Phase 1 PR 1 (pass-and-play game on one phone, V101.327).** The animated tutorial and the bot are not built yet.

## How to get to it (user POV)

Schedule ▸ the round `🥣` button beside `💰` (goals row) ▸ lobby: map side A/B, two names, ▸ Start. The phone goes to the killer first; every turn ends on a tint hand-off screen ("Pass the phone to …") that shows only public state, and the next player taps through. Killer: tap a house (home, day 1 only), tap 3 cells, pick 🥣 house + 🌳 witness park chips, 🔒 Lock. Detective: tap a café (day 1), tap cells (dots = legal), ask one card when on / next to 👁️, 🛡️ arrest = tap own / neighbour cell then the red confirm, ▸ End turn. Game over opens the reveal (day rail, the killer's notebook). My games list resumes or replays; 🆕 swaps roles. State: localStorage `cereal_v1_<userId>` — the killer's path is in there (trust-based until Phase 2).

## Scripts that drive it

- `cereal-maps-check` — `public/cereal-maps.js` against the photo transcription (Appendix A): tallies per side, contiguous ids, connected board, the subway pair, the train chain, one bowl, the five seam edges, orphan parks noted
- `cereal-board-qa` — the whole Phase 1 flow on the real page: 🥣 button beside 💰, lobby, killer day 1 (home · 8›3›2›1 · kill 3 · witness 4 · lock), hand-off hides the turn, detective café / walk / ask / missed arrest, reload + resume, day 2 kill without a park, correct arrest → reveal, 320 px fit
- `cereal-rules-check` — `public/cereal-rules.js` on the rulebook's worked examples: exact-3 killer path with subway / blocking / cornering, kill + witness placement, the one no-kill day, calendar minimums, all six question cards, the detective's café bonus and arrest reach, Lola's moves, abilities, Sniff and Bark, the side-B train, the seam

## What usually lies

- `userId` in index.html is a top-level `let`: `window.userId` is undefined in a module file, so the storage key silently became `cereal_v1_anon` until the harness read localStorage back. Read the bare global.
- The hand-off screen must be checked by what is NOT in the DOM (no `.ck-cell`, no `.ck-nb`, no path string), not by what is.
- A hand-typed adjacency. The engine derives neighbours from `x,y`; the maps file holds only the per-row letter strings, so compare those to the photo, never a neighbour list.
- "Adjacent" means orthogonal everywhere except Lola's Bark — a test that passes a diagonal arrest or witness is wrong, not the rule.
- The seam between city and suburb is an assumption (plan §7 Q1); `buildMap(…, { seam: false })` exists so the day the printed rules say otherwise is a one-flag change.
