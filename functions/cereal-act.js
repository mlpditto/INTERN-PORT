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
const ROLES3 = ['killer', 'lola', 'detective'];   // V101.349 Phase 3 online: 🐕 Lola, turn order 🔪 → 🐕 → 🕵️
const rolesOf = (g) => (g.mode === 3 ? ROLES3 : ROLES);
const QS = R.QUESTIONS.filter((q) => q !== 'area');   // 'area' is the 3-player card
const qsOf = (g) => (g.mode === 3 ? R.QUESTIONS : QS);
const ABIL = ['sniff', 'bark', 'bite'];

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
        const three = d.lola === true;
        const role = (three ? ROLES3 : ROLES).includes(d.role) ? d.role : bad('role');
        const pairIx = Number.isInteger(d.pair) && MAPS.difficulty[d.pair] ? d.pair : 1, pair = MAPS.difficulty[pairIx];
        const side = three ? pair.city : d.side === 'B' ? 'B' : 'A';
        const p = await me();
        const open = await games.where('creatorAuth', '==', authUid).where('status', '==', 'lobby').limit(1).get();
        if (!open.empty) return { gameId: open.docs[0].id, code: open.docs[0].data().code, existing: true };   // one open lobby per creator
        let c = null;
        for (let i = 0; i < 8 && !c; i++) { const t = code(deps.rand); if ((await games.where('code', '==', t).where('status', '==', 'lobby').limit(1).get()).empty) c = t; }
        if (!c) fail('code', 'Try again');
        const ref = games.doc();
        const seats = three ? { killer: null, lola: null, detective: null } : { killer: null, detective: null }; seats[role] = p;
        const names = { killer: '', detective: '' }; if (three) names.lola = ''; names[role] = p.name;
        const extra = three ? { suburbSide: pair.suburb, pair: pairIx, lola: { pos: R.lolaStart(R.buildMap(MAPS, pair.city, pair.suburb)), last: null, dd: { path: [], used: null } } } : {};
        await ref.set(Object.assign({
            code: c, status: 'lobby', mode: three ? 3 : 2, citySide: side, creatorAuth: authUid, players: seats, authUids: [authUid],
            names,
            day: 1, phase: 'killer', detectivePos: null, cereals: [], witness: null, arrestsLeft: R.ARRESTS, kills: 0,
            usedQuestions: [], skipUsed: false, log: [], dd: { path: [], asked: null }, result: null,
            createdAt: now, updatedAt: now, turnDeadline: null
        }, extra));
        await ref.collection('secret').doc('killer').set({ home: null, path: {}, kills: {} });
        if (three) await ref.collection('secret').doc('lola').set({ notes: [] });   // her answers: only cerealAct lolaNotes reads them, for her
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
            const seat = rolesOf(g).find((r) => !g.players[r]);
            if (!seat) fail('full', 'The room is full');
            const players = Object.assign({}, g.players, { [seat]: p });
            const names = Object.assign({}, g.names, { [seat]: p.name });
            const full = rolesOf(g).every((r) => players[r]);
            tx.update(ref, Object.assign({ players, names, authUids: g.authUids.concat(authUid), updatedAt: now }, full ? { status: 'playing', turnDeadline: now + TURN_MS } : {}));
            return { gameId: ref.id, role: seat, started: full };
        });
    }

    // every other action acts on one game the caller plays in
    if (typeof d.gameId !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(d.gameId)) bad('gameId');
    const ref = games.doc(d.gameId), secRef = ref.collection('secret').doc('killer'), lsecRef = ref.collection('secret').doc('lola');
    return db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists) fail('no-game', 'No such game');
        const g = s.data();
        const role = rolesOf(g).find((r) => g.players[r] && g.players[r].authUid === authUid);
        if (!role) throw new HttpsError('permission-denied', 'Not your game');
        // Phase 2 PR 2: ✕ ยกเลิกห้อง — the creator drops a room nobody has joined yet; it leaves every list (status 'cancelled')
        if (d.action === 'cancel') {
            if (g.status !== 'lobby') fail('started', 'The game has started — resign instead');
            tx.update(ref, { status: 'cancelled', updatedAt: now });
            return { ok: true };
        }
        if (g.status !== 'playing') fail('not-playing', 'Game is not running');
        const sec = (await tx.get(secRef)).data() || { home: null, path: {}, kills: {} };
        const lsec = g.mode === 3 ? ((await tx.get(lsecRef)).data() || { notes: [] }) : null;
        const map = R.buildMap(MAPS, g.citySide, g.suburbSide || null);
        const lolaPos = g.lola ? g.lola.pos : null;
        const blocked = [g.detectivePos, lolaPos].filter((x) => x != null);   // 🐕 blocks the killer like 🕵️
        const up = { updatedAt: now };
        const log = g.log.slice();
        const finish = (winner, reason, extra) => {
            up.status = 'finished'; up.phase = 'over'; up.turnDeadline = null;
            up.result = Object.assign({ winner, reason, day: g.day, cell: null, kpos: kposOf(sec), revealedHome: sec.home, revealedPath: sec.path, revealedKills: sec.kills }, extra || {});
            log.push({ day: g.day, type: 'end', text: (winner === 'good' ? (reason === 'bite' ? '🐕 wins · ' : '🕵️ wins · ') : '🔪 wins · ') + reason });
        };
        const commit = (ret) => { up.log = log; tx.update(ref, up); return Object.assign({ ok: true }, ret || {}); };

        if (d.action === 'resign') { finish(role === 'killer' ? 'good' : 'killer', 'resigned'); return commit(); }

        // Phase 2 PR 2: the killer's own home and paths, for the killer only — the doc is unreadable to every client (rules), and a
        // killer who reloads or changes phone still needs the notebook and where today starts. Read-only: nothing is written.
        if (d.action === 'mySecret') {
            if (role !== 'killer') throw new HttpsError('permission-denied', 'Only the killer sees the notebook');
            return { ok: true, secret: { home: sec.home, path: sec.path || {}, kills: sec.kills || {} } };
        }

        // V101.349: Lola's own answers, for Lola only (secret/lola is unreadable to every client)
        if (d.action === 'lolaNotes') {
            if (role !== 'lola') throw new HttpsError('permission-denied', 'Only Lola sees her notebook');
            return { ok: true, notes: (lsec && lsec.notes) || [] };
        }

        if (d.action === 'claim') {
            if (g.phase === role) fail('your-turn', 'It is your turn');
            if (!g.turnDeadline || now < g.turnDeadline) fail('too-early', 'The turn has time left');
            if (g.phase === 'killer') { finish('good', 'timeout'); return commit(); }
            if (g.phase === 'lola') {   // a stale Lola stays where she is; the detective moves on
                log.push({ day: g.day, type: 'timeout', text: '⏳ 🐕 timeout' });
                Object.assign(up, { lola: { pos: lolaPos, last: null, dd: { path: [], used: null } }, phase: 'detective', turnDeadline: now + TURN_MS });
                return commit();
            }
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
            log.push({ day: g.day, type: 'kill', kill: v.kill, witness: v.witness, det: g.detectivePos, lola: lolaPos, text: v.kill != null ? '🥣 ' + v.kill + (v.witness != null ? ' · 👁️ ' + v.witness : '') : '⏭ ไม่มีเหยื่อ' });
            if (!R.calendarOk(g.day, v.kills)) { up.kills = v.kills; finish('good', 'calendar'); return commit(); }
            Object.assign(up, { phase: g.mode === 3 ? 'lola' : 'detective', turnDeadline: now + TURN_MS, dd: { path: [], asked: null } });
            return commit();
        }

        // V101.349 🐕 Lola: lolaUse = her walk + one ability (the answer comes back to her and into secret/lola, never the public doc);
        // lolaEnd = the turn ends where she stands. A bite is an arrest on the shared 🛡️ and ends her turn when it misses.
        if (role === 'lola' && ['lolaUse', 'lolaEnd'].includes(d.action)) {
            const L0 = g.lola || { pos: null, last: null, dd: { path: [], used: null } };
            const path = Array.isArray(d.path) ? d.path.map(Number) : bad('path');
            if (path[0] !== L0.pos) fail('start', 'Start where you stand');
            if (!R.validateLolaPath(map, path).ok) fail('path', 'Illegal Lola walk');
            const used = L0.dd && L0.dd.used;
            if (used && (used.path || []).join() !== path.join()) fail('path', 'The walk is fixed after the ability');
            const at = path[path.length - 1];
            const endTurn = (last) => Object.assign(up, { lola: { pos: at, last, dd: { path: [], used: null } }, phase: 'detective', turnDeadline: now + TURN_MS });
            if (d.action === 'lolaEnd') {
                log.push({ day: g.day, type: 'lola-move', text: '🐕 อยู่ที่ ' + at });
                endTurn(used ? used.a : null);
                return commit();
            }
            if (used) fail('used', 'One ability a turn');
            const a = String(d.ability || '');
            if (!ABIL.includes(a) || !R.lolaAbilityOk(a, L0.last)) fail('ability', 'Not that ability this turn');
            const kp = kposOf(sec);
            if (a === 'bite') {
                const cell = Number(d.cell);
                if (!R.arrestValid(map, at, cell)) fail('reach', 'Your cell or a neighbour');
                if (cell === kp) { log.push({ day: g.day, type: 'arrest', cell, text: '🐕 🦷 ' + cell + ' ✔' }); finish('good', 'bite', { cell }); return commit({ caught: true }); }
                up.arrestsLeft = g.arrestsLeft - 1;
                log.push({ day: g.day, type: 'arrest', cell, text: '🐕 🦷 ' + cell + ' ✗ (เหลือ ' + up.arrestsLeft + ')' });
                if (up.arrestsLeft <= 0) { finish('killer', 'arrests'); return commit({ caught: false }); }
                endTurn('bite');
                return commit({ caught: false });
            }
            let cell = null, ans;
            if (a === 'sniff') {
                cell = Number(d.cell);
                if (!R.arrestValid(map, at, cell)) fail('reach', 'Your cell or a neighbour');
                const all = R.sniff(map, (sec.path || {})[g.day] || [kp], cell, kp);
                ans = all.length > 1 ? R.leastInformative(map, cell, all) : all[0];
            } else ans = R.bark(map, at, kp);
            tx.set(lsecRef, { notes: ((lsec && lsec.notes) || []).concat({ day: g.day, a, cell, from: at, ans }) });
            log.push({ day: g.day, type: 'lola', text: '🐕 ' + (a === 'sniff' ? '👃 ดมช่อง ' + cell : '📢 เห่า') });
            up.lola = { pos: L0.pos, last: L0.last, dd: { path, used: { a, cell, path } } };
            return commit({ answer: ans });
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
                if (!qsOf(g).includes(q)) bad('question');
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
