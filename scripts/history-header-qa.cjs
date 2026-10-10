// V101.92: the home accordion that holds History is titled "History" (it was "Work 워크" over a second "History" title) and its header carries the totals — also while it is
// folded. Inside, the duplicate title + totals are hidden; only the adjustments chip stays. The REAL public/index.html + history-lean/compact on a touch phone
// (file://, network blocked, Firebase stubbed). SHOT=<dir> writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(!/<i class="fa-solid fa-upload"><\/i> Work/.test(idx), 'no "Work" title on the history accordion');
assert.ok(idx.includes('id="work-section-sum"'), 'summary host in the header');

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
        // data arrives while the accordion is FOLDED (as in the real app: the listeners call renderUnifiedHistory regardless)
        await page.evaluate(() => {
            const D = n => new Date(Date.now() - n * 86400000), ts = n => ({ toMillis: () => D(n).getTime(), toDate: () => D(n) });
            const mk = (id, type, title, n, score) => ({ id, submissionType: type, title, timestamp: ts(n), status: 'approved', score, metadata: {} });
            unifiedSubmissionsCache = [mk('q1', 'quiz', 'Allergic Rhinitis-2', 33, 1.2), mk('q2', 'quiz', 'CASP Checklist', 35, 0.6), mk('w1', 'work', 'A work item', 36, 0.5)];
            getUnifiedAllItems = () => unifiedSubmissionsCache; unifiedRenderedCount = 50;
            window.getReflectiveStreak = () => ({ current: 5, longest: 9 });
            try { renderUnifiedHistory(); } catch (e) { if (!/firebase\./.test(e.message)) throw e; }
        });
        await page.waitForTimeout(400);
        assert.equal(await page.evaluate(() => document.getElementById('work-section-content').style.display), 'none', 'folded');

        const hdr = async () => page.evaluate(() => {
            const h = document.querySelector('#section-general-work .gl-minimal-header'), title = h.querySelector('h4'), sum = document.getElementById('work-section-sum'), chev = document.getElementById('work-section-icon');
            const r = h.getBoundingClientRect(), t = title.getBoundingClientRect(), s = sum.getBoundingClientRect(), c = chev.getBoundingClientRect();
            return { title: title.textContent.replace(/\s+/g, ' ').trim(), icon: title.querySelector('i').className, sum: sum.textContent.replace(/\s+/g, ' ').trim(), sumHtml: sum.innerHTML,
                h: Math.round(r.height), oneLine: Math.abs(t.top - s.top) < 20 && Math.abs(t.top - c.top) < 20, noOverlap: t.right <= s.left + 1 && s.right <= c.left + 1, inside: r.right >= c.right && s.left >= r.left, overflow: h.scrollWidth - h.clientWidth };
        });
        let r = await hdr();
        assert.ok(/^History/.test(r.title) && !/Work/.test(r.title) && r.icon.includes('fa-clock-rotate-left'), 'header reads History with the history icon: ' + JSON.stringify(r.title));
        assert.ok(/2\.3\s*pt/.test(r.sum) && r.sum.includes('🪙') && r.sum.includes('🔥'), 'totals (pt · 🪙 · 🔥) are in the header while folded: ' + r.sum);
        assert.ok(r.oneLine && r.noOverlap && r.inside && r.overflow <= 0 && r.h <= 56, 'one line, nothing overlaps or overflows: ' + JSON.stringify(r));
        for (const w of [363, 340]) {
            await page.setViewportSize({ width: w, height: 900 });
            await page.waitForTimeout(200);
            const x = await hdr();
            assert.ok(x.oneLine && x.noOverlap && x.overflow <= 0, 'header fits @' + w + ': ' + JSON.stringify(x));
        }
        await page.setViewportSize({ width: 390, height: 900 });

        // the totals follow the filter (they were the inner summary's numbers, now mirrored)
        await page.evaluate(() => filterUnifiedHistory('work'));
        await page.waitForTimeout(250);
        r = await hdr();
        assert.ok(/0\.5\s*pt/.test(r.sum), 'header totals follow the active filter: ' + r.sum);
        await page.evaluate(() => filterUnifiedHistory('all'));

        // open: no second "History" title, no second copy of the totals; the adjustments chip is still there
        await page.locator('#section-general-work .gl-minimal-header').click();
        await page.waitForTimeout(400);
        const inner = await page.evaluate(() => {
            const pane = document.getElementById('work-pane-history'), vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
            return { open: document.getElementById('work-section-content').style.display === 'block', h3: vis(pane.querySelector('.lr-header > h3')), sum: vis(pane.querySelector('.lr-header > .hc-summary')), chip: vis(document.getElementById('history-adjustments')), rail: vis(document.getElementById('unified-type-filters')), rows: pane.querySelectorAll('.hl-row').length, rotate: document.getElementById('work-section-icon').style.transform };
        });
        assert.ok(inner.open && !inner.h3 && !inner.sum, 'inside: the duplicate title and totals are hidden: ' + JSON.stringify(inner));
        assert.ok(inner.chip && inner.rail && inner.rows === 3 && /180/.test(inner.rotate), 'adjustments chip, chip rail and rows are still there; chevron turned: ' + JSON.stringify(inner));
        // folding again keeps the totals in the header
        await page.locator('#section-general-work .gl-minimal-header').click();
        await page.waitForTimeout(250);
        assert.equal(await page.evaluate(() => document.getElementById('work-section-content').style.display), 'none');
        assert.ok(/pt/.test((await hdr()).sum), 'totals stay when folded again');
        if (process.env.SHOT) {
            for (const open of [false, true]) {
                if (open) { await page.locator('#section-general-work .gl-minimal-header').click(); await page.waitForTimeout(400); }
                const b = await page.evaluate(() => { const e = document.getElementById('section-general-work').getBoundingClientRect(); return { x: e.x, y: e.y, w: e.width, h: e.height }; });
                await page.screenshot({ path: path.join(process.env.SHOT, `history_header_${open ? 'open' : 'folded'}.png`), clip: { x: Math.max(0, b.x - 4), y: b.y - 4, width: b.w + 8, height: Math.min(b.h + 8, 700) } });
            }
        }
        assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], 'no page errors');
        await ctx.close();
        console.log('PASS: History accordion — header reads History + totals (🔥 · pt · 🪙, live, also folded, follows the filter), one line at 390/363/340, no duplicate title/totals inside, chip + rail + rows intact');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
