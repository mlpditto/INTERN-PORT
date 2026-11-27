// V101.338: 🥣 Cereal Killer Phase 2 PR 3 — share in LINE (owner pick room B + nudge B, mockup-cereal-share/). Same two-phone harness
// as cereal-online-qa (the REAL functions/cereal-act.js referee in node, the pages' callable + snapshots routed to it, network blocked),
// plus a liff.shareTargetPicker stub that records the Flex messages and a clipboard stub for the fallback.
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
        window.__shared = []; window.__clip = [];
        window.liff = { isApiAvailable: (n) => n === 'shareTargetPicker' && !window.__noPicker, shareTargetPicker: (m) => { window.__shared.push(JSON.parse(JSON.stringify(m))); return Promise.resolve({ status: 'success' }); } };
        try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip.push(t); return Promise.resolve(); } }, configurable: true }); } catch (_) {}
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

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const K = await open(browser, 'authK'), D = await open(browser, 'authD');
        // killer makes a room
        await K.page.evaluate(() => cerealOpen()); await K.page.click('#ck-tab-online');
        await until(K.page, () => !!document.getElementById('ck-on-new'), null, 'online tab loads');
        await K.page.click('#ck-on-new'); await K.page.click('#ck-on-role-killer'); await K.page.click('#ck-on-create');
        await until(K.page, () => /^[A-Z2-9]{6}$/.test((document.getElementById('ck-on-room-code') || {}).textContent || ''), null, 'room code');
        const code = await K.page.textContent('#ck-on-room-code');
        // pick B: 📤 LINE chip beside 📋 คัดลอกรหัส, one row
        const row = await K.page.evaluate(() => [...document.querySelectorAll('#ck-on-invite, #ck-on-copy')].map(b => [b.textContent.trim(), Math.round(b.getBoundingClientRect().top)]));
        assert.deepEqual(row.map(r => r[0]), ['📤 LINE', '📋 คัดลอกรหัส'], 'room: 📤 LINE then 📋');
        assert.ok(Math.abs(row[0][1] - row[1][1]) <= 4, 'both chips on one row');
        if (process.env.QA_SHOTS) await K.page.screenshot({ path: process.env.QA_SHOTS + '/share-room.png' });
        await K.page.click('#ck-on-invite');
        await until(K.page, () => window.__shared.length === 1, null, 'invite sent through shareTargetPicker');
        const inv = (await K.page.evaluate(() => window.__shared[0]))[0], invJ = JSON.stringify(inv);
        assert.equal(inv.type, 'flex'); assert.ok(inv.altText.includes(code), 'alt text has the code');
        assert.ok(invJ.includes('Pond ชวนเล่น 🕵️ นักสืบ'), 'title: who invites, which seat is open');
        assert.ok(invJ.includes('"text":"' + code + '"'), 'card shows the code big');
        const invUri = inv.contents.footer.contents[0].action.uri;
        assert.ok(/^https:\/\/liff\.line\.me\/[^?]+\?cereal=/.test(invUri) && invUri.endsWith('?cereal=' + code), 'button opens ?cereal=<code>: ' + invUri);
        assert.equal(await txt(K.page, '#ck-on-invite'), '✓ ส่งแล้ว', 'chip says sent');
        // my own invite link (liff.state-wrapped, as LINE may deliver it) reopens my room, no own-game error
        await K.page.evaluate(() => CK.close());
        await K.page.evaluate((c) => {
            const wrapped = new URLSearchParams('liff.state=' + encodeURIComponent('?cereal=' + c));
            const inner = new URLSearchParams(decodeURIComponent(wrapped.get('liff.state')).replace(/^\?/, ''));
            applyTabDeepLink(inner);
        }, code);
        await until(K.page, () => !!document.getElementById('ck-on-room-code') && document.getElementById('cerealModal').style.display !== 'none', null, 'own link → my room');
        assert.equal(await K.page.$('#cerealModal .ck-warn'), null, 'no error on my own link');
        // friend taps the card: ?cereal=<code> (lower case) → joins without typing
        await D.page.evaluate((c) => applyTabDeepLink(new URLSearchParams('cereal=' + c.toLowerCase())), code);
        await until(D.page, () => !!document.getElementById('ck-on-wait'), null, 'deep link joined → detective waits');
        await until(K.page, () => document.querySelectorAll('#cerealModal .ck-cell:not([disabled])').length > 0, null, 'killer turn on the killer page');
        // nudge B: 📤 สะกิด first in the bottom row of the waiting screen
        const btns = await D.page.evaluate(() => [...document.querySelectorAll('#cerealModal .ck-row .ck-chip')].map(b => b.textContent.trim()).filter(t => /สะกิด|เกมของฉัน|ยอมแพ้/.test(t)));
        assert.deepEqual(btns, ['📤 สะกิด', '📋 เกมของฉัน', '🏳️ ยอมแพ้'], 'waiting row: 📤 สะกิด · 📋 · 🏳️');
        assert.equal(await D.page.$('#ck-on-wait .ck-chip, #ck-on-wait button:not(#ck-on-claim)'), null, 'nothing new inside the waiting card (pick B)');
        if (process.env.QA_SHOTS) await D.page.screenshot({ path: process.env.QA_SHOTS + '/share-wait.png' });
        await D.page.click('#ck-on-nudge');
        await until(D.page, () => window.__shared.length === 1, null, 'nudge sent');
        const nd = (await D.page.evaluate(() => window.__shared[0]))[0], ndJ = JSON.stringify(nd);
        const gameId = await D.page.evaluate(() => CK._.get().online.id);
        assert.ok(ndJ.includes('ถึงตาคุณแล้ว 🔪') && nd.contents.header.backgroundColor === '#be123c', 'killer-red ถึงตาคุณ card');
        assert.ok(ndJ.includes('Mint (🕵️)'), 'says who sent it');
        assert.ok(nd.contents.footer.contents[0].action.uri.endsWith('?cereal=' + gameId), 'opens the game by id');
        assert.equal(await txt(D.page, '#ck-on-nudge'), '✓ สะกิดแล้ว');
        // nothing secret in either card
        for (const j of [invJ, ndJ]) assert.ok(!/secret|"path"|home|kills/i.test(j), 'no secret in a card: ' + j.slice(0, 80));
        // ?cereal=<gameId> on the killer page opens that game from a closed modal
        await K.page.evaluate(() => CK.close());
        await K.page.evaluate((id) => applyTabDeepLink(new URLSearchParams('cereal=' + id)), gameId);
        await until(K.page, () => document.getElementById('cerealModal').style.display !== 'none' && document.querySelectorAll('#cerealModal .ck-cell:not([disabled])').length > 0, null, 'id link opens the game on my turn');
        // no LINE picker → clipboard fallback
        await D.page.evaluate(() => { window.__noPicker = true; CKOnline.state().sent = ''; CK._.render(); });
        await D.page.click('#ck-on-nudge');
        await until(D.page, () => window.__clip.length === 1, null, 'clipboard fallback');
        assert.ok((await D.page.evaluate(() => window.__clip[0])).includes('?cereal=' + gameId), 'copied text has the link');
        assert.equal(await K.page.evaluate(() => window.__writes) + await D.page.evaluate(() => window.__writes), 0, 'the pages never write Firestore');
        assert.deepEqual(K.errors, []); assert.deepEqual(D.errors, []);
        console.log('cereal-share-qa: OK — room 📤 LINE beside 📋 (pick B), Flex invite with code + ?cereal=<code>, own link reopens my room, friend link joins without typing, 📤 สะกิด in the waiting row (pick B), ถึงตาคุณ card coloured for the receiver + ?cereal=<gameId>, id link opens the game, clipboard fallback, nothing secret in cards, zero direct writes');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
