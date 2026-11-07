// V101.278 a different profile card for every LV (owner pick, mockup-lv-card-10-levels.html): edge colour + wash + corner emblem + LV text colour,
// the next LV in the chip tooltip, and a LEVEL UP popup (same modal as badges / Event Stamps) that CONTINUE acknowledges — users.lvSeen + this
// device; the first run records the current LV silently; an admin preview never writes. The REAL index.html (OUTDIR=… saves the 10 cards).
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href;
const EMB = ['🧭', '🎯', '🍳', '🩺', '🏺', '🔨', '🎵', '⚓', '⭐', '👑'];

async function open(browser, w) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 700, hasTouch: w < 700 });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        window.__writes = [];
        const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
        const doc = p => ({ get: async () => ({ exists: false, data: () => null }), onSnapshot: () => () => {}, set: async () => {}, update: async v => { window.__writes.push({ p, v: JSON.parse(JSON.stringify(v)) }); }, collection: q });
        const q = n => ({ where: () => q(n), orderBy: () => q(n), limit: () => q(n), get: async () => ({ docs: [], size: 0, empty: true, forEach() {} }), onSnapshot: () => () => {}, doc: id => doc(n + '/' + id) });
        const db = { collection: q, batch: () => ({ set() {}, update() {}, commit: async () => {} }), runTransaction: async () => {}, enablePersistence: async () => {}, settings() {} };
        window.firebase = new Proxy(function () {}, { get: (t, k) => { if (k === 'firestore') { const f = () => db; f.FieldValue = any; f.Timestamp = any; return f; } return k === 'then' ? undefined : any; }, apply: () => any });
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        isPreview = false; userId = 'U1'; window.myUserDoc = { id: 'U1' };
    });
    return { ctx, page, errors };
}
const setScore = (page, s) => page.evaluate(s => { myScore = s; updateGrandLineDashboard(); }, s);
const card = page => page.evaluate(() => { const c = document.getElementById('section-profile-combined'), r = document.getElementById('u-crew-rank'), cs = getComputedStyle(c);
    return { cls: [...c.classList].filter(x => /^lv/.test(x)).join(' '), edge: cs.borderLeftColor, emb: getComputedStyle(c, '::after').content, chip: getComputedStyle(r).color, title: r.title, text: r.textContent }; });

(async () => {
    const browser = await chromium.launch();
    try {
        const { ctx, page, errors } = await open(browser, 1100);
        // first run: the current LV is recorded silently (no popup for a level reached long ago)
        await setScore(page, 30.48);
        let c = await card(page);
        assert.equal(c.cls, 'lv lv-4'); assert.equal(c.text, 'LV.4');
        assert.equal(c.title, 'LV.4 Experienced Doctor · 9.52 pts to LV.5 Senior Archaeologist · 🌊 tap: wave theme on', 'the next LV in the tooltip (+ V101.285 the 🌊 switch hint): ' + c.title);
        assert.notEqual(await page.evaluate(() => document.getElementById('achievementUnlockModal').style.display), 'flex', 'no popup on the first run');
        assert.deepEqual(await page.evaluate(() => window.__writes), [{ p: 'users/U1', v: { lvSeen: 4 } }], 'the current LV is recorded silently');
        // every LV looks different (edge colour, emblem, chip text colour)
        const looks = [];
        for (let lv = 1; lv <= 10; lv++) {
            await page.evaluate(() => { window.myUserDoc.lvSeen = 99; });   // no popups while drawing all 10
            await setScore(page, lv * 10 - 5);
            await page.waitForTimeout(450);   // the card animates its colours (CSS transition) — read after it settles
            c = await card(page); looks.push(c);
            assert.equal(c.cls, 'lv lv-' + lv); assert.equal(c.emb, '"' + EMB[lv - 1] + '"', 'emblem for LV.' + lv);
            if (process.env.OUTDIR) await (await page.$('#section-profile-combined')).screenshot({ path: process.env.OUTDIR + '/lv-' + lv + '.png' });
        }
        assert.equal(new Set(looks.map(l => l.chip)).size, 10, 'ten different LV text colours: ' + looks.map(l => l.chip).join(' | '));
        assert.equal(new Set(looks.slice(0, 9).map(l => l.edge)).size, 9, 'nine different edge colours (LV.10 is the rainbow rim)');
        assert.equal(looks[9].title, 'LV.10 Captain · 🌊 tap: wave theme on', 'max level: no "pts to"');
        // V101.283: the card does not clip — the flood 🏠 / 🏥 gauges straddle its edges (they were cut in half under overflow:hidden)
        const clip = await page.evaluate(() => { const c = document.getElementById('section-profile-combined'), g = document.createElement('span');
            g.className = 'fw-side'; g.style.cssText = 'left:-13px;bottom:0'; c.appendChild(g);
            const r = g.getBoundingClientRect(), hit = document.elementFromPoint(r.left + 3, r.top + 13); g.remove();
            return { overflow: getComputedStyle(c).overflow, visible: hit === g }; });
        assert.deepEqual(clip, { overflow: 'visible', visible: true }, 'the flood gauge outside the card edge shows: ' + JSON.stringify(clip));
        // a new LV after that → LEVEL UP once; CONTINUE acknowledges it
        await page.evaluate(() => { window.myUserDoc.lvSeen = 4; window.__writes = []; });
        await setScore(page, 41);
        const up = await page.evaluate(() => ({ shown: document.getElementById('achievementUnlockModal').style.display, kicker: document.getElementById('ach-unlock-kicker').textContent, title: document.getElementById('ach-unlock-title').textContent, emblem: document.querySelector('#ach-unlock-badge .lv-up') && document.querySelector('#ach-unlock-badge .lv-up').textContent }));
        assert.deepEqual(up, { shown: 'flex', kicker: '⬆️ LEVEL UP', title: 'LV.5 Senior Archaeologist', emblem: '🏺LV.5' });
        await setScore(page, 42);
        assert.equal(await page.evaluate(() => achUnlockQueue.length), 0, 'not queued twice');
        await page.click('#achievementUnlockModal button:has-text("CONTINUE")');
        assert.deepEqual(await page.evaluate(() => ({ shown: document.getElementById('achievementUnlockModal').style.display, w: window.__writes, local: localStorage.getItem('ip_lv_seen_v1') })), { shown: 'none', w: [{ p: 'users/U1', v: { lvSeen: 5 } }], local: '5' }, 'CONTINUE = acknowledged');
        await setScore(page, 43);
        assert.equal(await page.evaluate(() => document.getElementById('achievementUnlockModal').style.display), 'none', 'not shown again');
        await ctx.close();
        // admin preview: popups may show but nothing is written
        const p2 = await open(browser, 390);
        await p2.page.evaluate(() => { isPreview = true; window.myUserDoc = { id: 'U1', lvSeen: 2 }; });
        await setScore(p2.page, 35);
        await p2.page.click('#achievementUnlockModal button:has-text("CONTINUE")');
        assert.equal(await p2.page.evaluate(() => window.__writes.length), 0, 'an admin preview never writes');
        await p2.ctx.close();
        assert.deepEqual(errors.filter(e => /lv|level/i.test(e)), [], 'no errors');
        console.log('PASS: LV cards — 10 looks (edge, emblem, LV text colour), next LV in the tooltip, first run silent, LEVEL UP once with the new emblem, CONTINUE = users.lvSeen + device, preview never writes');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
