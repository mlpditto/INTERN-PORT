// V101.328: 🥣 Cereal Killer tutorial (cereal-tutorial.js) on the REAL public/index.html, touch phone, file://, network blocked, Firebase
// stubbed. Layer 1, How to play: opens by itself the first time the 🥣 sheet opens, 8 scenes Thai first with an English line, the demo
// board animates (CSS only), ถัดไป walks all 8 to the ▸ เริ่มเกม card, ข้าม closes, the flag keeps it closed on the next open, ? in the
// lobby replays it, ▶ auto advances by itself and is remembered, reduced motion = still cards. Layer 2, coach marks: on the first real
// turns one hint at a time follows the step (home → path → chips → lock · cafe → move → ask → arrest), each once, ring over the real
// element, the game stays tappable, ข้ามคำใบ้ stops them for good. 320 px: no horizontal scroll. Writes nothing but localStorage.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n'), js = fs.readFileSync('public/cereal-tutorial.js', 'utf8'), game = fs.readFileSync('public/cereal.js', 'utf8');

// ---- static ----
assert.ok(/<script src="cereal\.js\?v=V[\d.]+" defer><\/script>\n<script src="cereal-tutorial\.js\?v=V[\d.]+" defer><\/script>/.test(idx), 'tutorial loads right after cereal.js');
assert.ok(!/db\.collection|firebase\.|fetch\(|httpsCallable/.test(js), 'the tutorial reads and writes nothing in Firestore');
for (let i = 1; i <= 8; i++) assert.ok(js.includes("'" + i + " / 8 · "), 'scene ' + i + ' present');
assert.ok(/root\.className = 'lang-no-toggle'/.test(js) && /croot\.className = 'lang-no-toggle'/.test(js), 'Thai is not hidden by lang-toggle');
assert.ok(!/✓|✅/.test(js), 'no check marks');
assert.ok(/CKTour\.coach\([^)]*coachKey\(\)\)/.test(game) && game.includes('CKTour.open()'), 'cereal.js calls the tutorial');

async function open(browser, { width = 390, reducedMotion = 'no-preference', storage = {} } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok', reducedMotion });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.dismiss());
    await page.addInitScript((storage) => {
        if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); localStorage.setItem('internGuideSeen', '1'); localStorage.setItem('journalTourSeen', '1'); for (const k in storage) localStorage.setItem(k, storage[k]); }
        window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0, increment: n => n } }) };
    }, storage);
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
        window.__writes = [];
        db.collection = name => ({ add: () => { window.__writes.push(name); return Promise.resolve({ id: 'x' }); }, doc: () => ({ update: () => { window.__writes.push(name); return Promise.resolve(); }, set: () => { window.__writes.push(name); return Promise.resolve(); }, get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }) });
        ensureFirebaseAuthReady = async () => ({ uid: 'auth-u1' }); requireRegistered = () => true;
        tryDailyCheckin = () => {}; renderDailyCheckinCard = () => {}; awardEngagementBonusIfDue = () => {};
        userId = 'u1'; userProfile = { displayName: 'Intern A', pictureUrl: '' };
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    });
    return { ctx, page, errors };
}
const txt = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);
const tour = page => page.evaluate(() => {
    const t = document.getElementById('cerealTour'); if (!t) return { open: false };
    const cell = t.querySelector('.ct-cell.w') || t.querySelector('.ct-cell');
    return { open: true, step: t.querySelector('.ct-pill').innerText.trim(), title: t.querySelector('.ct-tip .t').innerText, en: t.querySelector('.ct-tip .en').innerText, cells: t.querySelectorAll('.ct-cell').length,
        anim: getComputedStyle(cell).animationName, auto: (t.querySelector('.auto') || {}).getAttribute ? t.querySelector('.auto').getAttribute('aria-pressed') : null,
        next: (t.querySelector('.next') || {}).innerText, skip: !!t.querySelector('.skip'), fits: t.scrollWidth <= t.clientWidth + 1, finger: !!t.querySelector('.ct-fing') && getComputedStyle(t.querySelector('.ct-fing')).display !== 'none' };
});
const coach = page => page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 320));   // the ring glides to a new target over .25 s; measure after it lands
    const c = document.getElementById('cerealCoach'); if (!c || c.style.display === 'none') return { key: null };
    const ring = c.querySelector('.ct-ring').getBoundingClientRect(), key = c.getAttribute('data-key');
    const sel = { home: '#cerealModal .ck-board', path: '#cerealModal .ck-board', chips: '#ck-kill, #ck-wit', lock: '#ck-lock', cafe: '#cerealModal .ck-board', move: '#cerealModal .ck-board', ask: '#ck-ask', arrest: '#ck-arrest, #ck-end' }[key];
    const rs = [...document.querySelectorAll(sel)].map(e => e.getBoundingClientRect());
    const r = { left: Math.min(...rs.map(b => b.left)), top: Math.min(...rs.map(b => b.top)), right: Math.max(...rs.map(b => b.right)), bottom: Math.max(...rs.map(b => b.bottom)) }, tip = c.querySelector('.ct-tip').getBoundingClientRect();
    return { key, title: c.querySelector('.t').innerText, ringHasTarget: ring.left <= r.left + 1 && ring.right >= r.right - 1 && ring.top <= r.top + 1 && ring.bottom >= r.bottom - 1,
        tipOnScreen: tip.top >= 0 && tip.bottom <= innerHeight, tipOverTarget: !(tip.bottom <= r.top + 2 || tip.top >= r.bottom - 2), pe: getComputedStyle(c).pointerEvents };
});
const cell = id => `#cerealModal .ck-cell[data-id="${id}"]`;
const thai = /[฀-๿]/;

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        // ---- layer 1: How to play ----
        let { page, errors } = await open(browser);
        await page.evaluate(() => cerealOpen());
        let t = await tour(page);
        assert.ok(t.open, 'opens by itself on the first 🥣');
        assert.equal(t.step, '1 / 8'); assert.ok(thai.test(t.title) && !thai.test(t.en), 'Thai title, English line'); assert.equal(t.cells, 20);
        assert.equal(await page.evaluate(() => localStorage.getItem('cerealTourSeen')), '1', 'seen flag set on open');
        assert.ok(await page.evaluate(() => +getComputedStyle(document.getElementById('cerealTour')).zIndex > +getComputedStyle(document.getElementById('cerealModal')).zIndex), 'above the game sheet');
        await page.click('#cerealTour .next');
        t = await tour(page);
        assert.equal(t.step, '2 / 8'); assert.notEqual(t.anim, 'none', 'the killer walks (CSS animation on the path cells)'); assert.ok(t.finger, '👆 on the walking scenes');
        for (let i = 3; i <= 8; i++) { await page.click('#cerealTour .next'); assert.equal((await tour(page)).step, i + ' / 8', 'scene ' + i); }
        await page.click('#cerealTour .next');
        t = await tour(page);
        assert.equal(t.step, '🏁'); assert.ok(t.next.includes('เริ่มเกม') && !t.skip, 'the last card starts the game');
        await page.click('#cerealTour .next');
        assert.ok(!(await tour(page)).open, '▸ เริ่มเกม closes the tour');
        assert.ok(await page.isVisible('#ck-start'), 'the lobby was underneath all along');

        // closed + reopened: no tour; ? replays it; ข้าม closes; Escape closes
        await page.click('#cerealModal .ck-x'); await page.evaluate(() => cerealOpen());
        assert.ok(!(await tour(page)).open, 'seen → stays closed');
        await page.click('#cerealModal .ck-top .ck-pill');   // the ? chip
        assert.ok((await tour(page)).open && (await tour(page)).step === '1 / 8', '? replays from scene 1');
        await page.click('#cerealTour .skip'); assert.ok(!(await tour(page)).open, 'ข้าม closes');
        await page.click('#cerealModal .ck-top .ck-pill'); await page.keyboard.press('Escape'); assert.ok(!(await tour(page)).open, 'Esc closes');

        // ▶ auto: advances by itself, remembered, off again
        await page.evaluate(() => CKTour._interval(250));
        await page.click('#cerealModal .ck-top .ck-pill');
        assert.equal((await tour(page)).auto, 'false');
        await page.click('#cerealTour .auto');
        assert.equal((await tour(page)).auto, 'true'); assert.equal(await page.evaluate(() => localStorage.getItem('cerealTourAuto')), '1', 'auto is remembered');
        await page.waitForTimeout(700);
        assert.ok(['2 / 8', '3 / 8'].includes((await tour(page)).step), 'auto advanced: ' + (await tour(page)).step);
        await page.evaluate(() => document.querySelector('#cerealTour .auto').click());   // DOM click: at a 250 ms test interval the card re-renders faster than Playwright's stability wait
        assert.equal((await tour(page)).auto, 'false');
        const held = (await tour(page)).step; await page.waitForTimeout(600);
        assert.equal((await tour(page)).step, held, 'auto off holds the scene');
        await page.click('#cerealTour .skip');
        assert.deepEqual(await page.evaluate(() => window.__writes), []); assert.deepEqual(errors, []);

        // ---- layer 2: coach marks on the real first turns ----
        await page.fill('#ck-n1', 'Pond'); await page.fill('#ck-n2', 'Mint'); await page.click('#ck-start');
        assert.equal((await coach(page)).key, null, 'nothing on the hand-off screen');
        await page.click('#ck-hand-go');
        let c = await coach(page);
        assert.equal(c.key, 'home'); assert.ok(thai.test(c.title) && c.ringHasTarget && c.tipOnScreen && !c.tipOverTarget && c.pe === 'none', 'home hint rings the board, card off the board, board tappable: ' + JSON.stringify(c));
        await page.click(cell(8)); assert.equal((await coach(page)).key, 'path', 'home picked → path hint');
        for (const id of [3, 2, 1]) await page.click(cell(id));
        c = await coach(page); assert.equal(c.key, 'chips'); assert.ok(c.ringHasTarget, 'chips hint rings the kill row');
        await page.click('#ck-kill .ck-chip:has-text("🏠 3")'); assert.equal((await coach(page)).key, 'chips', 'still chips until the lock is enabled');
        c = await coach(page); assert.ok(c.ringHasTarget && !c.tipOverTarget, 'the witness row that just appeared is inside the ring, not under the card: ' + JSON.stringify(c));
        await page.click('#ck-wit .ck-chip:has-text("🌳 4")'); c = await coach(page); assert.equal(c.key, 'lock'); assert.ok(c.ringHasTarget);
        await page.click('#cerealCoach .next');   // เข้าใจแล้ว
        assert.equal((await coach(page)).key, null, 'dismissed');
        assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('cerealCoachSeen'))), { home: 1, path: 1, chips: 1, lock: 1 });
        await page.click('#ck-lock'); assert.equal((await coach(page)).key, null, 'hand-off: no coach');
        await page.click('#ck-hand-go'); assert.equal((await coach(page)).key, 'cafe');
        await page.click(cell(7)); assert.equal((await coach(page)).key, 'move');
        await page.click(cell(8)); await page.click(cell(9)); c = await coach(page); assert.equal(c.key, 'ask'); assert.ok(c.ringHasTarget, 'ask hint rings the card rail');
        await page.click('#ck-ask [data-q="building"]'); c = await coach(page); assert.equal(c.key, 'arrest'); assert.ok(c.ringHasTarget && !c.tipOverTarget, 'arrest hint rings 🛡️ and ▸ End turn, card off both');
        await page.click('#cerealCoach .skip');   // ข้ามคำใบ้
        assert.equal((await coach(page)).key, null); assert.equal(await page.evaluate(() => localStorage.getItem('cerealCoachSeen')), 'all', 'skip all');
        await page.click('#ck-end'); await page.click('#ck-hand-go');
        assert.equal((await coach(page)).key, null, 'no more hints after skip-all');
        assert.deepEqual(errors, [], 'no page errors');

        // a second device that saw everything: nothing opens; reduced motion: still cards, no finger, no animation
        const r = await open(browser, { reducedMotion: 'reduce', storage: { cerealCoachSeen: 'all' } });
        await r.page.evaluate(() => cerealOpen());
        t = await tour(r.page); assert.ok(t.open, 'fresh device still gets the tour');
        await r.page.click('#cerealTour .next'); t = await tour(r.page);
        assert.equal(t.anim, 'none', 'reduced motion: no animation'); assert.ok(!t.finger, 'no finger'); assert.ok(thai.test(t.title), 'still a readable card');
        await r.page.click('#cerealTour .skip');
        await r.page.click('#ck-start'); await r.page.click('#ck-hand-go');
        assert.equal((await coach(r.page)).key, null, 'coachSeen=all → no hints');
        assert.deepEqual(r.errors, []);

        // 320 px
        const n = await open(browser, { width: 320 });
        await n.page.evaluate(() => cerealOpen());
        t = await tour(n.page); assert.ok(t.open && t.fits, '320: no horizontal scroll');
        for (let i = 0; i < 5; i++) { await n.page.click('#cerealTour .next'); assert.ok((await tour(n.page)).fits, '320 scene fits'); }
        assert.deepEqual(n.errors, []);
        console.log('cereal-tutorial-qa: OK — auto-open once, 8 Thai-first scenes with animation, ▸ start / ข้าม / Esc / ? replay, ▶ auto remembered, 8 coach marks follow the real turn and ring the real element, skip-all, reduced motion, 320 px');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
