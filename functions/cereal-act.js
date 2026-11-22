// 🥣 Cereal Killer Phase 2 — the online referee (owner 2026-11-22: "Phase 2"; I deploy from HP · the app picks the less telling
// compass answer · a stale turn may be claimed after 1 hour). One callable, `cerealAct({ action, gameId?, ... })`.
// Clients never write game state: the public doc cereal_games/{id} holds what both players may see (it mirrors the pass-and-play
// game object in public/cereal.js, so the same screens draw it), and cereal_games/{id}/secret/killer holds the killer's home and
// paths, which no client can read (firestore.rules). The rules engine is public/cereal-rules.js — copied next to this file because
// a deploy uploads functions/ only; scripts/cereal-act-check.cjs fails if a copy drifts. Takes its I/O as `deps` (nika-ask pattern).
const R = require('./cereal-rules.js');
const MAPS = require('./cereal-maps.js');

const TURN_MS = 60 * 60 * 1000;                 // owner 2026-11-22: "1 ชม. พอครับ"
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L
const ROLES = ['killer', 'detective'];
const QS = R.QUESTIONS.filter((q) => q !== 'area');   // 'area' is the 3-player card

function code(rand) { let s = ''; for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]; return s; }
const other = (role) => (role === 'killer' ? 'detective' : 'killer');
const kposOf = (secret) => {
    const days = Object.keys(secret.path || {}).map(Number).sort((a, b) => b - a);
    return days.length ? secret.path[days[0]].slice(-1)[0] : secret.home;
};
function publicAnswer(map, q, cell, witness) {
    const a = R.answer(map, q, cell, witness);
    return a.length > 1 ? R.leastInformative(map, witness, a) : a[0];
}

// deps: { db, FieldValue, HttpsError, isAdmin(token), now, rand() }
async function handle(request, deps) {
    const { db, HttpsError } = deps;
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
    const authUid = request.auth.uid;
    const d = request.data || {};
    const now = deps.now;
    const fail = (codeName, msg) => { throw new HttpsError('failed-precondition', msg, { code: codeName }); };
    const bad = (msg) => { throw new HttpsError('invalid-argument', msg); };

    // who is calling: the LINE identity behind the anonymous Firebase user (same lookup as askNika)
    async function me() {
        const link = await db.collection('user_auth_links').doc(authUid).get();
        const uid = link.exists && (link.data() || {}).effectiveUserId;
        if (!uid) throw new HttpsError('permission-denied', 'Open the app from LINE first');
        const u = await db.collection('users').doc(uid).get();
        if (!u.exists) throw new HttpsError('permission-denied', 'Open the app from LINE first');
        const x = u.data() || {};
        return { uid, authUid, name: String(x.nickName || x.firstName || x.displayName || 'Intern').slice(0, 20), pic: x.pictureUrl || '' };
    }

    const games = db.collection('cereal_games');

    if (d.action === 'create') {
        const role = ROLES.includes(d.role) ? d.role : bad('role');
        const side = d.side === 'B' ? 'B' : 'A';
        const p = await me();
        const open = await games.where('creatorAuth', '==', authUid).where('status', '==', 'lobby').limit(1).get();
        if (!open.empty) return { gameId: open.docs[0].id, code: open.docs[0].data().code, existing: true };   // one open lobby per creator
        let c = null;
        for (let i = 0; i < 8 && !c; i++) { const t = code(deps.rand); if ((await games.where('code', '==', t).where('status', '==', 'lobby').limit(1).get()).empty) c = t; }
        if (!c) fail('code', 'Try again');
        const ref = games.doc();
        const seats = { killer: null, detective: null }; seats[role] = p;
        await ref.set({
            code: c, status: 'lobby', mode: 2, citySide: side, creatorAuth: authUid, players: seats, authUids: [authUid],
            names: { killer: role === 'killer' ? p.name : '', detective: role === 'detective' ? p.name : '' },
            day: 1, phase: 'killer', detectivePos: null, cereals: [], witness: null, arrestsLeft: R.ARRESTS, kills: 0,
            usedQuestions: [], skipUsed: false, log: [], dd: { path: [], asked: null }, result: null,
            createdAt: now, updatedAt: now, turnDeadline: null
        });
        await ref.collection('secret').doc('killer').set({ home: null, path: {}, kills: {} });
        return { gameId: ref.id, code: c };
    }

    if (d.action === 'join') {
        const c = String(d.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (c.length !== 6) bad('code');
        const p = await me();
        const q = await games.where('code', '==', c).where('status', '==', 'lobby').limit(1).get();
        if (q.empty) fail('no-game', 'No open game with that code');
        const ref = q.docs[0].ref;
        return db.runTransaction(async (tx) => {
            const s = await tx.get(ref); const g = s.data();
            if (g.status !== 'lobby') fail('started', 'Game already started');
            if (g.authUids.includes(authUid)) fail('own-game', 'You are already in this game');
            const seat = ROLES.find((r) => !g.players[r]);
            const players = Object.assign({}, g.players, { [seat]: p });
            const names = Object.assign({}, g.names, { [seat]: p.name });
            tx.update(ref, { players, names, authUids: g.authUids.concat(authUid), status: 'playing', updatedAt: now, turnDeadline: now + TURN_MS });
            return { gameId: ref.id, role: seat };
        });
    }

    // every other action acts on one game the caller plays in
    if (typeof d.gameId !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(d.gameId)) bad('gameId');
    const ref = games.doc(d.gameId), secRef = ref.collection('secret').doc('killer');
    return db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists) fail('no-game', 'No such game');
        const g = s.data();
        const role = ROLES.find((r) => g.players[r] && g.players[r].authUid === authUid);
        if (!role) throw new HttpsError('permission-denied', 'Not your game');
        if (g.status !== 'playing') fail('not-playing', 'Game is not running');
        const sec = (await tx.get(secRef)).data() || { home: null, path: {}, kills: {} };
        const map = R.buildMap(MAPS, g.citySide, null);
        const blocked = g.detectivePos != null ? [g.detectivePos] : [];
        const up = { updatedAt: now };
        const log = g.log.slice();
        const finish = (winner, reason, extra) => {
            up.status = 'finished'; up.phase = 'over'; up.turnDeadline = null;
            up.result = Object.assign({ winner, reason, day: g.day, cell: null, kpos: kposOf(sec), revealedHome: sec.home, revealedPath: sec.path, revealedKills: sec.kills }, extra || {});
            log.push({ day: g.day, type: 'end', text: (winner === 'good' ? '🕵️ wins · ' : '🔪 wins · ') + reason });
        };
        const commit = (ret) => { up.log = log; tx.update(ref, up); return Object.assign({ ok: true }, ret || {}); };

        if (d.action === 'resign') { finish(role === 'killer' ? 'good' : 'killer', 'resigned'); return commit(); }

        if (d.action === 'claim') {
            if (g.phase === role) fail('your-turn', 'It is your turn');
            if (!g.turnDeadline || now < g.turnDeadline) fail('too-early', 'The turn has time left');
            if (g.phase === 'killer') { finish('good', 'timeout'); return commit(); }
            // a stale detective: the turn ends where it stands (a never-started detective waits at the first café)
            const pos = g.detectivePos != null ? g.detectivePos : R.detectiveStartOptions(map)[0];
            log.push({ day: g.day, type: 'timeout', text: '⏳ 🕵️ timeout' });
            Object.assign(up, { detectivePos: pos, witness: null, dd: { path: [], asked: null } });
            if (g.day >= R.DAYS) finish('killer', 'survived'); else Object.assign(up, { day: g.day + 1, phase: 'killer', turnDeadline: now + TURN_MS });
            return commit();
        }

        if (g.phase !== role) fail('not-your-turn', 'Not your turn');

        if (d.action === 'killerMove' && role === 'killer') {
            const pos = kposOf(sec);
            if (pos != null && R.cornered(map, pos, blocked)) { finish('good', 'cornered', { cell: pos }); return commit({ cornered: true }); }
            const path = Array.isArray(d.path) ? d.path.map(Number) : bad('path');
            if (pos == null) { if (!R.killerHomeOptions(map).includes(path[0])) fail('home', 'Home must be a house'); }
            else if (path[0] !== pos) fail('start', 'The day starts where the last one ended');
            const kill = d.kill == null ? null : Number(d.kill), witness = d.witness == null ? null : Number(d.witness);
            const v = R.validateKillerTurn(map, { path, kill, witness }, { blocked, taken: g.cereals, kills: g.kills, skipUsed: g.skipUsed });
            if (!v.ok) fail(v.error, 'Illegal killer turn: ' + v.error);
            const nsec = { home: sec.home == null ? path[0] : sec.home, path: Object.assign({}, sec.path, { [g.day]: path }), kills: Object.assign({}, sec.kills) };
            if (v.kill != null) nsec.kills[g.day] = v.kill;
            tx.set(secRef, nsec);
            sec.home = nsec.home; sec.path = nsec.path; sec.kills = nsec.kills;
            Object.assign(up, { cereals: v.kill != null ? g.cereals.concat(v.kill) : g.cereals, kills: v.kills, skipUsed: v.skipUsed, witness: v.witness });
            log.push({ day: g.day, type: 'kill', kill: v.kill, witness: v.witness, det: g.detectivePos, text: v.kill != null ? '🥣 ' + v.kill + (v.witness != null ? ' · 👁️ ' + v.witness : '') : '⏭ ไม่มีเหยื่อ' });
            if (!R.calendarOk(g.day, v.kills)) { up.kills = v.kills; finish('good', 'calendar'); return commit(); }
            Object.assign(up, { phase: 'detective', turnDeadline: now + TURN_MS, dd: { path: [], asked: null } });
            return commit();
        }

        if (role === 'detective' && ['ask', 'detectiveEnd'].includes(d.action)) {
            const path = Array.isArray(d.path) ? d.path.map(Number) : bad('path');
            if (g.detectivePos == null) { if (!R.detectiveStartOptions(map).includes(path[0])) fail('start', 'Start on a café'); }
            else if (path[0] !== g.detectivePos) fail('start', 'Start where you stand');
            if (!R.validateDetectivePath(map, path).ok) fail('path', 'Illegal detective path');
            const asked = g.dd && g.dd.asked;
            if (asked) {   // after a card, the walk can only go on from where it was asked
                const pre = g.dd.path;
                if (pre.length > path.length || pre.some((c, i) => path[i] !== c)) fail('path', 'The walk must continue the asked path');
            }
            const at = path[path.length - 1];
            if (d.action === 'ask') {
                const q = String(d.question || '');
                if (!QS.includes(q)) bad('question');
                if (asked) fail('asked', 'One card per witness');
                if (g.usedQuestions.includes(q)) fail('used', 'Card already used');
                if (!R.canQuestion(map, at, g.witness)) fail('reach', 'Stand on or next to the witness');
                const ans = R.answer(map, q, kposOf(sec), g.witness), pick = ans.length > 1 ? R.leastInformative(map, g.witness, ans) : ans[0];
                log.push({ day: g.day, type: 'ask', q, ans: pick, text: '❓ ' + q + ' → ' + pick });
                Object.assign(up, { usedQuestions: g.usedQuestions.concat(q), dd: { path, asked: { q, ans: pick, two: ans.length > 1 } } });
                return commit({ answer: pick, two: ans.length > 1 });
            }
            // detectiveEnd: optional arrest from the end cell, then the day turns
            up.detectivePos = at;
            if (d.arrest != null) {
                const cell = Number(d.arrest);
                if (!R.arrestValid(map, at, cell)) fail('arrest', 'Arrest your cell or a neighbour');
                if (cell === kposOf(sec)) { log.push({ day: g.day, type: 'arrest', cell, text: '🛡️ ' + cell + ' ✔' }); finish('good', 'arrest', { cell }); return commit({ caught: true }); }
                up.arrestsLeft = g.arrestsLeft - 1;
                log.push({ day: g.day, type: 'arrest', cell, text: '🛡️ ' + cell + ' ✗ (เหลือ ' + up.arrestsLeft + ')' });
                if (up.arrestsLeft <= 0) { finish('killer', 'arrests'); return commit({ caught: false }); }
            }
            Object.assign(up, { witness: null, dd: { path: [], asked: null } });
            if (g.day >= R.DAYS) finish('killer', 'survived'); else Object.assign(up, { day: g.day + 1, phase: 'killer', turnDeadline: now + TURN_MS });
            return commit(d.arrest != null ? { caught: false } : {});
        }
        bad('action');
    });
}

module.exports = { handle, TURN_MS, publicAnswer, kposOf };
