// 🥣 Cereal Killer Phase 0: the board data in public/cereal-maps.js against the transcription in
// docs/CEREAL-KILLER-PLAN.md Appendix A. Per side: cell counts by type, contiguous ids, a connected board, every
// cell with a neighbour, the subway pair on two S cells, the train chain on three T cells, one bowl per suburb,
// and the seam between city and suburb (five edges, droppable). Parks with no adjacent house are reported, not failed.
const assert = require('node:assert/strict');
const MAPS = require('../public/cereal-maps.js');
const R = require('../public/cereal-rules.js');

// Appendix A tallies — ids per type, straight from the photos.
const EXPECT = {
  cityA: { H: [1, 3, 5, 8, 11, 15, 18, 19], P: [2, 4, 13], C: [7, 14], S: [10, 16], T: [], B: [], '.': [6, 9, 12, 17, 20] },
  cityB: { H: [1, 5, 8, 10, 11, 17, 18, 20], P: [9, 13, 16], C: [4, 12], S: [7, 14], T: [], B: [], '.': [2, 3, 6, 15, 19] },
  suburbA: { H: [23, 27, 29, 32, 34], P: [24, 25, 26, 33], C: [21, 30], S: [], T: [28, 35, 36], B: [22], '.': [31] },
  suburbB: { H: [21, 27, 29, 32, 33], P: [22, 24, 31], C: [28], S: [], T: [25, 30, 34], B: [23], '.': [26] },
};
const SUBWAY = { A: [10, 16], B: [7, 14] }, TRAIN = { A: [35, 28, 36], B: [30, 34, 25] };

const ids = (map, pred) => map.ids.filter(pred);
const tally = (map, cityOrSuburb) => {
  const pick = id => cityOrSuburb === 'city' ? R.inCity(id) : !R.inCity(id);
  const out = {};
  for (const t of ['H', 'P', 'C', 'S', 'T', 'B', '.']) out[t] = ids(map, id => pick(id) && map.cells[id].t === t);
  return out;
};
const connected = map => {
  const seen = new Set([1]), q = [1];
  while (q.length) for (const n of R.neighbors(map, q.shift())) if (!seen.has(n)) { seen.add(n); q.push(n); }
  return seen.size === map.ids.length;
};
const notes = [];

for (const city of ['A', 'B']) {
  // city alone (2-player)
  const m = R.buildMap(MAPS, city, null);
  assert.deepEqual(m.ids, Array.from({ length: 20 }, (_, i) => i + 1), 'city ' + city + ' ids 1..20');
  assert.deepEqual(tally(m, 'city'), EXPECT['city' + city], 'city ' + city + ' tallies');
  assert.ok(connected(m), 'city ' + city + ' connected');
  for (const id of m.ids) assert.ok(R.neighbors(m, id).length >= 1, 'city ' + city + ' cell ' + id + ' has a neighbour');
  for (const id of m.ids) for (const n of R.neighbors(m, id)) assert.ok(R.neighbors(m, n).includes(id), 'adjacency symmetric ' + id + '↔' + n);
  const [a, b] = SUBWAY[city];
  assert.equal(m.subway[a], b); assert.equal(m.subway[b], a);
  assert.deepEqual(ids(m, id => m.cells[id].t === 'S').sort(), [a, b].sort(), 'city ' + city + ' has exactly the two S cells of its pair');
  assert.ok(R.stepTargets(m, a).includes(b) && !R.stepTargets(m, a, { canRide: false }).includes(b), 'subway is a step only when riding');
  assert.equal(m.train.length, 0, 'no train without a suburb');
  assert.equal(R.cellsOf(m, 'C').length, 2, 'two cafés for the detective to start from');
  assert.equal(R.cellsOf(m, 'H').length, 8, 'eight houses, six cereal tokens');

  for (const sub of ['A', 'B']) {
    const s = R.buildMap(MAPS, city, sub);
    const n = sub === 'A' ? 36 : 34;
    assert.deepEqual(s.ids, Array.from({ length: n }, (_, i) => i + 1), city + '+' + sub + ' ids 1..' + n);
    assert.deepEqual(tally(s, 'suburb'), EXPECT['suburb' + sub], 'suburb ' + sub + ' tallies');
    assert.ok(connected(s), city + '+' + sub + ' connected');
    for (const id of s.ids) assert.ok(R.neighbors(s, id).length >= 1, city + '+' + sub + ' cell ' + id + ' has a neighbour');
    assert.deepEqual(s.train, TRAIN[sub], 'train ' + sub + ' order');
    assert.deepEqual(ids(s, id => s.cells[id].t === 'T').sort(), TRAIN[sub].slice().sort(), 'suburb ' + sub + ': the three T cells are the three stations');
    const [t0, t1, t2] = TRAIN[sub];
    assert.ok(R.stepTargets(s, t0).includes(t1) && !R.stepTargets(s, t0).includes(t2), 'train ' + sub + ': end station reaches only the middle one');
    assert.ok(R.stepTargets(s, t1).includes(t0) && R.stepTargets(s, t1).includes(t2), 'train ' + sub + ': middle station reaches both ends');
    assert.ok(!R.stepTargets(s, t0, { canRide: false }).includes(t1), 'train ' + sub + ' needs riding');
    assert.equal(R.cellsOf(s, 'B').length, 1, 'one bowl in suburb ' + sub);
    assert.equal(R.lolaStart(s), EXPECT['suburb' + sub].B[0]);

    // the seam: exactly the five pairs 16↔21 … 20↔25 where both cells exist, and seam:false drops exactly those
    const seamPairs = [[16, 21], [17, 22], [18, 23], [19, 24], [20, 25]].filter(([, d]) => s.cells[d]);
    for (const [u, d] of seamPairs) assert.ok(R.neighbors(s, u).includes(d), 'seam ' + u + '↔' + d);
    const cut = R.buildMap(MAPS, city, sub, { seam: false });
    for (const [u, d] of seamPairs) assert.ok(!R.neighbors(cut, u).includes(d), 'seam:false drops ' + u + '↔' + d);
    const edges = m2 => m2.ids.reduce((k, id) => k + R.neighbors(m2, id).length, 0) / 2;
    assert.equal(edges(s) - edges(cut), seamPairs.length, 'seam:false removes only the seam edges');
    assert.ok(!connected(cut), 'without the seam the board falls into city and suburb');

    // parks that never get a witness: a note, not a failure. Suburb A's park 25 has no house beside it on its own
    // board; paired with city A (street at 20) it stays orphaned, paired with city B the house at B-20 sits above it.
    const orphan = ids(s, id => s.cells[id].t === 'P' && !R.neighbors(s, id).some(o => s.cells[o].t === 'H'));
    if (orphan.length) notes.push(city + '+' + sub + ': park(s) with no adjacent house → ' + orphan.join(', '));
    assert.deepEqual(orphan, city === 'A' && sub === 'A' ? [25] : [], city + '+' + sub + ' orphan parks');
  }
}

// difficulty table covers the four pairings once each
assert.deepEqual(MAPS.difficulty.map(d => d.city + d.suburb).sort(), ['AA', 'AB', 'BA', 'BB']);
assert.deepEqual(MAPS.difficulty.map(d => d.spoons), [1, 2, 3, 4]);

// bad input is loud
assert.throws(() => R.buildMap(MAPS, 'C', null), /unknown city side/);
assert.throws(() => R.buildMap(MAPS, 'A', 'Z'), /unknown suburb side/);
assert.throws(() => R.buildMap({ city: { A: { cells: 'HHH' } }, suburb: {} }, 'A', null), /needs 20 cells/);

for (const n of notes) console.log('note: ' + n);
console.log('cereal-maps-check: OK — 2 city sides × (alone + 2 suburbs), tallies, connectivity, S/T, seam');
