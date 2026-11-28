// V101.402 🌙 midnight-rules.js: the decks, the deal, the two passes (➡ then ⬅), what you may swap with, 📡 (players only, +3 to the
// one it is taken from), 👁 once, what each seat knows after public swaps, the reveal (number × Fence cards of the kind), who starts
// next, the secret-partner ring and final = own × partner — and 3000 bot-only games that always end after 3 heists × 2 swaps each.
const assert = require('node:assert/strict');
const path = require('node:path');
const R = require(path.resolve('public/midnight-rules.js'));
const P = (n, lv) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, bot: true, level: lv || 1 }));
const C = (s) => ({ k: s[0], n: +s.slice(1) });
const key = (c) => c.k + c.n;
/** put known cards on the table: hands, then the 3 Fence slots, then the Bin */
function set(g, hands, fence, bin) {
    hands.forEach((s, i) => { g.at['p' + i] = C(s); g.know[i] = { ['p' + i]: g.at['p' + i] }; });
    fence.forEach((s, i) => { g.at['f' + i] = C(s); }); g.at.b = C(bin);
}

// the decks: seats + 4 cards, 4 kinds + 📡
for (let n = 4; n <= 7; n++) {
    const d = R.deck(n); assert.equal(d.length, n + 4, n + ' seats: seats + 4 cards');
    assert.equal(new Set(d.map(key)).size, d.length, 'every card is one of a kind');
    assert.deepEqual([...new Set(d.map((c) => c.k))].sort(), ['A', 'C', 'G', 'J', 'T']);
    assert.ok(d.filter((c) => c.k === 'T').every((c) => c.n < 0) && d.filter((c) => c.k !== 'T').every((c) => c.n > 0), '📡 minus, loot plus');
    assert.equal(d.filter((c) => c.k === 'T').length, n === 4 ? 1 : 2);
}
assert.throws(() => R.create(P(3), 1)); assert.throws(() => R.create(P(8), 1));

// the deal: one each, 3 at the Fence, 1 in the Bin; you know your own card only; one ring of partners through all seats
let g = R.create(P(5), 42);
assert.equal(g.heist, 1); assert.equal(g.phase, 'swap'); assert.equal(g.pass, 1);
assert.deepEqual(R.slots(g), ['p0', 'p1', 'p2', 'p3', 'p4', 'f0', 'f1', 'f2', 'b']);
assert.deepEqual(R.slots(g).map((k) => key(g.at[k])).sort(), R.deck(5).map(key).sort(), 'the whole deck is on the table');
g.know.forEach((K, i) => assert.deepEqual(Object.keys(K), ['p' + i]));
{ let s = 0; const seen = []; for (let i = 0; i < 5; i++) { seen.push(s); s = g.partner[s]; } assert.equal(s, 0); assert.equal(new Set(seen).size, 5, 'one ring, nobody is their own partner'); }
assert.deepEqual(R.create(P(5), 42).at, g.at, 'the same seed deals the same game');

// ➡ pass 1 clockwise from the starter, ⬅ pass 2 the other way; everyone swaps exactly twice; out of turn does nothing
g = R.create(P(4), 7); g.first = 2; set(g, ['C1', 'C2', 'A2', 'A3'], ['G4', 'G5', 'J6'], 'T-5');
assert.deepEqual(R.queue(g), [2, 3, 0, 1]); assert.equal(R.turn(g), 2);
assert.equal(R.swap(g, 0, 'b'), false, 'not your turn'); assert.equal(R.swap(g, 2, 'p2'), false, 'not with yourself'); assert.equal(R.swap(g, 2, 'f3'), false);
assert.ok(R.swap(g, 2, 'f0')); assert.deepEqual([g.at.p2, g.at.f0].map(key), ['G4', 'A2']);
assert.ok(R.swap(g, 3, 'p0')); assert.ok(R.swap(g, 0, 'b')); assert.ok(R.swap(g, 1, 'f1'));
assert.equal(g.pass, 2); assert.deepEqual(R.queue(g), [1, 0, 3, 2], 'pass 2 runs backwards'); assert.equal(R.turn(g), 1);
assert.deepEqual(g.log.map((l) => l.by + '>' + l.to + '@' + l.pass), ['2>f0@1', '3>p0@1', '0>b@1', '1>f1@1'], 'the public log: who with what, no faces');

// 📡: seat 0 took it from the Bin → may only swap with a player; taking a 📡 from a hand gives that hand +3 at once
assert.equal(key(g.at.p0), 'T-5');
assert.ok(R.swap(g, 1, 'p0')); assert.equal(g.bonus[0], 3, '+3 to the one the 📡 was taken from'); assert.equal(g.log[4].bonus, 0);
assert.equal(key(g.at.p1), 'T-5'); assert.equal(key(g.at.p0), 'G5');
assert.ok(R.swap(g, 0, 'f2'));   // seat 0: G5 → Fence, takes J6
assert.deepEqual(R.targets(g, 3), ['p0', 'p1', 'p2', 'f0', 'f1', 'f2', 'b']);
assert.ok(R.swap(g, 3, 'b'));
// seat 2 holds G4 → all targets; seat 1 (📡) would have players only
assert.deepEqual(R.targets(g, 1), ['p0', 'p2', 'p3'], 'a 📡 in hand: players only');
assert.ok(R.swap(g, 2, 'p3'));
// the reveal: Fence = A2 C2 G5 → loot scores number × Fence cards of its kind; 📡 its minus; bonus on top
assert.equal(g.phase, 'show'); assert.equal(R.turn(g), -1);
assert.deepEqual(['f0', 'f1', 'f2', 'b'].map((k) => key(g.at[k])), ['A2', 'C2', 'G5', 'C1']);
assert.deepEqual(g.res.map((r) => key(r.card) + ':' + r.mult + ':' + r.pts + '+' + r.bonus), ['J6:0:0+3', 'T-5:0:-5+0', 'A3:1:3+0', 'G4:1:4+0']);
assert.deepEqual(g.players.map((p) => p.total), [3, -5, 3, 4]);
assert.equal(g.next, 1, 'the 📡 holder starts the next heist');
assert.ok(R.next(g)); assert.equal(g.heist, 2); assert.equal(g.first, 1); assert.equal(g.phase, 'swap'); assert.deepEqual(g.bonus, [0, 0, 0, 0]);

// two Fence cards of a kind double it; nobody holds a 📡 → the next seat starts
g = R.create(P(4), 9); g.first = 3; set(g, ['A4', 'G4', 'C1', 'J6'], ['A2', 'A3', 'G5'], 'C2'); g.pass = 2; g.ti = 3;   // the last swap of the heist
assert.equal(R.turn(g), 3); assert.ok(R.swap(g, 3, 'b'));
assert.equal(g.res[0].pts, 8, '🖼 4 × 2 Fence 🖼'); assert.equal(g.res[1].pts, 4); assert.equal(g.res[3].pts, 0, '💵 is not in the Fence'); assert.equal(g.next, 0, 'no 📡 in a hand: the next seat');

// 👁 once a game, on your turn, a Fence slot or the Bin; knowledge moves with the public swaps
g = R.create(P(4), 3); g.first = 0; set(g, ['C1', 'C2', 'A2', 'A3'], ['G4', 'G5', 'J6'], 'T-5');
assert.equal(R.peek(g, 1, 'f0'), null, 'not your turn'); assert.equal(R.peek(g, 0, 'p1'), null, 'never a hand');
assert.equal(key(R.peek(g, 0, 'f1')), 'G5'); assert.equal(R.peek(g, 0, 'b'), null, 'once'); assert.equal(g.players[0].peek, 0);
assert.ok(R.swap(g, 0, 'f1'));   // seat 0 takes the G5 it saw and leaves C1 there
assert.deepEqual(Object.fromEntries(Object.entries(g.know[0]).map(([k, c]) => [k, key(c)])), { p0: 'G5', f1: 'C1' }, 'I know my new card and what I left');
assert.ok(R.swap(g, 1, 'p0'));   // seat 1 takes it from seat 0
assert.deepEqual(Object.fromEntries(Object.entries(g.know[0]).map(([k, c]) => [k, key(c)])), { p0: 'C2', f1: 'C1', p1: 'G5' }, 'I still know where my old card went');
assert.deepEqual(Object.fromEntries(Object.entries(g.know[1]).map(([k, c]) => [k, key(c)])), { p1: 'G5', p0: 'C2' });
assert.ok(R.swap(g, 2, 'p1'));   // seat 2 takes the G5: seat 0 follows it, seat 2 learns it, seat 3 knows nothing new
assert.equal(key(g.know[0].p2), 'G5'); assert.equal(g.know[0].p1, undefined, 'seat 1 now holds a card I never saw'); assert.deepEqual(Object.keys(g.know[3]), ['p3']);
for (const K of g.know) for (const [k, c] of Object.entries(K)) assert.equal(key(c), key(g.at[k]), 'what a seat knows is true');

// the end: final = own total × the partner's total; ranking by final, then own total
g = R.create(P(4), 5); g.partner = [1, 2, 3, 0]; g.heist = 3; g.phase = 'show'; [12, -6, 4, -2].forEach((t, i) => { g.players[i].total = t; });
assert.ok(R.next(g)); assert.equal(g.phase, 'end'); assert.deepEqual(g.final, [-72, -24, -8, -24]);
assert.deepEqual(R.ranking(g), [2, 3, 1, 0], 'a tie on the final goes to the higher own total'); assert.equal(R.next(g), false);

// 3000 bot-only games, every size and level: they end, everyone swapped twice a heist, knowledge stays true, a 📡 holder never swaps with the table
const stat = {};
for (let i = 0; i < 3000; i++) {
    const n = 4 + (i % 4), lv = 1 + (i % 3); g = R.create(P(n, lv), 1000 + i);
    const tot = stat[n] = stat[n] || { games: 0, pts: 0, zero: 0, cards: 0, lv: { 1: 0, 2: 0, 3: 0 }, lvN: { 1: 0, 2: 0, 3: 0 } };
    if (i % 5 === 0) g.players.forEach((p, s) => { p.level = 1 + (s % 3); });   // mixed tables: does a higher level score more?
    let steps = 0;
    while (g.phase !== 'end') {
        assert.ok(++steps < 200, 'the game ends');
        if (g.phase === 'show') {
            assert.equal(g.log.length, 2 * n); for (let s = 0; s < n; s++) assert.equal(g.log.filter((l) => l.by === s).length, 2, 'two swaps each');
            g.res.forEach((r) => { tot.cards++; tot.pts += r.sum; if (!r.sum) tot.zero++; });
            R.next(g); continue;
        }
        const s = R.turn(g), m = R.botMove(g, s), held = g.at['p' + s];
        if (m.peek) assert.ok(R.peek(g, s, m.peek), 'a bot peeks only when it may');
        if (held.k === 'T') assert.equal(m.to[0], 'p');
        assert.ok(R.swap(g, s, m.to), 'a bot move is legal');
        for (const K of g.know) for (const [k, c] of Object.entries(K)) assert.equal(key(c), key(g.at[k]));
    }
    assert.equal(g.heist, 3); tot.games++;
    if (i % 5 === 0) g.players.forEach((p) => { tot.lv[p.level] += p.total; tot.lvN[p.level]++; });
    assert.deepEqual(g.final, g.players.map((p, s) => p.total * g.players[g.partner[s]].total));
}
const line = Object.keys(stat).map((n) => n + ' seats: ' + (stat[n].pts / stat[n].cards).toFixed(2) + ' pts/heist, ' + Math.round(100 * stat[n].zero / stat[n].cards) + '% zero, mixed 🥄 ' + [1, 2, 3].map((l) => (stat[n].lv[l] / Math.max(1, stat[n].lvN[l])).toFixed(1)).join(' / ')).join(' · ');
const all = [1, 2, 3].map((l) => Object.keys(stat).reduce((a, n) => a + stat[n].lv[l], 0) / Object.keys(stat).reduce((a, n) => a + stat[n].lvN[l], 0));
assert.ok(all[2] > all[0] && all[1] > all[0], 'a thinking bot scores more than a random one: ' + all.map((x) => x.toFixed(2)).join(' / '));
console.log('midnight-rules-check: OK — decks seats + 4; ➡ then ⬅, two swaps each; 📡 players only, +3 when taken; 👁 once; knowledge follows the swaps; number × Fence kind; ring of partners, final = own × partner; 3000 bot games end. ' + line);
