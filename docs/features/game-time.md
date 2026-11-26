# 🎮 Game time for the admin

Owner 2026-11-25: "เก็บ stat ให้ ADMIN ทราบว่าแต่ละเกม user ใช้เวลามาก-น้อย แต่ละตา" — all 4 games, admin view pick B (a table per person, mockup-game-time-admin/).

**Intern side** (`public/game-log.js`, V101.370): each game's render calls `GameLog.see(game, state)`. When a game ends, one `game_plays` doc is added:
`userId, authUid, game ('bw' | 'count' | 'cereal' | 'wolf'), mode, rounds [seconds…], from, sec, win ('w' | 'l' | 'd' | null), score, res [per round], startedAt, endedAt, v, at`.
A round = ไพ่เงา: until ▸ ลง · นับไว: a question · Cereal: a day (online: includes waiting for the others) · หมาป่า: a night + a day.
The clock only moves between taps and renders; a gap of more than 3 minutes (popup closed, phone away, app in the background) counts as 3 minutes. A game left unfinished, or played while not signed in, writes nothing. A saved game resumed after a reload is timed from where it was picked up (`from`).

**Admin side** (`public/game-admin.js`, V102.704): a card `#gt-admin` under the 🥣 Cereal line on the Dashboard. There is one chip per game that has plays. The table shows one row per person, slowest first:
- 🎮 games played
- ⌛ average seconds per round. 🐢 means much slower than the median of the others, ⚡ much faster (only with 3+ people).
- the last game as small bars, with 🟧 on its longest round
- 🏆 wins / games (นับไว: average ✓ / 5)

The card covers the last 7 days in one query, at most every 5 minutes, and is hidden when empty or when the read fails.

**Rules** (`firestore.rules`, `game_plays`): an intern creates only their own (authUid = login, userId linked), for the 4 games, ≤ 40 rounds, known fields only. Nobody edits it; only admins read or delete. Needs `firebase deploy --only firestore:rules` (owner).

## 🏆 Top 3 per game (V101.375 / V102.705)

Owner 2026-11-26: "แต่ละเกม ให้เก็บคะแนนผู้ชนะไว้ด้วย ประกาศ Top 3 แต่ละเกม ให้แต่ละ user ทราบ ส่วน ADMIN จะทราบทั้งหมด". Picks: count wins · this week + all time · line B (mockup-game-top3/).
- **Ranking** (`game-top-rank.js`, the same file in `functions/` and `public/`): 🥣 🐺 ⚫⚪ = games won; 🧊 นับไว = best total seconds of a 5/5 game at 🥄🥄🥄 ยาก only (owner pick; the board says so). 🔢 เลขลับ (V101.377) = the fewest 🎫 of a 🧠 (no help) game. A tie goes to who got there first. The week starts Monday 00:00 Bangkok. Users with `isIgnored` never rank.
- **Intern** (`public/game-top.js`): one 🏆 line under each game's title — three faces with 🥇🥈🥉 and the value, plus "คุณ #n". A tap opens the board (สัปดาห์นี้ │ ตลอดกาล); a second tap folds it. Data comes from the `gameTop` callable (nickname + LINE photo of the top 3, and your own place). It asks at most every 2 min, and again after a finished game. Nothing shows when the call fails.
- **Admin** (`game-admin.js`): ⏱ เวลา │ 🏆 อันดับ on the 🎮 card. It lists every player of the chosen game, best first, including players with 0 wins. ตลอดกาล reads all of `game_plays` once (5 min).
- **Deploy**: `firebase deploy --only functions:gameTop` (no rules change).

## QA

- `scripts/game-log-qa.cjs`: real index.html with a fake clock and a fake Firestore. Covers seconds per round for all 4 games, the 3-min cap, one doc per game, closed half-way = none, not signed in = none.
- `scripts/game-admin-qa.cjs`: the admin.html wiring and the rules, checked as text, plus the real game-admin.js on a fake db. Covers the query, chips, rows, 🐢/⚡, bars, wins / ✓, the chip switch, the throttle, and the empty / failed states.
- `scripts/game-top-qa.cjs`: the ranking in node (both copies the same), the 🏆 line in the 4 real lobbies with a fake `gameTop`, the board, an empty week, a failing call, asking again after a game, 320 px; admin 🏆 อันดับ on a fake db.
- `scripts/rules-game-plays.emu.cjs`: emulator only, not in CI.
