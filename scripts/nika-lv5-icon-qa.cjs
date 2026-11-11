// V101.308 (owner): the Nika tab = the icon only; LV.1–4 see nika-lv1.png, LV.5+ see nika-lv5.png. The first time (this device) the icon flashes once
// (.nk-up) and a toast says so; after that it just shows. Driven through the real place the LV is set (lvNow, then nikaAsk.icon()). The REAL index.html.
// OUTDIR=… saves the two tabs.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            window.firebase = { functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: { left: 10 } }) }), firestore: { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } } };
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.evaluate(() => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            let n = document.getElementById('dd-codex-card');
            for (; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).display === 'none') n.style.setProperty('display', 'block', 'important');
            document.getElementById('dd-section-content').style.display = 'block';
            window.ensureFirebaseAuthReady = async () => ({ uid: 'a' }); window.__toasts = []; window.showToast = m => window.__toasts.push(m);
            localStorage.removeItem('nika_lv5_seen');
            document.querySelector('[data-ddtype="nika"]').click();
        });
        await page.waitForTimeout(250);
        const st = () => page.evaluate(() => { const t = document.querySelector('.nk-tab'), i = t.querySelector('img');
            return { src: i.getAttribute('src'), loaded: i.complete && i.naturalWidth > 0, up: t.classList.contains('nk-up'), text: [...t.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(''), toasts: window.__toasts.slice() }; });
        await page.evaluate(() => { lvNow = 4; nikaAsk.icon(); });
        let s = await st();
        assert.deepEqual([s.src, s.up, s.text, s.toasts], ['nika-lv1.png', false, '', []], 'LV.4: the old icon, no text: ' + JSON.stringify(s));
        if (process.env.OUTDIR) await page.locator('#dd-type-tabs').screenshot({ path: process.env.OUTDIR + '/nika-tab-lv4.png' });
        await page.evaluate(() => { lvNow = 5; nikaAsk.icon(); }); await page.waitForTimeout(300);
        s = await st();
        assert.deepEqual([s.src, s.loaded, s.up, s.toasts, await page.evaluate(() => localStorage.getItem('nika_lv5_seen'))], ['nika-lv5.png', true, true, ['🌞 Nika LV.5 ✨'], '1'], 'LV.5: the new picture, flash + toast once: ' + JSON.stringify(s));
        if (process.env.OUTDIR) { await page.waitForTimeout(1500); await page.locator('#dd-type-tabs').screenshot({ path: process.env.OUTDIR + '/nika-tab-lv5.png' }); }
        // a later load at LV.5+: the picture, no flash, no toast
        await page.evaluate(() => { lvNow = 3; nikaAsk.icon(); document.querySelector('.nk-tab').classList.remove('nk-up'); window.__toasts = []; lvNow = 7; nikaAsk.icon(); });
        s = await st();
        assert.deepEqual([s.src, s.up, s.toasts], ['nika-lv5.png', false, []], 'seen before: no flash / toast');
        assert.deepEqual(errors.filter(e => !/firebase.(firestore|auth) is not a function/.test(e)), [], 'no page errors: ' + errors);
        console.log('PASS: Nika icon by LV (V101.308) — icon-only tab; LV.1–4 nika-lv1.png, LV.5+ nika-lv5.png (loads), first time = flash + toast once, then quiet');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
