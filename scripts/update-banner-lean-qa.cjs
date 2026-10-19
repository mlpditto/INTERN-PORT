// V101.173: the "New version … available" banner is lean — one row ~32px (was ~56px, the page's global
// `button { min-height:48px; padding:12px }` set its height). The REAL public/index.html on a phone (file://, network blocked):
// fetch is stubbed so the real update check sees a newer <title> and draws the real banner.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(fs.readFileSync('public/index.html', 'utf8')));

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        for (const width of [412, 960]) {
            const ctx = await browser.newContext({ viewport: { width, height: 700 }, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
            const page = await ctx.newPage();
            const errors = []; page.on('pageerror', e => errors.push(e.message));
            await page.addInitScript(() => {
                window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }) };
                const real = window.fetch;
                window.fetch = (u, o) => /[?&]t=\d/.test(String(u)) ? Promise.resolve(new Response('<!doctype html><title>Internship Portfolio (V999.1)</title>', { status: 206 })) : real(u, o);
                try { localStorage.removeItem('updateBannerSuppressedUntil'); } catch (_) {}
            });
            await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
            await page.goto(INDEX, { waitUntil: 'load' });
            await page.waitForSelector('#upd-banner', { timeout: 15000 });   // the check fires 5 s after load
            const m = await page.evaluate(() => {
                const bar = document.getElementById('upd-banner'), r = bar.getBoundingClientRect();
                const b = ['upd-banner-reload', 'upd-banner-dismiss'].map(id => document.getElementById(id).getBoundingClientRect());
                const cy = x => x.top + x.height / 2;
                return { h: r.height, btnH: b.map(x => x.height), oneRow: Math.abs(cy(b[0]) - cy(r)) <= 2 && Math.abs(cy(b[1]) - cy(r)) <= 2, fits: bar.scrollWidth <= bar.clientWidth + 1,
                         text: bar.querySelector('span').textContent, right: b[1].right <= window.innerWidth };
            });
            assert.ok(m.h >= 28 && m.h <= 34, width + 'px: banner is ~32px tall, was ~56: ' + m.h);
            assert.deepEqual(m.btnH, [24, 24], width + 'px: both buttons 24px (not the global 48px)');
            assert.ok(m.oneRow && m.fits && m.right, width + 'px: one row, nothing overflows: ' + JSON.stringify(m));
            assert.match(m.text, /New version V999\.1 available · current V101\.\d+/);
            if (process.env.QA_SHOT) await page.locator('#upd-banner').screenshot({ path: process.env.QA_SHOT + '/upd-banner-' + width + '.png' });
            await page.click('#upd-banner-dismiss');
            assert.equal(await page.locator('#upd-banner').count(), 0, 'Dismiss still removes it');
            assert.deepEqual(errors.filter(e => !/firebase|liff/i.test(e)), [], 'no page errors');
            await ctx.close();
        }
        console.log('update-banner-lean-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
