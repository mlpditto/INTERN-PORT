// V101.169: Schedule S2 (mockup picked 2026-10-19). The REAL public/index.html on a touch phone (file://, network blocked,
// Firebase stubbed), clock pinned to Thu 22 Oct 2026 10:00 Bangkok.
// "Day N / M" + a thin bar + "K days left" under it · a count on a day with 2+ things due · an orange bar under a past day that
// still has an overdue quiz / quest (a Missed item drew nothing before) · the marks are explained in the ⓘ sheet (V101.183: the legend line under the strip is gone) ·
// no sideways scroll on a 360 / 412 px phone.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(fs.readFileSync('public/index.html', 'utf8')));

async function open(browser, width) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date('2026-10-22T10:00:00+07:00'));
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
        const me = { id: 'U1', displayName: 'Sample', startDate: key(-60), endDate: key(30) };
        usersData = [me]; window.myUserDoc = Object.assign({}, me);
        window.myCheckin = { lastDate: key(0) };
        window.myCasesCache = []; window.myReflectiveLogsCache = [];
        questsCache = [{ id: 'q1', title: 'Quest two days ago', isActive: true, deadline: D(-2) }];
        quizzesCache = [
            { id: 'z0', title: 'Quiz yesterday', isActive: true, deadline: D(-1) },
            { id: 'z1', title: 'Quiz tomorrow', isActive: true, deadline: D(1) },
            { id: 'z2', title: 'Quiz Sat A', isActive: true, deadline: D(2) },
            { id: 'z3', title: 'Quiz Sat B', isActive: true, deadline: D(2) }
        ];
        quizAttemptsCache = {}; mySubmissionsCache = {};
        schEventsCache = []; schMyEventInterests = {}; schLoadEvents = () => {};
        getUnifiedAllItems = () => [];
        schCheckinDays = new Set([key(-3), key(0)]);
        monthlyProgress.update({ logs: [], cases: [], targets: { quiz: 30, log: 12, case: 8 }, save: () => Promise.resolve() });
        monthlyProgress.setQuizzes([]);
        if (window.assignedGoals) assignedGoals.userOpen = () => {};
    });
    await page.evaluate(() => openScheduleModal());
    await page.waitForTimeout(300);
    return { page, ctx, errors };
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { page, ctx, errors } = await open(browser, 412);
        // ---- 1. Day N / M · days left + bar
        const dn = await page.evaluate(() => { const e = document.querySelector('#sch-week .sch-dn'); return e && { text: e.children[0].textContent.trim() + ' | ' + e.querySelector('.sch-dn-sub').textContent.trim(), bar: e.querySelector('.sch-dn-bar i').style.width }; });
        const m = /^Day (\d+) \/ (\d+) \| (\d+) days left$/.exec(dn.text);
        assert.ok(m, 'Day N / M then K days left: ' + dn.text);
        assert.equal(+m[2] - +m[1], +m[3], 'days left = M − N');
        assert.equal(dn.bar, Math.round(+m[1] / +m[2] * 100) + '%', 'bar = N / M');

        // ---- 2. count on Sat 24 (two quizzes due), overdue bars on Tue 20 (quest) and Wed 21 (quiz)
        const cell = k => page.evaluate(k => { const b = document.querySelector('#sch-week [data-schday="' + k + '"]'); return { cnt: b.querySelector('.sch-cnt')?.textContent || '', over: !!b.querySelector('.sch-over'), label: b.getAttribute('aria-label') }; }, k);
        const at = n => page.evaluate(n => __key(n), n);
        const sat = await cell(await at(2)), fri = await cell(await at(1)), tue = await cell(await at(-2)), wed = await cell(await at(-1)), thu = await cell(await at(0));
        assert.equal(sat.cnt, '2', 'Sat: 2 due'); assert.match(sat.label, /· 2 due$/);
        assert.equal(fri.cnt, '', 'Fri: one due → no count');
        assert.deepEqual([tue.over, wed.over, thu.over, fri.over], [true, true, false, false], 'orange bar only under past days with an overdue item');
        assert.match(wed.label, /· 1 overdue/, 'screen readers hear it too');

        // ---- 3. V101.183: no legend under the strip — the ⓘ sheet explains ⭐, the count and the overdue bar
        assert.equal(await page.locator('#sch-week .sch-legend').count(), 0, 'no legend under the strip');
        const marks = await page.evaluate(() => { internshipProgress.showHelp(null); const d = document.getElementById('ip-help-dialog'), m = d.querySelector('.ip-help-marks'); const r = { text: m ? m.textContent : '', cnt: !!d.querySelector('.ip-hcnt'), over: d.querySelector('.ip-hover') ? getComputedStyle(d.querySelector('.ip-hover')).backgroundColor : '' }; d.close(); return r; });
        assert.ok(marks.text.includes('⭐') && marks.cnt && marks.over === 'rgb(249, 115, 22)', 'ⓘ explains ⭐ / the count / the orange overdue bar: ' + JSON.stringify(marks));

        // ---- 4. no sideways scroll at 412 and 360
        const ov = () => page.evaluate(() => { const c = document.querySelector('#scheduleModal .modal-content'); return c.scrollWidth - c.clientWidth; });
        assert.ok(await ov() <= 1, 'no sideways scroll at 412: ' + await ov());
        await page.setViewportSize({ width: 360, height: 900 }); await page.waitForTimeout(200);
        assert.ok(await ov() <= 1, 'no sideways scroll at 360: ' + await ov());
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        await ctx.close();
        console.log('PASS schedule-s2-qa');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
