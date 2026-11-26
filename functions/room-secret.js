// 🔢 เลขลับ หลายคน — the referee for game 'secret' in the roomAct callable (owner 2026-11-27: "Yes, start it", picks: A player cards +
// a grid per player · the host picks ⏱ 1 h or 60 s a turn; docs/MIND-GAMES-PLAN.md §3, mockup-secret-multi/). 2–6 people, each gets a
// different secret 1–100. On your turn: ask ONE person ONE question from the menu for 🎫 1 (only you get the answer; everyone sees who
// asked whom what), or guess someone's number — right: ⭐ +3 and they are out · wrong: ⭐ −1 and 🎫 −1. 🎫 6 each. The game ends when one
// player is left in or nobody still in has a 🎫; most ⭐ wins. A turn past its time can be skipped by anyone else (`claim`).
// rooms/{id}: public (players, order, turn, 🎫, ⭐, who is out, the log without answers) · rooms/{id}/secret/hands: every number (no
// client) · rooms/{id}/hand/{login}: my number, my answers, my wrong guesses (only me). Takes its I/O as `deps` (cereal-act pattern).
const MAX = 100, TICKETS = 6, SEATS = 6, RIGHT = 3, WRONG = -1;
const TURN_MS = 60 * 60 * 1000, LIVE_MS = 60 * 1000;
const isPrime = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
// the same menu as public/secret.js (scripts/secret-multi-qa.cjs checks both answer alike)
const QS = {
    gt: { need: 1, test: (n, a) => n > a, txt: (a) => 'มากกว่า ' + a + ' ?' },
    even: { need: 0, test: (n) => n % 2 === 0, txt: () => 'เลขคู่ ?' },
    div3: { need: 0, test: (n) => n % 3 === 0, txt: () => 'หาร 3 ลงตัว ?' },
    prime: { need: 0, test: isPrime, txt: () => 'จำนวนเฉพาะ ?' },
    unit: { need: 1, test: (n, a) => n % 10 === a, txt: (a) => 'หลักหน่วยคือ ' + a + ' ?' },
    range: { need: 2, test: (n, a, b) => n >= Math.min(a, b) && n <= Math.max(a, b), txt: (a, b) => 'อยู่ใน ' + Math.min(a, b) + '–' + Math.max(a, b) + ' ?' }
};
function code(rand) { let s = ''; for (let i = 0; i < 4; i++) s += Math.floor(rand() * 10); return s; }

/** whose turn after `from` (index in order): the next one still in with a 🎫; null = nobody */
function nextTurn(g, from) {
    const n = g.order.length;
    for (let k = 1; k <= n; k++) { const u = g.order[(from + k) % n]; if (!g.out[u] && g.tickets[u] > 0) return u; }
    return null;
}
/** end the game when ≤ 1 is still in, or nobody still in has a 🎫; returns the public updates */
function settle(g, secret, now) {
    const inside = g.order.filter((u) => !g.out[u]);
    const turn = inside.length <= 1 ? null : nextTurn(g, g.order.indexOf(g.turn));
    if (inside.length > 1 && turn) return { turn, turnDeadline: now + (g.live ? LIVE_MS : TURN_MS) };
    const rank = g.order.slice().sort((x, y) => (g.score[y] - g.score[x]) || (g.order.indexOf(x) - g.order.indexOf(y)));
    const top = g.score[rank[0]], winners = rank.filter((u) => g.score[u] === top);
    return { status: 'done', turn: null, turnDeadline: null, result: { winners, rank, nums: secret.nums, reason: 'score' } };
}

async function handle(request, deps, me) {
    const { db, HttpsError } = deps;
    const authUid = request.auth.uid, d = request.data || {}, now = deps.now;
    const fail = (c, msg) => { throw new HttpsError('failed-precondition', msg, { code: c }); };
    const bad = (msg) => { throw new HttpsError('invalid-argument', msg); };
    const rooms = db.collection('rooms');

    if (d.action === 'create') {
        const p = await me(), live = d.live === true;
        const open = await rooms.where('creatorAuth', '==', authUid).where('status', '==', 'lobby').limit(4).get();
        const mine = open.docs.filter((x) => x.data().game === 'secret')[0];
        if (mine) { if (!!mine.data().live !== live) await mine.ref.update({ live, updatedAt: now }); return { roomId: mine.id, code: mine.data().code, name: p.name, existing: true }; }
        let c = null;
        for (let i = 0; i < 12 && !c; i++) { const t = code(deps.rand); if ((await rooms.where('code', '==', t).where('status', '==', 'lobby').limit(1).get()).empty) c = t; }
        if (!c) fail('code', 'Try again');
        const ref = rooms.doc();
        await ref.set({ game: 'secret', code: c, status: 'lobby', live, creatorAuth: authUid, authUids: [authUid], players: { [authUid]: p }, order: [authUid],
            tickets: {}, score: {}, out: {}, turn: null, log: [], result: null, createdAt: now, updatedAt: now, turnDeadline: null });
        return { roomId: ref.id, code: c, name: p.name };
    }
    if (d.action === 'join') {
        const c = String(d.code || '').replace(/\D/g, '');
        if (c.length !== 4) bad('code');
        const p = await me();
        const q = await rooms.where('code', '==', c).where('status', '==', 'lobby').limit(4).get();
        const doc = q.docs.filter((x) => x.data().game === 'secret')[0];
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
    const ref = rooms.doc(id), sref = ref.collection('secret').doc('hands'), href = (u) => ref.collection('hand').doc(u);
    return db.runTransaction(async (tx) => {
        const gs = await tx.get(ref);
        if (!gs.exists) fail('no-room', 'No such room');
        const g = gs.data();
        if (g.game !== 'secret') bad('game');
        if (!g.authUids.includes(authUid)) throw new HttpsError('permission-denied', 'Not your room');
        const hs = await tx.get(sref), secret = hs.exists ? hs.data() : { nums: {} };
        const mine = g.status === 'playing' || g.status === 'done' ? (await tx.get(href(authUid))).data() || { n: null, notes: [], wrong: [] } : null;

        if (d.action === 'cancel') {
            if (g.status !== 'lobby' || g.creatorAuth !== authUid) fail('not-yours', 'Only the host closes a waiting room');
            tx.update(ref, { status: 'done', result: { winners: [], rank: [], nums: {}, reason: 'cancelled' }, updatedAt: now });
            return { ok: true };
        }
        if (d.action === 'start') {
            if (g.status !== 'lobby') fail('started', 'Already started');
            if (g.creatorAuth !== authUid) fail('not-host', 'Only the host starts');
            if (g.order.length < 2) fail('alone', 'Wait for a friend');
            const pool = []; for (let n = 1; n <= MAX; n++) pool.push(n);
            const nums = {}; g.order.forEach((u) => { nums[u] = pool.splice(Math.floor(deps.rand() * pool.length), 1)[0]; });
            const tickets = {}, score = {}, out = {}; g.order.forEach((u) => { tickets[u] = TICKETS; score[u] = 0; out[u] = false; });
            const first = g.order[Math.floor(deps.rand() * g.order.length)];
            tx.set(sref, { nums });
            g.order.forEach((u) => tx.set(href(u), { n: nums[u], notes: [], wrong: [] }));
            tx.update(ref, { status: 'playing', tickets, score, out, turn: first, log: [], updatedAt: now, turnDeadline: now + (g.live ? LIVE_MS : TURN_MS) });
            return { ok: true };
        }
        if (g.status !== 'playing') fail('not-playing', 'The game is not on');

        if (d.action === 'ask' || d.action === 'guess') {
            if (g.turn !== authUid) fail('not-your-turn', 'Not your turn');
            const to = String(d.to || '');
            if (to === authUid || !g.order.includes(to)) bad('to');
            if (g.out[to]) fail('out', 'That player is out');
            if (!(g.tickets[authUid] > 0)) fail('no-ticket', 'No 🎫 left');
            const next = Object.assign({}, g, { tickets: Object.assign({}, g.tickets), score: Object.assign({}, g.score), out: Object.assign({}, g.out), log: g.log.slice() });
            if (d.action === 'ask') {
                const Q = QS[d.q]; if (!Q) bad('q');
                const lo = d.q === 'unit' ? 0 : 1, hi = d.q === 'unit' ? 9 : MAX, a = Q.need ? d.a : 0, b = Q.need === 2 ? d.b : 0;
                if (Q.need && !(Number.isInteger(a) && a >= lo && a <= hi)) bad('a');
                if (Q.need === 2 && !(Number.isInteger(b) && b >= 1 && b <= MAX)) bad('b');
                const ans = !!Q.test(secret.nums[to], a, b);
                next.tickets[authUid]--;
                next.log.push({ k: 'ask', by: authUid, to, txt: Q.txt(a, b), at: now });
                tx.set(href(authUid), Object.assign({}, mine, { notes: (mine.notes || []).concat([{ to, q: d.q, a, b, ans }]) }));
                Object.assign(next, settle(next, secret, now));
                tx.update(ref, { tickets: next.tickets, log: next.log, turn: next.turn, turnDeadline: next.turnDeadline, status: next.status || 'playing', result: next.result || null, updatedAt: now });
                return { ok: true, ans };
            }
            const n = d.n;
            if (!Number.isInteger(n) || n < 1 || n > MAX) bad('n');
            const right = secret.nums[to] === n;
            if (right) { next.score[authUid] += RIGHT; next.out[to] = true; } else { next.score[authUid] += WRONG; next.tickets[authUid]--; tx.set(href(authUid), Object.assign({}, mine, { wrong: (mine.wrong || []).concat([{ to, n }]) })); }
            next.log.push({ k: 'guess', by: authUid, to, n, right, at: now });
            if (right) next.log.push({ k: 'out', to, n, at: now });   // their number is no secret any more
            Object.assign(next, settle(next, secret, now));
            tx.update(ref, { tickets: next.tickets, score: next.score, out: next.out, log: next.log, turn: next.turn, turnDeadline: next.turnDeadline, status: next.status || 'playing', result: next.result || null, updatedAt: now });
            return { ok: true, right };
        }
        if (d.action === 'claim') {   // the turn ran out: skip it (owner: "เกินเวลา = ข้ามตาคนนั้น")
            if (g.turn === authUid) fail('your-turn', 'It is your turn');
            if (!g.turnDeadline || now < g.turnDeadline) fail('early', 'They still have time');
            const next = Object.assign({}, g, { log: g.log.concat([{ k: 'skip', to: g.turn, at: now }]) });
            Object.assign(next, settle(next, secret, now));
            tx.update(ref, { log: next.log, turn: next.turn, turnDeadline: next.turnDeadline, status: next.status || 'playing', result: next.result || null, updatedAt: now });
            return { ok: true };
        }
        if (d.action === 'resign') {   // I leave: out, no ⭐ change
            const next = Object.assign({}, g, { out: Object.assign({}, g.out, { [authUid]: true }), log: g.log.concat([{ k: 'left', to: authUid, at: now }]) });
            if (g.turn !== authUid) next.turn = g.turn;
            Object.assign(next, g.turn === authUid || next.order.filter((u) => !next.out[u]).length <= 1 ? settle(next, secret, now) : {});
            tx.update(ref, { out: next.out, log: next.log, turn: next.turn, turnDeadline: next.turnDeadline || g.turnDeadline, status: next.status || 'playing', result: next.result || null, updatedAt: now });
            return { ok: true };
        }
        bad('action');
    });
}

module.exports = { handle, QS, nextTurn, settle, TICKETS, TURN_MS, LIVE_MS };
