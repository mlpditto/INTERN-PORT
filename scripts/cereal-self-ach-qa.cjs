// V101.351: 🥣 Cereal Killer 🙋 self-reported achievements (owner pick A, mockup-cereal-self-ach/). Two real pages over the REAL
// functions/cereal-act.js handler (harness from cereal-stats-qa.cjs): ask on the game-over screen, the other phone votes ✓ / ✕.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const C = require(path.resolve('functions/cereal-act.js'));

// ---- the referee's world: a tiny Firestore + a clock --------------------------------------------------------------
const store = new Map(); let auto = 0, NOW = Date.now();
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const snap = (p) => ({ id: p.split('/').pop(), exists: store.has(p), data: () => clone(store.get(p)), ref: docRef(p) });
function docRef(p) { return { id: p.split('/').pop(), path: p, get: async () => snap(p), set: async (v) => { store.set(p, clone(v)); }, update: async (v) => { store.set(p, Object.assign(clone(store.get(p)) || {}, clone(v))); }, collection: (n) => colRef(p + '/' + n) }; }
function colRef(p, f, lim) {
    f = f || [];
    return { doc: (id) => docRef(p + '/' + (id || ('g' + String(++auto).padStart(14, '0')))), where: (k, op, v) => colRef(p, f.concat([[k, op, v]]), lim), limit: (n) => colRef(p, f, n),
        get: async () => { let docs = [...store.keys()].filter((k) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/')).filter((k) => f.every(([fk, op, v]) => op === '==' ? (store.get(k) || {})[fk] === v : ((store.get(k) || {})[fk] || []).includes(v))).map(snap); if (lim) docs = docs.slice(0, lim); return { empty: !docs.length, docs }; } };
}
const db = { collection: (n) => colRef(n), runTransaction: async (fn) => { const w = []; const tx = { get: (r) => r.get(), set: (r, v) => w.push(() => r.set(v)), update: (r, v) => w.push(() => r.update(v)) }; const out = await fn(tx); for (const x of w) await x(); return out; } };
class HttpsError extends Error { constructor(code, msg, details) { super(msg); this.code = code; this.details = details; } }
store.set('user_auth_links/authK', { effectiveUserId: 'Ukiller' }); store.set('users/Ukiller', { nickName: 'Pond' });
store.set('user_auth_links/authD', { effectiveUserId: 'Udet' }); store.set('users/Udet', { nickName: 'Mint' });

async function open(browser, authUid) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.dismiss());
    await page.exposeFunction('__act', async (json) => {
        try { return JSON.stringify({ ok: await C.handle({ auth: { uid: authUid, token: {} }, data: JSON.parse(json) }, { db, HttpsError, isAdmin: () => false, now: NOW, rand: Math.random }) }); }
        catch (e) { return JSON.stringify({ err: { code: e.code, message: e.message, details: e.details } }); }
    });
    await page.exposeFunction('__doc', async (p) => JSON.stringify(store.has(p) ? store.get(p) : null));
    await page.exposeFunction('__mine', async (uid) => JSON.stringify([...store.keys()].filter(k => /^cereal_games\/[^/]+$/.test(k) && (store.get(k).authUids || []).includes(uid)).map(k => Object.assign({ __id: k.split('/')[1] }, store.get(k)))));
    await page.addInitScript((authUid) => {
        if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); localStorage.setItem('internGuideSeen', '1'); localStorage.setItem('journalTourSeen', '1'); localStorage.setItem('cerealTourSeen', '1'); localStorage.setItem('cerealCoachSeen', 'all'); localStorage.setItem('cerealSound', 'off'); }
        window.__authUid = authUid;
        window.firebase = { auth: () => ({ currentUser: { uid: authUid }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }),
            functions: () => ({ httpsCallable: (name) => async (data) => { if (name !== 'cerealAct') return { data: {} }; const r = JSON.parse(await window.__act(JSON.stringify(data))); if (r.err) { const e = new Error(r.err.message); e.code = r.err.code; e.details = r.err.details; throw e; } return { data: r.ok }; } }),
            firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0, increment: n => n } }) };
    }, authUid);
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
        ensureFirebaseAuthReady = async () => ({ uid: window.__authUid }); requireRegistered = () => true;
        tryDailyCheckin = () => {}; renderDailyCheckinCard = () => {}; awardEngagementBonusIfDue = () => {};
        userId = 'u-' + window.__authUid; userProfile = { displayName: 'Intern', pictureUrl: '' };
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        // live listeners → polling the node store; any direct write is counted (there must be none)
        window.__writes = 0;
        // an unsubscribed listener never fires again (a tick still awaiting the store when leave() runs would reopen the game)
        const poll = (fn, cb) => { let last = '', off = false; const tick = async () => { const s = await fn(); if (!off && s !== last) { last = s; cb(s); } }; tick(); const h = setInterval(tick, 120); return () => { off = true; clearInterval(h); }; };
        const wr = () => { window.__writes++; return Promise.resolve(); };
        db.collection = (name) => ({
            where: (f, op, uid) => ({ onSnapshot: (cb) => poll(() => window.__mine(uid), (s) => cb({ docs: JSON.parse(s).map(x => ({ id: x.__id, data: () => { const y = Object.assign({}, x); delete y.__id; return y; } })) })) }),
            doc: (id) => ({ onSnapshot: (cb) => poll(() => window.__doc(name + '/' + id), (s) => { const v = JSON.parse(s); cb({ id, exists: !!v, data: () => v }); }), set: name === 'user_auth_links' ? () => Promise.resolve() : wr, update: wr, get: () => Promise.resolve({ exists: false, data: () => ({}) }) }),
            add: wr
        });
    });
    return { page, errors };
}
const cell = id => `#cerealModal .ck-cell[data-id="${id}"]`;
const txt = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }, sel);
const until = (page, fn, arg, msg) => page.waitForFunction(fn, arg, { timeout: 5000 }).catch(() => { throw new Error('timed out: ' + msg); });


// ---- Phase 4: one game through the real referee, then both phones' 🌐 lists and reveals ------------------------------
const R = require(path.resolve('public/cereal-rules.js')), M = require(path.resolve('public/cereal-maps.js'));
const act = async (authUid, data) => C.handle({ auth: { uid: authUid, token: {} }, data }, { db, HttpsError, isAdmin: () => false, now: NOW, rand: Math.random });
// the killer walks day 1; the detective arrests him on the first try, no card → 🧠 สัญชาตญาณ + ⚡ ปิดคดีไว + 🙈 ไม่ถามเลย
async function playToArrest() {
    const { gameId, code } = await act('authK', { action: 'create', role: 'killer', side: 'A' });
    await act('authD', { action: 'join', code });
    const m = R.buildMap(M, 'A', null);
    for (const h of R.killerHomeOptions(m)) for (const p of R.legalPaths(m, h, 3, {})) {
        const ko = R.killOptions(m, p, []); if (!ko.length) continue;
        const kill = ko[0], w = R.witnessOptions(m, kill)[0];
        if (!R.validateKillerTurn(m, { path: p, kill, witness: w == null ? null : w }, { blocked: [], taken: [], kills: 0, skipUsed: false }).ok) continue;
        const kp = p[p.length - 1];
        for (const c of R.detectiveStartOptions(m)) for (let k = 0; k <= 3; k++) for (const q of R.legalPaths(m, c, k, {})) {
            if (!R.validateDetectivePath(m, q).ok || !R.arrestValid(m, q[q.length - 1], kp)) continue;
            await act('authK', { action: 'killerMove', gameId, path: p, kill, witness: w == null ? null : w });
            const r = await act('authD', { action: 'detectiveEnd', gameId, path: q, arrest: kp });
            assert.equal(r.caught, true);
            return gameId;
        }
    }
    throw new Error('no path');
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const gid = await playToArrest();
        const D = await open(browser, 'authD'), K = await open(browser, 'authK');
        for (const [P, u] of [[D, 'Udet'], [K, 'Ukiller']]) await P.page.evaluate((u) => { userId = u; }, u);   // stats are keyed by the LINE uid
        const reveal = async (P) => {
            await P.page.evaluate(() => { CK.close(); cerealOpen(); });   // reopening the sheet = the lobby, and it stays there
            await until(P.page, () => !!document.getElementById('ck-tab-online'), null, 'tabs: ' + await P.page.evaluate(() => document.getElementById('cerealModal').innerText.slice(0, 200)));
            await P.page.click('#ck-tab-online');
            await until(P.page, (g) => !!document.querySelector('#cerealModal .ck-game[data-game="' + g + '"]'), gid, 'game row');
            await P.page.click('#cerealModal .ck-game[data-game="' + gid + '"]');
            await until(P.page, () => !!document.getElementById('ck-self'), null, '🙋 card');
        };
        const chips = (P) => P.page.$$eval('#ck-self .ck-chip', (b) => b.map((x) => x.dataset.ach + ':' + x.textContent.trim() + (x.disabled ? ':off' : '')));
        // detective (winner, 2 players): only 🥛 can be asked; the card names who confirms; it sits under the 🏅 line
        await reveal(D);
        assert.equal(await txt(D.page, '#ck-self .h'), '🙋 ขอเอง · Pond ยืนยัน');
        assert.deepEqual(await chips(D), ['real:🥛 ซีเรียลจริง'], '2 players: 🥛 only (🐶 is Lola, 🦜 is 3-player)');
        assert.ok(await D.page.evaluate(() => document.getElementById('ck-ach-new').nextElementSibling.id === 'ck-self'), 'under the 🏅 line');
        await D.page.click('#ck-self [data-ach="real"]');
        await until(D.page, () => /⏳/.test((document.querySelector('#ck-self [data-ach="real"]') || {}).textContent || ''), null, '⏳ while Pond decides');
        assert.deepEqual(await chips(D), ['real:🥛 ซีเรียลจริง ⏳:off']);
        assert.equal(await D.page.$('.ck-self-ask'), null, 'no ✓ / ✕ card on my own ask');
        // killer (the loser) opens the same reveal: Mint's ask with ✓ / ✕, above his own chips; ✓ → the card goes
        await reveal(K);
        await until(K.page, () => !!document.querySelector('.ck-self-ask[data-ach="real"]'), null, 'ask card');
        assert.equal(await txt(K.page, '.ck-self-ask .sp'), 'Mint ขอ ซีเรียลจริง กินซีเรียลระหว่างเล่น · จริงไหม?');
        assert.equal(await txt(K.page, '#ck-self .h'), '🙋 ขอเอง · Mint ยืนยัน', 'the loser can ask too');
        await K.page.setViewportSize({ width: 320, height: 800 });
        await K.page.waitForTimeout(150);
        const fit = await K.page.evaluate(() => { const a = document.querySelector('.ck-self-ask'), mc = document.querySelector('#cerealModal .modal-content'), n = a.querySelector('.n').getBoundingClientRect(); return { over: a.scrollWidth - a.clientWidth, right: n.right - mc.getBoundingClientRect().right, h: Math.round(n.height) }; });
        assert.ok(fit.over <= 1 && fit.right <= 0 && fit.h >= 36, '320 px: the card fits, buttons ≥ 36 px: ' + JSON.stringify(fit));
        if (process.env.SHOT) await (await K.page.$('#cerealModal .modal-content')).screenshot({ path: process.env.SHOT + '/self-ask-320.png' });
        await K.page.click('.ck-self-ask .y');
        await until(K.page, () => !document.querySelector('.ck-self-ask'), null, 'card gone after ✓');
        assert.equal(store.get('cereal_games/' + gid).claims.detective.real.state, 'ok');
        assert.equal(store.get('cereal_stats/Udet').ach.real, 1, '🥛 counted for Mint');
        // Mint's chip turns ✓ and 🏅 counts it (3 + 1 of 13)
        await until(D.page, () => /✓/.test((document.querySelector('#ck-self [data-ach="real"]') || {}).textContent || ''), null, '✓ on Mint\'s chip');
        if (process.env.SHOT) { await D.page.waitForTimeout(800); await (await D.page.$('#cerealModal .modal-content')).screenshot({ path: process.env.SHOT + '/self-ok-390.png' }); }
        await D.page.evaluate(() => { CK.close(); cerealOpen(); });
        await D.page.click('#ck-tab-online');
        await until(D.page, () => /🏅 4\/13/.test((document.getElementById('ck-on-ach') || {}).textContent || ''), null, '🏅 4/13');
        // the killer asks, Mint says ✕ → struck through, nothing counted
        await K.page.click('#ck-self [data-ach="real"]');
        await until(K.page, () => /⏳/.test((document.querySelector('#ck-self [data-ach="real"]') || {}).textContent || ''), null, 'Pond ⏳');
        await D.page.waitForTimeout(600);   // Mint sits on the 🌐 list while the game doc changes: the list must not jump into the game
        assert.ok(await D.page.$('#ck-tab-online') && !(await D.page.$('#cerealModal .ck-win')), 'the lobby stays the lobby when an old game changes');
        await until(D.page, () => true, null, '');
        await reveal(D);
        await until(D.page, () => !!document.querySelector('.ck-self-ask[data-seat="killer"]'), null, 'Pond\'s ask on Mint\'s phone');
        await D.page.click('.ck-self-ask .n');
        await until(K.page, () => /✕/.test((document.querySelector('#ck-self [data-ach="real"]') || {}).textContent || ''), null, '✕ on Pond\'s chip');
        assert.ok(!(store.get('cereal_stats/Ukiller').ach || {}).real, '✕ earns nothing');
        for (const P of [D, K]) { assert.equal(await P.page.evaluate(() => window.__writes), 0, 'the page never writes'); assert.deepEqual(P.errors, [], 'no page errors'); }
        console.log('cereal-self-ach-qa: OK — 🙋 card under the 🏅 line (2 players: 🥛 only), ask → ⏳, the other phone gets ✓ / ✕ (fits 320 px, 36 px buttons), ✓ → earned in cereal_stats + chip ✓ + 🏅 4/13, ✕ → struck, nothing counted; no client writes');
    } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
