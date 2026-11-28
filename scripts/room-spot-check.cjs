// 🪞 Memory Fracture with friends — functions/room-spot.js through the roomAct callable on an in-memory Firestore, no network.
// Proves: functions/spot-scene.js is the same file as public/spot-scene.js; create → a 4-digit code, the 🥄 level kept, live, one
// open room per host, apart from the host's 🪨 room; up to 7 join (the 8th is refused); only the host starts and only with 2+;
// what the room shows per step — 👀 the original shelf only (no seed, no changed shelf, no list of changes), ✓ Ready from everyone
// moves on early; 🎲 bets hidden (only "sent"), a bet you cannot pay is refused, my own bet sits in my hand doc; 🔍 the changed
// shelf only (the original is taken out), answers hidden, bad taps refused; 📊 the changes and everyone's answer, points
// = (found − wrong, ≥ 0) × bet, ×1.5 costs 💎1, ×2 costs 💎2 and 💎1 more past 2 wrong taps, 💎 never below 0; the round's rank
// 💎 (2 players: winner +2, loser 0; 3+: +2 · +1 · lowest −1; 0 points earns nothing; ties share a rank); no "found all" bonus;
// only the host goes on, a new shelf each round; claim is refused before the step's time, after it a missing bet is ×1 and a
// missing answer is no taps; 3 rounds end the room, ranked by 💎 then points; 🏳 a leaver's seat is out, one player left ends it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const R = require(path.join(root, 'functions', 'room-act.js'));
const RS = require(path.join(root, 'functions', 'room-spot.js'));
const S = require(path.join(root, 'public', 'spot-scene.js'));
assert.equal(fs.readFileSync(path.join(root, 'functions', 'spot-scene.js'), 'utf8').replace(/\r/g, ''), fs.readFileSync(path.join(root, 'public', 'spot-scene.js'), 'utf8').replace(/\r/g, ''), 'functions/spot-scene.js = public/spot-scene.js (copy it after a change)');

// the round's rank 💎, on its own
const rg = (pts) => { const seats = pts.map((x, i) => i), o = RS.rankGems(pts, seats); return seats.map((s) => o[s]); };
assert.deepEqual(rg([5, 3]), [2, 0], '2 players: winner +2, loser 0 (owner)');
assert.deepEqual(rg([4, 4]), [2, 2], 'a tie at the top: both +2');
assert.deepEqual(rg([0, 0]), [0, 0], '0 points earns nothing');
assert.deepEqual(rg([6, 3, 0]), [2, 1, -1], '3 players: +2 · +1 · −1');
assert.deepEqual(rg([6, 6, 2]), [2, 2, -1], 'ranks 1 · 1 · 3: the third is the lowest');
assert.deepEqual(rg([6, 2, 2]), [2, 1, 1], 'ranks 1 · 2 · 2: nobody is below rank 2');
assert.deepEqual(rg([5, 4, 3, 2]), [2, 1, 0, -1]);
assert.deepEqual(rg([5, 3, 3, 0]), [2, 1, 1, -1]);
assert.deepEqual(rg([5, 0, 0]), [2, 0, 0], 'rank 2 with 0 points: no 💎, no loss');

function fakeDb() {
  const store = new Map(); let auto = 0;
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const snap = (p) => ({ id: p.split('/').pop(), exists: store.has(p), data: () => clone(store.get(p)), ref: docRef(p) });
  function docRef(p) { return { id: p.split('/').pop(), path: p, get: async () => snap(p), set: async (v) => { store.set(p, clone(v)); }, update: async (v) => { store.set(p, Object.assign(clone(store.get(p)) || {}, clone(v))); }, collection: (n) => colRef(p + '/' + n) }; }
  function colRef(p, filters, lim) {
    filters = filters || [];
    return { doc: (id) => docRef(p + '/' + (id || ('room' + String(++auto).padStart(8, '0')))), where: (f, op, v) => colRef(p, filters.concat([[f, v]]), lim), limit: (n) => colRef(p, filters, n),
      get: async () => { let docs = [...store.keys()].filter((k) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/')).filter((k) => filters.every(([f, v]) => (store.get(k) || {})[f] === v)).map(snap); if (lim) docs = docs.slice(0, lim); return { empty: !docs.length, docs }; } };
  }
  return { collection: (n) => colRef(n), runTransaction: async (fn) => { const w = []; const tx = { get: (r) => r.get(), set: (r, v) => w.push(() => r.set(v)), update: (r, v) => w.push(() => r.update(v)) }; const out = await fn(tx); for (const f of w) await f(); return out; }, store };
}
class HttpsError extends Error { constructor(code, msg, details) { super(msg); this.code = code; this.details = details; } }

(async () => {
  const db = fakeDb(); const U = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  U.forEach((x) => { db.store.set('user_auth_links/auth' + x, { effectiveUserId: 'U' + x }); db.store.set('users/U' + x, { nickName: 'N' + x }); });
  let T = 1e12, seed = 9; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const call = (x, data) => R.handle({ auth: { uid: 'auth' + x }, data: Object.assign({ game: 'spot' }, data) }, { db, HttpsError, now: T, rand });
  const refused = async (p, c) => { try { await p; } catch (e) { assert.equal((e.details && e.details.code) || e.code, c); return; } assert.fail('expected ' + c); };
  const pub = (id) => db.store.get('rooms/' + id), sec = (id) => db.store.get('rooms/' + id + '/secret/scene'), hand = (id, x) => db.store.get('rooms/' + id + '/hand/auth' + x);
  const tapsFor = (id, nFound, nWrong) => { const s = sec(id), g = pub(id).g, hit = s.diffs.slice(0, nFound).map((d) => d.cells[0]), all = new Set(s.diffs.flatMap((d) => d.cells)), bad = []; for (let k = 0; k < g.cols * g.rows && bad.length < nWrong; k++) if (!all.has(k)) bad.push(k); return hit.concat(bad); };

  // create · join · start
  const rock = await R.handle({ auth: { uid: 'authA' }, data: { game: 'rock13', action: 'create' } }, { db, HttpsError, now: T, rand });
  const c1 = await call('A', { action: 'create', level: 3 });
  assert.match(c1.code, /^\d{4}$/); assert.notEqual(c1.roomId, rock.roomId, 'apart from the host\'s 🪨 room');
  assert.deepEqual([pub(c1.roomId).level, pub(c1.roomId).live, pub(c1.roomId).rounds], [3, true, 3]);
  assert.equal((await call('A', { action: 'create', level: 1 })).roomId, c1.roomId, 'one open room per host'); assert.equal(pub(c1.roomId).level, 1, 'the level follows the host\'s pick');
  await call('A', { action: 'create', level: 9 }); assert.equal(pub(c1.roomId).level, 2, 'an unknown level = 🥄🥄');
  for (const x of ['B', 'C', 'D', 'E', 'F', 'G']) await call(x, { action: 'join', code: c1.code });
  await refused(call('H', { action: 'join', code: c1.code }), 'full');
  await refused(call('B', { action: 'start', roomId: c1.roomId }), 'not-host');
  const c2 = await call('H', { action: 'create', level: 2 });
  await refused(call('H', { action: 'start', roomId: c2.roomId }), 'alone');
  await refused(call('A', { action: 'cancel', roomId: c2.roomId }), 'permission-denied');

  // a room of 3: A (host) · B · C
  const c3 = await call('B', { action: 'create', level: 2 });
  await call('C', { action: 'join', code: c3.code }); await call('D', { action: 'join', code: c3.code });
  const id = c3.roomId, ids = pub(id).order; assert.deepEqual(ids, ['authB', 'authC', 'authD']);
  await refused(call('C', { action: 'ready', roomId: id }), 'not-playing');
  await call('B', { action: 'start', roomId: id });
  let r = pub(id), s = sec(id);
  assert.deepEqual([r.status, r.g.phase, r.g.round, r.g.rounds, r.g.level], ['playing', 'look', 1, 3, 2]);
  assert.deepEqual(r.g.gem, [3, 3, 3], 'everyone starts with 💎 3'); assert.deepEqual(r.g.pts, [0, 0, 0]);
  assert.equal(r.g.orig.length, r.g.cols * r.g.rows); assert.deepEqual(r.g.orig, S.make(2, s.seed).orig, 'the shelf is spot-scene\'s, from the referee\'s seed');
  assert.deepEqual([r.g.changed, r.g.diffs, r.g.res], [null, null, null], '👀 only the original shelf'); assert.equal(r.g.max, s.diffs.length + 2);
  assert.ok(!JSON.stringify(r).includes('"seed"') && !JSON.stringify(r).includes(JSON.stringify(s.diffs[0].say)), 'no seed and no change text in the room');
  assert.equal(r.turnDeadline, T + 60000, '👀 60 s'); assert.deepEqual(hand(id, 'C'), { seat: 1, round: 1, bet: null, taps: null });
  // 👀 → 🎲: everyone ✓ Ready moves on early
  await refused(call('B', { action: 'bet', roomId: id, bet: 1 }), 'not-now');
  await refused(call('B', { action: 'claim', roomId: id }), 'early');
  await call('B', { action: 'ready', roomId: id }); await call('C', { action: 'ready', roomId: id });
  assert.equal(pub(id).g.phase, 'look'); assert.deepEqual(pub(id).g.ready, { 0: true, 1: true }); assert.equal(pub(id).turnDeadline, T + 60000, 'the clock does not restart inside a step');
  T += 20000; await call('D', { action: 'ready', roomId: id });
  r = pub(id); assert.equal(r.g.phase, 'bet'); assert.equal(r.turnDeadline, T + 10000, '🎲 10 s'); assert.ok(r.g.orig && !r.g.changed, '🎲 still the original shelf');
  // 🎲: hidden, payable, once
  await refused(call('B', { action: 'bet', roomId: id, bet: 3 }), 'bad-bet');
  await call('B', { action: 'bet', roomId: id, bet: 2 });
  r = pub(id); assert.deepEqual(r.g.sent, { 0: true }); assert.ok(!/"bets?":/.test(JSON.stringify(r)), 'no bet shows in the room'); assert.equal(hand(id, 'B').bet, 2, 'my bet in my hand doc');
  await refused(call('B', { action: 'bet', roomId: id, bet: 1 }), 'sent');
  await call('C', { action: 'bet', roomId: id, bet: 1.5 });
  T += 11000; await call('B', { action: 'claim', roomId: id });   // D never bet: ×1
  r = pub(id); s = sec(id);
  assert.equal(r.g.phase, 'find'); assert.equal(r.turnDeadline, T + 90000, '🔍 90 s'); assert.deepEqual(r.g.changed, s.changed, '🔍 the changed shelf'); assert.equal(r.g.orig, null, '🔍 the original is taken out'); assert.equal(r.g.diffs, null);
  // 🔍: answers hidden, bad taps refused
  await refused(call('B', { action: 'taps', roomId: id, taps: [0, 0] }), 'bad-taps');
  await refused(call('B', { action: 'taps', roomId: id, taps: [999] }), 'bad-taps');
  await refused(call('B', { action: 'taps', roomId: id, taps: Array.from({ length: r.g.max + 1 }, (x, i) => i) }), 'bad-taps');
  await refused(call('B', { action: 'taps', roomId: id, taps: 'x' }), 'bad-taps');
  const n = s.diffs.length;
  const tB = tapsFor(id, 2, 3), tC = tapsFor(id, n, 0), tD = tapsFor(id, 3, 1);
  await call('B', { action: 'taps', roomId: id, taps: tB });
  r = pub(id); assert.deepEqual(r.g.sent, { 0: true }); assert.equal(r.g.res, null, 'answers stay hidden'); assert.deepEqual(hand(id, 'B').taps, tB);
  await refused(call('B', { action: 'taps', roomId: id, taps: tB }), 'sent');
  await call('C', { action: 'taps', roomId: id, taps: tC }); await call('D', { action: 'taps', roomId: id, taps: tD });
  // 📊: B ×2 found 2 wrong 3 → 0 points, 💎 −2 −1 (past 2 wrong) −1 (lowest) → 0 · C ×1.5 found all → n × 1.5, 💎 −1 +2 · D ×1 3 − 1 = 2, 💎 +1
  r = pub(id);
  assert.equal(r.g.phase, 'show'); assert.equal(r.turnDeadline, T + 30000, '📊 30 s'); assert.deepEqual(r.g.diffs, s.diffs, '📊 the changes show');
  assert.deepEqual(r.g.res.map((x) => [x.bet, x.n, x.wrong.length, x.pts, x.cost, x.win, x.gem, x.rank]), [[2, 2, 3, 0, -3, -1, -4, 3], [1.5, n, 0, n * 1.5, -1, 2, 1, 1], [1, 3, 1, 2, 0, 1, 1, 2]]);
  assert.deepEqual(r.g.gem, [0, 4, 4], '💎 never below 0; no "found all" bonus for C'); assert.deepEqual(r.g.pts, [0, n * 1.5, 2]);
  assert.deepEqual(r.g.res[0].found, S.judge({ diffs: s.diffs }, tB).found);
  // only the host goes on; a new shelf
  await refused(call('C', { action: 'next', roomId: id }), 'not-host');
  await refused(call('C', { action: 'claim', roomId: id }), 'early');
  const first = JSON.stringify(s.changed);
  await call('B', { action: 'next', roomId: id });
  r = pub(id); s = sec(id);
  assert.deepEqual([r.g.phase, r.g.round], ['look', 2]); assert.notEqual(JSON.stringify(s.changed), first, 'a new shelf'); assert.deepEqual([r.g.changed, r.g.diffs, r.g.res], [null, null, null]);
  assert.deepEqual(s.bets, {}); assert.deepEqual(hand(id, 'B'), { seat: 0, round: 2, bet: null, taps: null });
  // round 2 on the clock alone: nobody acts
  T += 61000; await call('C', { action: 'claim', roomId: id }); assert.equal(pub(id).g.phase, 'bet');
  await refused(call('B', { action: 'bet', roomId: id, bet: 1.5 }), 'bad-bet');   // B has 💎 0
  await call('B', { action: 'bet', roomId: id, bet: 1 });
  T += 11000; await call('C', { action: 'claim', roomId: id }); assert.equal(pub(id).g.phase, 'find');
  T += 91000; await call('C', { action: 'claim', roomId: id });
  r = pub(id); assert.equal(r.g.phase, 'show'); assert.deepEqual(r.g.res.map((x) => [x.bet, x.n, x.pts, x.gem]), [[1, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0]], 'no answers: 0 points, no 💎 moves');
  T += 31000; await call('D', { action: 'claim', roomId: id }); assert.deepEqual([pub(id).g.phase, pub(id).g.round], ['look', 3], '📊 goes on by itself after 30 s');
  // round 3 to the end
  for (const x of ['B', 'C', 'D']) await call(x, { action: 'ready', roomId: id });
  for (const x of ['B', 'C', 'D']) await call(x, { action: 'bet', roomId: id, bet: 1 });
  await call('B', { action: 'taps', roomId: id, taps: tapsFor(id, 4, 0) }); await call('C', { action: 'taps', roomId: id, taps: tapsFor(id, 1, 0) }); await call('D', { action: 'taps', roomId: id, taps: tapsFor(id, 1, 0) });
  r = pub(id); assert.deepEqual(r.g.res.map((x) => x.win), [2, 1, 1]); assert.deepEqual(r.g.gem, [2, 5, 5]);
  await call('B', { action: 'next', roomId: id });
  r = pub(id);
  assert.deepEqual([r.status, r.g.phase, r.turnDeadline, r.result.reason], ['done', 'end', null, 'score']);
  assert.deepEqual(r.result.rank, ['authC', 'authD', 'authB'], 'most 💎, then most points (C ' + r.g.pts[1] + ' > D ' + r.g.pts[2] + ')');
  await refused(call('B', { action: 'ready', roomId: id }), 'not-playing');

  // 2 players: winner +2, loser 0
  const c4 = await call('E', { action: 'create', level: 1 });
  await call('F', { action: 'join', code: c4.code }); await call('E', { action: 'start', roomId: c4.roomId });
  for (const x of ['E', 'F']) await call(x, { action: 'ready', roomId: c4.roomId });
  for (const x of ['E', 'F']) await call(x, { action: 'bet', roomId: c4.roomId, bet: 1 });
  await call('E', { action: 'taps', roomId: c4.roomId, taps: tapsFor(c4.roomId, 3, 0) }); await call('F', { action: 'taps', roomId: c4.roomId, taps: tapsFor(c4.roomId, 1, 0) });
  assert.deepEqual(pub(c4.roomId).g.res.map((x) => x.win), [2, 0]); assert.deepEqual(pub(c4.roomId).g.gem, [5, 3]);
  // 🏳 leaving: 3 players, one leaves while the others are ready → the step moves on; a second leaves → the last one wins
  const c5 = await call('G', { action: 'create', level: 1 });
  await call('H', { action: 'join', code: c5.code }); await call('A', { action: 'join', code: c5.code }); await call('G', { action: 'start', roomId: c5.roomId });
  await call('G', { action: 'ready', roomId: c5.roomId }); await call('H', { action: 'ready', roomId: c5.roomId });
  await call('A', { action: 'resign', roomId: c5.roomId });
  r = pub(c5.roomId); assert.equal(r.g.phase, 'bet', 'the others were ready: on to 🎲'); assert.equal(r.g.out[2], true); assert.equal(r.players.authA.left, true);
  await refused(call('A', { action: 'bet', roomId: c5.roomId, bet: 1 }), 'left');
  await call('H', { action: 'resign', roomId: c5.roomId });
  r = pub(c5.roomId); assert.deepEqual([r.status, r.result.reason, r.result.rank[0]], ['done', 'left', 'authG']);
  // cancel a waiting room
  await call('H', { action: 'cancel', roomId: c2.roomId }); assert.equal(pub(c2.roomId).result.reason, 'cancelled');
  console.log('room-spot-check: OK — scene copy matches; rank 💎 table (2 players +2 / 0 · 3+ +2 / +1 / lowest −1 · 0 points nothing · shared ranks); code + level, live, one room per host, apart from 🪨; 7 seats; host starts with 2+; 👀 original only, no seed / changes in the room, all ✓ moves on; 🎲 hidden, payable, once, missing = ×1; 🔍 changed shelf only, bad taps refused, answers hidden; 📊 points × bet, ×2 past 2 wrong −1 more, 💎 ≥ 0, no found-all bonus; host goes on, 30 s by itself; a new shelf each round; 3 rounds → rank by 💎 then points; 🏳 seat out, one left ends; cancel');
})().catch((e) => { console.error(e); process.exit(1); });
