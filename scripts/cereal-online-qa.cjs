// V101.335: 🥣 Cereal Killer Phase 2 PR 2 — online play (owner pick B + C, mockup-cereal-online/) with TWO real pages (two phones) talking to
// the REAL functions/cereal-act.js handler running here in node on an in-memory Firestore (the same handler cerealAct deploys). The
// pages' httpsCallable('cerealAct') and their cereal_games onSnapshot listeners are routed to it (live updates by polling), network
// blocked. Proves: 📱 / 🌐 tabs; ＋ สร้างห้อง → the room screen with the 6-letter code and the seats; 🔑 มีรหัสห้อง joins and BOTH
// pages flip to the game; the killer plays day 1 through the referee; the detective's list shows ตาคุณ and the tab badge; the waiting
// screen shows "⏳ ตา …" and the public board only; the killer's notebook comes back from mySecret and the killer's path is NEVER in
// the detective's DOM; ask gets the referee's answer; a missed arrest turns the day; after 1 hour the waiting player ⏳ เคลม and both
// pages land on the reveal with the revealed path; the pages never write Firestore directly.
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

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const K = await open(browser, 'authK'), D = await open(browser, 'authD');
        // killer: 🌐 tab → ＋ สร้างห้อง (🔪, A) → the room
        await K.page.evaluate(() => cerealOpen());
        assert.ok(await K.page.isVisible('#ck-tab-local') && await K.page.isVisible('#ck-tab-online'), 'two tabs (pick B)');
        await K.page.click('#ck-tab-online');
        await until(K.page, () => !!document.getElementById('ck-on-new'), null, 'online tab loads');
        await K.page.click('#ck-on-new'); await K.page.click('#ck-on-role-killer'); await K.page.click('#ck-on-create');
        await until(K.page, () => /^[A-Z2-9]{6}$/.test((document.getElementById('ck-on-room-code') || {}).textContent || ''), null, 'room code shown (pick C)');
        const code = await K.page.textContent('#ck-on-room-code');
        if (process.env.QA_SHOTS) await K.page.screenshot({ path: process.env.QA_SHOTS + '/on-room.png' });
        assert.ok((await txt(K.page, '#cerealModal .seats')).includes('คุณ') && (await txt(K.page, '#cerealModal .seats')).includes('รอเพื่อน'), 'seats: me + waiting');
        // detective: 🌐 → 🔑 มีรหัสห้อง → join → both pages flip into the game
        await D.page.evaluate(() => cerealOpen()); await D.page.click('#ck-tab-online');
        await until(D.page, () => !!document.getElementById('ck-on-code'), null, 'online tab (detective)');
        // V101.339 lobby pick C: one row ＋ สร้างห้อง + 🔑 [code] ▸, no empty-state line, no credit line, typed in place (Enter joins)
        assert.deepEqual(await D.page.evaluate(() => [...document.querySelectorAll('#cerealModal .ck-onrow > *')].map(e => e.id || e.className)), ['ck-on-new', 'ck-name ck-code'], 'lobby: one row');
        assert.ok(!/ยังไม่มีเกม|Julián|เลือกบทบาท|พิมพ์รหัส 6/.test(await D.page.evaluate(() => document.getElementById('cerealModal').innerText)), 'no repeated lines, no credit line');
        await D.page.fill('#ck-on-code', code.toLowerCase()); await D.page.press('#ck-on-code', 'Enter');
        await until(D.page, () => !!document.getElementById('ck-on-wait'), null, 'detective waits for the killer');
        assert.ok((await txt(D.page, '#ck-on-wait')).includes('ตา Pond'), 'waiting card names the killer');
        assert.equal(await D.page.$('#ck-hand-go'), null, 'no hand-off screen online');
        if (process.env.QA_SHOTS) await D.page.screenshot({ path: process.env.QA_SHOTS + '/on-wait.png' });
        await until(K.page, () => document.querySelectorAll('#cerealModal .ck-cell:not([disabled])').length > 0, null, 'killer turn appears on the killer page');
        // killer day 1 through the referee
        await K.page.click(cell(8)); for (const id of [3, 2, 1]) await K.page.click(cell(id));
        await K.page.click('#ck-kill .ck-chip >> text="🏠 3"'); await K.page.click('#ck-wit .ck-chip >> text="🌳 4"'); await K.page.click('#ck-lock');
        await until(K.page, () => !!document.getElementById('ck-on-wait'), null, 'killer now waits');
        const g1 = JSON.parse(await (async () => JSON.stringify([...store.values()].find(v => v.code === code)))());
        assert.deepEqual({ phase: g1.phase, cereals: g1.cereals, witness: g1.witness }, { phase: 'detective', cereals: [3], witness: 4 }, 'the referee stored day 1');
        // detective: badge + ตาคุณ in the list, then the turn
        await D.page.evaluate(() => CK.lobby());
        await until(D.page, () => /ตาคุณ/.test(document.getElementById('cerealModal').innerText), null, 'my games list says ตาคุณ');
        assert.equal(await txt(D.page, '#ck-tab-online .ck-badge'), '1', 'tab badge = 1 game waiting for me');
        if (process.env.QA_SHOTS) await D.page.screenshot({ path: process.env.QA_SHOTS + '/on-list.png' });
        await D.page.click('#cerealModal .ck-game.mine');
        await until(D.page, () => document.querySelectorAll('#cerealModal .ck-cell:not([disabled])').length > 0, null, 'detective turn');
        assert.ok(!(await D.page.evaluate(() => document.getElementById('cerealModal').innerText)).includes('8 › 3 › 2 › 1'), 'the killer path is not on the detective page');
        await D.page.click(cell(7)); await D.page.click(cell(8)); await D.page.click(cell(9));
        await D.page.click('#ck-ask [data-q="building"]');
        await until(D.page, () => /→ ใช่/.test((document.getElementById('ck-answer') || {}).innerText || ''), null, 'the referee answers');
        await D.page.click('#ck-arrest'); await D.page.click(cell(4)); await D.page.click('#ck-confirm .yes');
        await until(D.page, () => !!document.getElementById('ck-on-wait'), null, 'detective waits after the miss');
        // killer day 2: the notebook comes back from mySecret
        await until(K.page, () => /8 › 3 › 2 › 1/.test(document.getElementById('cerealModal').innerText) && document.querySelectorAll('#cerealModal .ck-cell:not([disabled])').length > 0, null, 'killer day 2 with the notebook');
        assert.ok(!(await D.page.evaluate(() => document.getElementById('cerealModal').innerText)).includes('8 › 3 › 2 › 1'), 'still not on the detective page');
        // an hour passes: the detective claims the stale killer turn → both reveal
        NOW += 3600 * 1000 + 1000;
        await D.page.evaluate(() => { const st = CKOnline.state(); const g = CK._.get(); g.online.turnDeadline = Date.now() - 1; CK._.render(); });
        await until(D.page, () => !!document.getElementById('ck-on-claim'), null, 'claim button after the hour');
        await D.page.click('#ck-on-claim');
        await until(D.page, () => !!document.querySelector('#cerealModal .ck-win'), null, 'detective reveal');
        await until(K.page, () => !!document.querySelector('#cerealModal .ck-win'), null, 'killer reveal');
        assert.ok((await txt(D.page, '#cerealModal .ck-nb')).includes('8 › 3 › 2 › 1'), 'the reveal shows the revealed path');
        assert.equal(await K.page.evaluate(() => window.__writes) + await D.page.evaluate(() => window.__writes), 0, 'the pages never write Firestore');
        assert.deepEqual(K.errors, []); assert.deepEqual(D.errors, []);
        console.log('cereal-online-qa: OK — 📱/🌐 tabs, ＋ room code + seats, 🔑 join flips both pages, killer day 1 via cerealAct, ตาคุณ + badge, waiting card, mySecret notebook, path never on the detective page, referee answer, miss turns the day, ⏳ claim → both reveal, zero direct writes');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
