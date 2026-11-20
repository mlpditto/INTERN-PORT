// 🥣 Cereal Killer Phase 0: the rules engine in public/cereal-rules.js, driven by the rulebook's own worked
// examples (docs/CEREAL-KILLER-PLAN.md §1 + Appendix A "Cross-checks") and the edge cases around them:
// the killer's exact-3 path with subway, blocking and cornering; kill + witness placement; the no-kill day;
// the calendar minimums; every question card; the detective's café bonus and arrest reach; Lola's moves,
// abilities, Sniff and Bark; the train on side B. No DOM, no Firebase — the same file the page will load.
const assert = require('node:assert/strict');
const MAPS = require('../public/cereal-maps.js');
const R = require('../public/cereal-rules.js');

const A = R.buildMap(MAPS, 'A', null);        // 2-player, side A — every rulebook example is drawn on it
const AA = R.buildMap(MAPS, 'A', 'A');        // 3-player
const BB = R.buildMap(MAPS, 'B', 'B');
const ok = (r, msg) => assert.ok(r.ok, msg + ' (got ' + JSON.stringify(r) + ')');
const bad = (r, error, msg) => { assert.ok(!r.ok, msg + ' should fail'); if (error) assert.equal(r.error, error, msg + ' error'); };

// ---- killer movement: "8 › 3 › 2 › 1" ------------------------------------------------------------------
ok(R.validatePath(A, [8, 3, 2, 1], { steps: 3, exact: true }), 'the rulebook path 8›3›2›1');
assert.deepEqual(R.killOptions(A, [8, 3, 2, 1]), [8, 3, 1], 'may kill at 8, 3 or 1 — 2 is a park');
assert.deepEqual(R.witnessOptions(A, 3), [2, 4], 'a kill at 3 puts the witness in park 2 or 4');
assert.deepEqual(R.witnessOptions(A, 1), [2], 'a kill at 1 has only park 2');
assert.deepEqual(R.witnessOptions(A, 8), [13], 'a kill at 8 has only park 13');
assert.deepEqual(R.witnessOptions(A, 15), [], 'house 15 touches no park — no witness that day');

const ctx = { blocked: [], taken: [], kills: 0, skipUsed: false };
let t = R.validateKillerTurn(A, { path: [8, 3, 2, 1], kill: 3, witness: 4 }, ctx);
ok(t, 'kill at 3, witness at 4 "to keep distance"'); assert.equal(t.kills, 1); assert.equal(t.witness, 4);
ok(R.validateKillerTurn(A, { path: [8, 3, 2, 1], kill: 3, witness: 2 }, ctx), 'witness at 2 is the other legal choice');
bad(R.validateKillerTurn(A, { path: [8, 3, 2, 1], kill: 3, witness: null }, ctx), 'witness', 'a park exists → witness required');
bad(R.validateKillerTurn(A, { path: [8, 3, 2, 1], kill: 3, witness: 13 }, ctx), 'witness', 'park 13 is not adjacent to 3');
bad(R.validateKillerTurn(A, { path: [8, 3, 2, 1], kill: 2, witness: null }, ctx), 'kill', 'cannot kill in a park');
bad(R.validateKillerTurn(A, { path: [8, 3, 2, 1], kill: 11, witness: null }, ctx), 'kill', 'house 11 is not on the path');
bad(R.validateKillerTurn(A, { path: [1, 2, 3, 4], kill: 3, witness: 4 }, ctx), 'end-on-witness', 'may not end the turn on the witness park');
ok(R.validateKillerTurn(A, { path: [1, 2, 3, 4], kill: 3, witness: 2 }, ctx), 'ending on the OTHER park is fine');
t = R.validateKillerTurn(A, { path: [11, 12, 17, 16], kill: 11, witness: null }, ctx);
ok(t, 'house 11 touches no park: kill without a witness'); assert.equal(t.witness, null);
bad(R.validateKillerTurn(A, { path: [11, 12, 17, 16], kill: 11, witness: 13 }, ctx), 'witness', 'no park → no witness allowed');
bad(R.validateKillerTurn(A, { path: [8, 3, 2, 1], kill: 3, witness: 4 }, { ...ctx, taken: [3] }), 'kill', 'a house already holding cereal');
bad(R.validateKillerTurn(A, { path: [8, 3, 2, 1], kill: 3, witness: 4 }, { ...ctx, kills: 6 }), 'max', 'six tokens is the box');
bad(R.validateKillerTurn(A, { path: [8, 3, 2], kill: null, witness: null }, ctx), 'short', 'exactly three steps, not two');
bad(R.validateKillerTurn(A, { path: [8, 3, 2, 1, 6], kill: null, witness: null }, ctx), 'long', 'exactly three steps, not four');
ok(R.validateKillerTurn(A, { path: [8, 3, 4, 9], kill: null, witness: null }, ctx), '8›3›4›9 is a legal walk (3 and 4 share a row)');
ok(R.validateKillerTurn(A, { path: [8, 9, 14, 19], kill: 19, witness: null }, ctx), '8›9›14›19 is legal and 19 touches no park');
bad(R.validateKillerTurn(A, { path: [8, 13, 19, 18], kill: null, witness: null }, ctx), 'hop:13-19', '13 and 19 are diagonal — never a step');
ok(R.validateKillerTurn(A, { path: [8, 3, 8, 3], kill: 3, witness: 4 }, ctx), 'backtracking is allowed');

// the no-kill day: once per game
t = R.validateKillerTurn(A, { path: [6, 7, 12, 17], kill: null, witness: null }, ctx);
ok(t, 'one day without a victim'); assert.equal(t.skipUsed, true); assert.equal(t.kills, 0);
bad(R.validateKillerTurn(A, { path: [6, 7, 12, 17], kill: null, witness: null }, { ...ctx, skipUsed: true }), 'skip', 'a second quiet day');
bad(R.validateKillerTurn(A, { path: [6, 7, 12, 17], kill: null, witness: 13 }, ctx), 'witness', 'no kill → no witness');

// ---- subway: "5 → S10 → 16 → 17 = 10 › 16 › 17, more than twice as fast" ---------------------------------
ok(R.validatePath(A, [5, 10, 16, 17], { steps: 3, exact: true }), 'subway ride is one step');
bad(R.validatePath(A, [5, 10, 16, 17], { steps: 3, exact: true, canRide: false }), 'hop:10-16', 'without riding, 10 and 16 are far apart');
assert.equal(R.distance(A, 5, 17, { canRide: false }), 6, 'walking 5→17 takes 6 steps — double the ride (the rulebook says "more than double"; on this board it is exactly double)');
assert.equal(R.distance(A, 5, 17), 3, 'riding, 3');
ok(R.validatePath(A, [10, 16], { steps: 1 }), 'one may end the turn on an S cell');

// ---- blocked by the detective / cornered -----------------------------------------------------------------
bad(R.validatePath(A, [5, 10, 16, 17], { steps: 3, exact: true, blocked: [10] }), 'hop:5-10', 'the detective standing on the station blocks the ride');
bad(R.validatePath(A, [8, 3, 2, 1], { steps: 3, exact: true, blocked: [2] }), 'hop:3-2', 'may not pass through the detective');
assert.ok(!R.cornered(A, 1, [6]), 'corner house 1 with the detective at 6 still has 2→…');
assert.ok(R.cornered(A, 1, [2, 6]), 'detective at 2 and Lola at 6 corner the killer at 1 → killer loses');
assert.ok(!R.cornered(A, 16, [11, 17]), 'at the S cell 16, blocked on both sides, the subway still saves him');
assert.ok(!R.cornered(A, 16, [11, 10]), 'from 16 with 11 and the far station 10 blocked, 16→17→12→7 is still a legal walk');
assert.ok(R.cornered(A, 16, [17, 10]) === false || R.legalPaths(A, 16, 3, { exact: true, blocked: [17, 10] }).length === 0, 'cornered agrees with legalPaths');
assert.ok(R.cornered(A, 16, [17, 10]) === (R.legalPaths(A, 16, 3, { exact: true, blocked: [17, 10] }).length === 0));
for (const p of R.legalPaths(A, 8, 3, { exact: true })) ok(R.validatePath(A, p, { steps: 3, exact: true }), 'legalPaths only yields valid paths');
assert.ok(R.legalPaths(A, 8, 3, { exact: true }).length > 20, 'house 8 has plenty of three-step walks');

// ---- calendar ----------------------------------------------------------------------------------------------
assert.equal(R.calendarOk(1, 0), true); assert.equal(R.calendarOk(2, 0), false); assert.equal(R.calendarOk(2, 1), true);
assert.equal(R.calendarOk(3, 1), true); assert.equal(R.calendarOk(4, 2), false); assert.equal(R.calendarOk(4, 3), true);
assert.equal(R.calendarOk(6, 3), true); assert.equal(R.calendarOk(7, 5), false); assert.equal(R.calendarOk(7, 6), true);

// ---- question cards ---------------------------------------------------------------------------------------
// killer at 8 after 5›4›3›8, witness at 4: 8 is south-west of 4
assert.deepEqual(R.answer(A, 'dir', 8, 4).sort(), ['S', 'W']);
assert.deepEqual(R.answer(A, 'dir', 1, 13).sort(), ['N', 'W'], 'north-west of the witness → "N" or "W", killer picks');
assert.deepEqual(R.answer(A, 'dir', 9, 4), ['S'], 'straight below → one answer');
assert.deepEqual(R.answer(A, 'dir', 5, 4), ['E']);
assert.deepEqual(R.answer(A, 'row', 8, 4), ['no']); assert.deepEqual(R.answer(A, 'row', 5, 4), ['yes']);
assert.deepEqual(R.answer(A, 'col', 8, 4), ['no']); assert.deepEqual(R.answer(A, 'col', 9, 4), ['yes']);
assert.deepEqual(R.answer(A, 'building', 8, 4), ['yes'], 'house');
assert.deepEqual(R.answer(A, 'building', 7, 4), ['yes'], 'café');
assert.deepEqual(R.answer(A, 'building', 10, 4), ['yes'], 'subway');
assert.deepEqual(R.answer(AA, 'building', 28, 4), ['yes'], 'train station');
assert.deepEqual(R.answer(A, 'building', 6, 4), ['no'], 'street');
assert.deepEqual(R.answer(A, 'building', 13, 4), ['no'], 'park');
assert.deepEqual(R.answer(AA, 'building', 22, 4), ['no'], 'the bowl is not a building');
assert.deepEqual(R.answer(A, 'parity', 8, 4), ['even']); assert.deepEqual(R.answer(A, 'parity', 3, 4), ['odd']);
assert.deepEqual(R.answer(AA, 'area', 8, 4), ['city']); assert.deepEqual(R.answer(AA, 'area', 21, 4), ['suburb']);
assert.throws(() => R.answer(A, 'colour', 8, 4), /unknown question/);
// auto-pick between two true directions = the one that leaves more cells possible
assert.equal(R.leastInformative(A, 13, ['N', 'W']), 'N', 'from 13: north = rows 1–2 (10 cells) beats west = cols 1–2 (8 cells)');
assert.equal(R.cellsInDirection(A, 4, 'S').length, 15); assert.equal(R.cellsInDirection(A, 4, 'W').length, 12);
assert.equal(R.leastInformative(A, 4, ['S', 'W']), 'S', 'from 4: south (15 cells) tells less than west (12)');
assert.deepEqual(R.cellsInDirection(A, 13, 'N').length, 10);

// ---- detective ----------------------------------------------------------------------------------------------
assert.deepEqual(R.detectiveStartOptions(A), [7, 14], 'starts at a café');
assert.deepEqual(R.killerHomeOptions(A), [1, 3, 5, 8, 11, 15, 18, 19]);
let d = R.validateDetectivePath(A, [9, 14, 19]);
ok(d, 'the rulebook post "9 → 14 (café +1) → 19"'); assert.equal(d.bonus, true);
ok(R.validateDetectivePath(A, [9, 14, 19, 18, 13]), 'café bonus → four steps');
bad(R.validateDetectivePath(A, [9, 14, 19, 18, 13, 12]), 'long', 'never five');
bad(R.validateDetectivePath(A, [7, 8, 9, 10, 15]), 'long', 'starting ON the café earns nothing');
d = R.validateDetectivePath(A, [9, 14, 9, 14, 19]); ok(d, 'passing the same café twice'); assert.equal(d.bonus, true);
bad(R.validateDetectivePath(A, [9, 14, 9, 14, 9, 14]), 'long', '…still only +1');
ok(R.validateDetectivePath(A, [9]), 'may stay put');
ok(R.validateDetectivePath(A, [15, 10, 16]), 'the detective rides the subway too');
ok(R.validateDetectivePath(A, [8, 3, 8]), 'and may backtrack');
assert.ok(R.arrestValid(A, 19, 19), 'arrest on own cell'); assert.ok(R.arrestValid(A, 19, 14), 'or a neighbour');
assert.ok(!R.arrestValid(A, 19, 13), 'not diagonal'); assert.ok(!R.arrestValid(A, 19, 9), 'not two away');
assert.ok(!R.arrestValid(A, 10, 16), 'the subway partner is not "adjacent" for an arrest');
assert.ok(R.canQuestion(A, 9, 4) && R.canQuestion(A, 4, 4) && !R.canQuestion(A, 8, 4) && !R.canQuestion(A, 9, null));

// ---- Lola -----------------------------------------------------------------------------------------------------
assert.equal(R.lolaStart(AA), 22, 'starts at the bowl'); assert.equal(R.lolaStart(BB), 23); assert.equal(R.lolaStart(A), null);
ok(R.validateLolaPath(AA, [22, 21, 26, 31, 35]), 'four steps; starting on the bowl earns nothing');
bad(R.validateLolaPath(AA, [22, 21, 26, 31, 35, 31]), 'long', 'five is too many from the bowl');
let l = R.validateLolaPath(AA, [21, 22, 23, 24, 25, 30]); ok(l, 'bowl passed → five steps'); assert.equal(l.bonus, true);
bad(R.validateLolaPath(AA, [21, 22, 23, 24, 25, 30, 34]), 'long', 'never six');
bad(R.validateLolaPath(AA, [16, 10]), 'hop:16-10', 'Lola does not ride the subway');
ok(R.validateLolaPath(AA, [11, 16]), '…but may stand on the station');
bad(R.validateLolaPath(AA, [28, 35]), 'hop:28-35', 'nor the train');
l = R.validateLolaPath(AA, [9, 14, 19, 18, 13]); ok(l, 'cafés give Lola nothing — four steps is her normal budget'); assert.equal(l.bonus, false);
ok(R.validateLolaPath(AA, [16, 21, 26]), 'Lola crosses the seam into the suburb on foot');
assert.ok(R.lolaAbilityOk('bark', 'sniff') && !R.lolaAbilityOk('sniff', 'sniff') && R.lolaAbilityOk('sniff', null) && !R.lolaAbilityOk('howl', null));
// Sniff: "killer 5 › 4 › 3 › 8, Lola sniffs 4 → the killer points W or S"
assert.deepEqual(R.sniff(AA, [5, 4, 3, 8], 4, 8).sort(), ['S', 'W']);
assert.deepEqual(R.sniff(AA, [5, 4, 3, 8], 8, 8), ['center'], 'sniffing the cell he stands on');
assert.deepEqual(R.sniff(AA, [5, 4, 3, 8], 5, 8).sort(), ['S', 'W'], 'the start cell counts as "was there"; 8 is south-west of 5');
assert.deepEqual(R.sniff(AA, [5, 4, 3, 8], 3, 8), ['S'], 'straight below the sniffed cell → one direction');
assert.deepEqual(R.sniff(AA, [5, 4, 3, 8], 9, 8), ['no'], 'never there today');
// Bark: 8-neighbourhood
assert.equal(R.bark(AA, 9, 13), 'yes', 'diagonal counts for Bark'); assert.equal(R.bark(AA, 9, 9), 'yes', 'same cell');
assert.equal(R.bark(AA, 9, 14), 'yes'); assert.equal(R.bark(AA, 9, 1), 'no'); assert.equal(R.bark(AA, 9, 19), 'no', 'two rows away');
assert.equal(R.bark(AA, 20, 25), 'yes', 'Bark hears across the seam'); assert.equal(R.bark(AA, 19, 25), 'yes', 'diagonally across the seam too');
// Bite = arrest reach
assert.ok(R.arrestValid(AA, 22, 23) && !R.arrestValid(AA, 22, 28));

// ---- train, side B: "enter at 30, to exit at 25 you must pass 34 first" --------------------------------------
ok(R.validatePath(BB, [26, 30, 34, 25], { steps: 3, exact: true }), '30 → 34 → 25 in two steps after reaching 30');
bad(R.validatePath(BB, [30, 25], { steps: 1 }), 'hop:30-25', 'no skipping the middle station');
ok(R.validatePath(BB, [25, 34, 30], { steps: 2 }), 'the track runs both ways');
ok(R.validateDetectivePath(BB, [26, 30, 34, 25]), 'the detective rides the train too');
assert.deepEqual(R.answer(BB, 'area', 25, 9), ['suburb']);

// ---- seam -------------------------------------------------------------------------------------------------------
assert.ok(R.neighbors(AA, 16).includes(21) && R.neighbors(AA, 21).includes(16), 'city and suburb touch');
const cut = R.buildMap(MAPS, 'A', 'A', { seam: false });
assert.ok(!R.neighbors(cut, 16).includes(21), 'seam:false keeps them apart');
assert.ok(!R.neighbors(A, 16).includes(21), 'no suburb, no seam');

console.log('cereal-rules-check: OK — killer path/kill/witness/skip, subway, blocking, cornered, calendar, 6 question cards, detective café bonus + arrest, Lola moves/abilities/sniff/bark, train B, seam');
