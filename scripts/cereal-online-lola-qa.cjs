// V101.349 🥣 Cereal Killer Phase 3 online — THREE real pages (🔪 · 🐕 · 🕵️ phones) on the REAL functions/cereal-act.js in node with an
// in-memory Firestore (harness copied from cereal-online-qa). Network blocked; the pages never write Firestore.
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
            doc: (id) => ({ onSnapshot: (cb) => poll(() => window.__doc(name + '/' + id), (s) => { const v = JSON.parse(s); cb({ id, exists: !!v, data: () => v }); }), set: name === 'user_auth_links' ? () => Promise.resolve() : wr, update: wr, get: () => Promise.resolve({ exists: false, data: () => ({}) }) }),
            add: wr
        });
    });
    return { page, errors };
}
const cell = id => `#cerealModal .ck-cell[data-id="${id}"]`;
const txt = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }, sel);
const until = (page, fn, arg, msg) => page.waitForFunction(fn, arg, { timeout: 5000 }).catch(() => { throw new Error('timed out: ' + msg); });

store.set('user_auth_links/authL', { effectiveUserId: 'Ulola' }); store.set('users/Ulola', { nickName: 'Doggo' });

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const K = await open(browser, 'authK'), L = await open(browser, 'authL'), D = await open(browser, 'authD');
        // ---- killer: 🌐 → ＋ สร้างห้อง → 🐕 3 คน → 🔪 → ▸ สร้าง: a room with three seats
        await K.page.evaluate(() => { cerealOpen(); CK.tab('online'); });
        await until(K.page, () => !!document.getElementById('ck-on-new'), null, 'online tab');
        await K.page.click('#ck-on-new');
        await K.page.click('#ck-on-lola');
        assert.ok(await K.page.$('#ck-on-role-lola'), '🐕 Lola seat chip appears');
        assert.equal(await K.page.$('#ck-on-side-A'), null, '3 คน: the pair chip instead of A | B');
        assert.equal(await txt(K.page, '#ck-on-pair'), '🗺 🥄🥄');
        await K.page.click('#ck-on-role-killer'); await K.page.click('#ck-on-create');
        await until(K.page, () => !!document.getElementById('ck-on-room-code'), null, 'room');
        const code = await txt(K.page, '#ck-on-room-code');
        assert.equal(await K.page.evaluate(() => document.querySelectorAll('#cerealModal .ck-room .seat').length), 3, 'three seats in the room');
        assert.ok((await txt(K.page, '#cerealModal .ck-room')).includes('ครบ 3 คน'), 'the room says it starts with three');

        // ---- Lola joins (the room still waits), then the detective (the game starts on all three)
        for (const P of [L, D]) {
            await P.page.evaluate(() => { cerealOpen(); CK.tab('online'); });
            await until(P.page, () => !!document.getElementById('ck-on-code'), null, 'online tab');
            await P.page.fill('#ck-on-code', code); await P.page.press('#ck-on-code', 'Enter');
            if (P === L) {
                await until(L.page, () => !!document.getElementById('ck-on-room-code'), null, 'Lola sees the room');
                assert.equal(await L.page.evaluate(() => document.querySelectorAll('#cerealModal .ck-room .seat.on').length), 2, 'two of three seats taken');
            }
        }
        await until(K.page, () => !!document.querySelector('#cerealModal .ck.killer .ck-board.tall'), null, 'killer screen on the tall board');

        // ---- day 1 killer through the referee: 1 › 2 › 3 › 8, kill 3, witness 4
        await K.page.click(cell(1)); for (const id of [2, 3, 8]) await K.page.click(cell(id));
        await K.page.click('#ck-kill .ck-chip:has-text("🏠 3")'); await K.page.click('#ck-wit .ck-chip:has-text("🌳 4")');
        await K.page.click('#ck-lock');

        // ---- Lola's phone: her turn; walk 22 › 17 › 18 › 13, sniff 8 = 🎯 from the referee
        await until(L.page, () => !!document.querySelector('#cerealModal .ck.lola #ck-lola-ab'), null, 'Lola turn');
        for (const id of [17, 18, 13]) await L.page.click(cell(id));
        await L.page.click('#ck-lola-ab [data-ab="sniff"]'); await L.page.click(cell(8));
        await until(L.page, () => !!document.getElementById('ck-lola-ans'), null, 'Lola gets her answer');
        const ans = await txt(L.page, '#ck-lola-ans');
        assert.ok(ans.includes('อยู่ช่องนี้') && ans.includes('🔒'), 'her answer: ' + ans);
        assert.ok(/สมุด lola/i.test(await txt(L.page, '#cerealModal .ck.lola')), 'her notebook');
        // the detective's page meanwhile: the move is in the log, the answer is not in the DOM
        await until(D.page, () => /ดมช่อง 8/.test(document.getElementById('cerealModal').innerText), null, 'detective sees the public move');
        const dText = await D.page.evaluate(() => document.getElementById('cerealModal').innerText);
        assert.ok(!/อยู่ช่องนี้|🎯|สมุด lola|ไม่ได้ผ่าน/i.test(dText), 'no answer on the detective page');
        assert.equal(await D.page.evaluate(() => JSON.stringify(CK.game().lola || {}).includes('center')), false, 'no answer in the detective page state either');
        await L.page.click('#ck-lola-end');

        // ---- detective: six cards, Lola at 13 on the board
        await until(D.page, () => !!document.querySelector('#cerealModal .ck.detective .ck-board'), null, 'detective turn');
        await D.page.click('#cerealModal .ck-cell.c:not([disabled])');
        assert.equal(await D.page.evaluate(() => document.querySelectorAll('#ck-ask .ck-q').length), 6, 'six cards online too');
        assert.equal(await D.page.evaluate(() => (document.querySelector('#cerealModal .ck-cell[data-id="13"] .tk') || {}).textContent), '🐕');
        await D.page.click('#ck-end');
        await until(K.page, () => !!document.querySelector('#cerealModal .ck.killer #ck-path, #cerealModal .ck.killer .ck-board'), null, 'day 2 killer');
        assert.equal(await D.page.evaluate(() => window.__writes) + await L.page.evaluate(() => window.__writes) + await K.page.evaluate(() => window.__writes), 0, 'no page wrote Firestore (but its own user_auth_links)');
        for (const P of [K, L, D]) assert.deepEqual(P.errors, []);
        console.log('cereal-online-lola-qa: OK — ＋ สร้างห้อง with 🐕 3 คน + pair, a three-seat room that starts on the third join, killer → Lola → detective through the real referee, Lola\'s sniff answer only on her phone (the detective sees "ดมช่อง 8" only), six cards, no client writes');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
