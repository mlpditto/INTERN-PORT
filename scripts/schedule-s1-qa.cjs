// V101.168: Schedule S1 (mockup picked 2026-10-19). The REAL public/index.html on a touch phone (file://, network blocked,
// Firebase stubbed), clock pinned to Thu 22 Oct 2026 10:00 Bangkok.
// Month card names its month and folds to one line when every count is 0 · MISSED shows the last 30 days with "Show older (n)" ·
// Agenda: a real placeholder, Save off until there is a title, a past-date note, 0930 → 09:30, Location / Join link as two
// fields, "Save to my agenda" + "no one is notified" (the New Event form keeps its fold) · Training dates: the dates in words,
// the 182-day verdict while picking, the right message for an empty field · an open-ended account shows "🌐 Open-ended".
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(idx));
assert.ok(!idx.includes('>Post the invite</button>') && !idx.includes("showToast('📣 Invite posted"), 'no "post / invite" wording for a private agenda item');

async function open(browser, o = {}) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
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
    await page.evaluate((o) => {
        const D = n => new Date(Date.now() + n * 86400000);
        const key = n => schDateKey(D(n));
        window.__key = key;
        window.userId = 'U1';
        const me = o.open ? { id: 'U1', displayName: 'Sample', startDate: '1988-11-08', endDate: '2068-11-08', notAnInternship: true } : { id: 'U1', displayName: 'Sample', startDate: key(-60), endDate: key(30) };
        usersData = [me]; window.myUserDoc = Object.assign({}, me);
        window.myCheckin = { lastDate: key(0) };
        window.myCasesCache = []; window.myReflectiveLogsCache = [];
        questsCache = [{ id: 'q1', title: 'Quest two days ago', isActive: true, deadline: D(-2) }, { id: 'q2', title: 'Quest forty days ago', isActive: true, deadline: D(-40) }];
        quizzesCache = [{ id: 'z0', title: 'Quiz yesterday', isActive: true, deadline: D(-1) }, { id: 'z1', title: 'Quiz tomorrow', isActive: true, deadline: D(1) }];
        quizAttemptsCache = {}; mySubmissionsCache = {};
        schEventsCache = []; schMyEventInterests = {}; schLoadEvents = () => {};
        getUnifiedAllItems = () => [];
        schCheckinDays = new Set();
        const ts = n => ({ toDate: () => D(n) });
        const zero = !o.counts;
        monthlyProgress.update({ logs: zero ? [] : [{ id: 'l1', timestamp: ts(0), status: 'approved' }], cases: [], targets: { quiz: 30, log: 12, case: 8 }, save: () => Promise.resolve() });
        monthlyProgress.setQuizzes([]);
        if (window.assignedGoals) assignedGoals.userOpen = () => {};
    }, o);
    await page.evaluate(() => openScheduleModal());
    await page.waitForTimeout(300);
    return { page, ctx, errors };
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        // ---- 1. month card
        let { page, ctx, errors } = await open(browser);
        assert.equal((await page.textContent('#sch-gb-month')).trim(), '📊 Oct 2026 · this month');
        assert.equal(await page.evaluate(() => document.getElementById('sch-goals-box').classList.contains('zero')), true, 'all zero → one line');
        assert.equal((await page.textContent('#sch-goalbars')).trim(), 'Quiz 0/30 · Journal 0/12 · Case 0/8');
        assert.equal(await page.isVisible('#sch-goals-btn') && await page.isVisible('#sch-heat-btn') && await page.isVisible('#sch-fin-btn'), true, 'Goals 💰 Heatmap stay');

        // ---- 2. MISSED: last 30 days, older behind a button, reset on reopen
        const missedHead = () => page.evaluate(() => { const h = Array.from(document.querySelectorAll('#sch-agenda [role="button"]')).find(e => /missed/i.test(e.textContent)); return h ? h.textContent.replace(/\s+/g, ' ').trim() : null; });
        assert.match(await missedHead(), /^Missed\D*2\s*· last 30 days/i, 'two in the last 30 days, the 40-day-old one is older: ' + await missedHead());
        await page.evaluate(() => schToggleMissed());
        const rows = () => page.evaluate(() => Array.from(document.querySelectorAll('#sch-agenda .lang-no-toggle')).map(e => e.textContent.trim()).filter(t => /^Qu/.test(t)));
        assert.deepEqual((await rows()).filter(t => /ago|yesterday/.test(t)), ['Quiz yesterday', 'Quest two days ago'], 'newest first, recent only');
        assert.equal((await page.textContent('#sch-agenda .sch-older')).trim(), 'Show older (1)');
        await page.click('#sch-agenda .sch-older');
        assert.ok((await rows()).includes('Quest forty days ago'), 'older shown');
        assert.equal(await page.locator('#sch-agenda .sch-older').count(), 0);
        assert.match(await missedHead(), /^Missed\D*3/i, 'count follows what is listed');
        await page.evaluate(() => { closeScheduleModal(); openScheduleModal(); });
        assert.match(await missedHead(), /^Missed\D*2\s*· last 30 days/i, 'reopen resets to the last 30 days');

        // ---- 3. Agenda
        await page.evaluate(() => schToggleNewEvent(true)); await page.waitForTimeout(100);
        const f = '#sch-new-event';
        assert.equal(await page.getAttribute(f + ' #sne-title', 'placeholder'), 'e.g. Group meeting · Case presentation');
        assert.deepEqual(await page.evaluate(() => { const t = document.getElementById('sne-title'); const p = Array.from(document.querySelectorAll('#sch-new-event .invite-audience-hint')).find(e => /Admin/.test(e.textContent)); return [t.getAttribute('aria-label'), t.required, !!(p && p.title)]; }), ['Event name', true, true], 'title keeps its label + required, the privacy line keeps its tooltip');
        const save = page.locator(f + ' .invite-actions button').first();
        assert.equal((await save.textContent()).trim(), 'Save to my agenda');
        assert.equal(await save.isDisabled(), true, 'Save is off without a title');
        assert.equal(await page.isVisible(f + ' .invite-need'), true);
        await page.fill(f + ' #sne-title', 'Group meeting');
        assert.equal(await save.isDisabled(), false); assert.equal(await page.isVisible(f + ' .invite-need'), false);
        assert.equal(await page.isVisible(f + ' .invite-past'), false, 'today is not past');
        await page.fill(f + ' input[aria-label="Date DD/MM/YYYY"]', '20/10/2026');
        assert.equal(await page.isVisible(f + ' .invite-past'), true, 'a past date is said out loud');
        await page.fill(f + ' input[aria-label="Date DD/MM/YYYY"]', '23/10/2026');
        assert.equal(await page.isVisible(f + ' .invite-past'), false);
        await page.fill(f + ' #sne-start', ''); await page.type(f + ' #sne-start', '0930');
        assert.equal(await page.inputValue(f + ' #sne-start'), '09:30', '0930 → 09:30 while typing');
        await page.fill(f + ' #sne-end', '930'); await page.locator(f + ' #sne-end').blur();
        assert.equal(await page.inputValue(f + ' #sne-end'), '09:30', '930 → 09:30 on leaving');
        await page.fill(f + ' #sne-end', '9'); await page.locator(f + ' #sne-end').blur();
        assert.equal(await page.inputValue(f + ' #sne-end'), '09:00', '9 → 09:00 on leaving');
        assert.equal(await page.locator(f + ' summary').count(), 0, 'no ▸ fold in the Schedule form');
        assert.equal(await page.isVisible(f + ' #sne-location') && await page.isVisible(f + ' #sne-join'), true, 'Location + Join link visible');
        assert.match(await page.textContent(f), /Only you and Admin see this · no one is notified/);
        assert.equal(await page.locator('#event-form-section summary').count(), 1, 'the New Event form keeps its fold');
        await page.evaluate(() => { schToggleNewEvent(false); schToggleNewEvent(true); });
        assert.equal(await save.isDisabled(), true, 'reopen → Save off again (title cleared)');
        await page.evaluate(() => schToggleNewEvent(false));

        // ---- 4. Training dates
        await page.evaluate(() => schEditDates()); await page.waitForTimeout(150);
        const st = () => page.evaluate(() => { const e = document.getElementById('training-date-state'); return [e.className, e.textContent]; });
        assert.deepEqual(await st(), ['ok', '✓ Looks right']);
        assert.match(await page.textContent('#training-date-length'), /^\w{3}, 23 Aug 2026 → \w{3}, 21 Nov 2026\s*90 days · 12\.9 weeks$/, 'dates in words: ' + await page.textContent('#training-date-length'));
        await page.fill('#sch-end-date', '2027-08-31');
        const [cls, txt] = await st();
        assert.equal(cls, 'bad'); assert.match(txt, /^⚠️ That is 373 days — the limit is 182/, 'the 182-day rule shows while picking: ' + txt);
        assert.equal(await page.evaluate(() => document.getElementById('sch-end-date').classList.contains('bad')), true);
        await page.fill('#sch-start-date', '');
        await page.click('#training-date-save'); await page.waitForTimeout(100);
        assert.match(await page.textContent('#sch-date-msg'), /^Pick both a start and an end date/, 'empty field → the right message');
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        await ctx.close();

        // ---- 5. counts → the three columns come back
        ({ page, ctx, errors } = await open(browser, { counts: true }));
        assert.equal(await page.evaluate(() => document.getElementById('sch-goals-box').classList.contains('zero')), false);
        assert.equal(await page.locator('#sch-goalbars .sch-bar').count(), 3);
        await ctx.close();

        // ---- 6. open-ended account
        ({ page, ctx, errors } = await open(browser, { open: true }));
        // V101.170: the note sits beside the Schedule title, on the same line; the week row keeps only ✎
        assert.equal(await page.locator('#sch-week .sch-day-note').count(), 0, 'no Day 13860 / 29220 and no note on the week row');
        const on = await page.evaluate(() => { const n = document.getElementById('sch-open-note'), h = document.querySelector('#scheduleModal .sch-modal-header h3');
            const cy = e => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; };
            return { text: n.textContent.trim(), shown: !n.hidden && getComputedStyle(n).display !== 'none', sameLine: Math.abs(cy(n) - cy(h)) <= 6, w: n.getBoundingClientRect().width }; });
        assert.ok(on.text === '🌐 Open-ended' && on.shown && on.sameLine && on.w > 20, 'open-ended note inline with the Schedule title: ' + JSON.stringify(on));
        assert.ok(await page.locator('#sch-week .sch-rg-edit').isVisible(), '✎ still on the week row');
        if (process.env.QA_SHOT) await page.locator('#scheduleModal .modal-content').screenshot({ path: process.env.QA_SHOT + '/sch-open.png' });
        await page.evaluate(() => schEditDates()); await page.waitForTimeout(150);
        assert.deepEqual(await st(), ['open', '🌐 Open-ended account · no 182-day limit']);
        assert.match(await page.textContent('#training-date-length'), /\w{3}, 8 Nov 1988 → \w{3}, 8 Nov 2068\s*29,220 days · ≈ 80 years/);
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        await ctx.close();
        console.log('PASS schedule-s1-qa');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
