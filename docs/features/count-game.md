# 🧊 นับไว (Count Fast)

Two solo eye-and-speed games (owner 2026-11-25, pick C: answer, then the answer shows). Phone: 🧊 นับไว in the games row under History (V101.368, was beside 🐺 on Schedule); PC (≥ 768 px): the 🧊 circle just left of 🐺 in the header rail. Both call `countOpen()` → `#countModal`.

- 🟥 **Count the Rectangles** — a line drawing (outlines of a few rectangles on an 8×6 lattice); count every rectangle whose four sides are drawn lines. After the answer the rectangles light up one by one (🟧 n / n).
- 🧊 **Count the Cubes** — a staircase stack (back corner tallest, never taller toward you, so every column's top is in sight and hidden cubes sit under seen ones); count = the sum of the heights. After the answer every top shows its column's height and the sum.

V101.367: the question says what counts (🟥 มีสี่เหลี่ยมกี่รูป? · รวมรูปซ้อน · รวมกรอบนอก · 🧊 มีลูกบาศก์กี่ก้อน? · รวมก้อนที่ถูกบัง); a ❓ tour (3 scenes) opens once, then from ?; 5 round dots; ✓ beside the answer.

5 questions a run, 30 s each, getting harder; a number pad (keyboard digits / ⌫ / Enter / Esc on PC). Right = 100 + 5 × seconds left. Best score per game in localStorage `countBest_rect` / `countBest_cube`; nothing in Firestore. A room with friends = later.

File: `public/count.js` (game + its own CSS).

## QA

- `scripts/count-game-qa.cjs` — counter right on known drawings, every stack fair, doorways (phone + PC), pad, wrong → เฉลย + light-up, right = 100 + 5 × s, time out, best kept, 🧊 heights add up, 320 px, PC keys.
- `scripts/count-tour-qa.cjs` — V101.367: the first open plays the ❓ tour inside the popup (① ② ③ step by step, at once with reduced motion; ถัดไป fixed), never again; ? replays it and the clock waits; the fuller question; ✓ beside the answer, grey → orange; 44 px keys; 5 round dots; 320 px.
- `scripts/count-voice-qa.cjs` — V101.373: each ❓ scene reads itself in Thai (`public/count-voice/t1…t3.mp3`, Paxa foithong, made once, 40 kbps mono); 🔊/🔇 beside ✕ in the tour, kept as `countVoice`; ถัดไป / ข้าม / ✕ stop the clip; with the voice on scene 1 steps every 2.6 s. Audio is stubbed — real sound needs a phone

## What usually lies

- A harness pass does not prove the drawings are fun to count on a small phone; try it in LINE.

## V101.371: 🧘 no-timer mode and an answer that shows how to count

Owner asks: "เพิ่มโหมดไม่นับถอยหลังเวลา แต่เก็บ stat ให้ ADMIN และ user ทราบ" and "เฉลยควรบอกวิธีนับ พร้อมตัวเลขกำกับ". Picks: 🟥 C ภาพย่อย · 🧊 B ตารางมองจากบน (mockup-count-free/).

**Lobby**
- A chip rail: ⏱ แข่งเวลา 30 วิ / 🧘 ไม่จับเวลา.
- The pick is kept on the phone (localStorage `countFree`).

**🧘 no-timer mode**
- The clock counts up in grey and never ends a question. No points are given.
- The header shows ✓ n.
- The end screen shows ✓ n/5, the total time, the average per question, and the seconds for each question.
- A best total time is kept only for a 5/5 run (`countFreeBest_rect` / `countFreeBest_cube`).
- The admin 🎮 table logs the mode as `rect free` / `cube free`.

**Answer screen (both modes)**
- 🟥 Rectangles: every rectangle is shown as a small numbered picture (1…n). They are grouped by how many pieces each covers, with the sum line "1 ช่อง a + 2 ช่อง b … = n รูป". This replaces the old one-by-one lighting.
- 🧊 Cubes: a top-view table of the heights sits beside the stack, with each row's sum and the sum line "… = n ก้อน".

QA: `scripts/count-free-qa.cjs` (new) and `scripts/count-game-qa.cjs` (now checks the small pictures and the sum line).

## V101.372: ⏱ seconds per question in both modes

- Every answer line ends with `· ⏱ n วิ` (`#cg-took`); a time-out does not (it is always 30).
- The timed end screen also shows `#cg-qt` (ข้อ1 12วิ …, green right / red wrong) under 🏆.
- The ❓ tour last scene says `🧘 ไม่จับเวลาก็ได้`.
- QA: count-game-qa, count-free-qa.
