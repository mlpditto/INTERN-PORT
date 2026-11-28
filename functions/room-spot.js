// 🪞 Memory Fracture with friends — the referee for game 'spot' in the roomAct callable (owner 2026-11-28: "เล่นกับเพื่อนพร้อมเดิมพัน",
// PR 2 of docs/MEMORY-SPOT-PLAN.md; picks: the room layout of mock-spot-room/, 2 players = winner 💎+2 · loser 0, no "found all"
// bonus in a room, after 📊 the host goes on or the room does in 30 s). Live rooms only, 2–7 friends, no 🤖. The shelf and its
// changes are spot-scene.js — the same file the 🤖 practice runs on the page, copied next to this one (scripts/room-spot-check.cjs
// checks the two match). The referee makes the shelf: rooms/{id}/secret/scene keeps the seed, the changed shelf, the list of changes,
// every bet and every answer, and no client reads it. The room itself shows only what the step allows:
//   👀 look  — the original shelf            (✓ Ready from everyone moves on early)
//   🎲 bet   — the original shelf, who has bet (the bets stay hidden)
//   🔍 find  — the changed shelf only, who has answered (the original is taken out again)
//   📊 show  — the changes, everyone's answer, bet, points and 💎
// My own bet and answer sit in rooms/{id}/hand/{login}. Everyone starts with 💎 3. A round: points = (found − wrong, never below 0) ×
// the bet; ×1.5 costs 💎1, ×2 costs 💎2 and 💎1 more past 2 wrong taps. Then by points (only above 0 earns): the best 💎+2; with 3 or
// more players the next 💎+1 and the lowest 💎−1. 3 rounds; most 💎 wins, then most points. Each step has a clock (60 · 10 · 90 ·
// 30 s); after it anyone may `claim`: a missing bet is ×1, a missing answer is no taps. 🏳 leaving takes that seat out; one player
// left ends the game. Takes its I/O as `deps`.
const S = require('./spot-scene.js');
const SEATS = 7, GEMS = 3, SHOW = 30;
const MS = { look: S.LOOK * 1000, bet: S.BET * 1000, find: S.FIND * 1000, show: SHOW * 1000 };
function code(rand) { let s = ''; for (let i = 0; i < 4; i++) s += Math.floor(rand() * 10); return s; }
const clone = (x) => JSON.parse(JSON.stringify(x));

/** the seats still playing */
function active(g) { return g.gem.map((x, s) => s).filter((s) => !g.out[s]); }
/** the taps a player may send: whole numbers, each slot once, inside the shelf, at most the changes + 2 */
function okTaps(g, taps) {
    if (!Array.isArray(taps) || taps.length > g.max) return false;
    const seen = {};
    return taps.every((k) => Number.isInteger(k) && k >= 0 && k < g.cols * g.rows && !seen[k] && (seen[k] = 1));
}
/** a new round: the shelf comes from the referee's own seed; only the original goes public */
function deal(g, level, rand) {
    const seed = Math.floor(rand() * 2147483647), sc = S.make(level, seed);
    Object.assign(g, { phase: 'look', cols: sc.cols, rows: sc.rows, orig: sc.orig, changed: null, diffs: null, max: sc.diffs.length + 2, ready: {}, sent: {}, res: null });
    return { seed, changed: sc.changed, diffs: sc.diffs, bets: {}, taps: {} };
}
/** the 💎 a round's rank is worth, per seat, among the seats still playing. Rank = 1 + how many scored more (ties share a rank,
 *  1 · 1 · 3). Rank 1 💎+2 and rank 2 💎+1, only with points above 0; the lowest score 💎−1 when it is rank 3 or lower.
 *  Two players: only the winner earns (owner: winner +2, loser 0). */
function rankGems(pts, seats) {
    const out = {}, rank = {};
    seats.forEach((s) => { out[s] = 0; rank[s] = 1 + seats.filter((o) => pts[o] > pts[s]).length; });
    if (!seats.length) return out;
    const low = Math.min.apply(null, seats.map((s) => pts[s]));
    seats.forEach((s) => {
        if (rank[s] === 1) out[s] = pts[s] > 0 ? 2 : 0;
        else if (seats.length < 3) out[s] = 0;
        else if (rank[s] === 2) out[s] = pts[s] > 0 ? 1 : 0;
        else if (pts[s] === low) out[s] = -1;
    });
    return out;
}
/** 🔍 → 📊: judge every answer, pay the bets, pay the rank; the changes go public */
function reveal(g, sec) {
    const sc = { diffs: sec.diffs }, seats = active(g), pts = {}, res = [];
    g.gem.forEach((x, s) => {
        if (g.out[s]) { res[s] = null; return; }
        const taps = sec.taps[s] || [], bet = sec.bets[s] || 1, j = S.judge(sc, taps), raw = Math.max(0, j.n - j.wrong.length);
        let cost = -S.BETS[bet]; if (bet === 2 && j.wrong.length > 2) cost -= 1;
        pts[s] = raw * bet;
        res[s] = { bet, found: j.found, n: j.n, wrong: j.wrong, pts: pts[s], cost, rank: 0, gem: 0 };
    });
    const rg = rankGems(pts, seats), order = seats.slice().sort((a, b) => pts[b] - pts[a]);
    seats.forEach((s) => {
        res[s].win = rg[s]; res[s].gem = res[s].cost + rg[s]; res[s].rank = 1 + order.filter((o) => pts[o] > pts[s]).length;
        g.gem[s] = Math.max(0, g.gem[s] + res[s].gem); g.pts[s] += pts[s];
    });
    Object.assign(g, { phase: 'show', diffs: sec.diffs, res, ready: {}, sent: {} });
}
/** the final order of seats: most 💎, then most points, then the seat; the ones who left come last */
function ranking(g) {
    return g.gem.map((x, s) => s).sort((a, b) => (!!g.out[a] - !!g.out[b]) || g.gem[b] - g.gem[a] || g.pts[b] - g.pts[a] || a - b);
}

async function handle(request, deps, me) {
    const { db, HttpsError } = deps;
    const authUid = request.auth.uid, d = request.data || {}, now = deps.now;
    const fail = (c, msg) => { throw new HttpsError('failed-precondition', msg, { code: c }); };
    const bad = (msg) => { throw new HttpsError('invalid-argument', msg); };
    const rooms = db.collection('rooms');
    const lvl = (v) => (v === 1 || v === 3 ? v : 2);

    if (d.action === 'create') {
        const p = await me(), level = lvl(d.level);
        const open = await rooms.where('creatorAuth', '==', authUid).where('status', '==', 'lobby').limit(4).get();
        const mine = open.docs.filter((x) => x.data().game === 'spot')[0];
        if (mine) { if (mine.data().level !== level) await mine.ref.update({ level, updatedAt: now }); return { roomId: mine.id, code: mine.data().code, name: p.name, existing: true }; }
        let c = null;
        for (let i = 0; i < 12 && !c; i++) { const t = code(deps.rand); if ((await rooms.where('code', '==', t).where('status', '==', 'lobby').limit(1).get()).empty) c = t; }
        if (!c) fail('code', 'Try again');
        const ref = rooms.doc();
        await ref.set({ game: 'spot', code: c, status: 'lobby', live: true, level, rounds: S.ROUNDS, creatorAuth: authUid, authUids: [authUid], players: { [authUid]: p }, order: [authUid],
            g: null, result: null, createdAt: now, updatedAt: now, turnDeadline: null });
        return { roomId: ref.id, code: c, name: p.name };
    }
    if (d.action === 'join') {
        const c = String(d.code || '').replace(/\D/g, '');
        if (c.length !== 4) bad('code');
        const p = await me();
        const q = await rooms.where('code', '==', c).where('status', '==', 'lobby').limit(4).get();
        const doc = q.docs.filter((x) => x.data().game === 'spot')[0];
        if (!doc) fail('no-room', 'No open room with that code');
        return db.runTransaction(async (tx) => {
            const g = (await tx.get(doc.ref)).data();
            if (g.status !== 'lobby') fail('started', 'Already started');
            if (g.authUids.includes(authUid)) return { roomId: doc.id, already: true };
            if (g.order.length >= SEATS) fail('full', 'The room is full');
            tx.update(doc.ref, { authUids: g.authUids.concat([authUid]), order: g.order.concat([authUid]), players: Object.assign({}, g.players, { [authUid]: p }), updatedAt: now });
            return { roomId: doc.id };
        });
    }

    const id = String(d.roomId || '');
    if (!/^[A-Za-z0-9]{6,40}$/.test(id)) bad('roomId');
    const ref = rooms.doc(id), sref = ref.collection('secret').doc('scene'), href = (u) => ref.collection('hand').doc(u);
    return db.runTransaction(async (tx) => {
        const gs = await tx.get(ref);
        if (!gs.exists) fail('no-room', 'No such room');
        const room = gs.data();
        if (room.game !== 'spot') bad('game');
        if (!room.authUids.includes(authUid)) throw new HttpsError('permission-denied', 'Not your room');
        const hs = await tx.get(sref), sec = hs.exists ? hs.data() : null;
        const order = room.order;

        if (d.action === 'cancel') {
            if (room.status !== 'lobby' || room.creatorAuth !== authUid) fail('not-yours', 'Only the host closes a waiting room');
            tx.update(ref, { status: 'done', result: { rank: [], reason: 'cancelled' }, updatedAt: now });
            return { ok: true };
        }
        const hands = (g, round) => order.forEach((u, s) => { if (!g.out[s]) tx.set(href(u), { seat: s, round, bet: null, taps: null }); });
        /** write the room; the clock restarts only when the step changes */
        function save(g, secret, extra, reason) {
            const key = g.phase + ':' + g.round, up = Object.assign({ g, updatedAt: now }, extra || {});
            if (g.phase === 'end') Object.assign(up, { status: 'done', turnDeadline: null, wait: 'end', result: { rank: ranking(g).map((s) => order[s]), reason: reason || 'score' } });
            else Object.assign(up, { wait: key, turnDeadline: key === room.wait && room.turnDeadline ? room.turnDeadline : now + MS[g.phase] });
            tx.set(sref, secret);
            tx.update(ref, up);
            return { ok: true, phase: g.phase, done: g.phase === 'end' };
        }
        if (d.action === 'start') {
            if (room.status !== 'lobby') fail('started', 'Already started');
            if (room.creatorAuth !== authUid) fail('not-host', 'Only the host starts');
            if (order.length < 2) fail('alone', 'Wait for a friend');
            const g = { round: 1, rounds: S.ROUNDS, level: room.level, gem: order.map(() => GEMS), pts: order.map(() => 0), out: {} };
            const secret = deal(g, room.level, deps.rand);
            hands(g, 1);
            return save(g, secret, { status: 'playing' });
        }
        if (room.status !== 'playing') fail('not-playing', 'The game is not on');
        const seat = order.indexOf(authUid), g = clone(room.g), secret = clone(sec);
        const playing = () => active(g);
        const all = (map) => playing().every((s) => map[s]);
        /** move on when the step is complete (or its time is up: `force`) */
        function advance(force) {
            if (g.phase === 'look' && (force || all(g.ready))) { g.phase = 'bet'; g.ready = {}; g.sent = {}; }
            else if (g.phase === 'bet' && (force || all(g.sent))) { g.phase = 'find'; g.sent = {}; g.changed = secret.changed; g.orig = null; }
            else if (g.phase === 'find' && (force || all(g.sent))) reveal(g, secret);
            else if (g.phase === 'show' && force) {
                if (g.round >= g.rounds) g.phase = 'end';
                else { g.round++; Object.assign(secret, deal(g, g.level, deps.rand)); hands(g, g.round); }
            }
        }
        if (g.out[seat] && d.action !== 'claim') fail('left', 'You left this game');

        if (d.action === 'ready') {
            if (g.phase !== 'look') fail('not-now', 'Not now');
            g.ready[seat] = true; advance(false);
            return save(g, secret);
        }
        if (d.action === 'bet') {
            if (g.phase !== 'bet') fail('not-now', 'Not betting now');
            if (g.sent[seat]) fail('sent', 'Your bet is in');
            const b = d.bet === 1.5 || d.bet === 2 ? d.bet : d.bet === 1 ? 1 : null;
            if (b == null || S.BETS[b] > g.gem[seat]) fail('bad-bet', 'Pick a bet you can pay');
            secret.bets[seat] = b; g.sent[seat] = true;
            tx.set(href(authUid), { seat, round: g.round, bet: b, taps: null });
            advance(false);
            return save(g, secret);
        }
        if (d.action === 'taps') {
            if (g.phase !== 'find') fail('not-now', 'Not finding now');
            if (g.sent[seat]) fail('sent', 'Your answer is in');
            if (!okTaps(g, d.taps)) fail('bad-taps', 'Tap slots on the shelf');
            secret.taps[seat] = d.taps.slice(); g.sent[seat] = true;
            tx.set(href(authUid), { seat, round: g.round, bet: secret.bets[seat] || 1, taps: d.taps.slice() });
            advance(false);
            return save(g, secret);
        }
        if (d.action === 'next') {   // after 📊 the host goes on at once
            if (g.phase !== 'show') fail('not-now', 'Not now');
            if (room.creatorAuth !== authUid) fail('not-host', 'Only the host goes on');
            advance(true);
            return save(g, secret);
        }
        if (d.action === 'claim') {   // the step's time is up: go on without the late ones
            if (!room.turnDeadline || now < room.turnDeadline) fail('early', 'There is still time');
            advance(true);
            return save(g, secret);
        }
        if (d.action === 'resign') {   // 🏳 my seat is out; one player left ends the game
            const players = Object.assign({}, room.players, { [authUid]: Object.assign({}, room.players[authUid], { left: true }) });
            g.out[seat] = true;
            if (playing().length < 2) { g.phase = 'end'; return save(g, secret, { players }, 'left'); }
            advance(false);
            return save(g, secret, { players });
        }
        bad('action');
    });
}

module.exports = { handle, rankGems, reveal, ranking, okTaps, deal, MS, SEATS, GEMS, SHOW };
