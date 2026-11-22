// V101.333: 🥣 Cereal Killer — owner picks from mockup-cereal-ux/ (2026-11-22) on the REAL public/index.html, touch phone, file://,
// network blocked, Firebase stubbed. 1A: on a day where no victim loses the game (calendar minimum, or as many kills owed as days
// left) one short amber line sits above 🔒 until a victim is picked; never on day 1. 2A+D: the reveal opens on ทั้งหมด with every
// day's route drawn on the board in its own colour, ✗ on each missed arrest, and 🔎 ทบทวนคดี lists every card and arrest with where the
// killer really was and how many cells off a miss was; D1/D2… show one route. Sound: 12 Web Audio cues from cereal-sound.js, on at
// first, 🔊/🔇 in the header remembered on the phone; the right cue fires on each moment (read from CKSound.log). 390 + 320 px.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

async function open(browser, width) {
    const ctx = await browser.newContext({ viewport: { width, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.dismiss());
    await page.addInitScript(() => {
        if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); localStorage.setItem('internGuideSeen', '1'); localStorage.setItem('journalTourSeen', '1'); localStorage.setItem('cerealTourSeen', '1'); localStorage.setItem('cerealCoachSeen', 'all'); }
        window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0, increment: n => n } }) };
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
        ensureFirebaseAuthReady = async () => ({ uid: 'auth-u1' }); requireRegistered = () => true;
        tryDailyCheckin = () => {}; renderDailyCheckinCard = () => {}; awardEngagementBonusIfDue = () => {};
        userId = 'u1'; userProfile = { displayName: 'Intern A', pictureUrl: '' };
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    });
    return { page, errors };
}
const cell = id => `#cerealModal .ck-cell[data-id="${id}"]`;
const txt = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);
const sounds = page => page.evaluate(() => CKSound.log.splice(0));
const warn = page => page.$('#ck-warn');
const tap = async (page, ...ids) => { for (const id of ids) await page.click(cell(id)); };

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { page, errors } = await open(browser, 390);
        await page.evaluate(() => cerealOpen());
        assert.equal(await page.evaluate(() => CKSound.on()), true, 'sound is on at first');
        assert.equal(await page.textContent('#ck-snd'), '🔊');
        assert.equal(await page.evaluate(() => CKSound.KEYS.length), 12, 'twelve cues');
        await page.click('#ck-start'); await page.click('#ck-hand-go');
        assert.deepEqual(await sounds(page), ['heartbeat'], 'killer turn opens with the heartbeat');
        // day 1: the quiet day — never a warning on day 1
        await tap(page, 8, 3, 2, 1);
        assert.equal(await warn(page), null, 'no warning on day 1');
        await page.click('#ck-kill .ck-chip:has-text("⏭")'); await page.click('#ck-lock');
        assert.deepEqual(await sounds(page), ['step', 'step', 'step', 'step', 'whoosh'], 'steps, no crunch for a quiet day, the hand-off whoosh');
        await page.click('#ck-hand-go'); await tap(page, 7, 8, 9); await page.click('#ck-end');
        assert.deepEqual(await sounds(page), ['tick', 'stepD', 'stepD', 'stepD', 'whoosh']);
        // day 2: 0 victims and D2 needs ≥ 1 → the line is there from the first tap until a victim is picked
        await page.click('#ck-hand-go'); await sounds(page);
        assert.ok((await txt(page, '#ck-warn')).includes('วันนี้ต้องมีเหยื่อ'), 'day 2 warning above the lock');
        const order = await page.evaluate(() => { const w = document.getElementById('ck-warn'), l = document.getElementById('ck-lock'); return !!(w.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING); });
        assert.ok(order, 'the warning sits right above 🔒');
        await tap(page, 6, 11, 12);
        assert.ok(await warn(page), 'still there with the path full and no victim');
        await page.click('#ck-kill .ck-chip:has-text("🏠 11")');
        assert.equal(await warn(page), null, 'gone once a victim is picked');
        await page.click('#ck-lock');
        assert.deepEqual(await sounds(page), ['step', 'step', 'step', 'crunch', 'whoosh'], '🥣 crunch (no park by 11 → no gasp)');
        // detective day 2: miss at 14
        await page.click('#ck-hand-go'); await tap(page, 14, 13);
        await page.click('#ck-arrest'); await page.click(cell(14)); await page.click('#ck-confirm .yes');
        assert.deepEqual((await sounds(page)).slice(-2), ['buzz', 'whoosh'], 'a wrong arrest buzzes');
        // day 3: 1 victim, 5 owed in 5 days → must kill every day now
        await page.click('#ck-hand-go');
        assert.ok(await warn(page), 'day 3: 5 victims owed in 5 days → warning');
        await tap(page, 11, 6, 1);
        await page.click('#ck-kill .ck-chip >> text="🏠 1"'); await page.click('#ck-wit .ck-chip:has-text("🌳 2")');
        await sounds(page); await page.click('#ck-lock');
        assert.deepEqual(await sounds(page), ['crunch', 'gasp', 'whoosh'], 'victim + witness');
        // detective day 3: walk onto the witness, ask, catch at 1
        await page.click('#ck-hand-go'); await tap(page, 8, 3, 2);
        await page.click('#ck-ask [data-q="building"]');
        await page.click('#ck-arrest'); await page.click(cell(1)); await page.click('#ck-confirm .yes');
        assert.deepEqual((await sounds(page)).slice(-2), ['ding', 'siren'], 'answer ding, the caught siren');
        // reveal: ทั้งหมด, three coloured routes, ✗ at 14, the review
        if (process.env.QA_SHOTS) await page.screenshot({ path: process.env.QA_SHOTS + '/ux-reveal-390.png', fullPage: true });
        const rail = await page.evaluate(() => [...document.querySelectorAll('#cerealModal .ck-days button')].map(b => (b.classList.contains('on') ? '*' : '') + b.textContent));
        assert.equal(rail[0], '*ทั้งหมด', 'opens on every day');
        let routes = await page.evaluate(() => [...document.querySelectorAll('#cerealModal .ck-routes polyline')].map(p => ({ d: p.dataset.day, c: p.getAttribute('stroke'), n: p.getAttribute('points').split(' ').length })));
        assert.deepEqual(routes.map(r => r.d), ['1', '2', '3']); assert.equal(new Set(routes.map(r => r.c)).size, 3, 'a colour per day'); assert.ok(routes.every(r => r.n === 4), 'each route = 4 cells');
        assert.ok((await page.getAttribute(cell(14), 'class')).includes('miss'), '✗ where the arrest missed');
        const review = await txt(page, '#cerealModal .ck-review');
        assert.ok(review.includes('🛡️ จับ 14 ✗') && review.includes('ฆาตกรอยู่ 12') && /ห่าง \d+ ช่อง/.test(review) && review.includes('🛡️ จับ 1 ✔') && review.includes('อาคาร → ใช่'), 'review: ' + review);
        await page.click('#cerealModal .ck-days button:has-text("D2")');
        routes = await page.evaluate(() => [...document.querySelectorAll('#cerealModal .ck-routes polyline')].map(p => p.dataset.day));
        assert.deepEqual(routes, ['2'], 'D2 alone'); assert.ok((await page.getAttribute(cell(14), 'class')).includes('miss'), 'the D2 miss shows on D2');
        // the board and its overlay line up: route points sit inside their cells
        const fit = await page.evaluate(() => { const svg = document.querySelector('#cerealModal .ck-routes').getBoundingClientRect(), b = document.querySelector('#cerealModal .ck-board').getBoundingClientRect(); return Math.abs(svg.width - b.width) < 1 && Math.abs(svg.height - b.height) < 1; });
        assert.ok(fit, 'the route layer covers the board exactly');
        // 🔇 silences and is remembered
        await page.click('#ck-snd');
        assert.equal(await page.textContent('#ck-snd'), '🔇'); assert.equal(await page.evaluate(() => localStorage.getItem('cerealSound')), 'off');
        await page.evaluate(() => CKSound.play('ding')); assert.deepEqual(await sounds(page), [], 'muted = silent');
        assert.deepEqual(errors, []);

        // 320 px: the header with 🔊 still fits on the busiest screen (killer: 3 pills + 🔊 + ✕)
        const n = await open(browser, 320);
        await n.page.evaluate(() => cerealOpen()); await n.page.click('#ck-start'); await n.page.click('#ck-hand-go');
        const top = await n.page.evaluate(() => { const t = document.querySelector('#cerealModal .ck-top'), m = document.querySelector('#cerealModal .modal-content').getBoundingClientRect(), x = document.querySelector('#cerealModal .ck-x').getBoundingClientRect(); return { fits: t.scrollWidth <= t.clientWidth + 1, x: x.right <= m.right + 0.5, sw: t.scrollWidth, cw: t.clientWidth, kids: [...t.children].map(e => Math.round(e.getBoundingClientRect().width)) }; });
        assert.ok(top.fits && top.x, '320: killer header fits with 🔊 ' + JSON.stringify(top));
        assert.deepEqual(n.errors, []);
        // owner "พิจารณาเพิ่มขนาด map": a PC / tablet window gets a 560 px game, phones keep the full-width board
        const pc = await open(browser, 1280);
        await pc.page.evaluate(() => cerealOpen()); await pc.page.click('#ck-start'); await pc.page.click('#ck-hand-go');
        if (process.env.QA_SHOTS) await pc.page.screenshot({ path: process.env.QA_SHOTS + '/ux-pc-1280.png' });
        const sz = await pc.page.evaluate(() => ({ modal: document.querySelector('#cerealModal .modal-content').getBoundingClientRect().width, board: document.querySelector('#cerealModal .ck-board').getBoundingClientRect().width, cell: document.querySelector('#cerealModal .ck-cell').getBoundingClientRect().width }));
        assert.ok(sz.modal === 560 && sz.board >= 500 && sz.cell >= 95, 'PC: 560 px game, bigger board ' + JSON.stringify(sz));
        const ph = await open(browser, 390);
        await ph.page.evaluate(() => cerealOpen());
        assert.ok((await ph.page.evaluate(() => document.querySelector('#cerealModal .modal-content').getBoundingClientRect().width)) <= 390, 'phone unchanged');
        console.log('cereal-ux-qa: OK — 1A quota line above 🔒 (day 2 calendar, day 3 owed = days left, gone on a pick, never day 1), 2A+D reveal ทั้งหมด with a coloured route per day + ✗ misses + 🔎 ทบทวนคดี, 12 sounds on the right moments, 🔇 remembered, 320 px header, 560 px game on a PC');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
