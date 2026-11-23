// V101.349 🥣 Cereal Killer Phase 3 online — functions/cereal-act.js with THREE players (🔪 → 🐕 → 🕵️) on the in-memory Firestore.
// Proves: create with 🐕 3 คน + the printed pair (city + suburb, Lola on the bowl); the room waits until all three seats are taken
// (join takes the first free seat); the killer is blocked by Lola too and hands over to Lola; lolaUse = walk + one ability — sniff /
// bark answers come back to her and land in secret/lola, NEVER in the public doc; lolaNotes is Lola-only; one ability a turn, never last
// turn's; the walk is fixed after the ability; lolaEnd turns to the detective; the 6th card 🏡 is open on the 3-player map; a missed
// bite costs a shared 🛡️ and ends her turn; a stale Lola is claimed (she stays, the detective moves on); 2-player games unchanged.
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const C = require(path.join(root, 'functions', 'cereal-act.js'));
const R = require(path.join(root, 'public', 'cereal-rules.js'));
const MAPS = require(path.join(root, 'public', 'cereal-maps.js'));

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
for (const [a, u, n] of [['authK', 'Uk', 'Pond'], ['authL', 'Ul', 'Doggo'], ['authD', 'Ud', 'Mint'], ['authX', 'Ux', 'Out']]) { db.store.set('user_auth_links/' + a, { effectiveUserId: u }); db.store.set('users/' + u, { nickName: n }); }
let NOW = 1_800_000_000_000;
const call = (auth, data) => C.handle({ auth: { uid: auth, token: {} }, data }, { db, HttpsError, isAdmin: () => false, now: NOW, rand: () => 0.42 });
async function refused(p, code, msg) {
    try { await p; } catch (e) { assert.ok(e instanceof HttpsError, msg + ' threw ' + e); if (code) assert.equal((e.details && e.details.code) || e.code, code, msg + ': ' + e.message); return; }
    assert.fail(msg + ': was accepted');
}
const pub = (id) => db.store.get('cereal_games/' + id);
const sec = (id, d) => db.store.get('cereal_games/' + id + '/secret/' + d);
const kposOf = (s) => { const ds = Object.keys(s.path || {}).map(Number).sort((a, b) => b - a); return ds.length ? s.path[ds[0]].slice(-1)[0] : s.home; };
function killerTurn(map, g, s) {   // any legal day for the referee (keeps the calendar)
    const pos = kposOf(s), blocked = [g.detectivePos, g.lola && g.lola.pos].filter((x) => x != null);
    const homes = pos == null ? R.killerHomeOptions(map) : [pos];
    for (const h of homes) for (const p of R.legalPaths(map, h, R.STEPS.killer, { canRide: true, blocked })) {
        for (const k of R.killOptions(map, p, g.cereals).concat([null])) {
            for (const w of (k != null && R.witnessOptions(map, k).length ? R.witnessOptions(map, k) : [null])) {
                const v = R.validateKillerTurn(map, { path: p, kill: k, witness: w }, { blocked, taken: g.cereals, kills: g.kills, skipUsed: g.skipUsed });
                if (v.ok && R.calendarOk(g.day, v.kills) && v.kills >= Math.min(6, g.day)) return { path: p, kill: k, witness: w };
            }
        }
    }
    throw new Error('no killer turn');
}

(async () => {
    // ---- 2-player create is unchanged (mode 2, no lola)
    const two = await call('authX', { action: 'create', role: 'killer', side: 'A' });
    assert.equal(pub(two.gameId).mode, 2); assert.equal(pub(two.gameId).lola, undefined);
    await call('authX', { action: 'cancel', gameId: two.gameId });

    // ---- 3 players: create (🔪, pair 1 = A + A) → Lola joins (still lobby) → detective joins (playing)
    const cr = await call('authK', { action: 'create', role: 'killer', lola: true, pair: 1 });
    const id = cr.gameId;
    let g = pub(id);
    assert.deepEqual([g.mode, g.citySide, g.suburbSide, g.lola.pos, g.status, Object.keys(g.players)], [3, 'A', 'A', 22, 'lobby', ['killer', 'lola', 'detective']], 'three seats, A + A, Lola on the bowl (22)');
    assert.deepEqual(sec(id, 'lola'), { notes: [] });
    const j1 = await call('authL', { action: 'join', code: cr.code });
    assert.deepEqual([j1.role, j1.started, pub(id).status], ['lola', false, 'lobby'], 'the second player takes 🐕; the room still waits');
    const j2 = await call('authD', { action: 'join', code: cr.code });
    assert.deepEqual([j2.role, j2.started, pub(id).status, pub(id).turnDeadline], ['detective', true, 'playing', NOW + C.TURN_MS], 'the third seat starts the game');
    await refused(call('authX', { action: 'join', code: cr.code }), 'no-game', 'a full room is no longer open');

    const map = R.buildMap(MAPS, 'A', 'A');
    // ---- day 1 killer: 1›2›3›8, kill 3, witness 4; Lola on 22 is a block
    await call('authK', { action: 'killerMove', gameId: id, path: [1, 2, 3, 8], kill: 3, witness: 4 });
    assert.equal(pub(id).phase, 'lola', '🔪 → 🐕');
    await refused(call('authD', { action: 'lolaEnd', gameId: id, path: [22] }), 'not-your-turn', 'not the detective turn');
    await refused(call('authL', { action: 'lolaUse', gameId: id, path: [22, 17, 16, 10], ability: 'bark' }), 'path', 'Lola never rides the subway (16 → 10)');
    await refused(call('authL', { action: 'lolaUse', gameId: id, path: [22, 17, 18, 13], ability: 'sniff', cell: 7 }), 'reach', 'sniff own or next cell only');
    const sn = await call('authL', { action: 'lolaUse', gameId: id, path: [22, 17, 18, 13], ability: 'sniff', cell: 8 });
    assert.equal(sn.answer, 'center', 'the referee answers her: the killer is on 8');
    assert.ok(!JSON.stringify(pub(id)).includes('center'), 'the answer is NOT in the public doc');
    assert.deepEqual(sec(id, 'lola').notes, [{ day: 1, a: 'sniff', cell: 8, from: 13, ans: 'center' }], 'her notebook in secret/lola');
    assert.ok(pub(id).log.some((e) => e.text === '🐕 👃 ดมช่อง 8'), 'the log names the move');
    assert.equal((await call('authL', { action: 'lolaNotes', gameId: id })).notes.length, 1);
    await refused(call('authD', { action: 'lolaNotes', gameId: id }), 'permission-denied', 'lolaNotes is Lola-only');
    await refused(call('authK', { action: 'lolaNotes', gameId: id }), 'permission-denied', 'lolaNotes is Lola-only (killer)');
    await refused(call('authL', { action: 'lolaUse', gameId: id, path: [22, 17, 18, 13], ability: 'bark' }), 'used', 'one ability a turn');
    await refused(call('authL', { action: 'lolaEnd', gameId: id, path: [22, 17, 18] }), 'path', 'the walk is fixed after the ability');
    await call('authL', { action: 'lolaEnd', gameId: id, path: [22, 17, 18, 13] });
    g = pub(id);
    assert.deepEqual([g.phase, g.lola.pos, g.lola.last], ['detective', 13, 'sniff'], '🐕 → 🕵️, Lola at 13, sniff rests');
    await call('authD', { action: 'detectiveEnd', gameId: id, path: [14] });
    assert.deepEqual([pub(id).day, pub(id).phase], [2, 'killer']);

    // ---- day 2: Lola (13) blocks the killer at 8
    await refused(call('authK', { action: 'killerMove', gameId: id, path: [8, 13, 12, 11], kill: null }), null, 'the killer may not step onto Lola');
    let t = killerTurn(map, pub(id), sec(id, 'killer'));
    await call('authK', { action: 'killerMove', gameId: id, path: t.path, kill: t.kill, witness: t.witness });
    await refused(call('authL', { action: 'lolaUse', gameId: id, path: [13], ability: 'sniff', cell: 13 }), 'ability', 'sniff rests a turn');
    const bk = await call('authL', { action: 'lolaUse', gameId: id, path: [13, 12], ability: 'bark' });
    const kp = kposOf(sec(id, 'killer'));
    assert.equal(bk.answer, R.bark(map, 12, kp), 'bark answers truthfully');
    assert.ok(!JSON.stringify(pub(id)).includes('"ans"'), 'no answers in the public doc');
    await call('authL', { action: 'lolaEnd', gameId: id, path: [13, 12] });
    if (pub(id).witness != null && R.canQuestion(map, 14, pub(id).witness)) {
        const a = await call('authD', { action: 'ask', gameId: id, path: [14], question: 'area' });
        assert.ok(['city', 'suburb'].includes(a.answer), 'the 🏡 card answers city / suburb');
    }
    await call('authD', { action: 'detectiveEnd', gameId: id, path: [14] });

    // ---- day 3: a missed bite costs a shared 🛡️ and ends her turn
    t = killerTurn(map, pub(id), sec(id, 'killer'));
    await call('authK', { action: 'killerMove', gameId: id, path: t.path, kill: t.kill, witness: t.witness });
    const kp3 = kposOf(sec(id, 'killer')), miss = map.ids.find((c) => R.arrestValid(map, 12, c) && c !== kp3);
    const bt = await call('authL', { action: 'lolaUse', gameId: id, path: [12], ability: 'bite', cell: miss });
    g = pub(id);
    assert.deepEqual([bt.caught, g.arrestsLeft, g.phase, g.lola.last], [false, 3, 'detective', 'bite'], 'a missed bite: 🛡️ 4 → 3, turn ends');
    await call('authD', { action: 'detectiveEnd', gameId: id, path: [14] });

    // ---- day 4: a stale Lola is claimed after 1 h — she stays, the detective moves on
    t = killerTurn(map, pub(id), sec(id, 'killer'));
    await call('authK', { action: 'killerMove', gameId: id, path: t.path, kill: t.kill, witness: t.witness });
    await refused(call('authD', { action: 'claim', gameId: id }), 'too-early', 'not before 1 h');
    NOW += C.TURN_MS + 1;
    await call('authD', { action: 'claim', gameId: id });
    g = pub(id);
    assert.deepEqual([g.phase, g.lola.pos, g.lola.last], ['detective', 12, null], 'claimed: Lola stays on 12');
    assert.ok(g.log.some((e) => e.text === '⏳ 🐕 timeout'));
    console.log('cereal-act-lola-check: OK — 3 seats + pair, room waits for all three, killer blocked by 🐕, sniff / bark answered to Lola only (secret/lola, never the public doc), lolaNotes Lola-only, one ability / no repeat / walk fixed, 🏡 card, missed bite shares 🛡️, stale Lola claimed, 2-player create unchanged');
})().catch((e) => { console.error(e); process.exit(1); });
