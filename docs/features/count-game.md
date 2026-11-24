# 🧊 นับไว (Count Fast)

Two solo eye-and-speed games (owner 2026-11-25, pick C: answer, then the answer shows). Phone: the 🧊 button beside 🐺 on Schedule; PC (≥ 768 px): the 🧊 circle right after 🐺 in the header rail. Both call `countOpen()` → `#countModal`.

- 🟥 **Count the Rectangles** — a line drawing (outlines of a few rectangles on an 8×6 lattice); count every rectangle whose four sides are drawn lines. After the answer the rectangles light up one by one (🟧 n / n).
- 🧊 **Count the Cubes** — a staircase stack (back corner tallest, never taller toward you, so every column's top is in sight and hidden cubes sit under seen ones); count = the sum of the heights. After the answer every top shows its column's height and the sum.

5 questions a run, 30 s each, getting harder; a number pad (keyboard digits / ⌫ / Enter / Esc on PC). Right = 100 + 5 × seconds left. Best score per game in localStorage `countBest_rect` / `countBest_cube`; nothing in Firestore. A room with friends = later.

File: `public/count.js` (game + its own CSS).

## QA

- `scripts/count-game-qa.cjs` — counter right on known drawings, every stack fair, doorways (phone + PC), pad, wrong → เฉลย + light-up, right = 100 + 5 × s, time out, best kept, 🧊 heights add up, 320 px, PC keys.

## What usually lies

- A harness pass does not prove the drawings are fun to count on a small phone; try it in LINE.
