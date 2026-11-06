// V101.273 Christmas add-on (owner picks 2026-11-06): snow A over the whole page + the music-box loop, on by default from the first tap,
// long-press the profile photo (0.6 s) = off / on, a normal tap keeps "open in browser" in LINE. The REAL index.html + christmas.js; Audio and liff stubbed.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href;

async function open(browser, opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        window.__calls = []; window.__opened = 0;
        window.Audio = function (src) { this.src = src; this.paused = true; this.play = () => { this.paused = false; window.__calls.push('play'); return Promise.resolve(); }; this.pause = () => { this.paused = true; window.__calls.push('pause'); }; };
        window.liff = { isInClient: () => true, openWindow: () => { window.__opened++; }, init: () => new Promise(() => {}), isLoggedIn: () => false, getProfile: () => new Promise(() => {}) };
        const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
        const q = () => ({ where: q, orderBy: q, limit: q, get: async () => ({ docs: [], size: 0, empty: true, forEach() {} }), onSnapshot: () => () => {}, doc: () => ({ get: async () => ({ exists: false, data: () => null }), onSnapshot: () => () => {}, set: async () => {}, update: async () => {}, collection: q }) });
        const db = { collection: q, batch: () => ({ set() {}, update() {}, commit: async () => {} }), runTransaction: async () => {}, enablePersistence: async () => {}, settings() {} };
        window.firebase = new Proxy(function () {}, { get: (t, k) => { if (k === 'firestore') { const f = () => db; f.FieldValue = any; f.Timestamp = any; return f; } return k === 'then' ? undefined : any; }, apply: () => any });
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        if (typeof avatarBrowserInit === 'function') avatarBrowserInit();
    });
    return { ctx, page, errors };
}

(async () => {
    const browser = await chromium.launch();
    try {
        const { ctx, page, errors } = await open(browser);
        // theme off (6 Nov): nothing
        await page.evaluate(() => applySeasonTheme('off'));
        assert.equal(await page.locator('.xm-snow').count(), 0, 'no snow outside the Christmas theme');
        await page.mouse.click(200, 700);
        assert.deepEqual(await page.evaluate(() => window.__calls), [], 'no music outside the theme');
        // theme on
        await page.evaluate(() => applySeasonTheme('xm'));
        await page.waitForTimeout(100);
        const snow = await page.evaluate(() => { const s = document.querySelector('.xm-snow'); const cs = getComputedStyle(s); return { n: s.children.length, pe: cs.pointerEvents, pos: cs.position, anim: getComputedStyle(s.firstElementChild).animationName, aria: s.getAttribute('aria-hidden') }; });
        assert.deepEqual(snow, { n: 26, pe: 'none', pos: 'fixed', anim: 'xmSnow', aria: 'true' }, 'snow A: 26 flakes over the page, taps go through: ' + JSON.stringify(snow));
        await page.mouse.click(200, 700);
        assert.deepEqual(await page.evaluate(() => window.__calls), ['play'], 'music starts at the first tap (on by default)');
        // V101.276 pine forest (owner pick B): the page itself wears the theme
        const look = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundImage, strip: getComputedStyle(document.body, '::after').backgroundImage, foot: getComputedStyle(document.getElementById('intern-footer-line')).color }));
        assert.ok(look.bg.includes('rgb(15, 61, 46)'), 'pine background: ' + look.bg.slice(0, 80)); assert.ok(look.strip.includes('rgb(220, 38, 38)'), 'candy-cane strip on top');
        assert.equal(look.foot, 'rgb(209, 250, 229)', 'the version line turns light on the dark page');
        // the mute hint: once, English only, below the photo; holding the photo removes it
        await page.waitForTimeout(100);
        const hint = await page.evaluate(() => { const h = document.querySelector('.xm-hint'), img = document.getElementById('u-img').getBoundingClientRect(); return h ? { text: h.innerText.trim(), below: h.getBoundingClientRect().top >= img.bottom, pulse: !!document.querySelector('.xm-hint-pulse'), seen: localStorage.getItem('xm_hint_seen') } : null; });
        assert.deepEqual(hint, { text: '🎵 Hold your photo to turn the music off', below: true, pulse: true, seen: '1' }, 'the hint shows once the music starts: ' + JSON.stringify(hint));
        // long-press the photo → off, and the click after it does NOT open the browser
        const box = await page.locator('#u-img').boundingBox();
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        const opened0 = await page.evaluate(() => window.__opened);
        await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(750); await page.mouse.up();
        let st = await page.evaluate(() => ({ calls: window.__calls.slice(-1)[0], pref: localStorage.getItem('xm_music'), opened: window.__opened }));
        assert.equal(await page.locator('.xm-hint, .xm-hint-pulse').count(), 0, 'holding the photo removes the hint');
        assert.equal(st.calls, 'pause', 'long-press = music off'); assert.equal(st.pref, 'off', 'remembered');
        assert.equal(st.opened, opened0, 'the long-press does not open the browser');
        // a normal tap still opens the browser, and does not restart the music
        await page.mouse.click(cx, cy);
        st = await page.evaluate(() => ({ last: window.__calls.slice(-1)[0], opened: window.__opened }));
        assert.equal(st.opened, opened0 + 1, 'a normal tap keeps "open in browser"'); assert.equal(st.last, 'pause', 'music stays off');
        // long-press again → on
        await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(750); await page.mouse.up();
        st = await page.evaluate(() => ({ last: window.__calls.slice(-1)[0], pref: localStorage.getItem('xm_music') }));
        await page.waitForTimeout(100); assert.equal(await page.locator('.xm-hint').count(), 0, 'the hint never comes back on this device');
        assert.deepEqual(st, { last: 'play', pref: 'on' }, 'long-press again = music on');
        // theme switched off → snow gone, music paused
        await page.evaluate(() => applySeasonTheme('off')); await page.waitForTimeout(100);
        assert.equal(await page.locator('.xm-snow').count(), 0); assert.equal(await page.evaluate(() => window.__calls.slice(-1)[0]), 'pause', 'theme off = music off');
        assert.deepEqual(errors.filter(e => /christmas|xm/i.test(e)), [], 'no errors from christmas.js');
        await ctx.close();
        // reduced motion: no snow
        const r = await open(browser, { reduced: true });
        await r.page.evaluate(() => applySeasonTheme('xm')); await r.page.waitForTimeout(100);
        assert.equal(await r.page.evaluate(() => getComputedStyle(document.querySelector('.xm-snow')).display), 'none', 'still for reduced motion');
        await r.ctx.close();
        console.log('PASS: Christmas — snow A (26 flakes, taps go through, theme only, off for reduced motion); music on from the first tap; long-press photo = off / on, a tap still opens the browser');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
