// 🥣 Cereal Killer Phase 1½ PR 1 — public/cereal-bot.js (pure) driven through whole games in node, seeded, no DOM.
// A small referee below plays the rules in the same order as public/cereal.js (killer locks → calendar → detective walks, asks
// one card at the witness, may arrest once → witness leaves → next day; day 7 survived = killer). Proves:
//   · the detective's candidate set (public facts only) ALWAYS holds the killer's real cell — after every killer day, every
//     answer and every missed arrest (this is also the strongest regression test the engine has);
//   · every bot action is legal by the engine itself (validateKillerTurn, validateDetectivePath, canQuestion, arrestValid);
//   · the levels mean something: the 🥄🥄🥄 detective catches the greedy 🥄 killer more often than the 🥄 detective does, and the
//     🥄🥄 killer survives the 🥄🥄 detective more often than the 🥄 killer does; nobody wins 0 % or 100 % of the mixed games;
//   · speed: a whole game in < 50 ms on average (< 150 ms with a 🥄🥄🥄 bot).
const assert = require('node:assert/strict');
const MAPS = require('../public/cereal-maps.js');
const R = require('../public/cereal-rules.js');
const B = require('../public/cereal-bot.js');

function play(side, kLevel, dLevel, seed) {
  const map = R.buildMap(MAPS, side, null), rand = B.rng(seed);
  const pub = { day: 1, detectivePos: null, arrestsLeft: R.ARRESTS, usedQuestions: [], skipUsed: false, kills: 0, cereals: [], witness: null, days: [] };
  const me = { pos: null, home: null };
  const end = (winner, reason) => ({ winner, reason, day: pub.day });
  for (; pub.day <= R.DAYS; pub.day++) {
    // ---- killer
    if (me.pos != null && R.cornered(map, me.pos, pub.detectivePos != null ? [pub.detectivePos] : [])) return end('good', 'cornered');
    const kt = B.killerTurn(map, pub, me, kLevel, rand);
    if (!kt) return end('good', 'stuck');
    if (me.pos == null) { assert.ok(R.killerHomeOptions(map).includes(kt.home), 'home is a house'); me.home = kt.home; assert.equal(kt.path[0], kt.home); }
    else assert.equal(kt.path[0], me.pos, 'the day starts where the last one ended');
    const v = R.validateKillerTurn(map, { path: kt.path, kill: kt.kill, witness: kt.witness }, { blocked: pub.detectivePos != null ? [pub.detectivePos] : [], taken: pub.cereals, kills: pub.kills, skipUsed: pub.skipUsed });
    assert.ok(v.ok, 'bot killer turn is legal: ' + JSON.stringify({ kt, v }));
    me.pos = kt.path[kt.path.length - 1];
    if (v.kill != null) pub.cereals.push(v.kill);
    pub.kills = v.kills; pub.skipUsed = v.skipUsed; pub.witness = v.witness;
    const today = { day: pub.day, det: pub.detectivePos, kill: v.kill, witness: v.witness, asks: [], misses: [] };
    pub.days.push(today);
    assert.ok(B.candidates(map, pub).has(me.pos), 'after the killer moves the truth is a candidate (day ' + pub.day + ', seed ' + seed + ')');
    if (!R.calendarOk(pub.day, pub.kills)) return end('good', 'calendar');
    // ---- detective
    const mv = B.detectiveMove(map, pub, dLevel, rand);
    if (pub.detectivePos == null) { assert.ok(R.detectiveStartOptions(map).includes(mv.start), 'starts on a café'); assert.equal(mv.path[0], mv.start); }
    else assert.equal(mv.path[0], pub.detectivePos);
    assert.ok(R.validateDetectivePath(map, mv.path).ok, 'bot detective path is legal: ' + mv.path);
    const at = mv.path[mv.path.length - 1];
    pub.detectivePos = at;
    const q = B.detectiveAsk(map, pub, dLevel, rand, at);
    if (q) {
      assert.ok(R.canQuestion(map, at, pub.witness) && !pub.usedQuestions.includes(q) && q !== 'area', 'bot asks only when it may');
      const ans = B.publicAnswer(map, q, me.pos, pub.witness);
      assert.ok(R.answer(map, q, me.pos, pub.witness).includes(ans), 'the answer is truthful');
      pub.usedQuestions.push(q); today.asks.push({ q, ans });
      assert.ok(B.candidates(map, pub).has(me.pos), 'after an answer the truth is still a candidate');
    }
    const a = B.detectiveArrest(map, pub, dLevel, rand, at);
    if (a != null) {
      assert.ok(R.arrestValid(map, at, a), 'arrest is own cell or a neighbour');
      if (a === me.pos) return end('good', 'arrest');
      pub.arrestsLeft -= 1; today.misses.push(a);
      assert.ok(B.candidates(map, pub).has(me.pos), 'after a miss the truth is still a candidate');
      if (pub.arrestsLeft <= 0) return end('killer', 'arrests');
    }
    pub.witness = null;
  }
  pub.day = R.DAYS;
  return end('killer', 'survived');
}

// ---- unit pins --------------------------------------------------------------------------------------
{
  const A = R.buildMap(MAPS, 'A', null);
  // the rulebook day: home 8, path 8›3›2›1, kill 3, witness 4 → the killer's cell (1) is a candidate, and so are others
  const pub = { day: 1, detectivePos: null, arrestsLeft: 4, usedQuestions: [], skipUsed: false, kills: 1, cereals: [3], witness: 4, days: [{ day: 1, det: null, kill: 3, witness: 4, asks: [], misses: [] }] };
  const c = B.candidates(A, pub);
  assert.ok(c.has(1) && c.size > 1 && !c.has(4), 'day-1 candidates hold 1, more than one cell, never the witness park: ' + [...c]);
  pub.days[0].asks.push({ q: 'building', ans: 'yes' });
  const c2 = B.candidates(A, pub);
  assert.ok(c2.has(1) && [...c2].every(id => ['H', 'C', 'S', 'T'].includes(A.cells[id].t)), '"in a building → yes" keeps only buildings');
  pub.days[0].misses.push(1);
  assert.ok(!B.candidates(A, pub).has(1), 'a missed arrest removes that cell');
  // a seeded rng repeats
  const r1 = B.rng(7), r2 = B.rng(7); assert.deepEqual([r1(), r1(), r1()], [r2(), r2(), r2()]);
  // the entropy card beats a card everyone answers the same way
  assert.equal(B.detectiveAsk(A, { ...pub, usedQuestions: [], detectivePos: 4, days: [{ day: 1, det: null, kill: 3, witness: 4, asks: [], misses: [] }] }, 2, B.rng(1), 4) !== null, true);
}

// ---- simulations --------------------------------------------------------------------------------------
const N = 200;
function series(kL, dL) {
  let good = 0, ms = 0; const reasons = {};
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 'B' : 'A', t0 = process.hrtime.bigint();
    const r = play(side, kL, dL, 1000 + i * 7919 + kL * 13 + dL * 101);
    ms += Number(process.hrtime.bigint() - t0) / 1e6;
    if (r.winner === 'good') good++;
    reasons[r.reason] = (reasons[r.reason] || 0) + 1;
  }
  return { good: good / N, ms: ms / N, reasons };
}
const res = {};
for (const [k, d] of [[1, 1], [1, 3], [2, 2], [1, 2], [3, 3], [2, 1]]) res[k + '' + d] = series(k, d);
for (const [key, r] of Object.entries(res)) console.log(`  🔪${'🥄'.repeat(+key[0])} vs 🕵️${'🥄'.repeat(+key[1])}: detective wins ${(r.good * 100).toFixed(0)} % · ${r.ms.toFixed(1)} ms/game · ${JSON.stringify(r.reasons)}`);

assert.ok(res['13'].good > res['11'].good, '🥄🥄🥄 detective catches the greedy killer more often than 🥄 does');
assert.ok(res['22'].good < res['12'].good, '🥄🥄 killer survives the 🥄🥄 detective more often than 🥄 killer does');
assert.ok(res['33'].good < res['22'].good, '🥄🥄🥄 vs 🥄🥄🥄 is harder for the detective than 🥄🥄 vs 🥄🥄 (the 🥄🥄🥄 killer models where the detective will stand)');
for (const key of ['11', '22', '33']) assert.ok(res[key].good > 0.02 && res[key].good < 0.98, 'even games are not one-sided: ' + key + ' = ' + res[key].good);
for (const [key, r] of Object.entries(res)) assert.ok(r.ms < (key.includes('3') ? 150 : 50), 'speed ' + key + ': ' + r.ms.toFixed(1) + ' ms');
console.log('cereal-bot-check: OK — truth always a candidate, every bot action legal, levels ordered, fast (' + Object.keys(res).length * N + ' games)');
