// V101.82 / V101.83: the 🔥 check-in pill and 💰 FIN moved from the home activity row into Schedule — the pill sits inline in the TODAY header (kept even when
// nothing is due today; orange button = check in now, green = done), 💰 is an icon beside Goals. The REAL public/index.html on a touch phone
// (file://, network blocked, Firebase stubbed). FIN opens ABOVE Schedule (z-index). SHOT=<dir> also writes a PNG.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(idx.includes('function checkinPillHtml()') && idx.includes('function schTodayHeadHtml('), 'pill builder + TODAY header builder exist');

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
        window.myUserDoc = { id: 'U1', startDate: key(-60), endDate: key(394) };
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
        const ts = n => ({ toDate: () => D(n) });
        const row = (i, extra) => Object.assign({ id: 'r' + i, timestamp: ts(0), status: 'approved' }, extra);
        monthlyProgress.update({ logs: [0, 1, 2, 3].map(i => row(i)), cases: [0, 1].map(i => row(i)), targets: { quiz: 30, log: 12, case: 8 }, save: () => Promise.resolve() });
        monthlyProgress.setQuizzes(Array.from({ length: 12 }, (_, i) => row(i, { quizId: 'qz' + i, isPractice: false })));
        internshipProgress.setPeriod({ personal: true, goal: { kind: 'monthly', target: 30 }, monthlyTarget: 30, history: {}, saveGoal: () => Promise.resolve() });
        internshipProgress.setAttempts(Array.from({ length: 12 }, (_, i) => ({ quizId: 'qz' + i, status: 'approved', isPractice: false, timestamp: ts(0) })));
        if (window.assignedGoals) assignedGoals.userOpen = () => {};
    });
    return { page, errors, ctx };
}

(async () => {
    const browser = await chromium.launch();
    try {
        const { page, errors, ctx } = await open(browser);
        await page.evaluate(() => {
            myCheckin = { lastDate: __key(0) };                                   // top-level binding of the page
            window.computeEngagementStreak = () => ({ streak: 12, doneToday: true });
            try { renderDailyCheckinCard(); } catch (e) { if (!/firebase\./.test(e.message)) throw e; }
        });

        // ---- home row: empty (V101.82 pill + FIN, V101.86 Case, V101.87 Log all moved out)
        const home = await page.evaluate(() => ({ html: document.getElementById('daily-checkin-card').innerHTML, n: document.querySelectorAll('#daily-checkin-card .activity-actions > *').length }));
        assert.equal(home.n, 0, 'nothing in the home row');
        assert.equal(home.html, '', 'the host is empty');
        assert.ok(!/act-streak|finOpen|💰|🔥/.test(home.html), 'no pill / FIN on the home row');
        assert.equal(await page.locator('#badge-streak').textContent(), '12 days', 'the metrics-rail streak chip is still written by renderDailyCheckinCard');

        // ---- Schedule: the pill is inline with the TODAY header
        await page.evaluate(() => openScheduleModal());
        await page.waitForTimeout(500);
        const head = await page.evaluate(() => {
            const pill = document.querySelector('#sch-agenda .act-streak');
            if (!pill) return null;
            const row = pill.parentElement, label = row.firstElementChild;
            const r = pill.getBoundingClientRect(), l = label.getBoundingClientRect();
            return { cls: pill.className, tag: pill.tagName, text: pill.textContent.trim(), label: label.textContent.trim(), sameRow: Math.abs((r.top + r.bottom) / 2 - (l.top + l.bottom) / 2) < 8, right: r.left >= l.right - 1,
                aria: pill.getAttribute('aria-label'), h: Math.round(r.height), inHome: !!document.querySelector('#daily-checkin-card .act-streak') };
        });
        assert.ok(head, 'pill is in the agenda');
        assert.ok(/^Today/i.test(head.label) && head.sameRow && head.right, 'inline with the TODAY label: ' + JSON.stringify(head));
        assert.equal(head.text, '🔥12', 'streak only — no 🎁 text on the pill');
        assert.ok(head.cls.includes('done') && head.tag === 'SPAN', 'green + not a button once checked in');
        assert.ok(/Bonus \+/.test(head.aria), 'bonus wording is in aria-label: ' + head.aria);
        assert.equal(head.inHome, false);

        // nothing due today → the header (and the pill) is still there
        const realItems = await page.evaluate(() => { window.__realItems = schAgendaItems; schAgendaItems = () => []; schRenderAgenda(); return true; });
        assert.equal(await page.locator('#sch-agenda .act-streak').count(), 1, 'pill stays when the agenda is empty');
        await page.evaluate(() => { schAgendaItems = () => [{ id: 'x', title: 'Only later', due: new Date(Date.now() + 5 * 864e5), icon: '📌', type: 'other' }]; schRenderAgenda(); });
        assert.equal(await page.locator('#sch-agenda .act-streak').count(), 1, 'pill stays when only later items exist (no TODAY bucket)');
        await page.evaluate(() => { schAgendaItems = window.__realItems; });

        // not checked in yet → orange button: 24px to look at, 44px to tap on touch (invisible ::after), calls tryDailyCheckin
        await page.evaluate(() => { myCheckin = { lastDate: __key(-1) }; window.__ci = 0; window.tryDailyCheckin = () => { window.__ci++; }; schRenderAgenda(); });
        const todo = page.locator('#sch-agenda #daily-checkin-btn.act-streak.todo');
        assert.equal(await todo.count(), 1, 'orange check-in button');
        const bb = await todo.boundingBox();
        assert.ok(bb.height <= 28, 'visually small: ' + bb.height);
        const hit = await page.evaluate(() => {
            const b = document.getElementById('daily-checkin-btn'), r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const on = dy => document.elementFromPoint(cx, cy + dy) === b;
            const tile = document.querySelector('#sch-agenda .sch-tile'), t = tile && tile.getBoundingClientRect();
            return { up: on(-24), down: on(16), farUp: on(-34), farDown: on(30), coverTile: !!t && document.elementFromPoint(t.left + 6, t.top + 3) === b, ok: on(0) };
        });
        assert.ok(hit.ok && hit.up && hit.down, 'tap area reaches ±22px around the pill (≈44px): ' + JSON.stringify(hit));
        assert.ok(!hit.farUp && !hit.farDown, 'and no further: ' + JSON.stringify(hit));
        assert.equal(hit.coverTile, false, 'the invisible area never covers the tiles below');
        await todo.click();
        assert.equal(await page.evaluate(() => window.__ci), 1, 'tapping it checks in');
        await page.evaluate(() => { myCheckin = { lastDate: __key(0) }; schRenderAgenda(); });

        // ---- 💰 beside Goals
        const box = await page.evaluate(() => {
            const g = document.getElementById('sch-goals-btn').getBoundingClientRect(), f = document.getElementById('sch-fin-btn').getBoundingClientRect(), h = document.getElementById('sch-heat-btn').getBoundingClientRect();
            const links = document.querySelector('#sch-goals-box .sch-gb-links');
            return { text: document.getElementById('sch-fin-btn').textContent.trim(), sameRow: Math.abs((g.top + g.bottom) / 2 - (f.top + f.bottom) / 2) < 6, right: f.left >= g.right - 12, stacked: h.top >= g.bottom - 1,
                fits: links.scrollWidth <= links.clientWidth + 1, aria: document.getElementById('sch-fin-btn').getAttribute('aria-label'),
                goalsText: document.getElementById('sch-goals-btn').textContent.trim(), heatText: document.getElementById('sch-heat-btn').textContent.trim() };
        });
        assert.equal(box.text, '💰', 'icon only');
        assert.ok(box.sameRow && box.right, '💰 on the Goals row: ' + JSON.stringify(box));
        assert.ok(box.stacked && box.fits, 'Heatmap stays under, nothing clipped: ' + JSON.stringify(box));
        assert.equal(box.goalsText + box.heatText, 'GoalsHeatmap', 'Goals / Heatmap labels untouched');
        assert.ok(/FIN/.test(box.aria));
        await page.locator('#sch-goals-btn').click();
        assert.equal(await page.evaluate(() => document.getElementById('sch-pane-goals').style.display !== 'none'), true, 'Goals still expands');
        await page.locator('#sch-goals-btn').click();

        // FIN opens above Schedule
        await page.evaluate(() => {
            window.__fin = 0;
            const real = window.finOpen;
            window.finOpen = function () { window.__fin++; try { return real.apply(this, arguments); } catch (e) { document.getElementById('finModal').style.display = 'flex'; } };
        });
        await page.locator('#sch-fin-btn').click();
        assert.equal(await page.evaluate(() => window.__fin), 1, 'tapping 💰 calls finOpen');
        await page.waitForTimeout(250);
        const top = await page.evaluate(() => {
            const m = document.getElementById('finModal');
            const c = m.querySelector('.modal-content').getBoundingClientRect();
            const el = document.elementFromPoint(c.left + c.width / 2, c.top + 24);
            return { open: getComputedStyle(m).display !== 'none', onTop: !!el && !!el.closest('#finModal'), z: getComputedStyle(m).zIndex };
        });
        assert.ok(top.open && top.onTop && +top.z > 9999, 'FIN is above Schedule: ' + JSON.stringify(top));

        const lay = await page.evaluate(() => { const m = document.querySelector('#scheduleModal .modal-content'); return { over: m.scrollWidth - m.clientWidth }; });
        assert.ok(lay.over <= 1, 'no sideways scroll in Schedule');
        if (process.env.SHOT) {
            await page.evaluate(() => { document.getElementById('finModal').style.display = 'none'; });
            await page.locator('#scheduleModal .modal-content').screenshot({ path: path.join(process.env.SHOT, 'schedule_after.png') });
        }
        assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], 'no page errors');
        await ctx.close();
        console.log('PASS: check-in pill inline with TODAY (green/orange, kept when nothing is due, 44px tap), 💰 icon beside Goals, FIN opens above Schedule, home row empty');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
