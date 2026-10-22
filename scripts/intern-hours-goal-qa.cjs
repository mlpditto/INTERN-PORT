// V101.180 → V101.192: ⏱ Training hours live in Personal Info ▸ 📅 Period (intern). Card head: a second bar under the time bar — grey "not set"
// (no bar) → "goal n h · after tonight's sync" → amber warning (no bar) → "n / goal h (p%)" blue, green once the goal is met. Card body: the
// goal + time-clock name form (saved ONCE; then the admin changes it) / "after tonight's sync" / fix-the-name / one grey line with days + synced.
// 🌱 Lifelong accounts show nothing. The Hours button is gone from Schedule ▸ Goals.
// The REAL public/index.html on a touch phone (file://, network blocked, Firebase stubbed; db.update captured, never sent).
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

const idx = fs.readFileSync('public/index.html', 'utf8');
for (const s of ['id="pi-hours-row"', 'id="pi-hours-fill"', 'id="pi-hours-label"', '<div id="pi-hours-body" class="lang-no-toggle"></div>', 'function ipHoursRender(msg, doc)', 'function ipHoursSave(', "ipHoursRender('', d);"]) assert.ok(idx.includes(s), s + ' exists');
for (const s of ['ip-hours-btn', 'ipHoursToggle', 'id="ip-hours"', '#ip-hours ']) assert.ok(!idx.includes(s), s + ' is gone');
assert.ok(idx.indexOf('id="pi-hours-row"') < idx.indexOf('id="pi-hours-body"') && idx.indexOf('id="pi-hours-body"') < idx.indexOf('<details class="pi-socials">'), 'head row, then the body, inside the Period card');
const css = fs.readFileSync('public/personal-profile-tabs.css', 'utf8');
for (const s of ['.pi-hours-row{flex-basis:100%;justify-content:flex-end', '.pi-hours-row.ok #pi-hours-fill{background:#16a34a}', '.pi-hours-row.unset .pi-hours-track,#personalInfoModal .pi-hours-row.warn .pi-hours-track{display:none}']) assert.ok(css.includes(s), 'css: ' + s);
assert.ok(/personal-profile-tabs\.css\?v=V101\.19[2-9]|personal-profile-tabs\.css\?v=V101\.[2-9]\d\d/.test(idx), 'personal-profile-tabs.css cache-buster bumped');

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
        window.myUserDoc = { id: 'U1', fullName: 'ภัทราพร  สุนทรินทร์', firstName: 'ภัทราพร', startDate: schDateKey(new Date(Date.now() - 2 * 864e5)), endDate: schDateKey(new Date(Date.now() + 38 * 864e5)) };
        window.__upd = [];
        const _col = db.collection.bind(db);
        // the modal loads the users doc itself → hand it myUserDoc; updates are captured
        db.collection = n => Object.assign(_col(n), { doc: id => ({ update: async u => { window.__upd.push({ id, u }); }, get: () => Promise.resolve({ exists: true, data: () => Object.assign({}, window.myUserDoc) }), onSnapshot: () => () => {} }) });
        window.renderGoogleLinkRow = window.renderGoogleLinkRow || (() => {});
        openPersonalInfoModal();
        document.getElementById('personalInfoModal').style.display = 'block';
    });
    await page.waitForFunction(() => document.getElementById('pi-firstname').value === 'ภัทราพร');
    await page.waitForTimeout(100);
    await page.evaluate(() => { document.querySelector('#pi-info-panel .pi-card-period').open = true; });   // the load folds every card (V101.163); open Period to read / click its body
    const st = () => page.evaluate(() => {
        const row = document.getElementById('pi-hours-row'), body = document.getElementById('pi-hours-body'), track = row.querySelector('.pi-hours-track');
        const cs = getComputedStyle(row);
        return { hidden: row.hidden, shown: cs.display !== 'none', cls: row.className.replace('pi-period-progress pi-hours-row lang-no-toggle', '').trim(), label: document.getElementById('pi-hours-label').textContent,
            fill: document.getElementById('pi-hours-fill').style.width, fillColor: getComputedStyle(document.getElementById('pi-hours-fill')).backgroundColor, trackShown: getComputedStyle(track).display !== 'none',
            color: cs.color, text: body.innerText.replace(/\s+/g, ' ').trim(), bodyShown: getComputedStyle(body).display !== 'none', sumH: Math.round(document.querySelector('.pi-card-period > summary').getBoundingClientRect().height) };
    });

    // 0. the Goals pane has no Hours button any more
    assert.equal(await page.$('#ip-hours-btn'), null, 'no Hours button in Schedule ▸ Goals');

    // 1. not set → grey "not set" on the head (no bar), the set-up form in the body, name prefilled from fullName
    let s = await st();
    assert.equal(s.shown, true, 'hours row shown on the card head'); assert.equal(s.cls, 'unset'); assert.equal(s.label, '⏱ Training hours · not set'); assert.equal(s.trackShown, false, 'no bar while not set');
    assert.equal(s.color, 'rgb(100, 116, 139)', 'grey while not set');
    assert.ok(/Hours your school requires/.test(s.text) && /Set once/.test(s.text), 'set-up form: ' + s.text);
    assert.equal(await page.inputValue('#ip-h-name'), 'ภัทราพร  สุนทรินทร์', 'name prefilled from fullName');
    await page.click('#pi-hours-body .ip-h-save');
    s = await st();
    assert.ok(/Enter the hours/.test(s.text), 'empty goal is refused inline');
    assert.equal(await page.evaluate(() => __upd.length), 0, 'nothing written on a bad goal');
    await page.fill('#ip-h-goal', '200');
    await page.click('#pi-hours-body .ip-h-save');
    await page.waitForTimeout(100);
    let upd = await page.evaluate(() => __upd);
    assert.equal(upd.length, 1); assert.equal(upd[0].id, 'U1');
    assert.deepEqual(upd[0].u, { internHoursTarget: 200, timeName: '__DELETE__' }, 'goal saved; timeName equal to fullName is not stored');
    s = await st();
    assert.equal(s.label, "⏱ goal 200 h · after tonight's sync", 'waiting label: ' + s.label); assert.equal(s.cls, ''); assert.equal(s.fill, '0%'); assert.equal(s.trackShown, true, 'the empty bar shows once the goal is set');
    assert.ok(/tonight's sync/.test(s.text) && /Saved/.test(s.text), 'waiting body: ' + s.text);

    // 2. set once — a second save of the goal is ignored
    await page.evaluate(() => { window._ipHoursWaiting = false; myUserDoc.internHoursTarget = 200; ipHoursSave(false); });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => __upd.length), 1, 'goal cannot be saved twice from the intern side');

    // 3. no-match → amber warning on the head (no bar), only the name in the body, saved as timeName
    await page.evaluate(() => { myUserDoc.internHours = { status: 'no-match' }; ipHoursRender(); });
    s = await st();
    assert.equal(s.cls, 'warn'); assert.equal(s.label, '⚠ ⏱ name not found in the time clock'); assert.equal(s.trackShown, false); assert.equal(s.color, 'rgb(180, 83, 9)', 'amber warning');
    assert.ok(/Name not found/.test(s.text) && !(await page.$('#ip-h-goal')), 'no-match shows the name field only: ' + s.text);
    await page.fill('#ip-h-name', 'Pattarada  S.');
    await page.click('#pi-hours-body .ip-h-save');
    await page.waitForTimeout(100);
    upd = await page.evaluate(() => __upd);
    assert.deepEqual(upd[1].u, { timeName: 'Pattarada S.' }, 'name fix writes timeName only');
    await page.evaluate(() => { myUserDoc.internHours = { status: 'ambiguous' }; window._ipHoursWaiting = false; ipHoursRender(); });
    s = await st();
    assert.equal(s.label, '⚠ ⏱ two people share this name in the time clock');

    // 4. ok → "n / goal h (p%)" + blue bar on the head; one grey line (days · rule · synced) in the body; green once the goal is reached
    await page.evaluate(() => { window._ipHoursWaiting = false; myUserDoc.internHours = { status: 'ok', total: 16, days: 2, syncedAt: { toDate: () => new Date(2026, 9, 22, 0, 15) } }; ipHoursRender(); });
    s = await st();
    assert.equal(s.label, '⏱ 16 / 200 h (8%)', 'ok label: ' + s.label); assert.equal(s.fill, '8%'); assert.equal(s.fillColor, 'rgb(37, 99, 235)', 'blue bar'); assert.equal(s.cls, ''); assert.equal(s.color, 'rgb(30, 64, 175)');
    assert.equal(s.text, '⏱ 2 days · Clock span − 1 h break, max 8 h a day · synced 22 Oct, 00:15', 'ok body is one grey line: ' + s.text);
    assert.equal(await page.$('#pi-hours-body .ip-h-card'), null, 'no card frame in the ok state');
    assert.ok(s.sumH <= 48, 'the head is two short lines (time bar + hours bar), not more: ' + s.sumH);
    if (process.env.SHOT) await page.screenshot({ path: 'output/intern-hours-goal.png' });
    await page.evaluate(() => { myUserDoc.internHours = { status: 'ok', total: 216, days: 27 }; ipHoursRender(); });
    s = await st();
    assert.equal(s.cls, 'ok'); assert.equal(s.fill, '100%'); assert.equal(s.fillColor, 'rgb(22, 163, 74)', 'goal reached → green bar'); assert.equal(s.color, 'rgb(21, 128, 61)');
    assert.equal(s.label, '⏱ 216 / 200 h (100%)');

    // 5. 🌱 Lifelong (notAnInternship) → nothing: row hidden, body empty (and hidden)
    await page.evaluate(() => { myUserDoc.notAnInternship = true; ipHoursRender(); });
    s = await st();
    assert.equal(s.hidden, true); assert.equal(s.shown, false); assert.equal(s.text, ''); assert.equal(s.bodyShown, false, 'empty body takes no space');
    // reopening the modal re-reads the doc and renders from it (the modal's own copy, not myOwnRow)
    await page.evaluate(() => { myUserDoc.notAnInternship = false; window._ipHoursWaiting = false; myUserDoc.internHours = { status: 'ok', total: 16, days: 2 }; openPersonalInfoModal(); });
    await page.waitForFunction(() => document.getElementById('pi-hours-label').textContent === '⏱ 16 / 200 h (8%)');

    // 6. no sideways scroll
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');

    assert.deepEqual(errors, [], 'no page errors');
    await browser.close();
    console.log('intern-hours-goal-qa: PASS');
})().catch(e => { console.error(e); process.exit(1); });
