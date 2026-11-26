// 🐺 Werewolf Phase 0 — functions/wolf-rules.js (pure engine), no network, no Firebase. Proves: every default deck for
// 5–10 players is legal and deals exactly those roles; bad host decks are refused with their code; night picks are refused
// for the dead / wrong role / wolf-on-wolf / guard twice / spent potions; guard → heal → bite → poison resolve in that order
// (guard and heal both save the bitten, nothing stops poison); wolf ties use rng; vote ties and skips keep everyone in;
// both win conditions; two whole scripted games end with the right winner; inputs are never mutated.
const assert = require('node:assert/strict');
const path = require('node:path');
const W = require(path.join(__dirname, '..', 'functions', 'wolf-rules.js'));

// seeded rng so a run is repeatable
const rngOf = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const ids = (n) => Array.from({ length: n }, (_, i) => 'p' + (i + 1));

// ---- decks ----------------------------------------------------------------------------------------------------------
for (let n = W.MIN_PLAYERS; n <= W.MAX_PLAYERS; n++) {
  const c = W.defaultCounts(n);
  assert.equal(W.countsError(c, n), null, n + ' players: default deck is legal');
  assert.ok(c.wolf >= 1 && c.seer === 1 && c.guard === 1, n + ': has 🐺 🔮 🛡️');
  assert.equal(c.witch, n >= 7 ? 1 : 0, n + ': 🧪 from 7 players');
  for (let s = 1; s <= 20; s++) {
    const roles = W.deal(ids(n), c, rngOf(s));
    const got = {};
    Object.values(roles).forEach((r) => { got[r] = (got[r] || 0) + 1; });
    for (const r of W.ROLES) assert.equal(got[r] || 0, c[r], n + ' players seed ' + s + ': ' + r + ' count');
    assert.equal(Object.keys(roles).length, n);
  }
}
assert.throws(() => W.defaultCounts(4), /5–10/);
assert.throws(() => W.defaultCounts(11), /5–10/);
const dealt = new Set();
for (let s = 1; s <= 40; s++) dealt.add(Object.entries(W.deal(ids(5), W.defaultCounts(5), rngOf(s))).find(([, r]) => r === 'wolf')[0]);
assert.ok(dealt.size >= 4, 'the 🐺 seat moves around between deals (' + dealt.size + ' seats)');

const E = (counts, n) => W.countsError(counts, n);
assert.equal(E({ wolf: 1, seer: 1, guard: 1, villager: 1 }, 5), 'sum');
assert.equal(E({ seer: 1, guard: 1, villager: 3 }, 5), 'no-wolf');
assert.equal(E({ wolf: 3, seer: 1, villager: 2 }, 6), 'too-many-wolves');
assert.equal(E({ wolf: 1, seer: 2, villager: 2 }, 5), 'one-seer');
assert.equal(E({ wolf: 1, witch: 2, villager: 2 }, 5), 'one-witch');
assert.equal(E({ wolf: 1, jester: 1, villager: 3 }, 5), 'role');   // (hunter is a real role since 2026-11-26; see the 🎲 block below)
assert.equal(E({ wolf: 1.5, villager: 3.5 }, 5), 'count');
assert.equal(E({ wolf: 1, villager: 3 }, 4), 'players');
assert.equal(E({ wolf: 1, villager: 4 }, 5), null, 'a plain 🐺 + 👤 deck is allowed');
assert.throws(() => W.deal(ids(5), { wolf: 0, villager: 5 }), /no-wolf/);

// ---- one fixed table: p1 🐺 p2 🐺 p3 🔮 p4 🛡️ p5 🧪 p6 👤 p7 👤 --------------------------------------------------------
const ROLES7 = { p1: 'wolf', p2: 'wolf', p3: 'seer', p4: 'guard', p5: 'witch', p6: 'villager', p7: 'villager' };
let s = W.newState(ROLES7);
assert.deepEqual(W.nightTurns(s), { p1: 'wolf', p2: 'wolf', p3: 'seer', p4: 'guard', p5: 'witch' }, 'villagers sleep');
const P = (actor, kind, target, st) => W.pickError(st || s, actor, kind, target);
assert.equal(P('p1', 'wolf', 'p2'), 'target-wolf');
assert.equal(P('p1', 'wolf', 'p6'), null);
assert.equal(P('p3', 'wolf', 'p6'), 'not-your-role');
assert.equal(P('p6', 'seer', 'p1'), 'not-your-role');
assert.equal(P('p3', 'seer', 'p3'), 'self');
assert.equal(P('p3', 'seer', 'p9'), 'no-player');
assert.equal(P('p4', 'guard', 'p4'), null, 'the guard may cover themself');
assert.equal(P('p5', 'heal', 'p6'), null);
assert.equal(P('p5', 'poison', 'p5'), 'self');
assert.equal(P('p5', 'poison', 'p1'), null);

// wolf votes
assert.equal(W.wolfTarget({ p1: 'p6', p2: 'p6' }), 'p6');
assert.equal(W.wolfTarget({}), null, 'no wolf pressed = nobody bitten');
assert.equal(W.wolfTarget({ p1: 'p6', p2: null }), 'p6');
const tie = new Set([0.01, 0.99].map((x) => W.wolfTarget({ p1: 'p6', p2: 'p7' }, () => x)));
assert.deepEqual([...tie].sort(), ['p6', 'p7'], 'a wolf tie is decided by rng');

// night order
const frozen = JSON.stringify(s);
let r = W.resolveNight(s, { bite: 'p6', guard: 'p6', seer: 'p1' });
assert.deepEqual(r.dead, [], '🛡️ on the bitten = nobody dies');
assert.deepEqual(r.seen, { id: 'p1', wolf: true }, '🔮 sees 🐺');
assert.equal(r.state.lastGuard, 'p6');
assert.equal(r.state.night, 2);
assert.equal(r.state.witch.heal, true, 'potion untouched');
assert.equal(JSON.stringify(s), frozen, 'resolveNight does not mutate its input');
assert.equal(W.pickError(r.state, 'p4', 'guard', 'p6'), 'guard-repeat', '🛡️ cannot cover the same player 2 nights running');
assert.equal(W.pickError(r.state, 'p4', 'guard', 'p7'), null);

r = W.resolveNight(s, { bite: 'p6', heal: true, seer: 'p7' });
assert.deepEqual(r.dead, [], '💚 heal saves the bitten');
assert.equal(r.state.witch.heal, false, 'heal is spent');
assert.deepEqual(r.seen, { id: 'p7', wolf: false });
assert.equal(W.pickError(r.state, 'p5', 'heal', 'p7'), 'used');
assert.equal(W.resolveNight(s, { bite: null, heal: true }).state.witch.heal, true, 'no bite → heal not spent');

r = W.resolveNight(s, { bite: 'p6', guard: 'p7', poison: 'p6' });
assert.deepEqual(r.dead, ['p6'], 'bitten + poisoned the same player dies once');
r = W.resolveNight(s, { bite: 'p6', guard: 'p2', poison: 'p2' });
assert.deepEqual(r.dead, ['p6', 'p2'], '🛡️ does not stop ☠️ poison; order bite then poison');
assert.equal(r.state.witch.poison, false);
assert.equal(W.pickError(r.state, 'p5', 'poison', 'p1'), 'used');
assert.equal(W.pickError(r.state, 'p6', 'seer', 'p1'), 'dead');
assert.equal(W.pickError(r.state, 'p1', 'wolf', 'p6'), 'target-dead');

const spent = W.newState(ROLES7); spent.witch = { heal: false, poison: false };
assert.ok(!('p5' in W.nightTurns(spent)), '🧪 with no potions left sleeps');

// ---- votes ------------------------------------------------------------------------------------------------------------
let v = W.tallyVotes(s, { p1: 'p6', p2: 'p6', p3: 'p1', p4: 'p1', p5: 'p1', p6: 'skip', p7: 'p1' });
assert.equal(v.out, 'p1'); assert.deepEqual(v.counts, { p6: 2, p1: 4, skip: 1 });
assert.equal(W.tallyVotes(s, { p1: 'p6', p2: 'p6', p3: 'p1', p4: 'p1' }).out, null, 'a tie = nobody leaves');
assert.equal(W.tallyVotes(s, { p1: 'skip', p2: 'skip', p3: 'p1', p4: 'p1' }).out, null, 'skips tying the top = nobody leaves');
assert.equal(W.tallyVotes(s, { p1: 'skip', p2: 'skip', p3: 'p1' }).out, null, 'skip wins = nobody leaves');
assert.equal(W.tallyVotes(s, {}).out, null);
const dead6 = W.eliminate(s, 'p6');
v = W.tallyVotes(dead6, { p6: 'p1', p1: 'p6', p2: 'p3' });
assert.deepEqual(v.counts, { p3: 1 }, 'dead voters and votes for the dead are dropped');
assert.equal(s.alive.p6, true, 'eliminate does not mutate');

// ---- win -------------------------------------------------------------------------------------------------------------
assert.equal(W.winner(s), null);
assert.equal(W.winner(W.eliminate(W.eliminate(s, 'p1'), 'p2')), 'village');
let w = s; for (const id of ['p3', 'p4', 'p5']) w = W.eliminate(w, id);
assert.equal(W.winner(w), 'wolf', '2 🐺 vs 2 others = 🐺 win');

// ---- two scripted games ------------------------------------------------------------------------------------------------
function play(script) {
  let st = W.newState(ROLES7);
  for (const step of script) {
    if (step.night) {
      for (const [actor, kind, t] of step.night) assert.equal(W.pickError(st, actor, kind, t), null, actor + ' ' + kind + ' ' + t);
      const wolves = {}; step.night.filter((x) => x[1] === 'wolf').forEach(([a, , t]) => { wolves[a] = t; });
      const pick = { bite: W.wolfTarget(wolves, () => 0) };
      step.night.forEach(([, kind, t]) => { if (kind === 'heal') pick.heal = true; else if (kind !== 'wolf') pick[kind] = t; });
      st = W.resolveNight(st, pick).state;
    } else {
      st = W.eliminate(st, W.tallyVotes(st, step.vote).out);
    }
    if (W.winner(st)) return { win: W.winner(st), st };
  }
  return { win: null, st };
}
// village: night 1 🔮 finds p1, day 1 p1 out, night 2 💚 saves p3, day 2 p2 out
let g = play([
  { night: [['p1', 'wolf', 'p6'], ['p2', 'wolf', 'p6'], ['p3', 'seer', 'p1'], ['p4', 'guard', 'p7']] },
  { vote: { p2: 'p3', p3: 'p1', p4: 'p1', p5: 'p1', p7: 'p1' } },
  { night: [['p2', 'wolf', 'p3'], ['p3', 'seer', 'p2'], ['p4', 'guard', 'p5'], ['p5', 'heal', 'p3']] },
  { vote: { p2: 'p3', p3: 'p2', p4: 'p2', p5: 'p2', p7: 'p2' } },
]);
assert.equal(g.win, 'village'); assert.equal(g.st.alive.p6, false); assert.equal(g.st.alive.p3, true);
// wolves: they bite through, the village votes out its own
g = play([
  { night: [['p1', 'wolf', 'p3'], ['p2', 'wolf', 'p3'], ['p4', 'guard', 'p4']] },
  { vote: { p1: 'p4', p2: 'p4', p4: 'p5', p5: 'p4', p6: 'p4', p7: 'skip' } },
  { night: [['p1', 'wolf', 'p5'], ['p2', 'wolf', 'p5'], ['p5', 'poison', 'p6']] },
]);
assert.equal(g.win, 'wolf', '🐺 2 vs 👤 1 left'); assert.deepEqual(W.aliveIds(g.st.alive).sort(), ['p1', 'p2', 'p7']);

// 🎲 extra role (2026-11-26): 🏹 hunter — never in a default deck, one at most, 6 players up, swapped for a 👤; the shot after death
for (let n = W.MIN_PLAYERS; n <= W.MAX_PLAYERS; n++) assert.equal(W.defaultCounts(n).hunter, 0, n + ': no 🏹 by default');
assert.equal(W.countsError(W.addExtra(W.defaultCounts(5), 'hunter'), 5), 'hunter-needs-6');
for (let n = 6; n <= W.MAX_PLAYERS; n++) {
  const c = W.addExtra(W.defaultCounts(n), 'hunter');
  assert.equal(W.countsError(c, n), null, n + ': 🏹 deck is legal'); assert.equal(c.hunter, 1); assert.equal(c.villager, W.defaultCounts(n).villager - 1);
  const r = W.deal(ids(n), c, rngOf(n));
  assert.equal(Object.values(r).filter((x) => x === 'hunter').length, 1, n + ': exactly one 🏹 dealt');
}
assert.equal(W.countsError(Object.assign(W.addExtra(W.defaultCounts(8), 'hunter'), { hunter: 2, villager: 1 }), 8), 'one-hunter');
assert.deepEqual(W.addExtra({ wolf: 2, seer: 1, guard: 1, witch: 0, hunter: 0, villager: 0 }, 'hunter'), { wolf: 2, seer: 1, guard: 1, witch: 0, hunter: 0, villager: 0 }, 'no 👤 to swap = unchanged');
{
  const st = W.newState({ p1: 'wolf', p2: 'hunter', p3: 'seer', p4: 'guard', p5: 'villager', p6: 'villager' });
  assert.equal(W.shotError(st, 'p2', 'p1'), 'alive', 'a living hunter has no shot');
  const dead = W.eliminate(st, 'p2');
  assert.equal(W.shotError(dead, 'p2', 'p1'), null);
  assert.equal(W.shotError(dead, 'p3', 'p1'), 'not-hunter');
  assert.equal(W.shotError(dead, 'p2', 'p2'), 'target-dead');
  assert.equal(W.shotError(dead, 'p2', 'px'), 'no-player');
  assert.equal(W.winner(W.eliminate(dead, 'p1')), 'village', 'the shot can end the game');
  assert.equal(W.EMOJI.hunter, '🏹'); assert.ok(W.ROLES.indexOf('hunter') < W.ROLES.indexOf('villager'), 'deck order 🏹 before 👤');
}

// V101.353: the page loads public/wolf-rules.js — it must be the same bytes as the functions copy
const fsx = require('fs'), px = require('path');
const lf = (p) => fsx.readFileSync(px.join(__dirname, p), 'utf8').replace(/\r\n/g, '\n');
assert.equal(lf('../public/wolf-rules.js'), lf('../functions/wolf-rules.js'), 'public/wolf-rules.js = functions/wolf-rules.js');
console.log('wolf-rules-check: OK (decks 5–10, picks, night order, votes, win, 2 scripted games, 🏹 extra + shot, public copy)');
