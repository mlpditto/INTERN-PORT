// V101.350: 🥣 Cereal Killer Phase 4 (owner pick B, mockup-cereal-stats/) — online wins + 🏅 achievements. Two/three real pages over the
// REAL functions/cereal-act.js handler (the harness below is the one from cereal-online-qa.cjs). Proves the referee puts result.ach
// and writes cereal_stats/{LINE uid}; the 🌐 list shows 🏆 n ชนะ · 🏅 k/10, either opens per-role wins + the grid of ten; the
// winner's reveal gets one 🏅 ได้ใหม่ line, the loser's none; a newcomer sees only 🏅 0/10; 320 px fits; the page never writes.
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
        const poll = (fn, cb) => { let last = ''; const tick = async () => { const s = await fn(); if (s !== last) { last = s; cb(s); } }; tick(); const h = setInterval(tick, 120); return () => clearInterval(h); };
        const wr = () => { window.__writes++; return Promise.resolve(); };
        db.collection = (name) => ({
            where: (f, op, uid) => ({ onSnapshot: (cb) => poll(() => window.__mine(uid), (s) => cb({ docs: JSON.parse(s).map(x => ({ id: x.__id, data: () => { const y = Object.assign({}, x); delete y.__id; return y; } })) })) }),
            doc: (id) => ({ onSnapshot: (cb) => poll(() => window.__doc(name + '/' + id), (s) => { const v = JSON.parse(s); cb({ id, exists: !!v, data: () => v }); }), set: wr, update: wr, get: () => Promise.resolve({ exists: false, data: () => ({}) }) }),
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
        assert.deepEqual(store.get('cereal_games/' + gid).result.ach, { detective: ['instinct', 'quick', 'nocards'] });
        const D = await open(browser, 'authD'), K = await open(browser, 'authK');
        for (const [P, u] of [[D, 'Udet'], [K, 'Ukiller']]) await P.page.evaluate((u) => { userId = u; }, u);   // stats are keyed by the LINE uid
        // detective: 🌐 → 🏆 1 ชนะ · 🏅 3/10 › (closed), one tap opens the wins per role and the grid of ten
        await D.page.evaluate(() => cerealOpen());
        await D.page.click('#ck-tab-online');
        await until(D.page, () => /🏅 3\/10/.test((document.getElementById('ck-on-ach') || {}).textContent || ''), null, 'detective 🏅 3/10');
        assert.equal(await txt(D.page, '#ck-on-wins'), '🏆 1 ชนะ', 'closed: wins only');
        assert.ok(!(await D.page.$('#ck-on-achgrid')), 'grid closed at first');
        await D.page.click('#ck-on-ach');
        assert.equal(await txt(D.page, '#ck-on-wins'), '🏆 1 ชนะ · 🔪 0 · 🕵️ 1 · 🐕 0', 'open: per role');
        assert.equal(await D.page.$$eval('#ck-on-achgrid > div', (d) => d.length), 10, 'ten in the grid');
        assert.deepEqual(await D.page.$$eval('#ck-on-achgrid > div.got', (d) => d.map((x) => x.dataset.ach)), ['instinct', 'quick', 'nocards'], 'earned ones in colour');
        assert.equal(await D.page.$eval('#ck-on-ach', (b) => b.getAttribute('aria-expanded')), 'true');
        const shot = async (P, n) => { if (process.env.SHOT) await (await P.page.$('#cerealModal .modal-content')).screenshot({ path: process.env.SHOT + '/' + n + '.png' }); };
        await shot(D, 'built-390');
        // 320 px: chips one row, grid inside the sheet
        await D.page.setViewportSize({ width: 320, height: 800 });
        await D.page.waitForTimeout(150);
        const fit = await D.page.evaluate(() => { const g = document.getElementById('ck-on-achgrid'), mc = document.querySelector('#cerealModal .modal-content'); const a = document.getElementById('ck-on-wins').getBoundingClientRect(), b = document.getElementById('ck-on-ach').getBoundingClientRect(); return { over: g.scrollWidth - g.clientWidth, right: g.getBoundingClientRect().right - mc.getBoundingClientRect().right, row: Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) }; });
        await shot(D, 'built-320');
        assert.ok(fit.over <= 1 && fit.right <= 1 && fit.row <= 4, '320 px fits: ' + JSON.stringify(fit));
        await D.page.click('#ck-on-wins');
        assert.ok(!(await D.page.$('#ck-on-achgrid')), 'tap again closes');
        await D.page.setViewportSize({ width: 390, height: 800 });
        // detective's reveal: 🏅 ได้ใหม่ · the three names
        await D.page.click('#cerealModal .ck-game[data-game="' + gid + '"]');
        await until(D.page, () => !!document.getElementById('ck-ach-new'), null, 'reveal 🏅 line');
        assert.equal(await txt(D.page, '#ck-ach-new'), '🧠⚡🙈 🏅 ได้ใหม่ · สัญชาตญาณ · ปิดคดีไว · ไม่ถามเลย จับถูกครั้งแรก · ชนะภายในวันที่ 3 · ชนะโดยไม่ใช้การ์ด');
        assert.ok(await D.page.evaluate(() => document.querySelector('#cerealModal .ck-win').nextElementSibling.id === 'ck-ach-new'), 'right under the winner card');
        if (process.env.SHOT) await D.page.waitForTimeout(700);
        await shot(D, 'built-reveal');
        // killer: played 1, won 0, nothing earned → 🏆 0 ชนะ · 🏅 0/10, no 🏅 line on the reveal
        await K.page.evaluate(() => cerealOpen());
        await K.page.click('#ck-tab-online');
        await until(K.page, () => /🏅 0\/10/.test((document.getElementById('ck-on-ach') || {}).textContent || '') && !!document.getElementById('ck-on-wins'), null, 'killer chips');
        assert.equal(await txt(K.page, '#ck-on-wins'), '🏆 0 ชนะ');
        await K.page.click('#cerealModal .ck-game[data-game="' + gid + '"]');
        await until(K.page, () => !!document.querySelector('#cerealModal .ck-win'), null, 'killer reveal');
        assert.ok(!(await K.page.$('#ck-ach-new')), 'no 🏅 line for the loser');
        // a newcomer with no stats doc: only 🏅 0/10, no 🏆 chip
        store.set('user_auth_links/authN', { effectiveUserId: 'Unew' }); store.set('users/Unew', { nickName: 'New' });
        const N = await open(browser, 'authN');
        await N.page.evaluate(() => { userId = 'Unew'; cerealOpen(); });
        await N.page.click('#ck-tab-online');
        await until(N.page, () => !!document.getElementById('ck-on-ach'), null, 'newcomer chip');
        assert.ok(!(await N.page.$('#ck-on-wins')), 'no 🏆 before a first game');
        assert.equal(await txt(N.page, '#ck-on-ach'), '🏅 0/10 ›');
        assert.equal(await D.page.evaluate(() => window.__writes), 0, 'the page never writes');
        for (const P of [D, K, N]) assert.deepEqual(P.errors, [], 'no page errors');
        console.log('cereal-stats-qa: OK — referee writes 🏅 + cereal_stats; 🏆 n ชนะ · 🏅 k/10 chips (pick B) open per-role wins + the grid of ten (earned in colour), fits 320 px; reveal 🏅 ได้ใหม่ line for the winner only; newcomer sees 🏅 0/10; no client writes');
    } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
