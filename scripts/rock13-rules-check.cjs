// V101.382 🪨 rock13-rules.js: the placing order, ⏭ Pass, 🌈, taking stones at 13, 👑, the new set after round 7, the ranking — and
// 2000 bot-only games that always end with every card and chip used, nobody acting twice in a round and 13 never left on a carrier.
const assert = require('node:assert/strict');
const path = require('node:path');
const R = require(path.resolve('public/rock13-rules.js'));
const P = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, bot: true }));

// order: 🌈 first, then high → low, a tie clockwise from 👑 (seat 2)
let g = R.create(P(4), 14, 2);
R.submit(g, 0, 3, 'r'); R.submit(g, 1, 5, 'g'); R.submit(g, 2, 3, 'b'); assert.equal(g.phase, 'submit', 'waits for everyone');
assert.equal(R.submit(g, 2, 4, 'r'), false, 'one pick a round');
R.submit(g, 3, 0, 'w');
assert.equal(g.phase, 'place'); assert.deepEqual(g.main, [3, 1, 2, 0], '🌈, 5, then the 3s clockwise from 👑 seat 2');
assert.equal(R.canPass(g, 1), false, 'only the one whose turn it is');
assert.equal(R.place(g, 3, 'x'), false, '🌈 needs a carrier');
R.place(g, 3, 'b');
// ⏭: seat 1 passes, seat 2 passes, seat 0 is the last in line → cannot pass while two passed are waiting? it can (someone is left)
assert.ok(R.pass(g, 1)); assert.ok(R.pass(g, 2));
assert.equal(R.turn(g), 0); assert.ok(R.canPass(g, 0), 'passers still wait, so seat 0 may pass');
R.place(g, 0, null);
assert.equal(R.turn(g), 2, 'the later passer places first'); assert.equal(R.canPass(g, 2), false, 'no second pass');
R.place(g, 2, null); assert.equal(R.turn(g), 1, 'the first to pass places last'); R.place(g, 1, null);
assert.equal(g.phase, 'submit'); assert.equal(g.round, 2);
assert.deepEqual(g.stands, { r: [3], g: [5], b: [0, 3] });

// the last one left cannot pass
g = R.create(P(2), 7, 0); R.submit(g, 0, 6, 'r'); R.submit(g, 1, 1, 'r');
assert.ok(R.canPass(g, 0)); R.place(g, 0, null); assert.equal(R.canPass(g, 1), false, 'last in the round: no ⏭');

// 13: take every stone that was there (a 0 counts), keep yours; the last taker holds 👑
g = R.create(P(3), 14, 0);
g.stands.g = [6, 4, 0]; g.stands.b = [6, 6];
R.submit(g, 0, 3, 'g'); R.submit(g, 1, 2, 'r'); R.submit(g, 2, 1, 'b');
assert.deepEqual(R.preview(g, 0, 'g'), { st: 'g', total: 13, take: 3 });
R.place(g, 0, null); R.place(g, 1, null); R.place(g, 2, null);
assert.deepEqual(g.stands, { r: [2], g: [3], b: [1] }); assert.deepEqual(g.players.map((p) => p.pen), [3, 0, 2]);
assert.equal(g.first, 2, 'the last one to take stones holds 👑');
assert.deepEqual(R.ranking(g), [1, 2, 0], 'fewest 🪨 first');
g.players[0].pen = 2; assert.deepEqual(R.ranking(g), [1, 0, 2], 'a tie: the one who took longer ago ranks higher');
assert.equal(R.lightest({ stands: { r: [5], g: [1, 1, 3], b: [2, 2] } }), 'b', 'lightest = smallest sum, then fewer stones');
assert.equal(R.lightest({ stands: { r: [5], g: [1, 1, 3], b: [2, 3] } }), 'r', 'a tie in weight: fewer stones');

// 2000 bot games
let seed = 7; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const tally = { pass: 0, take: 0, w: 0 };
for (let k = 0; k < 2000; k++) {
  const n = 3 + (k % 5), rounds = k % 3 ? 14 : 7;
  g = R.create(P(n), rounds, k % n);
  for (let guard = 0; g.phase !== 'end' && guard < 1000; guard++) {
    if (g.phase === 'submit') { for (let s = 0; s < n; s++) { const b = R.botPick(g, s, rng); assert.ok(R.submit(g, s, b.card, b.chip), 'a bot pick is legal'); } continue; }
    const s = R.turn(g), t = R.botTurn(g, s);
    if (t.pass) { assert.ok(R.pass(g, s)); tally.pass++; } else { const r = R.place(g, s, t.pick); assert.ok(r, 'a bot placement is legal'); if (r.take) tally.take++; if (g.subs[s] && g.subs[s].chip === 'w') tally.w++; }
    for (const st of R.ST) assert.ok(R.sum(g.stands[st]) < 13 || g.stands[st].length === 1, 'never 13+ with old stones still there');
  }
  assert.equal(g.phase, 'end', 'the game ends');
  for (const p of g.players) { assert.deepEqual(p.cards, [], 'every card used'); assert.deepEqual(p.chips, { r: 0, g: 0, b: 0, w: 0 }, 'every chip used'); }
  const placed = g.log.filter((x) => x.k === 'place').length; assert.equal(placed, n * rounds, 'everyone places once a round');
}
assert.ok(tally.pass > 0 && tally.take > 0, 'bots pass and stones get taken ' + JSON.stringify(tally));
console.log('rock13-rules-check: OK — order 🌈 → high → 👑 clockwise; ⏭ once, first to pass places last, never the last one; 13 takes the old stones (0 counts); 👑 to the last taker; ranking; 2000 bot games legal to the end ' + JSON.stringify(tally));
