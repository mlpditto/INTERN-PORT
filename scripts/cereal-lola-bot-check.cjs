// V101.347 🥣 Cereal Killer Phase 3 bot — whole 3-player games in node (seeded, no DOM): 🔪 bot → 🐕 bot → 🕵️ bot on all four
// printed pairs. A small referee plays the rules in the order public/cereal.js does. Proves:
//   · the detective's public candidates AND Lola's own candidates (public + her sniff / bark answers) ALWAYS hold the killer's cell;
//   · every bot action is legal by the engine (killer blocked by 🕵️ and 🐕, validateLolaPath, never last turn's ability, sniff /
//     bite on own or next cell, detective rules) and every Lola answer is the engine's truthful one;
//   · the levels mean something: 🥄🥄🥄 hunters (🐕 + 🕵️) beat the 🥄 killer more often than 🥄 hunters do;
//   · speed: a whole 3-player game in < 400 ms on average.
const assert = require('node:assert/strict');
const MAPS = require('../public/cereal-maps.js');
const R = require('../public/cereal-rules.js');
const B = require('../public/cereal-bot.js');

function play(pair, kLevel, hLevel, seed) {
  const map = R.buildMap(MAPS, pair.city, pair.suburb), rand = B.rng(seed);
  const pub = { day: 1, detectivePos: null, lolaPos: R.lolaStart(map), arrestsLeft: R.ARRESTS, usedQuestions: [], skipUsed: false, kills: 0, cereals: [], witness: null, days: [] };
  const me = { pos: null, home: null }, lola = { pos: pub.lolaPos, last: null, notes: [] };
  const end = (winner, reason) => ({ winner, reason, day: pub.day });
  const truthOk = (why) => {
    assert.ok(B.candidates(map, pub).has(me.pos), 'public candidates hold the truth ' + why + ' (seed ' + seed + ', day ' + pub.day + ')');
    assert.ok(B.lolaCandidates(map, pub, lola.notes).has(me.pos), 'Lola\'s candidates hold the truth ' + why + ' (seed ' + seed + ', day ' + pub.day + ')');
  };
  for (; pub.day <= R.DAYS; pub.day++) {
    // ---- 🔪
    const blocked = [pub.detectivePos, pub.lolaPos].filter(x => x != null);
    if (me.pos != null && R.cornered(map, me.pos, blocked)) return end('good', 'cornered');
    const kt = B.killerTurn(map, pub, me, kLevel, rand);
    if (!kt) return end('good', 'stuck');
    if (me.pos == null) me.home = kt.home; else assert.equal(kt.path[0], me.pos);
    const v = R.validateKillerTurn(map, { path: kt.path, kill: kt.kill, witness: kt.witness }, { blocked, taken: pub.cereals, kills: pub.kills, skipUsed: pub.skipUsed });
    assert.ok(v.ok, 'bot killer turn is legal (blocked by 🕵️ + 🐕): ' + JSON.stringify(kt));
    const kPath = kt.path.slice();
    me.pos = kt.path[kt.path.length - 1];
    if (v.kill != null) pub.cereals.push(v.kill);
    pub.kills = v.kills; pub.skipUsed = v.skipUsed; pub.witness = v.witness;
    const today = { day: pub.day, det: pub.detectivePos, lola: pub.lolaPos, kill: v.kill, witness: v.witness, asks: [], misses: [] };
    pub.days.push(today);
    truthOk('after the killer');
    if (!R.calendarOk(pub.day, pub.kills)) return end('good', 'calendar');
    // ---- 🐕
    const lt = B.lolaTurn(map, pub, lola, hLevel, rand);
    assert.ok(lt && R.validateLolaPath(map, lt.path).ok && lt.path[0] === lola.pos, 'Lola walk is legal: ' + JSON.stringify(lt && lt.path));
    const at = lt.path[lt.path.length - 1];
    if (lt.ability) {
      const a = lt.ability;
      assert.ok(R.lolaAbilityOk(a.a, lola.last), 'never last turn\'s ability');
      if (a.a === 'sniff') {
        assert.ok(R.arrestValid(map, at, a.cell), 'sniff own or next cell');
        const ans = R.sniff(map, kPath, a.cell, me.pos), pickA = ans.length > 1 ? R.leastInformative(map, a.cell, ans) : ans[0];
        lola.notes.push({ day: pub.day, a: 'sniff', cell: a.cell, from: at, ans: pickA });
      } else if (a.a === 'bark') {
        lola.notes.push({ day: pub.day, a: 'bark', cell: null, from: at, ans: R.bark(map, at, me.pos) });
      } else {
        assert.ok(R.arrestValid(map, at, a.cell), 'bite own or next cell');
        if (a.cell === me.pos) return end('good', 'bite');
        pub.arrestsLeft -= 1; today.misses.push(a.cell);
        if (pub.arrestsLeft <= 0) return end('killer', 'arrests');
      }
      truthOk('after Lola\'s ' + a.a);
    }
    lola.pos = at; lola.last = lt.ability ? lt.ability.a : null; pub.lolaPos = at;
    // ---- 🕵️
    const mv = B.detectiveMove(map, pub, hLevel, rand);
    assert.ok(R.validateDetectivePath(map, mv.path).ok, 'detective path is legal');
    const dAt = mv.path[mv.path.length - 1]; pub.detectivePos = dAt;
    const q = B.detectiveAsk(map, pub, hLevel, rand, dAt);
    if (q) {
      assert.ok(R.canQuestion(map, dAt, pub.witness) && !pub.usedQuestions.includes(q), 'asks only when it may');
      const ans = B.publicAnswer(map, q, me.pos, pub.witness);
      pub.usedQuestions.push(q); today.asks.push({ q, ans });
      truthOk('after a card');
    }
    const arr = B.detectiveArrest(map, pub, hLevel, rand, dAt);
    if (arr != null) {
      assert.ok(R.arrestValid(map, dAt, arr));
      if (arr === me.pos) return end('good', 'arrest');
      pub.arrestsLeft -= 1; today.misses.push(arr);
      truthOk('after a miss');
      if (pub.arrestsLeft <= 0) return end('killer', 'arrests');
    }
    pub.witness = null;
  }
  return end('killer', 'survived');
}

const t0 = Date.now(); let games = 0;
const wins = {};
for (const pair of MAPS.difficulty) {
  for (const [k, h] of [[1, 1], [1, 3], [2, 2], [3, 3]]) {
    const key = k + 'v' + h; wins[key] = wins[key] || { good: 0, all: 0 };
    for (let s = 1; s <= 12; s++) { const r = play(pair, k, h, s * 7919 + k * 31 + h); games++; wins[key].all++; if (r.winner === 'good') wins[key].good++; }
  }
}
const ms = (Date.now() - t0) / games;
assert.ok(ms < 400, 'speed: ' + ms.toFixed(0) + ' ms a game');
const rate = k => wins[k].good / wins[k].all;
assert.ok(rate('1v3') > rate('1v1'), '🥄🥄🥄 hunters catch the 🥄 killer more often than 🥄 hunters: ' + JSON.stringify(wins));
assert.ok(Object.values(wins).every(w => w.good > 0 || w.all < 10), 'hunters win sometimes: ' + JSON.stringify(wins));
console.log('cereal-lola-bot-check: OK — ' + games + ' 3-player games on 4 pairs, truth always in both candidate sets, every move legal, ' + ms.toFixed(0) + ' ms a game, hunters win ' + Object.entries(wins).map(([k, w]) => k + ' ' + Math.round(100 * w.good / w.all) + '%').join(' · '));
