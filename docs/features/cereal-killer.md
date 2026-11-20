# 🥣 Cereal Killer

A turn-based deduction game for 2–3 interns (Killer vs Detective, plus Lola the police dog), built in phases — plan and board transcription in [`docs/CEREAL-KILLER-PLAN.md`](../CEREAL-KILLER-PLAN.md).

**Built so far: Phase 0 only** — the board data and the rules engine. Nothing is loaded by `public/index.html` yet; there is no screen to reach.

## How to get to it (user POV)

Not reachable yet. Phase 1 adds a `🥣` chip on the home activity row.

## Scripts that drive it

- `cereal-maps-check` — `public/cereal-maps.js` against the photo transcription (Appendix A): tallies per side, contiguous ids, connected board, the subway pair, the train chain, one bowl, the five seam edges, orphan parks noted
- `cereal-rules-check` — `public/cereal-rules.js` on the rulebook's worked examples: exact-3 killer path with subway / blocking / cornering, kill + witness placement, the one no-kill day, calendar minimums, all six question cards, the detective's café bonus and arrest reach, Lola's moves, abilities, Sniff and Bark, the side-B train, the seam

## What usually lies

- A hand-typed adjacency. The engine derives neighbours from `x,y`; the maps file holds only the per-row letter strings, so compare those to the photo, never a neighbour list.
- "Adjacent" means orthogonal everywhere except Lola's Bark — a test that passes a diagonal arrest or witness is wrong, not the rule.
- The seam between city and suburb is an assumption (plan §7 Q1); `buildMap(…, { seam: false })` exists so the day the printed rules say otherwise is a one-flag change.
