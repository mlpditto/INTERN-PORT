// V101.180: ⏱ Hours inside Schedule ▸ Goals (intern). The card shows only after a tap on Hours; not set → goal + time-clock name form,
// saved ONCE (then the admin changes it); set but not synced → "after tonight's sync"; no-match → fix the name only; ok → n / goal h + bar.
// The REAL public/index.html on a touch phone (file://, network blocked, Firebase stubbed; db.update captured, never sent).
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

const idx = fs.readFileSync('public/index.html', 'utf8');
for (const s of ['id="ip-hours-btn"', '<div id="ip-hours" class="lang-no-toggle" hidden>', 'function ipHoursToggle(', 'function ipHoursRender(', 'function ipHoursSave(']) assert.ok(idx.includes(s), s + ' exists');
assert.ok(idx.indexOf('id="ip-hours-btn"') < idx.indexOf('<div id="assigned-goals"'), 'Hours sits in the Goals pane, before the assigned goals');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => '__DELETE__' } }) };
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
        userId = 'U1';   // the page's own let, not window.userId
        window.myUserDoc = { id: 'U1', fullName: 'ภัทราพร  สุนทรินทร์', startDate: schDateKey(new Date(Date.now() - 2 * 864e5)), endDate: schDateKey(new Date(Date.now() + 38 * 864e5)) };
        window.__upd = [];
        const _col = db.collection.bind(db);
        db.collection = n => Object.assign(_col(n), { doc: id => ({ update: async u => { window.__upd.push({ id, u }); }, get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }) });
        if (window.assignedGoals) assignedGoals.userOpen = () => {};
        schEventsUnsub = () => {};   // events listener and check-in days are not under test
        schCheckinDays = new Set(); window.myCheckin = {}; window.myCasesCache = []; window.myReflectiveLogsCache = [];
        usersData = [Object.assign({}, myUserDoc)];
        openScheduleModal(); schToggleSection('goals');
    });
    await page.waitForTimeout(200);
    const st = () => page.evaluate(() => { const b = document.getElementById('ip-hours'); return { hidden: b.hidden, text: b.innerText.replace(/\s+/g, ' ').trim(), exp: document.getElementById('ip-hours-btn').getAttribute('aria-expanded') }; });

    // 1. closed until Hours is tapped
    let s = await st();
    assert.equal(s.hidden, true, 'card hidden until Hours is tapped'); assert.equal(s.exp, 'false');
    const btnBox = await page.locator('#ip-hours-btn').boundingBox();
    assert.ok(btnBox && btnBox.height >= 44, 'Hours button is a 44 px touch target');
    await page.click('#ip-hours-btn');
    s = await st();
    assert.equal(s.hidden, false); assert.equal(s.exp, 'true');

    // 2. not set → form, name prefilled from fullName (spaces collapsed on save)
    assert.ok(/Hours your school requires/.test(s.text) && /Set once/.test(s.text), 'set-up form: ' + s.text);
    assert.equal(await page.inputValue('#ip-h-name'), 'ภัทราพร  สุนทรินทร์', 'name prefilled from fullName');
    await page.click('#ip-hours .ip-h-save');
    s = await st();
    assert.ok(/Enter the hours/.test(s.text), 'empty goal is refused inline');
    assert.equal(await page.evaluate(() => __upd.length), 0, 'nothing written on a bad goal');
    await page.fill('#ip-h-goal', '200');
    await page.click('#ip-hours .ip-h-save');
    await page.waitForTimeout(100);
    let upd = await page.evaluate(() => __upd);
    assert.equal(upd.length, 1); assert.equal(upd[0].id, 'U1');
    assert.deepEqual(upd[0].u, { internHoursTarget: 200, timeName: '__DELETE__' }, 'goal saved; timeName equal to fullName is not stored');
    s = await st();
    assert.ok(/goal 200 h/.test(s.text) && /tonight's sync/.test(s.text) && /Saved/.test(s.text), 'waiting state: ' + s.text);

    // 3. set once — a second save of the goal is ignored
    await page.evaluate(() => { window._ipHoursWaiting = false; myUserDoc.internHoursTarget = 200; ipHoursSave(false); });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => __upd.length), 1, 'goal cannot be saved twice from the intern side');

    // 4. no-match → only the name, saved as timeName
    await page.evaluate(() => { myUserDoc.internHours = { status: 'no-match' }; ipHoursRender(); });
    s = await st();
    assert.ok(/Name not found/.test(s.text) && !(await page.$('#ip-h-goal')), 'no-match shows the name field only: ' + s.text);
    await page.fill('#ip-h-name', 'Pattarada  S.');
    await page.click('#ip-hours .ip-h-save');
    await page.waitForTimeout(100);
    upd = await page.evaluate(() => __upd);
    assert.deepEqual(upd[1].u, { timeName: 'Pattarada S.' }, 'name fix writes timeName only');

    // 5. ok → numbers + bar; green once the goal is reached
    await page.evaluate(() => { window._ipHoursWaiting = false; myUserDoc.internHours = { status: 'ok', total: 16, days: 2 }; ipHoursRender(); });
    s = await st();
    assert.ok(/16 \/ 200 h · 2 days/.test(s.text), 'ok numbers: ' + s.text);
    assert.equal(await page.evaluate(() => document.querySelector('#ip-hours .ip-h-bar i').style.width), '8%');
    if (process.env.SHOT) await page.screenshot({ path: 'output/intern-hours-goal.png' });
    await page.evaluate(() => { myUserDoc.internHours = { status: 'ok', total: 216, days: 27 }; ipHoursRender(); });
    assert.ok(await page.$('#ip-hours .ip-h-card.ok'), 'goal reached → green card');

    // 6. tap again closes; no sideways scroll
    await page.click('#ip-hours-btn');
    s = await st();
    assert.equal(s.hidden, true); assert.equal(s.exp, 'false');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');

    assert.deepEqual(errors, [], 'no page errors');
    await browser.close();
    console.log('intern-hours-goal-qa: PASS');
})().catch(e => { console.error(e); process.exit(1); });
