// Rank question scoring (public/rank-quiz.js) — pure functions, Node only. The worked examples shown to the owner (mock 2026-10-28) must come out as drawn.
const assert = require('node:assert/strict');
const R = require('../public/rank-quiz.js');

const Q = { type: 'rank', q: 'ผู้ป่วยหอบกำเริบ ยาตัวแรกที่ควรให้?', accepted: ['salbutamol', 'albuterol', 'ventolin'],
    options: ['Salbutamol พ่น', 'Ipratropium พ่น', 'Prednisolone กิน', 'Theophylline'], tiers: [0, 1, 1, 2], unsafe: [0, 0, 0, 0] };
const ans = (typed, order, m) => R.pack(typed, order, m);

// ---- typed-answer matching
assert.ok(R.autoMatch('Albuterol', Q.accepted) && R.autoMatch('  SALBUTAMOL!! ', Q.accepted), 'case / punctuation ignored');
assert.ok(R.autoMatch('ให้ ventolin พ่น', Q.accepted), 'an alias inside a longer answer');
assert.ok(R.autoMatch('salbutmol', Q.accepted), 'one typo on a 10-letter alias');
assert.ok(!R.autoMatch('prednisolone', Q.accepted) && !R.autoMatch('', Q.accepted) && !R.autoMatch('salb', Q.accepted), 'other drug / empty / too short → no');

// ---- phases + storage round-trip
assert.equal(R.phase(undefined, 4), 'type'); assert.equal(R.phase([], 4), 'type'); assert.equal(R.phase(['x'], 4), 'rank');
assert.equal(R.phase(['x', '0,1,2,3'], 4), 'reveal'); assert.equal(R.phase(['x', '0,1,2,2'], 4), 'rank', 'a broken order is not a lock');
assert.equal(R.phase(ans('albuterol', [0, 2, 1, 3], 2), 4), 'reveal', 'a stored (joined) answer reads back');
assert.deepEqual(R.parse(ans('a b', [3, 2, 1, 0], -1), 4), { typed: 'a b', locked: true, order: [3, 2, 1, 0], match: -1 });
assert.equal(ans('x'), 'x'); assert.equal(ans('x', [0, 1]), 'x\n---\n0,1'); assert.equal(ans('x', [0, 1], 1), 'x\n---\n0,1\n---\nm:1');

// ---- the worked examples (typed albuterol = best answer, so the typed part is 100%)
const ex = (order) => R.score(Q, ans('albuterol', order));
let s = ex([0, 2, 1, 3]);   // Salb, Pred, Ipra, Theo — Pred/Ipra share a tier
assert.deepEqual([s.top, s.pairOk, s.pairTotal, s.rank, s.credit, s.stars], [true, 5, 5, 1, 1, 5], 'perfect under tiers → ★5');
s = ex([0, 2, 3, 1]);       // the mock: Theo above Ipra costs one pair
assert.deepEqual([s.top, s.pairOk, s.pairTotal], [true, 4, 5]); assert.ok(Math.abs(s.rank - 0.9) < 1e-9 && Math.abs(s.credit - 0.92) < 1e-9 && s.stars === 4, '92% → ★4');
s = ex([1, 0, 2, 3]);       // Ipra first: top wrong, 4 of 5 pairs
assert.deepEqual([s.top, s.pairOk, s.pairTotal, s.stars], [false, 4, 5, 2]); assert.ok(Math.abs(s.credit - 0.52) < 1e-9);
s = ex([3, 2, 1, 0]);       // reversed
assert.deepEqual([s.top, s.pairOk, s.stars], [false, 0, 1]); assert.ok(Math.abs(s.credit - 0.2) < 1e-9, 'only the typed part');

// ---- the typed part: auto match, self match by tier, "none", neither
assert.equal(R.score(Q, ans('คิดว่า ยาพ่น', [0, 1, 2, 3])).free, 0, 'no match, no self-match → 0');
assert.deepEqual([R.score(Q, ans('x', [0, 1, 2, 3], 0)).free, R.score(Q, ans('x', [0, 1, 2, 3], 1)).free, R.score(Q, ans('x', [0, 1, 2, 3], 3)).free, R.score(Q, ans('x', [0, 1, 2, 3], -1)).free], [1, 0.5, 0, 0], 'self-match: best 1 · acceptable ½ · avoid 0 · none 0');
assert.equal(R.score(Q, ans('albuterol', [0, 1, 2, 3], 3)).matched, 'auto', 'an auto match wins over a self-match');

// ---- safety: an unsafe option above a best option caps the credit at 0.6 (⇒ ★3) and flags it
const Q2 = { ...Q, tiers: [0, 0, 1, 2], unsafe: [0, 0, 1, 0] };
s = R.score(Q2, ans('albuterol', [0, 2, 1, 3]));
assert.ok(s.safetyMiss && Math.abs(s.credit - 0.6) < 1e-9 && s.stars === 3, 'high credit but a safety miss → ★3');
assert.ok(!R.score(Q2, ans('albuterol', [0, 1, 2, 3])).safetyMiss, 'unsafe below every best option is fine');

// ---- stars at the edges, and unfinished answers
assert.deepEqual([1, 0.95, 0.949, 0.8, 0.799, 0.6, 0.599, 0.4, 0.399, 0].map(R.stars), [5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
assert.equal(R.score(Q, ['albuterol']).credit, 0, 'no ranking yet → no credit'); assert.equal(R.score(Q, undefined).stars, 0);

// ---- a question the editor may save
assert.ok(R.valid(Q) && !R.valid({ ...Q, tiers: [1, 1, 1, 1] }) && !R.valid({ ...Q, tiers: [0, 0, 0, 0] }) && !R.valid({ ...Q, options: ['only'] }) && !R.valid({ ...Q, type: 'choice' }));
// ---- which options the reveal marks red
assert.deepEqual(R.misplaced(Q, [0, 2, 1, 3]), [], 'a perfect (tier-wise) order marks nothing');
assert.deepEqual(R.misplaced(Q, [0, 2, 3, 1]).sort(), [1, 3], 'Theophylline above Ipratropium → those two');
assert.deepEqual(R.misplaced(Q, null), []);
// ---- V101.231: tier-box mode is dispatched on q.mode only — an old question / answer is untouched (the full set of tier cases is in rank-tier-qa)
assert.equal(R.score({ ...Q, mode: 'tier', tiers: [0, 1, 1, 2] }, ans('albuterol', [0, 1, 1, 2])).credit, 1, 'tier mode reads part 2 as one level per option');
assert.equal(R.score({ ...Q, mode: '' }, ans('albuterol', [0, 2, 1, 3])).credit, 1, 'mode "" (nothing chosen in the editor) is still the order mode');
assert.ok(R.isTier({ mode: 'tier' }) && !R.isTier(Q));
console.log('rank-quiz-qa: all assertions passed');
