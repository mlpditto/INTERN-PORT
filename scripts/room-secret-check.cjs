// V101.380 🔢 เลขลับ หลายคน — functions/room-secret.js through the roomAct callable on an in-memory Firestore, up to 7 LINE users, no
// network. Proves: create → a 4-digit code; up to 6 join (the 7th is refused); only the host starts and only with 2+; each player gets a
// different 1–100, readable only in their own hand doc; `ask` answers truthfully (same menu as public/secret.js), costs 🎫 1, the answer
// reaches only the asker's hand and the public log shows who asked whom what but never the answer or a number; `guess` right = ⭐ +3
// and the target is out (the log may then show their number), wrong = ⭐ −1 and 🎫 −1 (kept in my hand); the turn skips players who are
// out or have no 🎫; the game ends when one is left in or nobody in has a 🎫, the most ⭐ wins and every number is revealed; claim skips
// a late turn (1 h, or 60 s in a live room); resign; refusals (not your turn, yourself, someone out, no 🎫, bad question / number).
// Also: a ไพ่เงา room and a เลขลับ room with the same creator do not mix.
const assert = require('node:assert/strict');
const path = require('node:path');
const R = require(path.join(__dirname, '..', 'functions', 'room-act.js'));
const S = require(path.join(__dirname, '..', 'functions', 'room-secret.js'));

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
const isPrime = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
const truth = { gt: (n, a) => n > a, even: (n) => n % 2 === 0, div3: (n) => n % 3 === 0, prime: isPrime, unit: (n, a) => n % 10 === a, range: (n, a, b) => n >= Math.min(a, b) && n <= Math.max(a, b) };

(async () => {
  for (const [k, f] of Object.entries(truth)) for (let n = 1; n <= 100; n++) for (const a of [0, 3, 9, 50, 99]) assert.equal(S.QS[k].test(n, a, 40), f(n, a, 40), k + ' ' + n + ' ' + a);
  const db = fakeDb(); const U = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  U.forEach((x) => { db.store.set('user_auth_links/auth' + x, { effectiveUserId: 'U' + x }); db.store.set('users/U' + x, { nickName: 'N' + x }); });
  let T = 1e12, seed = 11; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const call = (x, data) => R.handle({ auth: { uid: 'auth' + x }, data: Object.assign({ game: 'secret' }, data) }, { db, HttpsError, now: T, rand });
  const refused = async (p, c) => { try { await p; } catch (e) { assert.equal((e.details && e.details.code) || e.code, c); return; } assert.fail('expected ' + c); };
  const pub = (id) => db.store.get('rooms/' + id), hand = (id, x) => db.store.get('rooms/' + id + '/hand/auth' + x);

  // ไพ่เงา and เลขลับ rooms of the same creator stay apart
  const bw = await R.handle({ auth: { uid: 'authA' }, data: { game: 'bw', action: 'create' } }, { db, HttpsError, now: T, rand });
  const c1 = await call('A', { action: 'create', live: true });
  assert.notEqual(c1.roomId, bw.roomId, 'its own room'); assert.equal(pub(c1.roomId).game, 'secret');
  await refused(R.handle({ auth: { uid: 'authB' }, data: { game: 'bw', action: 'join', code: c1.code } }, { db, HttpsError, now: T, rand }), c1.code === bw.code ? 'own-room' : 'no-room');
  await refused(call('B', { action: 'start', roomId: c1.roomId }), 'permission-denied');
  for (const x of ['B', 'C', 'D', 'E', 'F']) await call(x, { action: 'join', code: c1.code });
  await refused(call('G', { action: 'join', code: c1.code }), 'full');
  await refused(call('B', { action: 'start', roomId: c1.roomId }), 'not-host');
  await call('A', { action: 'start', roomId: c1.roomId });
  let g = pub(c1.roomId); const sec = db.store.get('rooms/' + c1.roomId + '/secret/hands').nums;
  assert.equal(g.status, 'playing'); assert.equal(new Set(Object.values(sec)).size, 6, 'six different numbers');
  ['A', 'B', 'C', 'D', 'E', 'F'].forEach((x) => { assert.equal(hand(c1.roomId, x).n, sec['auth' + x]); assert.equal(g.tickets['auth' + x], 6); });
  assert.ok(g.turnDeadline - T === S.LIVE_MS, 'live: 60 s');
  const turnX = g.turn.slice(4), other = turnX === 'A' ? 'B' : 'A';
  await refused(call(other, { action: 'ask', roomId: c1.roomId, to: 'auth' + turnX, q: 'even' }), 'not-your-turn');
  await refused(call(turnX, { action: 'ask', roomId: c1.roomId, to: 'auth' + turnX, q: 'even' }), 'invalid-argument');
  await refused(call(turnX, { action: 'ask', roomId: c1.roomId, to: 'auth' + other, q: 'colour' }), 'invalid-argument');
  await refused(call(turnX, { action: 'ask', roomId: c1.roomId, to: 'auth' + other, q: 'gt', a: 500 }), 'invalid-argument');
  const r1 = await call(turnX, { action: 'ask', roomId: c1.roomId, to: 'auth' + other, q: 'gt', a: 50 });
  assert.equal(r1.ans, sec['auth' + other] > 50); g = pub(c1.roomId);
  assert.deepEqual(hand(c1.roomId, turnX).notes, [{ to: 'auth' + other, q: 'gt', a: 50, b: 0, ans: r1.ans }], 'the answer goes to the asker only');
  assert.equal((hand(c1.roomId, other).notes || []).length, 0);
  assert.deepEqual(Object.keys(g.log[0]).sort(), ['at', 'by', 'k', 'to', 'txt']); assert.equal(g.log[0].txt, 'มากกว่า 50 ?');
  assert.equal(g.tickets['auth' + turnX], 5);
  // claim skips a late turn
  await refused(call(turnX, { action: 'claim', roomId: c1.roomId }), 'early');
  T += S.LIVE_MS + 1; const late = g.turn;
  await call(late === 'authA' ? 'B' : 'A', { action: 'claim', roomId: c1.roomId });
  g = pub(c1.roomId); assert.notEqual(g.turn, late); assert.equal(g.log[g.log.length - 1].k, 'skip');
  // a right guess: +3, out, the number public; a wrong one: −1, 🎫 −1, kept in my hand
  let gx = g.turn.slice(4), target = g.order.find((u) => u !== g.turn);
  await call(gx, { action: 'guess', roomId: c1.roomId, to: target, n: sec[target] });
  g = pub(c1.roomId); assert.equal(g.score['auth' + gx], 3); assert.equal(g.out[target], true); assert.equal(g.log[g.log.length - 1].k, 'out');
  await refused(call(g.turn.slice(4), { action: 'ask', roomId: c1.roomId, to: target, q: 'even' }), 'out');
  gx = g.turn.slice(4); const t2 = g.order.find((u) => u !== g.turn && !g.out[u]), wrongN = sec[t2] === 1 ? 2 : 1;
  const before = g.tickets['auth' + gx];
  await call(gx, { action: 'guess', roomId: c1.roomId, to: t2, n: wrongN });
  g = pub(c1.roomId); assert.equal(g.score['auth' + gx], -1); assert.equal(g.tickets['auth' + gx], before - 1); assert.deepEqual(hand(c1.roomId, gx).wrong, [{ to: t2, n: wrongN }]);
  // resign
  const quitter = g.order.find((u) => u !== g.turn && !g.out[u]);
  await call(quitter.slice(4), { action: 'resign', roomId: c1.roomId }); g = pub(c1.roomId); assert.equal(g.out[quitter], true);

  // 200 random games of 2–5: the rules, the public log never holds an answer or a hidden number
  for (let k = 0; k < 200; k++) {
    const n = 2 + (k % 4), who = U.slice(0, n), host = who[0];
    const c = await call(host, { action: 'create', live: false }); for (const x of who.slice(1)) await call(x, { action: 'join', code: c.code });
    await call(host, { action: 'start', roomId: c.roomId });
    const nums = db.store.get('rooms/' + c.roomId + '/secret/hands').nums;
    for (let guard = 0; guard < 200; guard++) {
      g = pub(c.roomId); if (g.status !== 'playing') break;
      const me = g.turn, x = me.slice(4), targets = g.order.filter((u) => u !== me && !g.out[u]), to = targets[Math.floor(rand() * targets.length)];
      assert.ok(!g.out[me] && g.tickets[me] > 0, 'the turn holder is in and has a 🎫');
      if (rand() < 0.75) { const keys = Object.keys(S.QS), q = keys[Math.floor(rand() * keys.length)]; const r = await call(x, { action: 'ask', roomId: c.roomId, to, q, a: q === 'unit' ? Math.floor(rand() * 10) : 1 + Math.floor(rand() * 100), b: 1 + Math.floor(rand() * 100) }); const L = hand(c.roomId, x).notes.slice(-1)[0]; assert.equal(r.ans, truth[q](nums[to], L.a, L.b)); }
      else { const guess = rand() < 0.3 ? nums[to] : 1 + Math.floor(rand() * 100); await call(x, { action: 'guess', roomId: c.roomId, to, n: guess }); }
      g = pub(c.roomId);
      if (g.status === 'playing') {
        const hidden = g.order.filter((u) => !g.out[u]).map((u) => nums[u]);
        g.log.forEach((L) => { assert.ok(!('ans' in L)); if (L.k === 'guess' && !L.right) assert.ok(true); if (L.k === 'out') assert.ok(!hidden.includes(L.n) || g.out[L.to]); });
      }
    }
    g = pub(c.roomId); assert.equal(g.status, 'done');
    const inside = g.order.filter((u) => !g.out[u]);
    assert.ok(inside.length <= 1 || inside.every((u) => g.tickets[u] === 0), 'ends at one left or no 🎫');
    assert.deepEqual(g.result.nums, nums, 'every number revealed'); assert.equal(g.score[g.result.winners[0]], Math.max(...g.order.map((u) => g.score[u])));
  }
  console.log('room-secret-check: OK — same menu as public/secret.js; rooms per game; 2–6 seats, host starts; different numbers, each in its own hand; ask truthful, answer to the asker only, 🎫 −1; guess +3 out / −1 🎫 −1; claim skips, resign; 200 random games end right, most ⭐ wins, all revealed');
})().catch((e) => { console.error(e); process.exit(1); });
