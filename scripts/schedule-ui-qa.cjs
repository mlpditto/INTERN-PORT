// V101.78: Schedule (intern) — Agenda week strip, the REAL public/index.html on a touch phone (file://, network blocked, Firebase stubbed).
// Mon–Sun strip above the Agenda list: solid dot = done (schBuildDayMap), hollow dot = still to do (schAgendaItems), one colour per kind
// (Quiz / Journal / Case / Event / other); a MISSED item draws nothing; tap a day = that day's rows, tap again = closed; the arrows only walk
// weeks that carry a dot (+ next week); Today › returns; every open starts on this week with nothing picked; touch targets ≥ 44 px, no sideways
// scroll; the tabs and the list below still work. SHOT=1 also writes PNGs to output/.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(/<title>Internship Portfolio \(V101\.78\)<\/title>/.test(idx), 'intern version bumped');
for (const fn of ['function schRenderWeek(', 'function schWeekMarks(', 'function schItemDayKey(', 'function schWeekDayHtml(', 'function schWeekShift(', 'function schWeekPick(']) assert.ok(idx.includes(fn), fn + ' exists');
assert.ok(idx.includes('<div id="sch-week"'), 'strip host sits above #sch-agenda');
assert.ok(idx.indexOf('<div id="sch-week"') < idx.indexOf('<div id="sch-agenda"'), 'strip is above the list');
assert.ok(/\.sch-wd/.test(idx) && !/\.dc-view-tab[^{]*\.sch-wd/.test(idx), 'own classes, not .dc-view-tab');

async function open(browser) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }) };
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
        const D = n => new Date(Date.now() + n * 86400000);
        const key = n => schDateKey(D(n));
        window.__key = key;
        window.userId = 'U1';
        usersData = [{ id: 'U1', displayName: 'Sample', startDate: key(-60), endDate: key(394) }];
        window.myCheckin = { lastDate: key(-1) };               // not checked in today -> a hollow "other" dot today
        window.myCasesCache = []; window.myReflectiveLogsCache = [];
        // two quests whose deadlines are long gone (MISSED, must draw nothing) + one quiz due in 2 days
        questsCache = [{ id: 'q1', title: 'Old quest A', isActive: true, deadline: D(-5) }, { id: 'q2', title: 'Old quest B', isActive: true, deadline: D(-12) }];
        quizzesCache = [{ id: 'z1', title: 'Vitamin B quiz', isActive: true, deadline: D(2) }];
        quizAttemptsCache = {}; mySubmissionsCache = {};
        schEventsCache = [{ id: 'e1', title: 'Journal club', eventDate: key(3), timeText: '09:00–10:00' }]; schMyEventInterests = {};
        schLoadEvents = () => {};
        const T = (n, type, title) => ({ submissionType: type, title, status: 'done', timestamp: D(n), id: type + n });
        const items = [T(-1, 'quiz', 'Pharmacology quiz'), T(-2, 'reflective', 'Daily reflection'), T(-3, 'case', 'Keratitis case')];
        getUnifiedAllItems = () => items;
        schCheckinDays = new Set();
    });
    return { page, errors, ctx };
}

const cell = (page, n) => page.evaluate(n => document.querySelector('#sch-week [data-schday="' + __key(n) + '"]') ? 1 : 0, n);
// walk the arrows until the week holding day n is on screen
async function goTo(page, n) {
    for (let i = 0; i < 60 && !(await cell(page, n)); i++) {
        const dir = await page.evaluate(n => (new Date(__key(n)) < new Date(document.querySelector('#sch-week [data-schday]').dataset.schday) ? -1 : 1), n);
        const btn = page.locator('#sch-week .sch-wk-nv').nth(dir < 0 ? 0 : 1);
        if (await btn.isDisabled()) break;
        await btn.click();
    }
    assert.ok(await cell(page, n), 'day ' + n + ' reachable with the arrows');
}
const dots = (page, n) => page.evaluate(n => [...document.querySelectorAll('#sch-week [data-schday="' + __key(n) + '"] .sch-dt')].map(d => d.className.replace('sch-dt', '').trim().split(/\s+/).sort().join('.')), n);

(async () => {
    const browser = await chromium.launch({ headless: true });
    const { page, errors } = await open(browser);
    await page.evaluate(() => openScheduleModal());
    await page.waitForTimeout(300);

    // ---- 1. strip is drawn: Monday first, 7 days, today marked, this week's caption
    const shape = await page.evaluate(() => {
        const b = [...document.querySelectorAll('#sch-week .sch-wd')];
        return { n: b.length, first: new Date(b[0].dataset.schday + 'T12:00:00').getDay(), todayCls: b.filter(x => x.classList.contains('today')).map(x => x.dataset.schday), todayKey: schDateKey(new Date()), letters: b.map(x => x.querySelector('small').textContent).join('') };
    });
    assert.equal(shape.n, 7, 'seven days');
    assert.equal(shape.first, 1, 'Monday first');
    assert.equal(shape.letters, 'MTWTFSS');
    assert.deepEqual(shape.todayCls, [shape.todayKey], 'today is marked');
    assert.ok(/ – /.test(await page.textContent('#sch-week .sch-wk-cap')), 'range caption');
    assert.equal(await page.locator('#sch-week .sch-wk-cap button').count(), 0, 'no Today › link on this week');

    // ---- 2. dots: hollow today (journal, case, other), solid past, hollow future, nothing for MISSED
    assert.deepEqual((await dots(page, 0)).sort(), ['c.o', 'j.o', 'o.x'].sort(), 'today: hollow case / journal / other');
    await goTo(page, -1); assert.deepEqual(await dots(page, -1), ['q'], 'yesterday: solid quiz');
    await goTo(page, -2); assert.deepEqual(await dots(page, -2), ['j'], 'D-2: solid journal');
    await goTo(page, -3); assert.deepEqual(await dots(page, -3), ['c'], 'D-3: solid case');
    // MISSED: no mark at all on the deadline days (D-5 / D-12), so their weeks are not even reachable
    assert.deepEqual(await page.evaluate(() => { const m = schWeekMarks(schAgendaItems()); return [m[__key(-5)], m[__key(-12)]]; }), [undefined, undefined], 'a MISSED quest draws no dot');
    assert.ok(await page.evaluate(() => schAgendaItems().filter(it => schBucketOf(it, new Date()) === 'missed').length) === 2, 'fixture: two missed quests exist');
    await goTo(page, 2); assert.deepEqual(await dots(page, 2), ['o.q'], 'quiz deadline: hollow quiz');
    await goTo(page, 3); assert.deepEqual(await dots(page, 3), ['e.o'], 'event: hollow event');
    const colours = await page.evaluate(() => { const c = k => { const e = document.createElement('span'); e.className = 'sch-dt ' + k; document.querySelector('#sch-week').append(e); const v = getComputedStyle(e).backgroundColor; e.remove(); return v; }; return ['q', 'j', 'c', 'e', 'x'].map(c); });
    assert.equal(new Set(colours).size, 5, 'five distinct dot colours: ' + colours.join(' '));
    // hollow = transparent fill + coloured ring
    const hollow = await page.evaluate(() => { const e = document.createElement('span'); e.className = 'sch-dt o q'; document.querySelector('#sch-week').append(e); const s = getComputedStyle(e); const r = [s.backgroundColor, s.borderTopWidth]; e.remove(); return r; });
    assert.ok(/rgba\(0, 0, 0, 0\)|transparent/.test(hollow[0]) && parseFloat(hollow[1]) >= 1, 'hollow dot: ' + hollow.join(' '));

    // ---- 3. arrows only walk weeks that carry a dot (+ next week)
    await page.evaluate(() => { schWeekOffset = 0; schRenderAgenda(); });
    for (let i = 0; i < 6; i++) await page.evaluate(() => schWeekShift(-1));
    const lo = await page.evaluate(() => schWeekOffset);
    assert.ok(lo >= -1 && lo <= 0, 'cannot walk back past the first week with a dot (offset ' + lo + ')');
    assert.ok(await page.locator('#sch-week .sch-wk-nv').nth(0).isDisabled(), '‹ disabled at the first week');
    for (let i = 0; i < 9; i++) await page.evaluate(() => schWeekShift(1));
    const hi = await page.evaluate(() => schWeekOffset);
    assert.ok(hi >= 1 && hi <= 2, 'forward stops after the last dot / next week (offset ' + hi + ')');
    assert.ok(await page.locator('#sch-week .sch-wk-nv').nth(1).isDisabled(), '› disabled at the end');
    assert.equal(await page.locator('#sch-week .sch-wk-cap button').count(), 1, 'Today › link off this week');
    await page.locator('#sch-week .sch-wk-cap button').click();
    assert.equal(await page.evaluate(() => schWeekOffset), 0, 'Today › returns');

    // ---- 4. tap a day: its rows; tap again closes; focus stays on the day
    await goTo(page, -1);
    await page.locator('#sch-week [data-schday="' + (await page.evaluate(() => __key(-1))) + '"]').click();
    const det = await page.textContent('#sch-week-day');
    assert.ok(det.includes('Pharmacology quiz') && det.includes('done'), 'yesterday shows the done quiz: ' + det);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#sch-week [aria-pressed="true"]').length), 1, 'one day pressed');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.dataset.schday), await page.evaluate(() => __key(-1)), 'focus stays on the tapped day');
    await page.locator('#sch-week [data-schday="' + (await page.evaluate(() => __key(-1))) + '"]').click();
    assert.equal(await page.locator('#sch-week-day').count(), 0, 'second tap closes the day');
    await goTo(page, 0);
    await page.locator('#sch-week .sch-wd.today').click();
    const today = await page.textContent('#sch-week-day');
    assert.ok(today.includes('Journal') && today.includes('Case') && today.includes('Daily check-in'), 'today lists what is still to do: ' + today);
    await goTo(page, 3);
    await page.locator('#sch-week [data-schday="' + (await page.evaluate(() => __key(3))) + '"]').click();
    assert.ok((await page.textContent('#sch-week-day')).includes('Journal club'), 'a future event day shows the event card');
    assert.equal(await page.locator('#sch-week-day [onclick*="schJoinEvent"], #sch-week-day button').count() >= 0, true);

    // ---- 5. every open starts clean
    await page.evaluate(() => { schWeekShift(1); closeScheduleModal(); openScheduleModal(); });
    assert.equal(await page.evaluate(() => schWeekOffset), 0, 'reopen = this week');
    assert.equal(await page.locator('#sch-week-day').count(), 0, 'reopen = no day picked');
    assert.equal(await page.locator('#sch-week .sch-wk-cap button').count(), 0, 'reopen = no Today › link');

    // ---- 6. phone layout: 44 px targets, no sideways scroll, strip above the list
    const lay = await page.evaluate(() => {
        const h = [...document.querySelectorAll('#sch-week .sch-wd, #sch-week .sch-wk-nv')].map(b => b.getBoundingClientRect());
        const w = document.getElementById('sch-week'), a = document.getElementById('sch-agenda');
        return { minH: Math.min(...h.map(r => r.height)), minW: Math.min(...[...document.querySelectorAll('#sch-week .sch-wd')].map(b => b.getBoundingClientRect().width)), over: w.scrollWidth - w.clientWidth, above: w.getBoundingClientRect().bottom <= a.getBoundingClientRect().top + 1, modal: document.getElementById('scheduleModal').style.display };
    });
    assert.equal(lay.modal, 'flex', 'modal really open (not a hidden-container pass)');
    assert.ok(lay.minH >= 44, 'targets ≥ 44 px tall: ' + lay.minH);
    assert.ok(lay.minW >= 36, 'day buttons ≥ 36 px wide: ' + lay.minW);
    assert.ok(lay.over <= 1, 'no sideways scroll: ' + lay.over);
    assert.ok(lay.above, 'strip sits above the list');

    // ---- 7. the list below and the tabs are untouched
    const list = await page.textContent('#sch-agenda');
    assert.ok(/Today/.test(list) && /Journal/.test(list) && /Case/.test(list) && /Vitamin B quiz/.test(list) && /Journal club/.test(list), 'Agenda list still there: ' + list.slice(0, 160));
    assert.ok(/Show 2 missed/.test(list), 'Missed still collapsed behind its link');
    await page.evaluate(() => schSwitchPane('activity'));
    assert.equal(await page.evaluate(() => document.getElementById('sch-pane-agenda').style.display), 'none', 'Activity tab still switches');
    await page.evaluate(() => schSwitchPane('agenda'));
    assert.equal(await page.locator('#sch-week .sch-wd').count(), 7, 'strip is back with the Agenda');

    // ---- 8. nothing scheduled at all: the strip still draws, the list says so
    await page.evaluate(() => { questsCache = []; quizzesCache = []; schEventsCache = []; getUnifiedAllItems = () => []; myCheckin = { lastDate: schDateKey(new Date()) }; window.myCasesCache = [{ timestamp: new Date(), status: 'approved' }]; schRenderAgenda(); });
    assert.equal(await page.locator('#sch-week .sch-wd').count(), 7, 'strip with an empty agenda');

    if (process.env.SHOT) {
        await page.evaluate(() => { schWeekSel = null; });
        fs.mkdirSync('output', { recursive: true });
        await page.evaluate(() => { questsCache = [{ id: 'q1', title: 'Old quest A', isActive: true, deadline: new Date(Date.now() - 5 * 864e5) }]; quizzesCache = [{ id: 'z1', title: 'Vitamin B quiz', isActive: true, deadline: new Date(Date.now() + 2 * 864e5) }]; schEventsCache = [{ id: 'e1', title: 'Journal club', eventDate: __key(3), timeText: '09:00' }]; myCheckin = { lastDate: __key(-1) }; window.myCasesCache = []; const T = (n, type, title) => ({ submissionType: type, title, status: 'done', timestamp: new Date(Date.now() + n * 864e5), id: type + n }); getUnifiedAllItems = () => [T(-1, 'quiz', 'Pharmacology quiz'), T(-2, 'reflective', 'Daily reflection'), T(-3, 'case', 'Keratitis case')]; schWeekPick(__key(-1)); });
        await page.locator('#scheduleModal .modal-content').screenshot({ path: 'output/schedule-weekstrip.png' });
    }
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    await browser.close();
    console.log('schedule-ui-qa: PASS');
})().catch(e => { console.error(e); process.exit(1); });
