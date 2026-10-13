// V101.134 — Explore: the "Earn once per shop · Daily cap applies" strip is gone; the note is the Open button's hover tooltip (title, with the real
// daily Beri cap; Thai in data-th-title). The REAL public/index.html + renderExploreLinks in Chromium (network blocked, Firebase stubbed).
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(idx));
assert.ok(!idx.includes('explore-daily-cap-text'), 'the in-page cap span is gone');
assert.ok(!/🪙 Earn once per shop/.test(idx), 'no strip above the shop list');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.waitForTimeout(400);
        const r = await page.evaluate(() => {
            reviewLinksCache = [{ id: 'a1', title: 'BEARHOUSE', url: 'https://example.com' }];
            reviewLinkClicksCache = {};
            renderExploreLinks();
            const open = document.querySelector('#explore-links-list button[onclick^="explOpenLink"]');
            return { found: !!open, title: open && open.title, th: open && open.dataset.thTitle, cap: REVIEW_LINK_DAILY_BERI_CAP, text: document.getElementById('explore-links-list').innerText };
        });
        assert.ok(r.found, 'the Open button renders');
        assert.equal(r.title, 'Earn once per shop · Daily cap applies (' + r.cap + ' Beri/day)', 'English tooltip, with the real cap');
        assert.match(r.th, new RegExp('^กดเปิดลิงก์ครั้งแรก รับ Beri ทันที .* จำกัดวันละ ' + r.cap + ' Beri\\)$'), 'Thai tooltip');
        assert.ok(!/Earn once per shop/.test(r.text), 'the sentence is not printed on the page');
        assert.deepEqual(errors.filter(e => !/firebase\.|Cannot read properties of undefined/.test(e)), [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: Explore — the earn / daily-cap note is the Open button tooltip, not a strip');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
