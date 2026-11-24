// 🐺 Werewolf solo bots (public/wolf-ai.js, V101.353): play many all-bot games through wolf-rules.js and check the bots
// never cheat or break a rule — every pick passes pickError, wolves never vote or accuse a mate, a real 🔮 claim matches the
// check, a fake one is marked fake and only comes from a wolf, games end — plus a seat for "me" so the solo path is covered.
const assert = require('assert');
const W = require('../public/wolf-rules.js');
const AI = require('../public/wolf-ai.js');

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function play(n, level, seed) {
  const rng = mulberry(seed);
  const ids = []; for (let i = 1; i <= n; i++) ids.push('p' + i);
  const g = { id: 'g' + seed, ids, me: 'nobody', level, day: 1, st: W.newState(W.deal(ids, W.defaultCounts(n), rng)), checks: {}, claims: [], said: [], votes: [] };
  const role = (id) => g.st.roles[id];
  for (let guard = 0; guard < 30; guard++) {
    // night
    const wv = AI.wolfVotes(g, rng);
    Object.entries(wv).forEach(([w, t]) => assert.equal(W.pickError(g.st, w, 'wolf', t), null, 'wolf pick ' + w + '→' + t));
    const bite = W.wolfTarget(wv, rng);
    const seer = W.withRole(g.st.roles, g.st.alive, 'seer')[0], gd = W.withRole(g.st.roles, g.st.alive, 'guard')[0], wi = W.withRole(g.st.roles, g.st.alive, 'witch')[0];
    const picks = { bite, seer: null, guard: null, heal: false, poison: null };
    if (seer) { picks.seer = AI.seerPick(g, seer, rng); if (picks.seer) assert.equal(W.pickError(g.st, seer, 'seer', picks.seer), null, 'seer pick'); }
    if (gd) { picks.guard = AI.guardPick(g, gd, rng); if (picks.guard) assert.equal(W.pickError(g.st, gd, 'guard', picks.guard), null, 'guard pick'); }
    if (wi) {
      const p = AI.witchPick(g, wi, bite, rng);
      if (p.heal) { assert.ok(bite, 'heal needs a bite'); assert.equal(W.pickError(g.st, wi, 'heal', bite), null, 'heal'); picks.heal = true; }
      if (p.poison) { assert.equal(W.pickError(g.st, wi, 'poison', p.poison), null, 'poison'); picks.poison = p.poison; }
    }
    const r = W.resolveNight(g.st, picks);
    if (r.seen) { g.checks[seer] = g.checks[seer] || {}; g.checks[seer][r.seen.id] = r.seen.wolf; }
    g.st = r.state;
    if (W.winner(g.st)) return { g, win: W.winner(g.st) };
    // day
    const t = AI.talk(g);
    t.claims.forEach((c) => {
      assert.equal(c.day, g.day);
      if (c.fake) assert.equal(role(c.by), 'wolf', 'only wolves fake a claim');
      else { assert.equal(role(c.by), 'seer', 'a true claim comes from the seer'); assert.equal(g.checks[c.by][c.t], c.wolf, 'the seer reports its check'); }
      g.claims.push(c);
    });
    const again = AI.talk(g);   // talking twice the same day adds no second claim
    assert.equal(again.claims.length, 0, 'one claim per bot per day');
    Object.entries(t.tags).forEach(([b, x]) => {
      assert.ok(g.st.alive[b], 'only the living speak');
      if (x.k === 'sus' && role(b) === 'wolf') assert.notEqual(role(x.t), 'wolf', 'a wolf never accuses a mate');
      if (x.k === 'sus' || x.k === 'trust') g.said.push({ day: g.day, by: b, k: x.k, t: x.t, soft: !!x.soft });
    });
    const v = AI.votes(g);
    Object.entries(v).forEach(([b, x]) => {
      assert.ok(g.st.alive[b]); assert.notEqual(x, b, 'no self vote');
      if (x !== 'skip') { assert.ok(g.st.alive[x], 'vote for the living'); if (role(b) === 'wolf') assert.notEqual(role(x), 'wolf', 'a wolf never votes a mate'); }
      g.votes.push({ day: g.day, by: b, t: x });
    });
    const tv = W.tallyVotes(g.st, v);
    g.st = W.eliminate(g.st, tv.out);
    if (W.winner(g.st)) return { g, win: W.winner(g.st) };
    g.day++;
  }
  throw new Error('game ' + seed + ' did not end');
}

// V101.356 (owner's playthrough): day 1 is mostly quiet / 👍, not a wall of 🤨; from 🥄🥄 the seer bot claims on day 1, a 👤 result too
{
  let sus = 0, said = 0, seerDay1 = 0, seerTries = 0;
  for (let s = 1; s <= 200; s++) {
    const rng = mulberry(s * 17 + 3), ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
    const g = { id: 'd1-' + s, ids, me: 'nobody', level: 2, day: 1, st: W.newState(W.deal(ids, W.defaultCounts(7), rng)), checks: {}, claims: [], said: [], votes: [] };
    const seer = ids.find((id) => g.st.roles[id] === 'seer'), t = ids.find((id) => id !== seer && g.st.roles[id] !== 'wolf');
    g.checks[seer] = { [t]: false };   // night 1 found a villager
    const r = AI.talk(g);
    Object.entries(r.tags).forEach(([b, x]) => { if (b === seer) return; said++; if (x.k === 'sus') sus++; });
    seerTries++; if (r.claims.some((c) => c.by === seer && c.t === t && c.wolf === false && !c.fake)) seerDay1++;
  }
  assert.ok(sus / said < 0.4, 'day 1: fewer than 40 % of the bots accuse (' + sus + '/' + said + ')');
  assert.equal(seerDay1, seerTries, '🥄🥄: the seer bot claims its 👤 result on day 1 every time');
}
// V101.358 wolfWhy (🌕 reasons on the wolf night): a 🔮 claim, naming a wolf, suspecting a wolf, a trusted player, else nothing
{
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
  const roles = { p1: 'wolf', p2: 'wolf', p3: 'seer', p4: 'guard', p5: 'witch', p6: 'villager', p7: 'villager' };
  const g = { id: 'why', ids, me: 'p1', level: 3, day: 2, st: W.newState(roles), checks: {}, claims: [{ by: 'p3', day: 1, t: 'p6', wolf: false }, { by: 'p4', day: 1, t: 'p2', wolf: true }], said: [{ day: 1, by: 'p5', k: 'sus', t: 'p1' }], votes: [] };
  assert.equal(AI.wolfWhy(g, 'p3'), 'อ้างเป็น 🔮');
  assert.equal(AI.wolfWhy(g, 'p4'), 'ชี้ตัว 🐺', 'naming a wolf beats just claiming');
  assert.equal(AI.wolfWhy(g, 'p5'), 'สงสัย 🐺');
  assert.equal(AI.wolfWhy({ ...g, claims: [], said: [] }, 'p7'), null, 'a first-night guess says nothing');
}
const tally = {};
let fakes = 0, trues = 0;
for (const n of [5, 7, 9]) for (const level of [1, 2, 3]) {
  const k = n + '/' + level; tally[k] = { village: 0, wolf: 0 };
  for (let s = 1; s <= 150; s++) {
    const r = play(n, level, s * 31 + n * 7 + level);
    tally[k][r.win]++;
    r.g.claims.forEach((c) => { if (c.fake) fakes++; else trues++; });
  }
}
assert.ok(trues > 0, 'seers do claim'); assert.ok(fakes > 0, 'wolves sometimes fake a claim at 🥄🥄+');
// smarter bots help the village: at 7 players, 🥄🥄🥄 village wins more than 🥄 (both sides are bots, but the village side
// is the one that has to reason — a wolf only has to blend in)
assert.ok(tally['7/3'].village > tally['7/1'].village, 'level 3 village beats level 1 village: ' + JSON.stringify(tally));
// hash noise is stable: same inputs, same answer
assert.equal(AI.hash('abc'), AI.hash('abc'));
console.log('wolf-ai-check: OK — 1350 bot games, no illegal pick, no mate accused/voted, claims honest or marked fake; village wins', JSON.stringify(Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, v.village]))));
