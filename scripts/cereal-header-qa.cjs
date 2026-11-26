// V101.334: 🥣 doorway (owner 2026-11-22: "ย้าย Cereal Killer มาอยู่ข้างซ้าย Schedule ใน PC") on the REAL public/index.html, file://,
// network blocked, Firebase stubbed. PC-wide window (1280): a 28 px 🥣 circle sits in the header rail directly left of 📅 Schedule on
// the same row, opens the game, and the 🥣 beside 💰 inside Schedule is gone (moved, not copied). Phone (390): no header 🥣; the one in
// the Schedule goals row is still there.
const path = require('node:path'), assert = require('node:assert/strict'), fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(idx.indexOf('id="u-cereal-chip"') > 0 && idx.indexOf('id="u-cereal-chip"') < idx.indexOf('id="u-schedule-chip"'), 'the header 🥣 is written right before 📅');

async function open(browser, width, mobile) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, timezoneId: 'Asia/Bangkok' });
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
const disp = (page, sel) => page.evaluate(s => getComputedStyle(document.querySelector(s)).display, sel);

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const pc = await open(browser, 1280, false);
        // V101.378 (owner pick A, mockup-pc-games-chip/): the games are one 🎮 circle left of 📅; 🥣 is the first row of its menu
        assert.equal(await disp(pc.page, '#u-games-chip'), 'flex', 'PC: the header 🎮 shows');
        assert.equal(await pc.page.isVisible('#u-cereal-chip'), false, 'the menu starts closed');
        const r = await pc.page.evaluate(() => { const a = document.getElementById('u-games-chip').getBoundingClientRect(), b = document.getElementById('u-schedule-chip').getBoundingClientRect(); return { aw: a.width, ah: a.height, ar: a.right, bl: b.left, ay: Math.round(a.top + a.height / 2), by: Math.round(b.top + b.height / 2), sbw: b.width }; });
        assert.ok(r.aw === r.sbw && r.ah === r.aw, 'same circle as 📅: ' + JSON.stringify(r));
        assert.ok(r.ar <= r.bl && r.bl - r.ar < 16 && Math.abs(r.ay - r.by) <= 1, 'directly left of 📅 on the same row: ' + JSON.stringify(r));
        assert.equal(await disp(pc.page, '#sch-cereal-btn'), 'none', 'PC: gone from the Schedule goals row (moved, not copied)');
        await pc.page.click('#u-games-chip');
        assert.deepEqual(await pc.page.$$eval('#u-games-menu .btn-sm', (b) => b.map((x) => x.textContent.replace(/\s+/g, ''))), ['🥣Cerealนักสืบ2คน', '🐺หมาป่ากับบอท', '🧊นับไวนับรูป', '⚫ไพ่เงาดวลเลข', '🔢เลขลับทายเลข'], 'the menu: 🥣 🐺 🧊 ⚫ 🔢 with names');
        assert.equal(await pc.page.getAttribute('#u-games-chip', 'aria-expanded'), 'true');
        await pc.page.keyboard.press('Escape'); assert.equal(await pc.page.isVisible('#u-games-menu'), false, 'Esc closes it');
        await pc.page.click('#u-games-chip'); await pc.page.mouse.click(5, 700); assert.equal(await pc.page.isVisible('#u-games-menu'), false, 'a tap outside closes it');
        await pc.page.click('#u-games-chip');
        await pc.page.click('#u-cereal-chip');
        assert.equal(await pc.page.isVisible('#u-games-menu'), false, 'picking a game closes the menu');
        assert.equal(await disp(pc.page, '#cerealModal'), 'flex', 'opens the game');
        assert.deepEqual(pc.errors, []);
        const ph = await open(browser, 390, true);
        assert.equal(await disp(ph.page, '#u-games-wrap'), 'none', 'phone: no header 🎮 (and no 🥣)');
        assert.notEqual(await disp(ph.page, '#sch-cereal-btn'), 'none', 'phone: 🥣 shown (V101.368: in the games row under History)');
        assert.deepEqual(ph.errors, []);
        console.log('cereal-header-qa: OK — PC: 🎮 circle left of 📅, its menu 🥣 🐺 🧊 ⚫ 🔢 (Esc / outside / a pick close it), 🥣 opens the game, gone from Schedule; phone: in the games row under History');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
