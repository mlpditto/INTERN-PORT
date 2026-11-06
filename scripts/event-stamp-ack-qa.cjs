// V101.277 Event Stamp (owner 2026-11-06: "ปุ่ม continue กดแล้ว = รับทราบจะไม่แสดงซ้ำ"): CONTINUE acknowledges the stamp for good —
// saved on the intern's own doc (users/{id}.eventStampsSeen, arrayUnion) + this device; a stamp acknowledged on another device is not shown;
// nothing is marked before CONTINUE; an admin preview never writes the intern's doc. The REAL index.html.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href;

async function open(browser) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        window.__writes = [];
        const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
        const doc = path => ({ get: async () => ({ exists: false, data: () => null }), onSnapshot: () => () => {}, set: async () => {}, update: async v => { window.__writes.push({ path, v: JSON.parse(JSON.stringify(v)) }); }, collection: q });
        const q = name => ({ where: () => q(name), orderBy: () => q(name), limit: () => q(name), get: async () => ({ docs: [], size: 0, empty: true, forEach() {} }), onSnapshot: () => () => {}, doc: id => doc(name + '/' + id) });
        const db = { collection: q, batch: () => ({ set() {}, update() {}, commit: async () => {} }), runTransaction: async () => {}, enablePersistence: async () => {}, settings() {} };
        const FieldValue = { arrayUnion: (...ids) => ({ __arrayUnion: ids }), serverTimestamp: () => 'TS', increment: n => n, delete: () => null };
        window.firebase = new Proxy(function () {}, { get: (t, k) => { if (k === 'firestore') { const f = () => db; f.FieldValue = FieldValue; f.Timestamp = any; return f; } return k === 'then' ? undefined : any; }, apply: () => any });
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    });
    return { ctx, page, errors };
}
const STAMPS = [{ id: 'ev1_U1', title: 'Halloween', eventDate: '2026-10-31', badge: 'halloween' }, { id: 'ev2_U1', title: 'Pharma Day', eventDate: '2026-10-20', badge: 'star' }];

(async () => {
    const browser = await chromium.launch();
    try {
        const { ctx, page, errors } = await open(browser);
        // ev2 was acknowledged on another phone → only ev1 shows here
        const r = await page.evaluate(stamps => {
            isPreview = false; userId = 'U1'; window.myUserDoc = { id: 'U1', eventStampsSeen: ['ev2_U1'] };
            myEventStamps = stamps; evStampsQueueNew();
            const m = document.getElementById('achievementUnlockModal');
            return { shown: m.style.display, title: document.getElementById('ach-unlock-title').textContent, local: localStorage.getItem('ip_event_stamps_seen_v1'), writes: window.__writes.length };
        }, STAMPS);
        assert.equal(r.shown, 'flex'); assert.equal(r.title, 'Halloween', 'the stamp acknowledged on another device is not shown');
        assert.equal(r.local, null, 'nothing is marked before CONTINUE'); assert.equal(r.writes, 0);
        // the snapshot fires again while the popup is open → not queued twice
        await page.evaluate(() => evStampsQueueNew());
        assert.equal(await page.evaluate(() => achUnlockQueue.length), 0, 'not queued twice');
        await page.click('#achievementUnlockModal button:has-text("CONTINUE")');
        const after = await page.evaluate(() => ({ shown: document.getElementById('achievementUnlockModal').style.display, local: JSON.parse(localStorage.getItem('ip_event_stamps_seen_v1')), writes: window.__writes }));
        assert.equal(after.shown, 'none', 'CONTINUE closes it');
        assert.deepEqual(after.writes, [{ path: 'users/U1', v: { eventStampsSeen: { __arrayUnion: ['ev1_U1'] } } }], 'CONTINUE saves the acknowledgement on the intern\'s own doc');
        assert.ok(after.local.includes('ev1_U1') && after.local.includes('ev2_U1'), 'and on this device');
        // a later snapshot / reload: nothing shows again
        await page.evaluate(() => { evStampsQueued.clear(); evStampsQueueNew(); });
        assert.equal(await page.evaluate(() => document.getElementById('achievementUnlockModal').style.display), 'none', 'never shown again');
        await ctx.close();
        // admin preview: shows, CONTINUE closes, but never writes the intern's doc
        const p2 = await open(browser);
        const pv = await p2.page.evaluate(stamps => { isPreview = true; userId = 'U1'; window.myUserDoc = null; myEventStamps = stamps; evStampsQueueNew(); return document.getElementById('achievementUnlockModal').style.display; }, STAMPS);
        assert.equal(pv, 'flex', 'preview still shows it');
        await p2.page.click('#achievementUnlockModal button:has-text("CONTINUE")');
        assert.equal(await p2.page.evaluate(() => window.__writes.length), 0, 'an admin preview never writes the intern\'s doc');
        await p2.ctx.close();
        assert.deepEqual(errors.filter(e => /stamp/i.test(e)), [], 'no errors');
        console.log('PASS: Event Stamp — CONTINUE = acknowledged for good (users.eventStampsSeen arrayUnion + this device), acknowledged elsewhere = not shown, nothing marked before CONTINUE, no double queue, preview never writes');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
