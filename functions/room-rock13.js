// 🪨 Carry 13 online — the referee for game 'rock13' in the roomAct callable (owner 2026-11-27: PR 2 of docs/MIND-GAMES-PLAN.md §8;
// pick ค = live rooms only, ⚡ 60 s a pick / a turn; layout B, mockup-rock13-online/). 2–7 friends, 🤖 fill the room up to 3. The rules
// are rock13-rules.js — the same file the 🤖 practice runs on the page, copied next to this one (scripts/room-rock13-check.cjs checks
// the two match). A round: everyone picks a card + a chip in secret (the picks wait in rooms/{id}/secret/subs, no client reads them;
// my own pick sits in rooms/{id}/hand/{login}) → when all are in, they show and everyone places in turn (▸ place or ⏭ Pass, 🌈 picks
// its carrier). Bots act inside the same call. Time out (anyone may `claim` after 60 s): a missing pick is drawn at random, a late
// turn places without passing and 🌈 goes to the lightest carrier. 🏳 leaving turns that seat into a 🤖. Takes its I/O as `deps`.
const R = require('./rock13-rules.js');
const SEATS = 7, MIN_SEATS = 3, LIVE_MS = 60 * 1000;
function code(rand) { let s = ''; for (let i = 0; i < 4; i++) s += Math.floor(rand() * 10); return s; }
const clone = (x) => JSON.parse(JSON.stringify(x));

/** who the game waits on: 'submit:<round>' or 'place:<round>:<seat>'; the clock restarts when this changes */
function waitKey(G) { return G.phase === 'submit' ? 'submit:' + G.round : G.phase === 'place' ? 'place:' + G.round + ':' + R.turn(G) : 'end'; }
/** let every 🤖 act until a person has to: bots pick at once, and place when their turn comes */
function advance(G, rand) {
    for (let guard = 0; guard < 500; guard++) {
        if (G.phase === 'submit') {
            const todo = G.players.map((p, s) => s).filter((s) => G.players[s].bot && !G.subs[s]);
            if (!todo.length) return;
            todo.forEach((s) => { const b = R.botPick(G, s, rand); R.submit(G, s, b.card, b.chip); });
            continue;
        }
        if (G.phase !== 'place') return;
        const t = R.turn(G);
        if (t < 0 || !G.players[t].bot) return;
        const b = R.botTurn(G, t);
        if (b.pass) R.pass(G, t); else R.place(G, t, b.pick);
    }
}
/** a pick drawn at random for a person whose 60 s ran out */
function randomPick(G, s, rand) {
    const p = G.players[s], chips = Object.keys(p.chips).filter((c) => p.chips[c] > 0);
    return { card: p.cards[Math.floor(rand() * p.cards.length)], chip: chips[Math.floor(rand() * chips.length)] };
}
/** split the full game into what everyone sees (the picks hidden while picking) and the secret picks */
function split(G) {
    const pub = clone(G), subs = G.phase === 'submit' ? clone(G.subs) : {};
    if (G.phase === 'submit') { pub.sent = {}; Object.keys(G.subs).forEach((s) => { pub.sent[s] = true; }); pub.subs = {}; } else pub.sent = {};
    return { pub, subs };
}

async function handle(request, deps, me) {
    const { db, HttpsError } = deps;
    const authUid = request.auth.uid, d = request.data || {}, now = deps.now;
    const fail = (c, msg) => { throw new HttpsError('failed-precondition', msg, { code: c }); };
    const bad = (msg) => { throw new HttpsError('invalid-argument', msg); };
    const rooms = db.collection('rooms');

    if (d.action === 'create') {
        const p = await me(), rounds = d.rounds === 7 ? 7 : 14;
        const open = await rooms.where('creatorAuth', '==', authUid).where('status', '==', 'lobby').limit(4).get();
        const mine = open.docs.filter((x) => x.data().game === 'rock13')[0];
        if (mine) { if (mine.data().rounds !== rounds) await mine.ref.update({ rounds, updatedAt: now }); return { roomId: mine.id, code: mine.data().code, name: p.name, existing: true }; }
        let c = null;
        for (let i = 0; i < 12 && !c; i++) { const t = code(deps.rand); if ((await rooms.where('code', '==', t).where('status', '==', 'lobby').limit(1).get()).empty) c = t; }
        if (!c) fail('code', 'Try again');
        const ref = rooms.doc();
        await ref.set({ game: 'rock13', code: c, status: 'lobby', live: true, rounds, creatorAuth: authUid, authUids: [authUid], players: { [authUid]: p }, order: [authUid],
            g: null, wait: null, result: null, createdAt: now, updatedAt: now, turnDeadline: null });
        return { roomId: ref.id, code: c, name: p.name };
    }
    if (d.action === 'join') {
        const c = String(d.code || '').replace(/\D/g, '');
        if (c.length !== 4) bad('code');
        const p = await me();
        const q = await rooms.where('code', '==', c).where('status', '==', 'lobby').limit(4).get();
        const doc = q.docs.filter((x) => x.data().game === 'rock13')[0];
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
    const ref = rooms.doc(id), sref = ref.collection('secret').doc('subs'), href = (u) => ref.collection('hand').doc(u);
    return db.runTransaction(async (tx) => {
        const gs = await tx.get(ref);
        if (!gs.exists) fail('no-room', 'No such room');
        const room = gs.data();
        if (room.game !== 'rock13') bad('game');
        if (!room.authUids.includes(authUid)) throw new HttpsError('permission-denied', 'Not your room');
        const hs = await tx.get(sref), secret = hs.exists ? hs.data() : { subs: {} };

        if (d.action === 'cancel') {
            if (room.status !== 'lobby' || room.creatorAuth !== authUid) fail('not-yours', 'Only the host closes a waiting room');
            tx.update(ref, { status: 'done', result: { rank: [], reason: 'cancelled' }, updatedAt: now });
            return { ok: true };
        }
        /** write the new state: public room, secret picks, the clock, the end */
        function save(G, order, extra) {
            const k = waitKey(G), s = split(G), up = Object.assign({ g: s.pub, wait: k, updatedAt: now }, extra || {});
            up.turnDeadline = k === 'end' ? null : k === room.wait && room.turnDeadline ? room.turnDeadline : now + LIVE_MS;
            if (G.phase === 'end') Object.assign(up, { status: 'done', turnDeadline: null, result: { rank: R.ranking(G).map((x) => order[x]), reason: 'score' } });
            tx.set(sref, { subs: s.subs });
            tx.update(ref, up);
            return { ok: true, done: G.phase === 'end' };
        }
        if (d.action === 'start') {
            if (room.status !== 'lobby') fail('started', 'Already started');
            if (room.creatorAuth !== authUid) fail('not-host', 'Only the host starts');
            if (room.order.length < 2) fail('alone', 'Wait for a friend');
            const order = room.order.slice(), players = Object.assign({}, room.players);
            for (let i = 1; order.length < MIN_SEATS; i++) { order.push('bot' + i); players['bot' + i] = { name: '🤖' + i, pic: '', bot: true }; }
            const G = R.create(order.map((u) => ({ id: u, name: players[u].name, bot: !!players[u].bot })), room.rounds, Math.floor(deps.rand() * order.length));
            advance(G, deps.rand);
            room.wait = null;
            room.order.forEach((u) => tx.set(href(u), { seat: order.indexOf(u), sub: null }));
            return save(G, order, { status: 'playing', order, players });
        }
        if (room.status !== 'playing') fail('not-playing', 'The game is not on');
        const order = room.order, seat = order.indexOf(authUid), G = clone(room.g);
        G.subs = G.phase === 'submit' ? clone(secret.subs || {}) : G.subs;
        delete G.sent;

        if (d.action === 'pick') {
            if (G.phase !== 'submit') fail('not-now', 'Not picking now');
            if (!R.canSubmit(G, seat, d.card, d.chip)) fail('bad-pick', 'Pick a card and a chip you still have');
            R.submit(G, seat, d.card, d.chip);
            tx.set(href(authUid), { seat, sub: { card: d.card, chip: d.chip, round: room.g.round } });
            advance(G, deps.rand);
            return save(G, order);
        }
        if (d.action === 'place' || d.action === 'pass') {
            if (G.phase !== 'place' || R.turn(G) !== seat) fail('not-your-turn', 'Not your turn');
            if (d.action === 'pass') { if (!R.pass(G, seat)) fail('no-pass', 'You cannot pass now'); }
            else if (!R.place(G, seat, d.st)) fail('bad-place', 'Tap a carrier');
            advance(G, deps.rand);
            return save(G, order);
        }
        if (d.action === 'claim') {   // the 60 s ran out: pick at random / place for them
            if (!room.turnDeadline || now < room.turnDeadline) fail('early', 'They still have time');
            if (G.phase === 'submit') G.players.forEach((p, s) => { if (!G.subs[s]) { const r = randomPick(G, s, deps.rand); R.submit(G, s, r.card, r.chip); } });
            else if (G.phase === 'place') { const t = R.turn(G); R.place(G, t, G.subs[t].chip === 'w' ? R.lightest(G) : null); }
            advance(G, deps.rand);
            return save(G, order);
        }
        if (d.action === 'resign') {   // 🏳 my seat turns into a 🤖 and the game goes on; nobody left → it ends
            const players = Object.assign({}, room.players, { [authUid]: Object.assign({}, room.players[authUid], { left: true }) });
            G.players[seat].bot = true;
            if (!G.players.some((p) => !p.bot)) {
                tx.update(ref, { status: 'done', turnDeadline: null, players, updatedAt: now, result: { rank: R.ranking(G).map((x) => order[x]), reason: 'left' } });
                return { ok: true, done: true };
            }
            advance(G, deps.rand);
            return save(G, order, { players });
        }
        bad('action');
    });
}

module.exports = { handle, advance, split, waitKey, randomPick, LIVE_MS, SEATS };
