// 🌐 Rooms for 2-player games — the online referee (owner 2026-11-26: ไพ่เงา "ทำให้ user เล่น 2 คน" → B 🌐 with a friend through LINE
// + C 🔢 a live room; docs/MIND-GAMES-PLAN.md §2: one room server for every game that comes later). One callable,
// `roomAct({ game, action, roomId?, code?, n?, live? })`. Clients never write: rooms/{id} holds what both players may see, and
// rooms/{id}/secret/hands holds the numbers in each hand and the leader's face-down tile, which no client can read (firestore.rules).
// Only game 'bw' (⚫⚪ ไพ่เงา) today: tiles 0–8 once each, the other side sees only the colour (even ⚫ odd ⚪), higher wins the round,
// a draw scores nobody and keeps the leader, the winner leads next, 9 rounds or first to 5. Seats 'a' (the creator) and 'b'.
// A turn has a deadline: 1 h in a 🌐 game (as Cereal), 30 s in a 🔢 live room. After it the waiting player may `claim`:
// 🌐 → they win by timeout · 🔢 → the late player's lowest tile is played for them. Takes its I/O as `deps` (cereal-act pattern).
const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8], WIN_AT = 5, ROUNDS = 9;
const TURN_MS = 60 * 60 * 1000, LIVE_MS = 30 * 1000;
const col = (n) => (n % 2 ? 'w' : 'b');
const other = (s) => (s === 'a' ? 'b' : 'a');
const left = (hand) => { const b = hand.filter((n) => col(n) === 'b').length; return { b, w: hand.length - b }; };
/** what each player may see of their own hand: rooms/{id}/hand/{authUid} = { tiles: left in hand, mine: my number per round, pend: my face-down tile } */
function handDocs(g, sec) {
    const out = {}, lt = sec.lt, ltSeat = lt == null ? null : g.lc != null ? other(g.turn) : null;
    ['a', 'b'].forEach((s, i) => { const p = g.players && g.players[s]; if (p && p.authUid) out[p.authUid] = { seat: s, tiles: sec[s], mine: (sec.nums || []).map((x) => x[i]), pend: ltSeat === s ? lt : null }; });
    return out;
}
function code(rand) { let s = ''; for (let i = 0; i < 4; i++) s += Math.floor(rand() * 10); return s; }

/** one tile from `seat` on room g (public) + h (secret); returns the public and secret updates. Pure. */
function place(g, h, seat, n, now) {
    const hands = { a: h.a.slice(), b: h.b.slice() };
    hands[seat].splice(hands[seat].indexOf(n), 1);
    const ms = g.live ? LIVE_MS : TURN_MS, pub = { left: { a: left(hands.a), b: left(hands.b) }, updatedAt: now, turnDeadline: now + ms };
    if (g.lc == null) {   // the leader puts a tile face down: the follower sees its colour
        return { pub: Object.assign(pub, { lc: col(n), turn: other(seat) }), sec: { a: hands.a, b: hands.b, lt: n, nums: h.nums || [] } };
    }
    const ta = seat === 'a' ? n : h.lt, tb = seat === 'b' ? n : h.lt, res = ta > tb ? 'a' : ta < tb ? 'b' : 'draw';
    const sc = { a: g.sc.a + (res === 'a' ? 1 : 0), b: g.sc.b + (res === 'b' ? 1 : 0) };
    const hist = g.hist.concat([{ ac: col(ta), bc: col(tb), res, lead: g.lead }]), nums = (h.nums || []).concat([[ta, tb]]);
    const lead = res === 'draw' ? g.lead : res, end = sc.a >= WIN_AT || sc.b >= WIN_AT || hist.length >= ROUNDS;
    Object.assign(pub, { sc, hist, lead, lc: null, turn: lead });
    if (end) Object.assign(pub, { status: 'done', turn: null, turnDeadline: null, result: { winner: sc.a > sc.b ? 'a' : sc.a < sc.b ? 'b' : 'draw', reason: 'score', nums } });
    return { pub, sec: { a: hands.a, b: hands.b, lt: null, nums } };
}

function writeHands(tx, ref, g, sec) { const h = handDocs(g, sec); Object.keys(h).forEach((k) => tx.set(ref.collection('hand').doc(k), h[k])); }

// deps: { db, HttpsError, now, rand() }
async function handle(request, deps) {
    const { db, HttpsError } = deps;
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
    const authUid = request.auth.uid, d = request.data || {}, now = deps.now;
    const fail = (c, msg) => { throw new HttpsError('failed-precondition', msg, { code: c }); };
    const bad = (msg) => { throw new HttpsError('invalid-argument', msg); };
    if (d.game !== 'bw' && d.game !== 'secret') bad('game');

    async function me() {   // the LINE identity behind the anonymous Firebase user (as cerealAct / askNika)
        const link = await db.collection('user_auth_links').doc(authUid).get();
        const uid = link.exists && (link.data() || {}).effectiveUserId;
        if (!uid) throw new HttpsError('permission-denied', 'Open the app from LINE first');
        const u = await db.collection('users').doc(uid).get();
        if (!u.exists) throw new HttpsError('permission-denied', 'Open the app from LINE first');
        const x = u.data() || {};
        return { uid, authUid, name: String(x.nickName || x.firstName || x.displayName || 'Intern').slice(0, 20), pic: /^https:\/\//.test(x.pictureUrl || '') ? String(x.pictureUrl).slice(0, 500) : '' };
    }
    if (d.game === 'secret') return require('./room-secret.js').handle(request, deps, me);   // V101.380 🔢 เลขลับ หลายคน
    const rooms = db.collection('rooms');

    if (d.action === 'create') {
        const p = await me(), live = d.live === true;
        const open = { docs: (await rooms.where('creatorAuth', '==', authUid).where('status', '==', 'lobby').limit(4).get()).docs.filter((x) => (x.data().game || 'bw') === 'bw') };
        if (open.docs.length) {   // one open room per creator: switch its kind instead of piling rooms up
            const r = open.docs[0];
            if (!!r.data().live !== live) await r.ref.update({ live, updatedAt: now });
            return { roomId: r.id, code: r.data().code, name: p.name, existing: true };
        }
        let c = null;
        for (let i = 0; i < 12 && !c; i++) { const t = code(deps.rand); if ((await rooms.where('code', '==', t).where('status', '==', 'lobby').limit(1).get()).empty) c = t; }
        if (!c) fail('code', 'Try again');
        const ref = rooms.doc();
        await ref.set({ game: 'bw', code: c, status: 'lobby', live, creatorAuth: authUid, authUids: [authUid], players: { a: p, b: null },
            sc: { a: 0, b: 0 }, hist: [], lead: null, lc: null, turn: null, left: { a: left(ALL), b: left(ALL) }, result: null,
            createdAt: now, updatedAt: now, turnDeadline: null });
        await ref.collection('secret').doc('hands').set({ a: ALL.slice(), b: ALL.slice(), lt: null, nums: [] });
        await ref.collection('hand').doc(authUid).set({ seat: 'a', tiles: ALL.slice(), mine: [], pend: null });
        return { roomId: ref.id, code: c, name: p.name };
    }

    if (d.action === 'join') {
        const c = String(d.code || '').replace(/\D/g, '');
        if (c.length !== 4) bad('code');
        const p = await me();
        const q = (await rooms.where('code', '==', c).where('status', '==', 'lobby').limit(4).get()).docs.filter((x) => (x.data().game || 'bw') === 'bw');
        if (!q.length) fail('no-room', 'No open room with that code');
        const ref = q[0].ref;
        return db.runTransaction(async (tx) => {
            const g = (await tx.get(ref)).data();
            if (g.status !== 'lobby') fail('started', 'Already started');
            if (g.authUids.includes(authUid)) fail('own-room', 'This is your own room');
            const lead = deps.rand() < 0.5 ? 'a' : 'b';
            tx.set(ref.collection('hand').doc(authUid), { seat: 'b', tiles: ALL.slice(), mine: [], pend: null });
            tx.update(ref, { status: 'playing', authUids: g.authUids.concat([authUid]), players: { a: g.players.a, b: p }, lead, turn: lead,
                updatedAt: now, turnDeadline: now + (g.live ? LIVE_MS : TURN_MS) });
            return { roomId: ref.id, seat: 'b' };
        });
    }

    const id = String(d.roomId || '');
    if (!/^[A-Za-z0-9]{6,40}$/.test(id)) bad('roomId');
    const ref = rooms.doc(id), sref = ref.collection('secret').doc('hands');
    return db.runTransaction(async (tx) => {
        const gs = await tx.get(ref), hs = await tx.get(sref);
        if (!gs.exists) fail('no-room', 'No such room');
        const g = gs.data(), h = hs.data();
        const seat = g.players.a && g.players.a.authUid === authUid ? 'a' : g.players.b && g.players.b.authUid === authUid ? 'b' : null;
        if (!seat) throw new HttpsError('permission-denied', 'Not your room');

        if (d.action === 'cancel') {   // the creator closes a room nobody joined
            if (g.status !== 'lobby') fail('started', 'Already started');
            tx.update(ref, { status: 'done', result: { winner: null, reason: 'cancelled', nums: [] }, updatedAt: now });
            return { ok: true };
        }
        if (g.status !== 'playing') fail('not-playing', 'The game is not on');

        if (d.action === 'play') {
            const n = d.n;
            if (g.turn !== seat) fail('not-your-turn', 'Not your turn');
            if (!Number.isInteger(n) || !h[seat].includes(n)) fail('no-tile', 'That tile is not in your hand');
            const u = place(g, h, seat, n, now);
            tx.update(ref, u.pub); tx.set(sref, u.sec); writeHands(tx, ref, Object.assign({}, g, u.pub), u.sec);
            return { ok: true, done: u.pub.status === 'done' };
        }
        if (d.action === 'resign') {
            const nums = h.nums || [];
            tx.update(ref, { status: 'done', turn: null, turnDeadline: null, updatedAt: now, result: { winner: other(seat), reason: 'resigned', nums } });
            return { ok: true };
        }
        if (d.action === 'claim') {
            if (g.turn === seat) fail('your-turn', 'It is your turn');
            if (!g.turnDeadline || now < g.turnDeadline) fail('early', 'The other player still has time');
            if (!g.live) {
                tx.update(ref, { status: 'done', turn: null, turnDeadline: null, updatedAt: now, result: { winner: seat, reason: 'timeout', nums: h.nums || [] } });
                return { ok: true, done: true };
            }
            const late = g.turn, n = Math.min.apply(null, h[late]), u = place(g, h, late, n, now);   // 🔢 live: their lowest tile
            tx.update(ref, u.pub); tx.set(sref, u.sec); writeHands(tx, ref, Object.assign({}, g, u.pub), u.sec);
            return { ok: true, auto: true, done: u.pub.status === 'done' };
        }
        bad('action');
    });
}

module.exports = { handle, place, handDocs, TURN_MS, LIVE_MS };
