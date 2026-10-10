// V102.144: admin ▸ Dashboard ▸ "📖 Guide feedback" — the REAL public/guide-feedback-admin.js against a stubbed Firestore.
// Queries admin_notifications type == guide_feedback, newest first, shows who / which section / language / message, ✓ Mark read updates the doc,
// and the panel hides itself (queue-empty) once nothing is unread.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const js = fs.readFileSync('public/guide-feedback-admin.js', 'utf8');

const harness = `<!doctype html><meta charset="utf-8"><title>Nika Admin (V9.9)</title>
<style>.queue-empty{display:none!important}</style>
<div id="dashboard-work"></div>
<script>
window.__q = []; window.__upd = [];
const docs = [
  { id: 'a', data: () => ({ type: 'guide_feedback', userName: 'Mint', section: '📝 Quiz', lang: 'th', message: 'ไม่เข้าใจ ONE-TIME', read: false, timestamp: { toMillis: () => 2000, toDate: () => new Date(2000) } }), ref: { update: d => { window.__upd.push(['a', d]); docs[0].read = true; return Promise.resolve(); } } },
  { id: 'b', data: () => ({ type: 'guide_feedback', userName: 'Ploy', section: '🏁 Start here', lang: 'en', message: 'Where is Settings?', read: true, timestamp: { toMillis: () => 1000, toDate: () => new Date(1000) } }), ref: { update: () => Promise.resolve() } }
];
const db = { app: { auth: () => ({ currentUser: {}, onAuthStateChanged: cb => cb({}) }) },
  collection: n => ({ where: (f, op, v) => ({ onSnapshot: ok => { window.__q.push([n, f, op, v]); window.__ok = ok; ok({ docs: docs, size: docs.length }); } }) }) };
</script>
<script>${js}</script>`;

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent(harness);
        await page.waitForSelector('#dashboard-work details.lr-admin');
        await page.evaluate(() => { document.querySelector('#dashboard-work details.lr-admin').open = true; });
        await page.waitForSelector('#dashboard-work .lr-request');
        assert.deepEqual(await page.evaluate(() => window.__q[0]), ['admin_notifications', 'type', '==', 'guide_feedback'], 'queries guide_feedback');
        const rows = await page.$$eval('.lr-request > summary', els => els.map(e => e.textContent));
        assert.deepEqual(rows, ['💬 New · Mint · 📝 Quiz (TH)', '✅ Read · Ploy · 🏁 Start here (EN)'], 'newest first, who / section / language');
        assert.ok((await page.$eval('.lr-request p', e => e.textContent)).includes('ONE-TIME'), 'message shown');
        assert.equal(await page.locator('details.lr-admin.queue-empty').count(), 0, 'visible while something is unread');
        await page.click('.lr-request > summary');
        await page.click('.lr-request button');
        await page.waitForFunction(() => window.__upd.length === 1);
        assert.deepEqual(await page.evaluate(() => window.__upd[0]), ['a', { read: true }], 'Mark read updates the doc');
        await page.evaluate(() => window.__ok({ docs: [{ ...{ id: 'b' }, data: () => ({ type: 'guide_feedback', read: true, message: 'x' }), ref: {} }], size: 1 }));
        assert.equal(await page.locator('details.lr-admin.queue-empty').count(), 1, 'hides itself when nothing is unread');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: admin Guide feedback panel — reads type guide_feedback, newest first with user · section · language, ✓ Mark read, hides when nothing is unread');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
