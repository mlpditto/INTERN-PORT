// 🥣 Cereal Killer Phase 2 PR 1 — functions/cereal-act.js (the cerealAct callable) on a small in-memory Firestore, two players
// (two anonymous auth uids linked to two LINE users), no network. Proves: the engine copies in functions/ are byte-identical to
// public/; create → join starts the game with a 1 h turn deadline; a scripted game (the rulebook day 8›3›2›1, kill 3, witness 4 →
// the detective walks to the witness, asks, misses an arrest → day 2 → a correct arrest) ends with the right winner and
// result.revealedPath equal to what the killer sent; the killer's home and path never appear in the PUBLIC doc while the game runs;
// every illegal action is refused with its code (outsider, wrong turn, bad path, kill off the path, second card, early claim…);
// a stale turn can be claimed after 1 h (killer → detective wins; detective → the turn ends in place); resign ends the game.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
for (const f of ['cereal-rules.js', 'cereal-maps.js']) {
    assert.equal(fs.readFileSync(path.join(root, 'functions', f), 'utf8').replace(/\r\n/g, '\n'), fs.readFileSync(path.join(root, 'public', f), 'utf8').replace(/\r\n/g, '\n'), 'functions/' + f + ' is a byte copy of public/' + f + ' (copy it again after changing the engine)');
}
const idx = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
assert.ok(/exports\.cerealAct = onCall\(/.test(idx) && idx.includes("require('./cereal-act').handle(request"), 'functions/index.js exports cerealAct');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
assert.ok(/match \/cereal_games\/\{gameId\} \{\s*allow read: if isAdmin\(\) \|\| \(isSignedIn\(\) && request\.auth\.uid in resource\.data\.authUids\);\s*allow write: if false;\s*match \/secret\/\{doc\} \{\s*allow read, write: if false;/.test(rules), 'rules: players read their game, nobody writes, nobody reads secret');
const C = require(path.join(root, 'functions', 'cereal-act.js'));

// ---- a tiny Firestore: collections, docs, sub-collections, equality where + limit, transactions -------------------------
function fakeDb() {
    const store = new Map();   // path -> data
    let auto = 0;
    const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
    const snap = (p) => ({ id: p.split('/').pop(), exists: store.has(p), data: () => clone(store.get(p)), ref: docRef(p) });
    function docRef(p) {
        return {
            id: p.split('/').pop(), path: p,
            get: async () => snap(p),
            set: async (v) => { store.set(p, clone(v)); },
            update: async (v) => { store.set(p, Object.assign(clone(store.get(p)) || {}, clone(v))); },
            collection: (n) => colRef(p + '/' + n)
        };
    }
    function colRef(p, filters, lim) {
        filters = filters || [];
        return {
            doc: (id) => docRef(p + '/' + (id || ('g' + String(++auto).padStart(12, '0')))),
            where: (f, op, v) => { assert.equal(op, '=='); return colRef(p, filters.concat([[f, v]]), lim); },
            limit: (n) => colRef(p, filters, n),
            get: async () => {
                let docs = [...store.keys()].filter((k) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/'))
                    .filter((k) => filters.every(([f, v]) => (store.get(k) || {})[f] === v)).map(snap);
                if (lim) docs = docs.slice(0, lim);
                return { empty: !docs.length, docs };
            }
        };
    }
    const db = {
        collection: (n) => colRef(n),
        runTransaction: async (fn) => {
            const writes = [];
            const tx = { get: (ref) => ref.get(), set: (ref, v) => writes.push(() => ref.set(v)), update: (ref, v) => writes.push(() => ref.update(v)) };
            const out = await fn(tx);
            for (const w of writes) await w();
            return out;
        },
        store
    };
    return db;
}
class HttpsError extends Error { constructor(code, msg, details) { super(msg); this.code = code; this.details = details; } }

const db = fakeDb();
db.store.set('user_auth_links/authK', { effectiveUserId: 'Ukiller' });
db.store.set('user_auth_links/authD', { effectiveUserId: 'Udet' });
db.store.set('user_auth_links/authX', { effectiveUserId: 'Uout' });
db.store.set('users/Ukiller', { nickName: 'Pond' });
db.store.set('users/Udet', { nickName: 'Mint' });
db.store.set('users/Uout', { nickName: 'Out' });
let NOW = 1_800_000_000_000;
const call = (auth, data) => C.handle({ auth: auth ? { uid: auth, token: {} } : null, data }, { db, HttpsError, isAdmin: () => false, now: NOW, rand: () => 0.3 });
async function refused(p, code, msg) {
    try { await p; } catch (e) { assert.ok(e instanceof HttpsError, msg + ' threw ' + e); if (code) assert.equal((e.details && e.details.code) || e.code, code, msg + ': ' + e.message); return; }
    assert.fail(msg + ' should be refused');
}
const pub = (id) => db.store.get('cereal_games/' + id);
const secret = (id) => db.store.get('cereal_games/' + id + '/secret/killer');

(async () => {
    await refused(call(null, { action: 'create', role: 'killer' }), 'unauthenticated', 'no login');
    await refused(call('authNobody', { action: 'create', role: 'killer' }), 'permission-denied', 'not linked to LINE');

    // create + join
    const c = await call('authK', { action: 'create', role: 'killer', side: 'A' });
    assert.ok(/^[A-HJ-NP-Z2-9]{6}$/.test(c.code), 'invite code: ' + c.code);
    assert.deepEqual((await call('authK', { action: 'create', role: 'detective' })).gameId, c.gameId, 'one open lobby per creator');
    assert.equal(pub(c.gameId).status, 'lobby');
    await refused(call('authK', { action: 'join', code: c.code }), 'own-game', 'cannot join your own game');
    await refused(call('authD', { action: 'join', code: 'ZZZZZZ' }), 'no-game', 'unknown code');
    const j = await call('authD', { action: 'join', code: c.code.toLowerCase() });
    assert.equal(j.role, 'detective');
    const id = c.gameId;
    let g = pub(id);
    assert.equal(g.status, 'playing'); assert.deepEqual(g.authUids, ['authK', 'authD']); assert.equal(g.turnDeadline, NOW + 3600000, '1 h turn');
    assert.deepEqual(g.names, { killer: 'Pond', detective: 'Mint' });
    await refused(call('authX', { action: 'join', code: c.code }), 'no-game', 'a started game takes nobody else');
    await refused(call('authX', { action: 'killerMove', gameId: id, path: [8, 3, 2, 1] }), 'permission-denied', 'outsider');
    await refused(call('authD', { action: 'ask', gameId: id, path: [7], question: 'building' }), 'not-your-turn', 'detective before the killer');

    // killer day 1 — illegal first
    await refused(call('authK', { action: 'killerMove', gameId: id, path: [2, 3, 8, 9] }), 'home', 'home must be a house');
    await refused(call('authK', { action: 'killerMove', gameId: id, path: [8, 3, 2] }), 'short', 'exactly 3 steps');
    await refused(call('authK', { action: 'killerMove', gameId: id, path: [8, 3, 2, 1], kill: 5, witness: null }), 'kill', 'kill off the path');
    await refused(call('authK', { action: 'killerMove', gameId: id, path: [8, 3, 2, 1], kill: 3, witness: null }), 'witness', 'a park touches 3 → witness required');
    await call('authK', { action: 'killerMove', gameId: id, path: [8, 3, 2, 1], kill: 3, witness: 4 });
    g = pub(id);
    assert.deepEqual({ phase: g.phase, cereals: g.cereals, witness: g.witness, kills: g.kills }, { phase: 'detective', cereals: [3], witness: 4, kills: 1 });
    assert.deepEqual(secret(id), { home: 8, path: { 1: [8, 3, 2, 1] }, kills: { 1: 3 } });
    const leak = (gg) => { const s = JSON.stringify(Object.assign({}, gg, { result: null })); return /"home"|8,3,2,1|revealed/.test(s); };
    assert.ok(!leak(g), 'the public doc never holds the home or the path: ' + JSON.stringify(g));
    await refused(call('authK', { action: 'killerMove', gameId: id, path: [1, 2, 3, 4] }), 'not-your-turn', 'killer twice');
    // Phase 2 PR 2: mySecret — the killer's own notebook, nobody else's
    assert.deepEqual((await call('authK', { action: 'mySecret', gameId: id })).secret, { home: 8, path: { 1: [8, 3, 2, 1] }, kills: { 1: 3 } }, 'the killer reads back the notebook');
    await refused(call('authD', { action: 'mySecret', gameId: id }), 'permission-denied', 'the detective never gets the notebook');
    await refused(call('authX', { action: 'mySecret', gameId: id }), 'permission-denied', 'an outsider never gets it');

    // detective day 1: café → 8 → 9 (next to 👁️ 4), ask, a second card refused, miss at 4
    await refused(call('authD', { action: 'ask', gameId: id, path: [8, 9], question: 'building' }), 'start', 'day 1 starts on a café');
    await refused(call('authD', { action: 'ask', gameId: id, path: [7, 8], question: 'building' }), 'reach', 'not next to the witness yet');
    await refused(call('authD', { action: 'ask', gameId: id, path: [7, 8, 9], question: 'area' }), null, 'the area card is 3-player only');
    const a = await call('authD', { action: 'ask', gameId: id, path: [7, 8, 9], question: 'building' });
    assert.equal(a.answer, 'yes', 'killer on house 1 → in a building');
    await refused(call('authD', { action: 'ask', gameId: id, path: [7, 8, 9], question: 'row' }), 'asked', 'one card per witness');
    await refused(call('authD', { action: 'detectiveEnd', gameId: id, path: [7, 2], arrest: null }), 'path', 'after asking, the walk continues the asked path');
    await refused(call('authD', { action: 'detectiveEnd', gameId: id, path: [7, 8, 9], arrest: 1 }), 'arrest', 'arrest reach is own cell or a neighbour');
    const miss = await call('authD', { action: 'detectiveEnd', gameId: id, path: [7, 8, 9], arrest: 4 });
    assert.equal(miss.caught, false);
    g = pub(id);
    assert.deepEqual({ day: g.day, phase: g.phase, pos: g.detectivePos, witness: g.witness, arrests: g.arrestsLeft, used: g.usedQuestions }, { day: 2, phase: 'killer', pos: 9, witness: null, arrests: 3, used: ['building'] });
    assert.ok(!leak(g), 'still no secret in public after day 1');

    // claim: too early, then after 1 h a stale detective turn would end in place — here the killer is stale → detective wins (on a copy)
    await refused(call('authD', { action: 'claim', gameId: id }), 'too-early', 'claim before the hour');
    await refused(call('authK', { action: 'claim', gameId: id }), 'your-turn', 'cannot claim your own turn');

    // killer day 2: 1›6›11›12, kill 11 (no park next to 11 → no witness); the detective blocks 9
    await refused(call('authK', { action: 'killerMove', gameId: id, path: [8, 9, 10, 15] }), 'start', 'day 2 starts at 1');
    await call('authK', { action: 'killerMove', gameId: id, path: [1, 6, 11, 12], kill: 11, witness: null });
    g = pub(id);
    assert.equal(g.witness, null); assert.deepEqual(g.cereals, [3, 11]);
    // detective day 2: 9 → 14 → 13, arrest 12 → caught
    const win = await call('authD', { action: 'detectiveEnd', gameId: id, path: [9, 14, 13], arrest: 12 });
    assert.equal(win.caught, true);
    g = pub(id);
    assert.equal(g.status, 'finished'); assert.deepEqual({ w: g.result.winner, r: g.result.reason, cell: g.result.cell }, { w: 'good', r: 'arrest', cell: 12 });
    assert.deepEqual(g.result.revealedPath, { 1: [8, 3, 2, 1], 2: [1, 6, 11, 12] }, 'revealedPath = what the killer sent');
    assert.equal(g.result.revealedHome, 8);
    await refused(call('authK', { action: 'killerMove', gameId: id, path: [12, 13, 14, 15] }), 'not-playing', 'no moves after the end');

    // Phase 2 PR 2: cancel an unjoined room; a started game cannot be cancelled
    const cx = await call('authX', { action: 'create', role: 'killer' });
    await call('authX', { action: 'cancel', gameId: cx.gameId });
    assert.equal(pub(cx.gameId).status, 'cancelled', 'an unjoined room is cancelled');
    await refused(call('authD', { action: 'join', code: cx.code }), 'no-game', 'a cancelled room takes nobody');
    await refused(call('authK', { action: 'cancel', gameId: id }), 'started', 'a started game is not cancelled');

    // a second game: a stale killer is claimed after 1 h → detective wins on time; a third: resign
    const c2 = await call('authD', { action: 'create', role: 'detective', side: 'B' });
    await call('authK', { action: 'join', code: c2.code });
    assert.equal(pub(c2.gameId).players.killer.authUid, 'authK');
    NOW += 3600000 + 1;
    await call('authD', { action: 'claim', gameId: c2.gameId });
    assert.deepEqual({ s: pub(c2.gameId).status, w: pub(c2.gameId).result.winner, r: pub(c2.gameId).result.reason }, { s: 'finished', w: 'good', r: 'timeout' });
    // stale detective: the killer claims, the turn ends at the first café, day 2 begins
    const c3 = await call('authK', { action: 'create', role: 'killer', side: 'A' });
    await call('authD', { action: 'join', code: c3.code });
    await call('authK', { action: 'killerMove', gameId: c3.gameId, path: [8, 3, 2, 1], kill: 3, witness: 4 });
    NOW += 3600000 + 1;
    await call('authK', { action: 'claim', gameId: c3.gameId });
    g = pub(c3.gameId);
    assert.deepEqual({ day: g.day, phase: g.phase, pos: g.detectivePos, witness: g.witness }, { day: 2, phase: 'killer', pos: 7, witness: null }, 'stale detective: turn ends at the first café');
    await call('authD', { action: 'resign', gameId: c3.gameId });
    assert.deepEqual({ s: pub(c3.gameId).status, w: pub(c3.gameId).result.winner }, { s: 'finished', w: 'killer' }, 'resign hands the win over');

    // Phase 4: 🏅 on the result + cereal_stats/{LINE uid}. Game 1 = an arrest on day 2 after one miss, one card → ⚡ only;
    // game 2 = ⏳ timeout and game 3 = resign earn nothing but still count as played / won.
    assert.deepEqual(pub(id).result.ach, { detective: ['quick'] }, 'game 1 earns ⚡ ปิดคดีไว for the detective only');
    assert.deepEqual(pub(c2.gameId).result.ach, {}, 'a timeout earns nothing');
    assert.deepEqual(pub(c3.gameId).result.ach, {}, 'a resign earns nothing');
    const stat = (u) => { const s = db.store.get('cereal_stats/' + u); return s && { p: s.played, k: s.winsKiller, d: s.winsDetective, l: s.winsLola, a: s.ach, t: typeof s.updatedAt }; };
    assert.deepEqual(stat('Udet'), { p: 3, k: 0, d: 2, l: 0, a: { quick: 1 }, t: 'number' }, 'detective stats');
    assert.deepEqual(stat('Ukiller'), { p: 3, k: 1, d: 0, l: 0, a: {}, t: 'number' }, 'killer stats');
    assert.equal(db.store.get('cereal_stats/Uout'), undefined, 'a cancelled room writes no stats');
    assert.ok(/match \/cereal_stats\/\{userId\} \{\s*allow read: if isAdmin\(\) \|\| isSelfOrLinked\(userId\);\s*allow write: if false;/.test(rules), 'rules: own stats readable, nobody writes');
    // every achievement from a crafted finished game (pure)
    const A = (f) => C.achievementsOf(Object.assign({ mode: 2, arrestsLeft: 4, usedQuestions: ['row'], skipUsed: false, kills: 3 }, f));
    const fin = (winner, reason, day) => ({ winner, reason, day: day || 5 });
    assert.deepEqual(A({ result: fin('good', 'arrest') }), { detective: ['instinct'] }, '🧠 first try');
    assert.deepEqual(A({ arrestsLeft: 1, result: fin('good', 'arrest') }), { detective: ['distrust'] }, '🤨 last 🛡️');
    assert.deepEqual(A({ arrestsLeft: 2, result: fin('good', 'cornered') }), { detective: ['cornered'] }, '🧱 cornered');
    assert.deepEqual(A({ arrestsLeft: 2, mode: 3, result: fin('good', 'cornered') }), { lola: ['cornered'], detective: ['cornered'] }, '🧱 goes to 🐕 too');
    assert.deepEqual(A({ arrestsLeft: 2, result: fin('good', 'calendar', 3) }), { detective: ['quick'] }, '⚡ by day 3');
    assert.deepEqual(A({ arrestsLeft: 2, usedQuestions: [], result: fin('good', 'calendar') }), { detective: ['nocards'] }, '🙈 no card');
    assert.deepEqual(A({ mode: 3, arrestsLeft: 2, result: fin('good', 'bite') }), { lola: ['k9'] }, '🐕 K9');
    assert.deepEqual(A({ skipUsed: true, kills: 6, arrestsLeft: 4, result: fin('killer', 'survived', 7) }), { killer: ['planner', 'bowl', 'invisible'] }, '🗓 🥣 🫥');
    assert.deepEqual(A({ mode: 3, arrestsLeft: 0, result: fin('killer', 'arrests') }), { killer: ['scentless'] }, '👃 a 3-player win');
    assert.deepEqual(A({ skipUsed: true, kills: 6, result: fin('killer', 'resigned') }), {}, 'resign earns none');
    assert.equal(C.ACH.length, 10);
    const onl = fs.readFileSync(path.join(root, 'public', 'cereal-online.js'), 'utf8');
    C.ACH.forEach((x) => assert.ok(onl.includes("['" + x + "', "), 'cereal-online.js names ' + x));
    console.log('cereal-act-check: OK — engine copies match, create/join (1 h deadline), scripted game to a correct arrest with revealedPath, secret never public while playing, illegal actions refused with codes, claim after 1 h (killer → loses, detective → turn ends), resign, 🏅 + cereal_stats');
})().catch((e) => { console.error(e); process.exit(1); });
