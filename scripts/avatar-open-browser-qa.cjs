// V101.135 — tapping the LINE photo (#u-img) inside LIFF opens THIS app (origin + path, no query) in the phone's own browser via
// liff.openWindow({ external: true }); Enter / Space do the same; outside LIFF the photo does nothing (no pointer, no title, no call).
// The REAL public/index.html in Chromium (network blocked), liff stubbed.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

async function open(browser, inClient) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript((inClient) => {
        window.__open = [];
        window.liff = { isInClient: () => inClient, openWindow: o => window.__open.push(o) };
        window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase });
    }, inClient);
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.liff = { isInClient: () => window.__client, openWindow: o => window.__open.push(o) }; });
    return { ctx, page, errors };
}
(async () => {
    const browser = await chromium.launch();
    try {
        // inside LIFF
        let { ctx, page, errors } = await open(browser, true);
        await page.evaluate(() => { window.__client = true; window.__open = []; document.getElementById('u-img').dataset.ob = ''; avatarBrowserInit(); });
        const a = await page.evaluate(() => { const i = document.getElementById('u-img'); return { cursor: i.style.cursor, title: i.title, role: i.getAttribute('role'), tab: i.tabIndex, label: i.getAttribute('aria-label') }; });
        assert.deepEqual(a, { cursor: 'pointer', title: 'Open in browser เปิดในเบราว์เซอร์', role: 'button', tab: 0, label: 'Open in browser' }, 'in LIFF the photo looks and reads as a button');
        await page.evaluate(() => document.getElementById('u-img').click());
        const url = await page.evaluate(() => location.origin + location.pathname);
        assert.deepEqual(await page.evaluate(() => window.__open), [{ url, external: true }], 'a tap → the app URL (origin + path, no query / hash) in the external browser');
        await page.evaluate(() => { const i = document.getElementById('u-img'); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); });
        assert.equal(await page.evaluate(() => window.__open.length), 3, 'Enter and Space open it too');
        await page.evaluate(() => { document.getElementById('u-img').dataset.ob = '1'; avatarBrowserInit(); document.getElementById('u-img').click(); });
        assert.equal(await page.evaluate(() => window.__open.length), 4, 'init twice does not double the handler (one open per tap)');
        // the badges on the photo are not part of it
        assert.equal(await page.evaluate(() => { const b = document.getElementById('u-award-badge'), g = document.getElementById('u-group-dot'); window.__open = []; b.click(); g.click(); return window.__open.length; }), 0, 'the group dot / award badge do not open the browser');
        assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], 'no page errors: ' + errors.join(' | '));
        await ctx.close();

        // outside LIFF
        ({ ctx, page, errors } = await open(browser, false));
        await page.evaluate(() => { window.__client = false; window.__open = []; document.getElementById('u-img').dataset.ob = ''; avatarBrowserInit(); });
        const b = await page.evaluate(() => { const i = document.getElementById('u-img'); return { cursor: i.style.cursor, title: i.title, role: i.getAttribute('role') }; });
        assert.deepEqual(b, { cursor: '', title: '', role: null }, 'outside LIFF: no pointer, no title, not a button');
        await page.evaluate(() => document.getElementById('u-img').click());
        assert.equal(await page.evaluate(() => window.__open.length), 0, 'outside LIFF a tap does nothing');
        await ctx.close();
        console.log('PASS: LINE photo — in LIFF a tap / Enter / Space opens this app in the external browser; outside LIFF nothing');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
