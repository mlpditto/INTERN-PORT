// V101.174: History ▸ a Reflective Log card shows the intern's own text and the mentor's comment. The submissions mirror keeps
// the text as `description` (the card read `content` → "No reflection content") and never gets the comment; the card now reads
// the reflective_logs doc (reflectiveLogsCache) by metadata.sourceId. The REAL public/index.html on a phone (file://, network
// blocked, Firebase stubbed); the detail is mounted in the real History pane so lang-toggle runs over it (page in EN).
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(fs.readFileSync('public/index.html', 'utf8')));
const TEXT = 'ได้เรียนรู้ระบบยาต่างๆในร้านทั้ง Telepharmacy';

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }) };
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX, { waitUntil: 'load' });
        await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });
        await page.waitForTimeout(400);

        const show = (sub) => page.evaluate(async (sub) => {
            const host = document.getElementById('work-pane-history') || document.body;
            for (let a = host; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            let box = document.getElementById('__qa_detail'); if (!box) { box = document.createElement('div'); box.id = '__qa_detail'; box.className = 'card-detail'; host.prepend(box); }
            box.innerHTML = renderTypeDetailHtml(sub);
            await new Promise(r => setTimeout(r, 250));   // let lang-toggle's observer walk the new nodes
            return { text: box.innerText, hidden: box.querySelectorAll('.lang-th').length };
        }, sub);

        await page.evaluate(TEXT => {
            reflectiveLogsCache = [
                { id: 'L1', content: TEXT, mood: '😊', adminComment: 'ดีมาก ลองเพิ่มเรื่องการปรับยา', adminBonus: 0.3, pointsClaimed: false },
                { id: 'L2', content: 'claimed one', mood: '😊', adminComment: 'Nice work', adminBonus: 0.2, pointsClaimed: true },
                { id: 'L3', content: 'not reviewed yet', mood: '😐' },
            ];
        }, TEXT);
        // what the Journal submit writes to the submissions mirror: the text as `description`, no content, no comment
        const mirror = (id, desc) => ({ submissionType: 'reflective', status: 'reviewed', description: desc, metadata: { sourceId: id, mood: '😊', sourceType: 'reflective_logs' } });

        const a = await show(mirror('L1', TEXT));
        assert.ok(a.text.includes(TEXT), 'own text shows (was "No reflection content"): ' + a.text);
        assert.ok(!/No reflection content/.test(a.text), 'no empty placeholder');
        assert.ok(/mentor · พี่เลี้ยง/i.test(a.text) && a.text.includes('ดีมาก ลองเพิ่มเรื่องการปรับยา'), "mentor's comment shows: " + a.text);
        assert.match(a.text, /🎁 \+0\.3 pts — กดรับในหน้า Journal/, 'unclaimed bonus → points to Journal');
        assert.equal(a.hidden, 0, 'no Thai hidden by lang-toggle');

        const b = await show(mirror('L2', 'claimed one'));
        assert.match(b.text, /✅ รับแล้ว · Claimed \+0\.2 pts/, 'claimed bonus says so');
        const c = await show(mirror('L3', 'not reviewed yet'));
        assert.ok(c.text.includes('not reviewed yet') && !/mentor/i.test(c.text), 'no review → text only, no mentor block');
        const d = await show(mirror('MISSING', 'older entry not in the cache'));
        assert.ok(d.text.includes('older entry not in the cache'), 'source not loaded → the mirror description is shown');
        const e = await show({ ...mirror('L1', TEXT), adminComment: 'from the mirror' });
        assert.ok(!/mentor · พี่เลี้ยง/i.test(e.text), 'a mirror that already carries adminComment is left to history-lean.js (no duplicate)');
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        await ctx.close();
        console.log('history-reflective-detail-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
