// V101.89: History ▸ expanded row ▸ 🗑 ▸ "Request delete". The reason form used to FLOAT (position:absolute, 230px) under the 🗑 and was cut off by the Work card's
// overflow:hidden when the row sat near the bottom — the select / Send were unreachable. It now opens IN the row's flow (the row grows, nothing clipped).
// The REAL public/index.html + history-compact.css + delete-requests.js/css on a touch phone (file://, network blocked, Firebase stubbed).
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const css = fs.readFileSync('public/history-compact.css', 'utf8');
assert.ok(/\.dr-menu\[open\][^{]*\{[^}]*flex:\s*1 1 100%/.test(css) && /\.dr-menu\[open\] > \.dr-body\s*\{[^}]*position:\s*static/.test(css), 'history-compact.css opens the 🗑 form in flow');

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
        await page.setViewportSize({ width: 390, height: 900 });
        await page.evaluate(() => {
            const D = n => new Date(Date.now() - n * 86400000), ts = n => ({ toMillis: () => D(n).getTime(), toDate: () => D(n) });
            const mk = (id, title, n, score) => ({ id, submissionType: 'quiz', title, timestamp: ts(n), status: 'approved', score, metadata: {} });
            unifiedSubmissionsCache = [mk('q1', 'Allergic Rhinitis-2', 33, 1.2), mk('q2', 'CASP Checklist', 35, 0.6), mk('q3', 'Quiz แบบทดสอบ', 36, 0.7), mk('q4', 'A, AN, THE', 37, 0)];
            getUnifiedAllItems = () => unifiedSubmissionsCache; unifiedRenderedCount = 50;
            document.getElementById('work-section-content').style.display = 'block';   // the real accordion: its card is overflow:hidden
            try { switchWorkTab('history'); } catch (e) { /* intern view has no tab bar */ }
            const w = document.getElementById('work-pane-history'); w.style.display = 'block'; w.classList.add('active');
            try { renderUnifiedHistory(); } catch (e) { if (!/firebase\./.test(e.message)) throw e; }
            mountDeleteMenus();
        });
        await page.waitForTimeout(400);
        const rows = await page.locator('.hl-row').count();
        assert.equal(rows, 4, 'four sample rows');
        // the LAST row is the worst case: the form has nowhere to float to
        await page.locator('.hl-row').last().click();
        await page.waitForTimeout(250);
        const before = await page.evaluate(() => { const c = document.querySelector('#section-general-work > .card'); return Math.round(c.getBoundingClientRect().height); });
        await page.locator('.hl-row').last().locator('.dr-menu > summary').click();
        await page.locator('.hl-row').last().locator('.dr-start').click();
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => {
            const menu = document.querySelector('.dr-menu[open]'), body = menu.querySelector('.dr-body'), card = document.querySelector('#section-general-work > .card');
            const br = body.getBoundingClientRect(), cr = card.getBoundingClientRect(), row = menu.closest('.hl-row').getBoundingClientRect();
            const pos = getComputedStyle(body).position;
            const parts = ['select', 'input:not([hidden])', '.dr-send'].map(s => body.querySelector(s)).filter(Boolean).map(e => e.getBoundingClientRect());
            const send = body.querySelector('.dr-send').getBoundingClientRect();
            return { pos, bodyBottom: Math.round(br.bottom), cardBottom: Math.round(cr.bottom), insideCard: br.bottom <= cr.bottom + 1, insideRow: br.bottom <= row.bottom + 1, sendTop: Math.round(send.top), sendBottom: Math.round(send.bottom), sendVisible: send.bottom <= cr.bottom + 1, sendH: Math.round(send.height), cardH: Math.round(cr.height), leftOk: br.left >= cr.left && br.right <= cr.right, formVisible: !body.querySelector('.dr-form').hidden };
        });
        assert.equal(r.pos, 'static', 'the form is in flow: ' + JSON.stringify(r));
        assert.ok(r.formVisible && r.insideCard && r.insideRow && r.sendVisible && r.leftOk, 'form + Send are inside the row and the card, not clipped: ' + JSON.stringify(r));
        assert.ok(r.sendH >= 44, 'Send is a 44px target');
        assert.ok(r.cardH > before, 'the card grew to hold the form (' + before + ' → ' + r.cardH + ')');
        // the 🗑 circle stays on the action bar line; closing the menu gives the space back
        await page.locator('.hl-row').last().locator('.dr-menu > summary').click();
        await page.waitForTimeout(200);
        const after = await page.evaluate(() => Math.round(document.querySelector('#section-general-work > .card').getBoundingClientRect().height));
        assert.ok(after <= before + 1, 'closing returns the space: ' + before + ' / ' + after);
        // a row in the MIDDLE behaves the same (no floating overlap onto the next row)
        await page.locator('.hl-row').nth(1).click();
        await page.locator('.hl-row').nth(1).locator('.dr-menu > summary').click();
        await page.locator('.hl-row').nth(1).locator('.dr-start').click();
        await page.waitForTimeout(250);
        const mid = await page.evaluate(() => { const rows = [...document.querySelectorAll('.hl-row')], a = rows[1].getBoundingClientRect(), b = rows[2].getBoundingClientRect(), body = rows[1].querySelector('.dr-body').getBoundingClientRect(); return { overlap: body.bottom > b.top + 1, rowBottom: Math.round(a.bottom), nextTop: Math.round(b.top) }; });
        assert.ok(!mid.overlap, 'the form does not cover the next row: ' + JSON.stringify(mid));
        assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], 'no page errors');
        await ctx.close();
        console.log('PASS: History 🗑 Request delete — the reason form opens in the row (in flow), never clipped by the card, Send reachable, space returned on close, next row not covered');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
