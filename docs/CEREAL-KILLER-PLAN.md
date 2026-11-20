# 🥣 Cereal Killer — a turn-based deduction game for interns, built into the intern portal

Written 2026-11-20. **Phase 0 (board data + rules engine + node checks) ships with this document; Phases 1–4 are not built.** Baseline: `origin/production` b2331644 = intern V101.326 / admin V102.698.

Source: the owner's Thai rules summary *Cereal Killer — สรุปกติกา และวิธีเล่นผ่าน LINE* (design: Julián Tunni, Primigenio / Super Noob Games). Section 15 of that summary describes playing over a LINE group with a hand-kept notebook, a referee or a SHA-256 commit to stop the killer cheating. **Building the game into the portal removes all three problems:** the app holds the secret path, computes every answer truthfully, validates every move, and reveals the path at the end.

**Scope:** 2-player game first (Killer vs Detective, city map), then the 3-player Lola variant. Interns play against each other asynchronously inside the LIFF app; the LINE group stays for banter and hand-off nudges sent by the players themselves. **Out of scope:** AI opponents, points/score rewards (decision pending, §7), an admin tournament board.

---

## 1. What the rules need from the software (read from the summary)

| Rule | Software consequence |
|---|---|
| Killer moves hidden, exactly 3 orthogonal steps, may backtrack, may not pass Detective / Lola, loses if cornered | Pure engine: adjacency graph, path validator, "any legal 3-path exists?" check |
| Subway `S` = 1 step to the opposite `S`; train `T` follows a fixed 3-station order (suburb only); Lola may stand on but not ride them | Map data carries `S` pairs and the `T` sequence; mover flag `canRide` |
| Kill = cereal token on a house the killer started on / passed / ended on, max 1 per day, 6 total, one skip day allowed; witness placed on an adjacent park (killer picks if two) | Engine returns the kill candidates and witness options for a given path; killer may not end on the park that gets the witness |
| Calendar minimums: ≥1 after day 2, ≥3 after day 4, 6 after day 7, else Detective wins immediately | Engine checks at end of each killer turn |
| Detective ≤3 steps, +1 once for passing a café (not when starting there, not the same café twice) | Step budget with a café bonus flag |
| One question per witness, each of the 5 (6) cards once per game, killer must answer truthfully; compass answer with two valid directions is the killer's choice | Engine computes `{validAnswers}`; the killer's client picks one when ambiguous, otherwise auto-answers |
| Arrest: own cell or orthogonal neighbour; 4 shared attempts; wrong = turn ends, badge moves | Counter on the game doc; correct arrest ends the game |
| Lola: ≤4 steps, +1 for the bowl, three abilities (Sniff / Bark / Bite), never the same ability twice in a row, answers are private to Lola, Bark counts diagonals | Private answer channel; ability cooldown; a second adjacency (8-neighbour) for Bark |
| Difficulty = map side pairs (B+B 🥄 … A+B 🥄🥄🥄🥄) | Map data has sides A/B for city and suburb |
| 14 achievements | Phase 4; some are self-reported (real cereal, Lola allowed to speak) |

**The map is captured.** The owner photographed all four board sides on 2026-11-20; Appendix A holds the cell-by-cell transcription that `public/cereal-maps.js` will be generated from. The city is a 5×4 numbered grid (1–20); the suburb sits directly under it and continues the numbering (A: 21–36, B: 21–34) with holes where the train track runs. Every worked example in the summary checks out against the transcription (Appendix A, "Cross-checks").

---

## 2. Architecture — how it fits the portal

| Concern | Decision | Why |
|---|---|---|
| Where the code lives | `public/cereal-rules.js` (pure engine, no DOM, no Firebase) + `public/cereal.js` / `public/cereal.css` (UI), loaded from `public/index.html` as classic `<script src="…?v=V101.NNN" defer>` like `activity-rewards.js` | House pattern: flat module pairs, no ES modules; a pure engine can run in node for the harness (shape C) and in Cloud Functions unchanged |
| Map data | `public/cereal-maps.js` — `window.CEREAL_MAPS = { cityA, cityB, suburbA, suburbB }`, each `{ cells:[{id,x,y,type}], subway:[[a,b]], train:[a,b,c] }`; adjacency is derived, never hand-typed | One source of truth; a Playwright test can render it and a node test can walk it |
| Entry point | a `🥣` chip on the home activity row (same slot family as `💰 FIN` in `renderDailyCheckinCard()`), opening a full-height sheet | Lean + inline; no new tab; the chip carries the "your move" badge |
| Hidden information | **Cloud Function referee** `cerealAct` (one callable, `action` switch). Clients never write game state; the killer's path lives in `cereal_games/{id}/secret/killer`, which no client can read; the function answers questions from it and copies the path into the public doc when the game ends | Firestore rules cannot hide a field, so the secret must be a doc clients cannot read; a function is the only way the Detective's question gets a truthful answer **while the Killer is offline**, which async play needs. Alternative (no function, client commit-and-reveal) in §7 Q2 |
| Identity | players stored as `{ uid: <LINE/effective userId>, authUid, name, pic }`; rules test `request.auth.uid in resource.data.authUids` | Interns are anonymous Firebase users; the LINE id comes via `user_auth_links` (firestore.rules:587) |
| Realtime | one `onSnapshot` on `cereal_games where authUids array-contains <authUid> and status in [lobby, playing]` | Same pattern as `quest_submissions` (index.html:10807) with `handleFirestoreListenerError` |
| Notifying the other player | **no OA push** (300/month cap, `functions/line-quota.js`). The acting player gets a one-tap `liff.shareTargetPicker` Flex card ("🔪 Day 3 done · your move 🕵️ · open") to drop into the LINE group; invites use the same card with the room code | Quota-free because the player sends it; mirrors how achievements and event stamps already share (index.html:7630, 7903) |
| Lola cannot speak | Lola's Sniff / Bark results are written to `secret/lola`, readable only by Lola's authUid; the group log shows only "🐕 sniffed cell 23" | Enforces the rule in-app; what people say in the LINE group is their business |
| Persistence of a half-typed turn | localStorage draft `cereal_draft_<gameId>` so a killer who closes the sheet mid-path does not lose it | FIN precedent: local first, network never blocks the UI |

### Data model

```
cereal_games/{gameId}
  code            6-char invite code (A–Z 2–9), unique while status != finished
  status          lobby | playing | finished
  mode            2 | 3
  maps            { city: 'A'|'B', suburb: 'A'|'B'|null }
  players         { killer:{uid,authUid,name,pic}, detective:{…}, lola:{…}|null }
  authUids        [ … ]                       ← rules key
  day             1..7
  phase           killer | lola | detective
  detectivePos    cellId | null               (null until the detective picks a café after day 1)
  lolaPos         cellId | null
  cereals         [cellId]                    (public, like tokens on the table)
  witness         cellId | null               (cleared at the end of the detective turn)
  arrestsLeft     4
  usedQuestions   ['dir','row','col','building','parity','area']
  lola            { lastAbility, used:[] }
  noKillDayUsed   bool
  log             [ {day, by:'killer'|'detective'|'lola', type, text, answer?} ]   public events only
  result          { winner:'killer'|'good', reason, revealedPath, revealedHome }   set on finish
  createdAt, updatedAt, turnDeadline?

cereal_games/{gameId}/secret/killer     { home, path: { '1':[a,b,c], … }, kills: { '3': cellId } }   no client access
cereal_games/{gameId}/secret/lola       { answers: [ {day, ability, cell, answer} ] }                 read: lola.authUid only

cereal_stats/{uid}    { played, winsKiller, winsDetective, winsLola, achievements:{…} }   read: owner + admin; write: function
```

### Function `cerealAct({ gameId?, action, payload })`

| action | who | payload | validates |
|---|---|---|---|
| `create` | anyone registered | `{mode, maps, role}` | one open lobby per creator |
| `join` | anyone | `{code, role?}` | seat free, not already in the game |
| `start` | creator | — | seats filled; writes day 1 / phase killer |
| `killerMove` | killer | `{home?, path:[3], kill?:cell, witness?:cell}` | home only on day 1; path legal; kill on the path; witness adjacent park; calendar minimums; cornered → good side wins |
| `detectiveMove` | detective | `{path:[0..4]}` | step budget incl. café bonus; may stop and act in between (the client sends the move it made so far) |
| `ask` | detective | `{question}` | on/adjacent to witness, card unused; returns the answer (killer-chosen when ambiguous, see note) |
| `arrest` / `bite` | detective / lola | `{cell}` | own cell or neighbour; decrements `arrestsLeft`; 0 → killer wins |
| `endTurn` | current mover | — | removes witness after the detective turn; advances phase/day; day 7 end → killer wins if 6 kills |
| `lolaMove` / `sniff` / `bark` | lola | `{path}` / `{cell}` / — | ≤4 + bowl; ability not used last turn |
| `resign` | any player | — | — |

*Ambiguous compass answers.* The rule lets the killer choose between two true directions. To keep the detective's turn from waiting on the killer, the function picks the direction **farther from the killer's actual cell** (the less informative truthful answer), and the end-of-game reveal shows both options. If the owner prefers the human choice, `ask` can instead park the game in a `phase: 'answer'` sub-state until the killer taps one of two chips — one extra round trip per question.

### Rules (firestore.rules, deploy manual)

```
match /cereal_games/{gameId} {
  allow read: if isAdmin() || (isSignedIn() && request.auth.uid in resource.data.authUids);
  allow write: if false;                       // function only (admin SDK)
  match /secret/killer { allow read, write: if false; }
  match /secret/lola   { allow read: if isSignedIn() && request.auth.uid == get(/databases/$(database)/documents/cereal_games/$(gameId)).data.players.lola.authUid; allow write: if false; }
}
match /cereal_stats/{uid} { allow read: if isAdmin() || isSelfOrLinked(uid); allow write: if false; }
```

---

## 3. Phases

Each phase ships as its own PR against `production`, bumps the intern version, adds a `scripts/*-qa.cjs` that fails without the change, and updates `docs/features/cereal-killer.md`. Mockups (3–5 variants, ≤512 KB each) precede every new screen, per DESIGN §7.

### Phase 0 — Map data + rules engine (no UI, no Firebase)

**Owner input: done** — the four sides are transcribed in Appendix A.

| Deliverable | Verify |
|---|---|
| `public/cereal-maps.js` — city A/B + suburb A/B, generated from Appendix A | `scripts/cereal-maps-check.cjs`: the JS matches Appendix A cell for cell; numbering is contiguous; every cell has ≥1 orthogonal neighbour and the graph is connected (city alone, and city + suburb); each `S` has exactly one partner; `T` has 3 stations in a chain; exactly one bowl per suburb; counts per side equal the Appendix A tallies (8 houses / 3 parks / 2 cafés / 2 `S` per city side); a park with no adjacent house is reported as a note, not a failure (A+A leaves park 25 that way; B+A does not) |
| `public/cereal-rules.js` — `adjacent(map, cell, {diagonal})`, `legalPaths(map, from, steps, {exact, blocked, canRide})`, `killOptions(path)`, `witnessOptions(cell)`, `answer(question, killerCell, witnessCell)`, `arrest(cell, killerCell)`, `cornered(map, killerCell, blocked)`, `calendarOk(day, kills)`, `cafeBonus(path)`, `sniff/bark` | `scripts/cereal-rules-check.cjs` (harness shape C): the summary's own worked examples as fixtures — `8›3›2›1` kill at 3 → witness 4 is an option and ending on 4 is illegal; `5 → S10 → 16 → 17` is three steps; killer NW of witness → `N` and `W` both valid; sniff at 4 after `5›4›3›8` → `W` or `S`; day-2 with 0 kills → good wins; a killer boxed in by detective + edge → cornered |
| Emoji vocabulary added to DESIGN.md §5: 🥣 cereal / kill, 🔪 killer, 🕵️ detective, 🐕 Lola, 👁️ witness (park), ☕ café, 🚇 S, 🚆 T, 🦴 bone / bowl, 🛡️ arrest, 🥄 difficulty | review |

Size: 1 PR, no version bump needed (nothing loads it yet) — but bump anyway if `index.html` references the file.

### Phase 1 — Pass-and-play on one phone (2 players, localStorage)

Proves the UI and the engine together with zero backend and no deploy beyond GitHub Pages. Everything built here carries over unchanged to Phase 2: only the "send action" function swaps from local to `cerealAct`.

| Deliverable | Verify |
|---|---|
| Mockups first: board (5-wide grid, numbered, emoji per type, tokens as small pills), killer notebook (home + 7 day rows, tap cells to build `a › b › c`, kill / witness chips appear inline), detective turn (step counter, question chips rail, arrest chip in red with quoted confirm), hand-off screen ("pass the phone to 🕵️ — tap to reveal"), end-of-game reveal with the path drawn on the board | owner picks a variant |
| `public/cereal.js` + `.css`; the `🥣` entry (placement per the mockup pick: beside 💰 FIN on Schedule, or an Explore tile — the home activity row has had no chips since V101.87); state in `cereal_v1_<userId>`; game loop driven by the engine; a 🔁 replay of the finished game |
| **Tutorial, two layers, same pattern as `journal-tour.js`** (violet tip card, **Thai first + small EN line — confirmed by the owner 2026-11-20, same as the Journal tour**, 👆 finger, CSS-only animation, `prefers-reduced-motion` keeps the cards, once per device via a localStorage flag, replay from `?`; scenes advance on ถัดไป by default, with a small ▶ auto toggle on the tip card that plays them every ~6 s — owner 2026-11-20: "รอกดถัดไปอย่างเดียว หรือให้ user ตกลงกันได้"): (1) **How to play** — 8 scenes (owner picked 8 over 5) on a demo board that animates by itself (goal · killer walks 3 · cereal + witness · calendar minimums · pass the phone · detective walks + asks · arrest · subway + cornered → ▸ start), opened on the first 🥣 tap; (2) **coach marks** — spotlight tips on the real first killer turn (pick home · tap 3 cells · 🥣 👁️ chips · lock → pass) and first detective turn (move · ask · arrest). Owner asked for this on 2026-11-20 ("ต้องมี animation tutorial สอน user เล่นทีละขั้น"); mockup frames T and C on the canvas | `scripts/cereal-tutorial-qa.cjs`: first open shows scene 1, ถัดไป walks all 8, ข้าม lands on the start card, the flag is set once and the tour does not return on reload, `?` replays it, reduced-motion renders every scene without animation, no Firestore call | `scripts/cereal-board-qa.cjs` (shape B, 320 + 390 px): the chip opens the sheet, a full scripted 2-day game via real taps lands the expected tokens on the board, the killer's path is not in the DOM while the detective screen is up, the wrong-arrest path decrements `🛡️ 4 → 3`, the reveal draws 6 cells |
| Version: intern V101.286 (+ `scripts/schedule-ui-qa.cjs` version pin, as every intern bump) | `node scripts/version-check.cjs`-style assertions in the suite |

Size: 3 PRs (game → tutorial + coach marks → polish). Mockup canvas (2026-11-20): https://claude.ai/artifact/EDLqmodTtzkkB1raRrgC1d — frames Main, K-A, K-B, H, D-A, D-B, R, T (tutorial), C (coach). This is the phase to stop at if interns do not take to the game.

### Phase 1½ — Play against a bot (single player, still one phone, no Firebase)

Owner 2026-11-20: "เพิ่มโหมดเล่นกับบอทได้ด้วย". The pure engine makes this cheap, and a solo mode is what gets a game tried at all. Lobby gains an opponent chip (👤 friend · 🤖 bot) and a 🥄 level chip; the bot's secret lives only in memory on the device.

| Deliverable | Verify |
|---|---|
| `public/cereal-bot.js` — pure, no DOM. **Bot detective:** keeps the set of killer cells consistent with everything public (start = every house; each day expand by every legal 3-path that avoids the detective; keep only paths that touch that day's cereal house and give that day's witness; filter by every answer); moves toward the densest part of the set, asks the card that splits the set most evenly (entropy), arrests when one candidate is in reach or late in the game when ≤ 2 are. **Bot killer:** among legal paths picks by a score — kills still needed vs the calendar, distance from the detective's reach (cells within 4 steps), a witness park far from the detective, never ends adjacent to the detective when it can help it, keeps the skip day for an emergency. **Levels** 🥄 = random card + arrest at ≤ 3 candidates / greedy killer · 🥄🥄 = entropy card, arrest at 1 / killer scores distance · 🥄🥄🥄 = also models what the detective can deduce | `scripts/cereal-bot-check.cjs`: the candidate set always contains the true killer cell (200 simulated games, seeded RNG — this is also the best regression test the engine will ever get); the bot never submits an illegal action (every action re-validated by the engine); win rates per level land in sane bands (🥄 detective catches the greedy killer < 🥄🥄🥄 does); a full game finishes in < 50 ms in node |
| Lobby: opponent chip 👤 / 🤖, 🥄 level chip, the hand-off screen is skipped when the other seat is the bot; the bot's turn shows a short "🤖 thinking…" beat (≥ 600 ms so the move is seen to happen), then the public result; the reveal shows the bot's notebook like a human's | `cereal-bot-ui-qa.cjs`: a scripted solo game as detective and as killer reaches the reveal; no hand-off screen appears; the bot's path never enters the DOM before the reveal |
| Tutorial hook: the last tutorial card offers "▸ Try a round vs 🤖" | — |

Out of scope here: a bot for the 3-player game (Lola) — Phase 3 decides. Size: 2 PRs (bot + its check → lobby/turn UI). Version: intern +2.

### Phase 2 — Online, asynchronous, 2 players

| Deliverable | Verify |
|---|---|
| `functions/cereal.js` — `cerealAct` callable (region us-central1 like the others), requiring `public/cereal-rules.js` through a shared copy step or a symlink-free `require('../public/cereal-rules.js')` (file is UMD: `window` or `module.exports`) | `scripts/cereal-act-check.cjs` (shape D): fake Firestore, a scripted full game across two auth uids, every illegal action rejected with a code, the secret doc never appears in any public write, `result.revealedPath` equals what the killer sent |
| `firestore.rules` block above + index on `authUids` (array-contains) + `status` | `scripts/rules-cereal.emu.cjs` on the emulator: outsider cannot read, player can read, nobody can write, Lola alone reads `secret/lola` |
| Lobby: 🥣 sheet lists "my games" (badge = my move), `+ New` → mode / map chips / pick my role → room code, `Join` → code input; `liff.shareTargetPicker` invite card; "your move" card after each turn; both guarded by `liff.isApiAvailable` with a copy-code fallback | `scripts/cereal-lobby-qa.cjs`: captured writes are **zero** (everything goes through the callable stub), the share card body carries the code and a `liff.state` deep link (see the liff.state wrapping trap in memory) |
| Turn timer: optional `turnDeadline` (default 48 h); on expiry the next actor may tap "⏳ claim" to end the stale turn (no scheduler job → nothing to deploy on a schedule, no LINE quota) | included in `cereal-act-check` |
| Deep link `?cereal=<gameId>` so the shared card opens the sheet on that game | QA asserts the router handles the prefix before substring routes (memory: router prefix first) |

Deploy: `firebase deploy --only functions:cerealAct` and `--only firestore:rules,firestore:indexes` by the owner (manual, from the non-OneDrive clone). Add both to `docs/OWNER_ACTIONS.md`.

Size: 3 PRs (function + rules, lobby UI, share cards). Version: intern V101.287–289.

### Phase 3 — 3 players: Lola, suburb map, train

| Deliverable | Verify |
|---|---|
| Suburb map rendered under the city; difficulty picker shows the four pairs with 🥄 count; question card 6 (city / suburb) | maps-check already covers suburb data |
| Lola seat, bowl start, ≤4 steps + bowl bonus, cannot ride S/T, blocks the killer like the detective | engine fixtures from the summary's Sniff example |
| Abilities as three chips with a 🦴 on the one used last turn (disabled); Sniff needs a cell; Bark has none; Bite = arrest with the shared counter | `cereal-lola-qa.cjs`: Lola's screen shows the private answer, the detective's screen of the same game shows only the event line |
| `secret/lola` answers through the function; the killer's compass answer to Sniff follows the same "farther direction" default | rules emulator test for the Lola read |

Size: 2 PRs. Version: intern V101.290–291.

### Phase 4 — Meta: stats, achievements, feature map, admin peek

| Deliverable | Verify |
|---|---|
| `cereal_stats/{uid}` written by the function on finish; a one-line stats strip in the 🥣 sheet (`🔪 2 · 🕵️ 3 · 🐕 1 wins`) | act-check asserts the increments |
| Achievements from the rulebook (Instinct, Distrust, Planner, Claustrophobic, K9, Scentless, Invisible, …) detected by the function from the log; self-reported ones (Real cereal, Good dog, Dolittle) as taps that both opponents confirm. Shown as emoji pills; decide whether they join the existing `badges` area or stay inside the sheet | fixtures per achievement |
| `docs/features/cereal-killer.md` listing every script above; README sweep line | review |
| Admin: a small read-only "🥣 games" count on the dashboard, nothing more unless asked | — |

Size: 2 PRs. Version: intern V101.292+, admin V102.608 only if the dashboard line is wanted.

---

## 4. What is deliberately not in this plan

- No points, score or Beri for playing (§7 Q4). A game interns can grind for score invites collusion (two accounts, one brain).
- ~~No AI opponent~~ — the owner asked for a bot mode on 2026-11-20; it is Phase 1½ above. A bot for the 3-player game is still out.
- No OA push for turns. The free cap is already the binding constraint on the digest; a 7-day game between 2–3 people is 15–21 pushes.
- No server timer job. A "claim" tap on expiry covers stale games without a scheduler.
- No reuse of the publisher's board art, card art or logo. The cell layout (which cell is a house, park, café…) is game mechanics and is transcribed from the owner's own copy; the drawing is ours — emoji on a plain grid. The app credits the designer in the sheet footer.

---

## 5. Risks and traps to carry into each phase

| Risk | Mitigation |
|---|---|
| Map typed by hand is wrong (a missing adjacency silently makes a cell unreachable) | `cereal-maps-check` connectivity + degree checks; render the derived adjacency as thin lines in the mockup and eyeball it once against the photo |
| Rules drift between client (preview of legal moves) and function (authority) | one file, `cereal-rules.js`, loaded in both; the act-check imports the same file the page does |
| Anonymous auth uid changes when an intern reinstalls LINE → loses their seat | store both `uid` (LINE/effective) and `authUid`; `join` with the same `uid` re-seats and rewrites `authUids` |
| Killer's hidden path leaking through the UI (DOM, console, localStorage on a shared device) | Phase 1 QA greps the DOM and localStorage for the path while the detective screen is up; Phase 2 never has the path client-side except the killer's own draft, cleared on submit |
| `liff.state` deep link wrapping (memory) | reuse the existing router helper; QA asserts the decoded param |
| Thai text blank under lang-toggle (memory) | all labels EN-first with `data-th-*`; kr-gap ratchet stays green |
| Inline editors wider than the chip they replace (FIN lesson) | check the editing state at 320 px in every mockup |
| Zero / empty states (FIN lesson, three times) | render day 1 before the detective has a café, a game with 0 kills, a finished game with 0 arrests used, and look at them |
| Function cold start (us-central1, Gen 2) makes the first tap feel dead | optimistic UI from the local engine (the board updates at once, the callable confirms; a rejection rolls back with a toast) |

---

## 6. Order of work and rough size

| Phase | PRs | Owner input needed | Deploys |
|---|---|---|---|
| 0 Map + engine | 1 | none left (photos received 2026-11-20) | none |
| 1 Pass-and-play + tutorial | 3 | pick mockup variants (K-A/K-B, D-A/D-B, entry); tutorial = 8 scenes, tap-only + ▶ auto toggle (decided) | Pages only |
| 1½ Play vs bot | 2 | 🥄 level names | Pages only |
| 2 Online 2p | 3 | pick lobby mockup; run `firebase deploy` for the function + rules + index | functions, rules, indexes |
| 3 Lola / suburb | 2 | suburb map sides; pick Lola mockup | functions, rules |
| 4 Meta | 2 | decide badges placement | functions |

Phases 0 → 1 → 1½ → 2 are sequential (1½ needs only the engine and Phase 1's screens). Phase 3 can start as soon as Phase 2's function exists. Phase 4 is independent after Phase 2.

---

## 7. Decisions the owner has to make before Phase 0

1. **Map source — decided 2026-11-20:** transcribed from the owner's board photos (Appendix A). Open sub-question: **does the suburb connect to the city across the seam** (16↔21 … 20↔25)? The rulebook places the suburb "under" the city and question card 6 asks "city or suburb", which only makes sense if the killer can cross. The plan assumes **yes, all five seam pairs are adjacent**; confirm from the printed rules or one physical game.
2. **Referee.** (a) Cloud Function `cerealAct` (recommended, cheat-proof, detective never waits for the killer) vs (b) no function: the killer's client commits each day's path to an append-only owner-only doc and answers questions itself; everyone verifies at reveal. (b) saves a function deploy but every question blocks on the killer being online, and a modified client can lie until the reveal.
3. **Ambiguous compass answers**: function auto-picks the less informative truthful direction (recommended) vs the killer chooses (one more round trip per question).
4. **Rewards**: none (recommended) · a fixed Beri for finishing a game · achievements only.
5. **Entry point**: `🥣` chip on the home activity row (recommended) · an Explore tile · a Mission card.
6. **Turn deadline default**: 48 h (recommended) · 24 h · none.

---

## Appendix A — Board transcription (from the owner's photos, 2026-11-20)

Legend: `H` house · `P` park (witness) · `C` café · `S` subway · `T` train station · `B` dog bowl · `.` street (the printed compass rose on A-20 and B-3 is decoration; both are plain street cells) · `–` no cell (track runs there).

Coordinates: `x` 1–5 left→right, `y` 1–4 city, 5–8 suburb (the suburb board sits directly under the city, so `y` continues and the seam adjacency 16↔21 … 20↔25 derives like any other; see §7 Q1). Orthogonal adjacency is **derived** from `x,y`, never typed.

### Side A

```
city A              suburb A
 1H  2P  3H  4P  5H    21C 22B 23H 24P 25P
 6.  7C  8H  9. 10S    26P 27H 28T 29H 30C
11H 12. 13P 14C 15H    31. 32H  –  33P 34H
16S 17. 18H 19H 20.    35T  –   –   –  36T
```

Subway A: `10 ↔ 16`. Train A: `35 – 28 – 36` (a Y whose junction is under 28: from 35 the track runs east along the bottom and curves up to 28; from 36 it runs west and curves up to 28; so 28 is the middle station).

Tallies — city A: 8 H (1 3 5 8 11 15 18 19) · 3 P (2 4 13) · 2 C (7 14) · S 10 16 · 5 street (6 9 12 17 20). Suburb A: 5 H (23 27 29 32 34) · 4 P (24 25 26 33) · 2 C (21 30) · B 22 · T 28 35 36 · 1 street (31). **Park 25 touches no house on its own board** (24 park, 30 café); across the seam it meets city cell 20 — a street on city A, a **house on city B**. So with A+A a witness can never stand there, with B+A it can. Keep it; it is how the board is printed.

### Side B

```
city B              suburb B
 1H  2.  3.  4C  5H    21H 22P 23B 24P 25T
 6.  7S  8H  9P 10H    26. 27H 28C 29H  –
11H 12C 13P 14S 15.    30T 31P 32H 33H  –
16P 17H 18H 19. 20H     –   –   –  34T  –
```

Subway B: `7 ↔ 14`. Train B: `30 – 34 – 25` (a line: from 30 the track drops to the bottom edge, runs east to 34, continues east then north up the empty column 5 to 25).

Tallies — city B: 8 H (1 5 8 10 11 17 18 20) · 3 P (9 13 16) · 2 C (4 12) · S 7 14 · 5 street (2 3 6 15 19). Suburb B: 5 H (21 27 29 32 33) · 3 P (22 24 31) · 1 C (28) · B 23 · T 25 30 34 · 1 street (26). Suburb B has 14 cells (21–34); suburb A has 16 (21–36).

### Data for `public/cereal-maps.js` (what Phase 0 types in)

```js
window.CEREAL_MAPS = {
  cityA: { cells: 'HPHPH .CH.S H.PCH S.HH.', subway: [[10, 16]] },
  cityB: { cells: 'H..CH .SHPH HCPS. PHH.H', subway: [[7, 14]] },
  suburbA: { rows: ['CBHPP', 'PHTHC', '.H-PH', 'T---T'], train: [35, 28, 36] },
  suburbB: { rows: ['HPBPT', '.HCH-', 'TPHH-', '---T-'], train: [30, 34, 25] },
};
// city: 20 chars (spaces ignored) read row by row = ids 1..20, y = 1..4
// suburb: 4 rows under the city (y = 5..8); '-' is no cell; ids continue from 21
// in reading order, skipping '-' (so suburb A = 21..36, suburb B = 21..34)
```

A loader turns those strings into `{ id, x, y, t }` cells; adjacency = cells whose `|dx|+|dy| = 1`; Bark adjacency = `max(|dx|,|dy|) = 1`. Keeping the source as strings makes a transcription slip visible at a glance next to the photo.

### Cross-checks against the rulebook's worked examples (all on side A)

| Example in the summary | On the transcription |
|---|---|
| Killer `8 › 3 › 2 › 1` may kill at 8, 3 or 1 | 8, 3, 1 are houses; 2 is a park, so not a kill cell ✓ |
| Kill at 3 → witness on an adjacent park, killer chose 4 "to keep distance" | 3 touches parks 2 and 4 (two options, killer picks) ✓; 4 is farther from the killer's end cell 1 ✓ |
| Killer leaves 5, enters subway at 10, exits 16, ends 17 = `10 › 16 › 17`, three steps | 5↔10 adjacent, 10↔16 is the subway pair, 16↔17 adjacent ✓; walking 5→17 takes 6 steps, double the ride (the rulebook says "more than double"; on this board it is exactly double) ✓ |
| Sniff: killer `5 › 4 › 3 › 8`, Lola sniffs 4, killer now at 8 answers W or S | 8 is at (3,2), 4 at (4,1): south-west, so `W` or `S` ✓ |
| Train: "enter at 30, to exit at 25 you must pass 34 first" (side B) | train B is `30 – 34 – 25` ✓ |
| Detective starts at a café; Lola starts at the bowl | every side has ≥1 café; each suburb has exactly one bowl ✓ |

### Still to confirm physically

- Seam adjacency city↔suburb (§7 Q1). If the answer is "no", `y` stays as is and the loader drops the five seam edges.
- Whether a `T` ride counts as one step per station hop (30→34 = 1, 34→25 = 1) or one step for the whole ride. The summary's wording ("works like the subway, but must follow the track in order") reads as **one step per hop**; the engine takes a flag.
