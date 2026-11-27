// V101.389 🪨 Carry 13 online — functions/room-rock13.js through the roomAct callable on an in-memory Firestore, no network.
// Proves: functions/rock13-rules.js is the same file as public/rock13-rules.js; create → a 4-digit code, 7 rounds kept; up to 7 join
// (the 8th is refused); only the host starts and only with 2+; 2 people get 🤖 up to 3 seats; a secret pick never shows in the room
// (only "sent") until everyone has picked, and my own pick sits in my hand doc; then the picks show and the queue runs: not your turn
// is refused, 🌈 needs a carrier, ⏭ Pass works once; bots act inside the call; claim is refused before 60 s, after it a missing pick
// is drawn and a late turn is placed (🌈 → the lightest carrier); a game played to the end ranks every seat as rock13-rules does and
// closes the room; 🏳 a leaver's seat becomes a 🤖, everyone leaving ends it; a เลขลับ room of the same host does not mix.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const R = require(path.join(root, 'functions', 'room-act.js'));
const Rules = require(path.join(root, 'public', 'rock13-rules.js'));
assert.equal(fs.readFileSync(path.join(root, 'functions', 'rock13-rules.js'), 'utf8').replace(/\r/g, ''), fs.readFileSync(path.join(root, 'public', 'rock13-rules.js'), 'utf8').replace(/\r/g, ''), 'functions/rock13-rules.js = public/rock13-rules.js (copy it after a rules change)');

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
  let T = 1e12, seed = 5; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const call = (x, data) => R.handle({ auth: { uid: 'auth' + x }, data: Object.assign({ game: 'rock13' }, data) }, { db, HttpsError, now: T, rand });
  const refused = async (p, c) => { try { await p; } catch (e) { assert.equal((e.details && e.details.code) || e.code, c); return; } assert.fail('expected ' + c); };
  const pub = (id) => db.store.get('rooms/' + id);
  const full = (id) => { const r = pub(id), G = JSON.parse(JSON.stringify(r.g)); if (G.phase === 'submit') G.subs = (db.store.get('rooms/' + id + '/secret/subs') || {}).subs || {}; return G; };

  // a เลขลับ room of the same host stays apart
  const sec = await R.handle({ auth: { uid: 'authA' }, data: { game: 'secret', action: 'create' } }, { db, HttpsError, now: T, rand });
  const c1 = await call('A', { action: 'create', rounds: 7 });
  assert.match(c1.code, /^\d{4}$/); assert.notEqual(c1.roomId, sec.roomId);
  assert.equal(pub(c1.roomId).rounds, 7); assert.equal(pub(c1.roomId).live, true, 'every Carry 13 room is live (pick ค)');
  assert.equal((await call('A', { action: 'create', rounds: 7 })).roomId, c1.roomId, 'one open room per host');
  // 7 seats, the 8th refused
  for (const x of ['B', 'C', 'D', 'E', 'F', 'G']) await call(x, { action: 'join', code: c1.code });
  await refused(call('H', { action: 'join', code: c1.code }), 'full');
  await refused(call('B', { action: 'start', roomId: c1.roomId }), 'not-host');
  // 2 people → 🤖 fill to 3
  const c2 = await call('H', { action: 'create', rounds: 14 });
  await refused(call('H', { action: 'start', roomId: c2.roomId }), 'alone');
  await call('A', { action: 'join', code: c2.code });
  await call('H', { action: 'start', roomId: c2.roomId });
  let r2 = pub(c2.roomId);
  assert.equal(r2.order.length, 3); assert.ok(r2.players[r2.order[2]].bot, 'the third seat is a 🤖'); assert.equal(r2.g.rounds, 14);
  assert.equal(r2.g.phase, 'submit'); assert.equal(r2.g.sent[2], true, 'the 🤖 has picked at once');
  assert.deepEqual(r2.g.subs, {}, 'picks never show while picking');
  // secret picks
  await call('H', { action: 'pick', roomId: c2.roomId, card: 6, chip: 'r' });
  r2 = pub(c2.roomId);
  assert.equal(r2.g.sent[0], true); assert.deepEqual(r2.g.subs, {}); assert.ok(!JSON.stringify(r2).includes('"card":6'), 'my 6 is nowhere in the room');
  assert.deepEqual(db.store.get('rooms/' + c2.roomId + '/hand/authH').sub, { card: 6, chip: 'r', round: 1 }, 'my pick in my hand doc');
  await refused(call('H', { action: 'pick', roomId: c2.roomId, card: 5, chip: 'g' }), 'bad-pick');
  await refused(call('A', { action: 'pick', roomId: c2.roomId, card: 9, chip: 'g' }), 'bad-pick');
  await refused(call('A', { action: 'claim', roomId: c2.roomId }), 'early');
  // the 60 s run out: A's pick is drawn
  T += 61000;
  await call('H', { action: 'claim', roomId: c2.roomId });
  r2 = pub(c2.roomId);
  assert.ok(r2.g.phase === 'place' || r2.g.round === 2, 'the round goes on');
  if (r2.g.phase === 'place') assert.equal(r2.g.subs[0].card, 6, 'picks show once everyone is in');
  assert.equal(r2.turnDeadline, T + 60000, 'a new 60 s for whoever is next');

  // the big room: play all 7 rounds, people choosing, checking each step against rock13-rules
  await call('A', { action: 'start', roomId: c1.roomId });
  const id = c1.roomId, ids = pub(id).order;
  assert.equal(ids.length, 7, 'no 🤖 when there are 3+');
  let passes = 0, rainbows = 0, guard = 0;
  while (pub(id).status === 'playing' && guard++ < 400) {
    const r = pub(id), G = full(id);
    if (G.phase === 'submit') {
      for (let s = 0; s < ids.length; s++) if (!r.g.sent[s]) {
        const p = G.players[s], chip = p.chips.w > 0 && G.round % 7 === 5 ? 'w' : ['r', 'g', 'b', 'w'].find((c) => p.chips[c] > 0);
        await call(ids[s].slice(4), { action: 'pick', roomId: id, card: p.cards[(s + G.round) % p.cards.length], chip });
      }
      continue;
    }
    const t = Rules.turn(G), who = ids[t].slice(4), other = ids[(t + 1) % ids.length].slice(4);
    await refused(call(other, { action: 'place', roomId: id, st: 'r' }), 'not-your-turn');
    const exp = JSON.parse(JSON.stringify(G));
    if (Rules.canPass(G, t) && passes < 3 && Rules.preview(G, t, G.subs[t].chip === 'w' ? 'r' : G.subs[t].chip).take) {
      await call(who, { action: 'pass', roomId: id }); Rules.pass(exp, t); passes++;
      await refused(call(who, { action: 'pass', roomId: id }), Rules.turn(full(id)) === t ? 'no-pass' : 'not-your-turn');
    } else if (G.subs[t].chip === 'w') {
      await refused(call(who, { action: 'place', roomId: id }), 'bad-place');
      await call(who, { action: 'place', roomId: id, st: 'g' }); Rules.place(exp, t, 'g'); rainbows++;
    } else { await call(who, { action: 'place', roomId: id }); Rules.place(exp, t, null); }
    if (exp.phase !== 'submit') { const now = full(id); assert.deepEqual(now.stands, exp.stands, 'the room follows rock13-rules'); assert.deepEqual(now.players.map((p) => p.pen), exp.players.map((p) => p.pen)); }
  }
  const done = pub(id);
  assert.equal(done.status, 'done'); assert.equal(done.g.phase, 'end'); assert.equal(done.turnDeadline, null);
  assert.deepEqual(done.result.rank, Rules.ranking(done.g).map((s) => ids[s]), 'the rank is rock13-rules ranking');
  assert.ok(rainbows > 0, '🌈 was played'); assert.ok(passes > 0, '⏭ was played');
  await refused(call('A', { action: 'pick', roomId: id, card: 0, chip: 'r' }), 'not-playing');

  // a late turn is placed for them; 🌈 goes to the lightest
  const c3 = await call('B', { action: 'create', rounds: 7 });
  await call('C', { action: 'join', code: c3.code }); await call('B', { action: 'start', roomId: c3.roomId });
  let rainbowLate = false;
  for (let k = 0; k < 60 && pub(c3.roomId).status === 'playing'; k++) {
    const G = full(c3.roomId);
    if (G.phase === 'submit') {
      const r = pub(c3.roomId);
      for (const [s, x] of [[0, 'B'], [1, 'C']]) if (!r.g.sent[s]) { const p = G.players[s]; await call(x, { action: 'pick', roomId: c3.roomId, card: p.cards[0], chip: p.chips.w ? 'w' : ['r', 'g', 'b'].find((c) => p.chips[c] > 0) }); }
      continue;
    }
    const t = Rules.turn(G), late = Rules.lightest(G), chip = G.subs[t].chip, n0 = G.log.length;
    T += 61000; await call(t === 0 ? 'C' : 'B', { action: 'claim', roomId: c3.roomId });
    const log = pub(c3.roomId).g.log[n0];
    assert.deepEqual([log.k, log.s, log.auto], ['place', t, true], 'the late one was placed, no pass, marked auto (V101.390 ⏱ line)'); if (chip === 'w') { assert.equal(log.st, late, '🌈 → the lightest carrier'); rainbowLate = true; break; }
  }
  assert.ok(rainbowLate, 'a late 🌈 was placed for them');
  // 🏳 leaving: the seat becomes a 🤖; everyone leaving ends it
  const c4 = await call('D', { action: 'create', rounds: 7 });
  await call('E', { action: 'join', code: c4.code }); await call('D', { action: 'start', roomId: c4.roomId });
  await call('E', { action: 'resign', roomId: c4.roomId });
  let r4 = pub(c4.roomId);
  assert.equal(r4.status, 'playing'); assert.equal(r4.g.players[1].bot, true); assert.equal(r4.players.authE.left, true); assert.equal(r4.g.sent[1], true, 'the new 🤖 picked for the leaver');
  await call('D', { action: 'resign', roomId: c4.roomId });
  r4 = pub(c4.roomId); assert.equal(r4.status, 'done'); assert.equal(r4.result.reason, 'left');
  // cancel a waiting room
  const c5 = await call('F', { action: 'create' });
  await refused(call('G', { action: 'cancel', roomId: c5.roomId }), 'permission-denied');
  await call('F', { action: 'cancel', roomId: c5.roomId }); assert.equal(pub(c5.roomId).result.reason, 'cancelled');
  console.log('room-rock13-check: OK — rules copy matches; code + 7/14 rounds, live only; 7 seats (8th refused); host starts with 2+; 🤖 fill to 3; picks hidden until all are in; queue: not your turn refused, 🌈 needs a carrier, ⏭ once; follows rock13-rules step by step to the end (' + passes + ' ⏭, ' + rainbows + ' 🌈); claim: early refused, a missing pick drawn, a late turn placed (🌈 → lightest); 🏳 seat → 🤖, all leave → ends; cancel');
})().catch((e) => { console.error(e); process.exit(1); });
