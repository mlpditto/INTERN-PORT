// V101.290 (owner pick B, mockup-interrupted-card.html): an interrupted graded quiz card is one English pill in the title row —
// "⚠️ Q n/N  📨 Retry" (the tooltip / aria-label say it was stopped and the admin decides) + a thin bar — with no paragraph and no footer button. The REAL public/index.html
// (file://, network blocked, Firebase stubbed), driven through renderAssignments.
//   node scripts/quiz-interrupted-pill-qa.cjs   (SHOT=1 also saves qa-interrupted-pill.png)
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' })).newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', d => d.dismiss());
        await page.addInitScript(() => {
            const doc = () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), set: () => Promise.resolve(), update: () => Promise.resolve(), onSnapshot: () => () => {} });
            const q = () => ({ doc, where: q, orderBy: q, limit: q, get: () => Promise.resolve({ docs: [], size: 0, empty: true, forEach: () => {} }), onSnapshot: () => () => {}, add: () => Promise.resolve({ id: 'x' }) });
            window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: q }), { FieldValue: { serverTimestamp: () => 'TS', delete: () => 0, increment: n => n } }) };
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX, { waitUntil: 'load' });

        const card = (att) => page.evaluate((att) => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            userId = 'U1'; userProfile = { displayName: 'NATT' };
            const qs = Array.from({ length: 15 }, (_, i) => ({ type: 'choice', q: 'Q' + i, options: ['a', 'b'], correct: 0 }));
            quizzesCache = [{ id: 'eye2', title: 'Eye for all-2', quizType: 'standard', isActive: true, targetGroup: 'Public', questions: qs, deadline: { toDate: () => new Date(Date.now() + 3 * 864e5) } }];
            quizAttemptsCache = { eye2: Object.assign({ quizId: 'eye2', userId: 'U1', status: 'started' }, att) };
            window.__req = []; window.requestLateQuiz = (id, r) => window.__req.push([id, r]);
            renderAssignments();
            const pill = document.querySelector('.qz-intr');
            const c = pill && pill.closest('.assignment-card');
            for (let e = c; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).display === 'none') e.style.setProperty('display', 'block', 'important');   // the Mission tab may be hidden in the harness
            if (c) c.scrollIntoView();
            return pill ? { text: pill.innerText, label: pill.getAttribute('aria-label'), clipped: (t => t.scrollWidth > t.clientWidth + 0.5)(pill.querySelector('.t')), h: pill.getBoundingClientRect().height, bar: (document.querySelector('.qz-intr-bar i') || {}).style?.width, body: c.querySelector('.assign-body').getBoundingClientRect().height, foot: c.querySelector('.assign-footer').getBoundingClientRect().height, all: c.innerText, rows: Math.round(pill.getBoundingClientRect().height / 32), fits: pill.getBoundingClientRect().right <= pill.parentElement.getBoundingClientRect().right + 0.5 && pill.querySelector('b').getBoundingClientRect().right <= pill.getBoundingClientRect().right + 0.5 } : null;
        }, att);

        let r = await card({ currentStep: 3 });
        assert.ok(r, 'the pill renders');
        assert.equal(r.text.replace(/\s+/g, ' ').trim(), '⚠️ Q 4/15 📨 Retry');
        assert.equal(r.rows, 1, 'one line at 390 px'); assert.ok(r.fits, 'the button is never cut off'); assert.equal(r.clipped, false, 'Q n/N is not cut either'); assert.equal(r.label, 'Stopped at question 4 of 15 before submitting. Ask the admin to let you retry.'); assert.equal(r.bar, '20%');
        assert.equal(r.body, 0, 'no paragraph'); assert.equal(r.foot, 0, 'no footer button');
        assert.doesNotMatch(r.all, /หยุดกลางคัน|Interrupted|Request Retry/, 'said once, in English');
        if (process.env.SHOT) await page.locator('.qz-intr').evaluate(e => e.closest('.assignment-card')).then(() => page.locator('.assignment-card:has(.qz-intr)').screenshot({ path: 'qa-interrupted-pill.png' }));
        await page.click('.qz-intr');
        assert.deepEqual(await page.evaluate(() => __req), [['eye2', true]], 'the pill asks the admin (same request as before)');

        r = await card({});
        assert.match(r.text, /Q 1\/15/, 'no Next yet → Q 1'); assert.equal(r.bar, '0%');

        assert.deepEqual(errors, [], 'no page errors');
        console.log('PASS quiz-interrupted-pill-qa');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
