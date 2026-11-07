// V101.285 🌊 Ice tide theme (owner pick A · mockup-lv-wave-theme.html): from LV.4 the LV chip is the switch (tap = html.wave on / off),
// kept on users/{id}.theme ('wave' | 'classic') + this device (intern_wave, read in <head> so the page opens in it). Below LV.4 the chip wears 🔒
// and the theme stays off. With Christmas (html.xm) the ice page replaces the pine; the snow stays. The version sits fixed bottom-left.
// An admin preview never writes. The REAL index.html, Firestore stubbed.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href;

async function open(browser, { cached = false } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript((cached) => {
        try { localStorage.setItem('intern_theme', 'off'); if (cached) localStorage.setItem('intern_wave', '1'); } catch (e) { /* none */ }
        window.__writes = [];
        const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
        const doc = p => ({ get: async () => ({ exists: false, data: () => null }), onSnapshot: () => () => {}, set: async (v, o) => { window.__writes.push({ p, v: JSON.parse(JSON.stringify(v)), merge: !!(o && o.merge) }); }, update: async () => {}, collection: q });
        const q = n => ({ where: () => q(n), orderBy: () => q(n), limit: () => q(n), get: async () => ({ docs: [], size: 0, empty: true, forEach() {} }), onSnapshot: () => () => {}, doc: id => doc(n + '/' + id) });
        const db = { collection: q, batch: () => ({ set() {}, update() {}, commit: async () => {} }), runTransaction: async () => {}, enablePersistence: async () => {}, settings() {} };
        window.firebase = new Proxy(function () {}, { get: (t, k) => { if (k === 'firestore') { const f = () => db; f.FieldValue = any; f.Timestamp = any; return f; } return k === 'then' ? undefined : any; }, apply: () => any });
    }, cached);
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    const atLoad = await page.evaluate(() => document.documentElement.classList.contains('wave'));
    await page.waitForTimeout(600);
    await page.evaluate(() => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        isPreview = false; userId = 'U1'; window.myUserDoc = { id: 'U1', lvSeen: 99 };
    });
    return { ctx, page, errors, atLoad };
}
const setScore = (page, s) => page.evaluate(s => { myScore = s; updateGrandLineDashboard(); }, s);
const state = page => page.evaluate(() => {
    const r = document.getElementById('u-crew-rank'), f = getComputedStyle(document.getElementById('intern-footer-line'));
    let store = null; try { store = localStorage.getItem('intern_wave'); } catch (e) { /* none */ }
    return { wave: document.documentElement.classList.contains('wave'), cls: [...r.classList].join(' '), role: r.getAttribute('role'), pressed: r.getAttribute('aria-pressed'),
        after: getComputedStyle(r, '::after').content, title: r.title, bg: getComputedStyle(document.body).backgroundColor, bgImg: getComputedStyle(document.body).backgroundImage,
        foot: f.position, store, writes: window.__writes.slice() };
});

(async () => {
    const browser = await chromium.launch();
    try {
        // LV.3: 🔒, not a button, a tap does nothing
        let { ctx, page, errors } = await open(browser);
        await setScore(page, 25);
        let s = await state(page);
        assert.equal(s.cls, 'lv-wave-lock'); assert.equal(s.after, '"🔒"'); assert.equal(s.role, null);
        assert.match(s.title, / · 🔒 LV\.4 unlocks the 🌊 theme$/);
        await page.locator('#u-crew-rank').click();
        s = await state(page);
        assert.equal(s.wave, false, 'LV.3 cannot wear the theme'); assert.equal(s.writes.length, 0);

        // LV.4: 🌊 button; tap = on (users.theme = wave, merge) → page is ice blue, version fixed bottom-left; tap again = off (classic)
        await setScore(page, 43.4);
        s = await state(page);
        assert.equal(s.cls, 'lv-wave-ok'); assert.equal(s.after, '"🌊"'); assert.equal(s.role, 'button'); assert.equal(s.pressed, 'false');
        assert.equal(s.foot, 'static', 'the version stays in the flow without the theme');
        await page.locator('#u-crew-rank').click();
        s = await state(page);
        assert.equal(s.wave, true); assert.equal(s.pressed, 'true'); assert.equal(s.store, '1');
        assert.deepEqual(s.writes, [{ p: 'users/U1', v: { theme: 'wave' }, merge: true }]);
        assert.equal(s.bg, 'rgb(234, 246, 255)', 'ice page'); assert.match(s.bgImg, /svg/, 'the wave band');
        assert.equal(s.foot, 'fixed', 'version in the bottom-left corner');
        const foot = await page.evaluate(() => { const b = document.getElementById('intern-footer-line').getBoundingClientRect(); return { l: b.left, b: innerHeight - b.bottom, txt: document.getElementById('intern-version-current').textContent }; });
        assert(foot.l < 20 && foot.b < 20, 'bottom-left: ' + JSON.stringify(foot)); assert.match(foot.txt, /^V\d+\.\d+$/);
        const chip = await page.evaluate(() => getComputedStyle(document.getElementById('u-crew-rank')).backgroundColor);
        assert.equal(chip, 'rgb(3, 83, 164)', 'navy LV chip');
        // keyboard works too
        await page.locator('#u-crew-rank').focus(); await page.keyboard.press('Enter');
        s = await state(page);
        assert.equal(s.wave, false); assert.equal(s.store, ''); assert.deepEqual(s.writes.at(-1), { p: 'users/U1', v: { theme: 'classic' }, merge: true });

        // the saved choice from another device turns it on; dropping under LV.4 turns it off by itself (the field is kept)
        await page.evaluate(() => { window.myUserDoc.theme = 'wave'; lvWaveSync(); });
        assert.equal((await state(page)).wave, true, 'users.theme = wave → on');
        await setScore(page, 28);
        s = await state(page);
        assert.equal(s.wave, false, 'LV.3 again → off'); assert.equal(s.cls, 'lv-wave-lock');
        assert.equal(await page.evaluate(() => window.myUserDoc.theme), 'wave', 'the choice is kept for when LV.4 comes back');
        await setScore(page, 41);
        assert.equal((await state(page)).wave, true, 'back at LV.4 → on again');

        // with Christmas: ice page, not pine; snow layer still there
        await page.evaluate(() => { applySeasonTheme('xm'); if (window.xmSnowStart) try { xmSnowStart(); } catch (e) { /* none */ } });
        s = await state(page);
        assert.equal(s.bg, 'rgb(234, 246, 255)', 'wave + Christmas = ice page'); assert.doesNotMatch(s.bgImg, /linear-gradient/, 'no pine gradient');
        await page.evaluate(() => { document.documentElement.classList.remove('wave'); });
        assert.notEqual((await state(page)).bg, 'rgb(234, 246, 255)', 'Christmas alone keeps its pine');

        // an admin preview never writes
        await page.evaluate(() => { isPreview = true; window.__writes.length = 0; lvWaveSync(); });
        await page.locator('#u-crew-rank').click();
        assert.equal((await state(page)).writes.length, 0, 'preview: no write');
        assert.deepEqual(errors.filter(e => !/firebase|liff/i.test(e)), [], 'no page errors');
        await ctx.close();

        // this device's last state is on before any script after <head> runs
        ({ ctx, atLoad: s } = await open(browser, { cached: true }));
        assert.equal(s, true, 'html.wave at load from intern_wave');
        await ctx.close();
        console.log('PASS: LV wave theme — 🔒 below LV.4, LV chip toggles html.wave (users.theme + device), ice page + Christmas blend, version bottom-left, preview never writes');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
