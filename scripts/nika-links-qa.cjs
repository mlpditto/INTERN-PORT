// V101.303 (owner) — the Nika tab's one-click external tools: 🫘 Kidney risk screening (cpa-microalbuminurea.netlify.app, สมาคมเภสัชกรรมชุมชน).
// Shown under the chips, outside the form so it stays while Nika is paused / done for the day; in LINE it opens outside the app
// (liff.openWindow external), in a browser a new tab. The REAL index.html + nika-ask.js on a 390 px phone, stubbed callable. OUTDIR=… saves a shot.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const URL_ = 'https://cpa-microalbuminurea.netlify.app/';

async function open(browser, peek, thai) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript((peek) => {
        window.firebase = { functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: peek }) }), firestore: { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } } };
        window.__open = []; window.open = (u, t, f) => { window.__open.push([u, t, f]); return {}; };
    }, peek);
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate((thai) => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        let n = document.getElementById('dd-codex-card');
        for (; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).display === 'none') n.style.setProperty('display', 'block', 'important');
        document.getElementById('dd-section-content').style.display = 'block';
        window.ensureFirebaseAuthReady = async () => ({ uid: 'a' });
        if (thai) document.body.classList.add('lang-th-on');
        document.querySelector('[data-ddtype="nika"]').click();
    }, thai);
    await page.waitForTimeout(250);
    return { page, ctx, errors };
}

(async () => {
    const browser = await chromium.launch();
    try {
        // 1. English, a browser: the link sits at the end of the chip row (V101.308: 🫘 ↗ only, the name in the tooltip), opens a new tab
        let { page, ctx, errors } = await open(browser, { left: 10, paused: false }, false);
        const l = await page.evaluate(() => { const b = document.querySelector('#nika-section-content .nk-link'), r = b.getBoundingClientRect();
            return { text: b.textContent.trim(), title: b.title, h: Math.round(r.height), inForm: !!b.closest('.nk-form'), afterChips: !!(document.querySelector('.nk-chips').compareDocumentPosition(b) & 4), row: !!b.closest('.nk-row') }; });
        assert.deepEqual(l, { text: '🫘 ↗', title: 'Kidney risk screening · สมาคมเภสัชกรรมชุมชน (ประเทศไทย)', h: 36, inForm: false, afterChips: true, row: true }, 'one-click link at the end of the chip row: ' + JSON.stringify(l));
        await page.click('.nk-link');
        assert.deepEqual(await page.evaluate(() => window.__open), [[URL_, '_blank', 'noopener']], 'a browser: new tab');
        if (process.env.OUTDIR) await page.locator('#dd-codex-card').screenshot({ path: process.env.OUTDIR + '/nika-link.png' });
        assert.deepEqual(errors.filter(e => !/firebase.(firestore|auth) is not a function/.test(e)), [], 'no Nika errors: ' + errors);
        await ctx.close();

        // 2. Thai, inside LINE: liff.openWindow external; still there while Nika is paused for a quiz
        ({ page, ctx, errors } = await open(browser, { left: 4, paused: true }, true));
        await page.evaluate(() => { window.__liff = []; window.liff = { isInClient: () => true, openWindow: o => window.__liff.push(o) }; });
        const s = await page.evaluate(() => { const b = document.querySelector('.nk-link'); return { label: b.getAttribute('aria-label'), form: document.querySelector('.nk-form').hidden, paused: !!document.querySelector('.nk-out .nk-pause'), shown: b.getBoundingClientRect().height > 0, chips: document.querySelector('.nk-chips .nk-chip') ? document.querySelector('.nk-chips .nk-chip').getBoundingClientRect().height : 0 }; });
        assert.deepEqual(s, { label: 'คัดกรองความเสี่ยงโรคไต', form: true, paused: true, shown: true, chips: 0 }, 'Thai label; the form + question chips hide while paused, the link stays: ' + JSON.stringify(s));
        await page.click('.nk-link');
        assert.deepEqual(await page.evaluate(() => [window.__liff, window.__open]), [[{ url: URL_, external: true }], []], 'LINE: opens outside the app');
        assert.deepEqual(errors.filter(e => !/firebase.(firestore|auth) is not a function/.test(e)), [], 'no Nika errors: ' + errors);
        await ctx.close();
        console.log('PASS: Nika one-click link (V101.303 · V101.308 🫘 ↗ in the chip row) — label in the tooltip (TH/EN), new tab in a browser, liff.openWindow external in LINE, stays while Nika is paused');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
