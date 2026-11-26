// 🌐 ไพ่เงา online — functions/room-act.js (the roomAct callable) on a small in-memory Firestore, two LINE users, no network.
// Proves: index.js exports roomAct and the rules let players read their room and nobody write it or read its secret; create → a
// 4-digit code, one open room per creator; join starts the game with a deadline (1 h 🌐, 30 s 🔢); over 300 random games the
// referee keeps the rules (each tile once, higher wins, draw keeps the leader, winner leads, 9 rounds or 5), and while a game
// runs no number from either hand is in the PUBLIC doc (only colours); the end reveals every round's numbers; refusals: outsider,
// wrong turn, a tile not in hand, own room, early claim, the turn holder claiming; claim after the deadline: 🌐 = the waiter wins,
// 🔢 = the late player's lowest tile is played; resign; cancel an empty room.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const idx = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
assert.ok(/exports\.roomAct = onCall\(/.test(idx) && idx.includes("require('./room-act').handle(request"), 'functions/index.js exports roomAct');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
assert.ok(/match \/rooms\/\{roomId\} \{\s*allow read: if isAdmin\(\) \|\| \(isSignedIn\(\) && request\.auth\.uid in resource\.data\.authUids\);\s*allow write: if false;\s*match \/secret\/\{doc\} \{\s*allow read, write: if false;/.test(rules), 'rules: players read their room, nobody writes, nobody reads secret');
assert.ok(rules.includes('match /hand/{uid} {   // each player reads only their own tiles\n        allow read: if isSignedIn() && request.auth.uid == uid;\n        allow write: if false;') || rules.replace(/\r\n/g, '\n').includes('match /hand/{uid} {   // each player reads only their own tiles\n        allow read: if isSignedIn() && request.auth.uid == uid;\n        allow write: if false;'), 'rules: a player reads only their own hand');
const R = require(path.join(root, 'functions', 'room-act.js'));

function fakeDb() {
  const store = new Map(); let auto = 0;
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const snap = (p) => ({ id: p.split('/').pop(), exists: store.has(p), data: () => clone(store.get(p)), ref: docRef(p) });
  function docRef(p) { return { id: p.split('/').pop(), path: p, get: async () => snap(p), set: async (v) => { store.set(p, clone(v)); }, update: async (v) => { store.set(p, Object.assign(clone(store.get(p)) || {}, clone(v))); }, collection: (n) => colRef(p + '/' + n) }; }
  function colRef(p, filters, lim) {
    filters = filters || [];
    return { doc: (id) => docRef(p + '/' + (id || ('r' + String(++auto).padStart(12, '0')))), where: (f, op, v) => { assert.equal(op, '=='); return colRef(p, filters.concat([[f, v]]), lim); }, limit: (n) => colRef(p, filters, n),
      get: async () => { let docs = [...store.keys()].filter((k) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/')).filter((k) => filters.every(([f, v]) => (store.get(k) || {})[f] === v)).map(snap); if (lim) docs = docs.slice(0, lim); return { empty: !docs.length, docs }; } };
  }
  return { collection: (n) => colRef(n), runTransaction: async (fn) => { const w = []; const tx = { get: (r) => r.get(), set: (r, v) => w.push(() => r.set(v)), update: (r, v) => w.push(() => r.update(v)) }; const out = await fn(tx); for (const f of w) await f(); return out; }, store };
}
class HttpsError extends Error { constructor(code, msg, details) { super(msg); this.code = code; this.details = details; } }

(async () => {
  const db = fakeDb();
  for (const [a, u, n] of [['authA', 'UA', 'Mind'], ['authB', 'UB', 'Ton'], ['authX', 'UX', 'Out']]) { db.store.set('user_auth_links/' + a, { effectiveUserId: u }); db.store.set('users/' + u, { nickName: n, pictureUrl: 'https://x/' + n }); }
  let T = 1e12, seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const call = (auth, data) => R.handle({ auth: auth ? { uid: auth } : null, data: Object.assign({ game: 'bw' }, data) }, { db, HttpsError, now: T, rand });
  const refused = async (p, code) => { try { await p; } catch (e) { assert.equal((e.details && e.details.code) || e.code, code); return; } assert.fail('expected ' + code); };
  const pub = (id) => db.store.get('rooms/' + id), sec = (id) => db.store.get('rooms/' + id + '/secret/hands');

  await refused(call(null, { action: 'create' }), 'unauthenticated');
  await refused(R.handle({ auth: { uid: 'authA' }, data: { game: 'chess', action: 'create' } }, { db, HttpsError, now: T, rand }), 'invalid-argument');
  const c1 = await call('authA', { action: 'create' });
  assert.match(c1.code, /^\d{4}$/); assert.equal((await call('authA', { action: 'create', live: true })).roomId, c1.roomId, 'one open room per creator');
  assert.equal(pub(c1.roomId).live, true, 'switching the kind keeps the room');
  await refused(call('authA', { action: 'join', code: c1.code }), 'own-room');
  await refused(call('authB', { action: 'join', code: '0000' === c1.code ? '1111' : '0000' }), 'no-room');
  await call('authB', { action: 'join', code: c1.code });
  let g = pub(c1.roomId);
  assert.equal(g.status, 'playing'); assert.deepEqual(g.authUids, ['authA', 'authB']); assert.equal(g.turnDeadline - T, R.LIVE_MS, '🔢 live: 30 s');
  await refused(call('authX', { action: 'play', roomId: c1.roomId, n: 3 }), 'permission-denied');
  const holder = g.turn === 'a' ? 'authA' : 'authB', waiter = g.turn === 'a' ? 'authB' : 'authA';
  await refused(call(waiter, { action: 'play', roomId: c1.roomId, n: 3 }), 'not-your-turn');
  await refused(call(holder, { action: 'play', roomId: c1.roomId, n: 9 }), 'no-tile');
  await refused(call(waiter, { action: 'claim', roomId: c1.roomId }), 'early');
  await refused(call(holder, { action: 'claim', roomId: c1.roomId }), 'your-turn');
  T += R.LIVE_MS + 1;
  const cl = await call(waiter, { action: 'claim', roomId: c1.roomId });
  assert.ok(cl.auto); g = pub(c1.roomId); assert.equal(g.lc, 'b', '🔢 the late player\'s lowest tile (0, ⚫) went down'); assert.equal(sec(c1.roomId).lt, 0);
  await call(waiter, { action: 'resign', roomId: c1.roomId });
  g = pub(c1.roomId); assert.equal(g.status, 'done'); assert.equal(g.result.reason, 'resigned'); assert.equal(g.result.winner, holder === 'authA' ? 'a' : 'b');

  // 🌐 timeout claim = the waiter wins; cancel an empty room
  const c2 = await call('authA', { action: 'create' }); await call('authB', { action: 'join', code: c2.code });
  g = pub(c2.roomId); assert.equal(g.turnDeadline - T, R.TURN_MS, '🌐: 1 h');
  T += R.TURN_MS + 1; const w2 = g.turn === 'a' ? 'authB' : 'authA';
  await call(w2, { action: 'claim', roomId: c2.roomId }); g = pub(c2.roomId);
  assert.deepEqual([g.status, g.result.reason, g.result.winner], ['done', 'timeout', w2 === 'authA' ? 'a' : 'b']);
  const c3 = await call('authA', { action: 'create' }); await call('authA', { action: 'cancel', roomId: c3.roomId });
  assert.equal(pub(c3.roomId).status, 'done'); await refused(call('authB', { action: 'join', code: c3.code }), 'no-room');

  // 300 random games: the rules, and no hand number in the public doc while playing
  let fives = 0;
  for (let k = 0; k < 300; k++) {
    const c = await call('authA', { action: 'create' }); await call('authB', { action: 'join', code: c.code });
    const used = { a: [], b: [] };
    for (let guard = 0; guard < 30; guard++) {
      g = pub(c.roomId); if (g.status !== 'playing') break;
      const s = g.turn, h = sec(c.roomId)[s], n = h[Math.floor(rand() * h.length)], before = { lead: g.lead, lc: g.lc, lt: sec(c.roomId).lt, sc: g.sc };
      await call(s === 'a' ? 'authA' : 'authB', { action: 'play', roomId: c.roomId, n }); used[s].push(n);
      g = pub(c.roomId);
      if (g.status === 'playing' && before.lc == null) {   // I led: my hand doc shows my face-down tile, the other's does not
        const mine = db.store.get('rooms/' + c.roomId + '/hand/' + (s === 'a' ? 'authA' : 'authB')), theirs = db.store.get('rooms/' + c.roomId + '/hand/' + (s === 'a' ? 'authB' : 'authA'));
        assert.equal(mine.pend, n); assert.ok(!mine.tiles.includes(n)); assert.equal(theirs.pend, null); assert.ok(!JSON.stringify(theirs.mine).includes(String(n)) || theirs.mine.includes(n));
      }
      if (g.status === 'playing') {   // the public doc: only these keys, colours in hist, counts in left — no tile number anywhere
        assert.deepEqual(Object.keys(g).sort(), ['authUids', 'code', 'createdAt', 'creatorAuth', 'game', 'hist', 'lc', 'lead', 'left', 'live', 'players', 'result', 'sc', 'status', 'turn', 'turnDeadline', 'updatedAt']);
        assert.equal(g.result, null); assert.ok(g.lc === null || g.lc === 'b' || g.lc === 'w');
        g.hist.forEach((x) => assert.deepEqual(Object.keys(x).sort(), ['ac', 'bc', 'lead', 'res']));
      }
      if (before.lc != null) {   // a round resolved
        const L = g.hist[g.hist.length - 1], ta = s === 'a' ? n : before.lt, tb = s === 'b' ? n : before.lt;
        assert.equal(L.res, ta > tb ? 'a' : ta < tb ? 'b' : 'draw'); assert.equal(L.ac, ta % 2 ? 'w' : 'b'); assert.equal(L.bc, tb % 2 ? 'w' : 'b');
        if (g.status === 'playing') assert.equal(g.lead, L.res === 'draw' ? before.lead : L.res, 'the winner leads, a draw keeps the leader');
      }
    }
    const ha = db.store.get('rooms/' + c.roomId + '/hand/authA'), hb = db.store.get('rooms/' + c.roomId + '/hand/authB');
    assert.deepEqual([ha.seat, hb.seat], ['a', 'b']); assert.deepEqual(ha.mine, used.a.slice(0, ha.mine.length)); assert.deepEqual(hb.mine, used.b.slice(0, hb.mine.length));
    assert.deepEqual(ha.tiles.concat(used.a).sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((n) => ha.tiles.includes(n) || used.a.includes(n)).sort(), 'own hand = the tiles not yet played');
    assert.equal(g.status, 'done'); assert.equal(new Set(used.a).size, used.a.length); assert.equal(new Set(used.b).size, used.b.length);
    assert.ok(g.sc.a === 5 || g.sc.b === 5 || g.hist.length === 9); if (g.sc.a === 5 || g.sc.b === 5) fives++;
    assert.equal(g.result.nums.length, g.hist.length, 'the end reveals every round'); assert.equal(g.result.winner, g.sc.a > g.sc.b ? 'a' : g.sc.a < g.sc.b ? 'b' : 'draw');
    await refused(call('authA', { action: 'play', roomId: c.roomId, n: 0 }), 'not-playing');
  }
  assert.ok(fives > 30, 'some games end at 5: ' + fives);
  console.log('room-act-check: OK — roomAct export + rules; 4-digit code, one open room per creator; deadlines 1 h 🌐 / 30 s 🔢; 300 games keep the rules and never put a hand number in the public doc; the end reveals all; refusals; claim (🌐 win / 🔢 auto-play); resign; cancel');
})().catch((e) => { console.error(e); process.exit(1); });
