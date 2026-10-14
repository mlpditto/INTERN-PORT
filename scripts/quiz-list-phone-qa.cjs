// V102.230 — Quiz Engine list on a phone: each row is a card (title full width, chips on one line, metrics + actions below), Live rows tinted green.
// Real admin.html + the real renderQuizzesNow with fixture quizzes; ≤480px gets the card rules, 1200px must be untouched.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        for (const vw of [390, 1200]) {
            const phone = vw <= 480;
            const page = await browser.newPage({ viewport: { width: vw, height: 900 } });
            await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
            await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
            await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
            const r = await page.evaluate(() => {
                const mk = (id, o) => Object.assign({ id, title: 'Quiz ' + id, shortTitle: 'Short ' + id, isActive: false, questions: Array.from({ length: 15 }, () => ({ q: 'x', options: ['a', 'b'], correct: 0 })), tags: 'Diabetes', translations: { th: {} } }, o);
                const list = [
                    mk('live1', { title: 'แนวทางวิเคราะห์การแข่งขันอุตสาหกรรมร้านยา และการปรับตัวของร้านยาชุมชน', isActive: true, __d: Date.now() + 4 * 864e5 }),
                    mk('p1', { title: 'Hypertension — first-line agents and when to step up therapy' }),
                    mk('t1', { title: 'Template: Case discussion', isTemplate: true }),
                ];
                list.forEach((x, i) => { x.__c = 1000 + i; x.createdAt = { toMillis: () => x.__c, toDate: () => new Date(x.__c), seconds: x.__c }; if (x.__d != null) x.deadline = { toDate: () => new Date(x.__d), toMillis: () => x.__d }; });
                window.quizzesData = list;
                try { renderQuizzesNow(); } catch (e) { return { err: String(e && e.message || e) }; }
                // the tab / sections can be display:none in this bare page — make the two tables measurable without touching their own rules
                for (let n = document.getElementById('quizzesTableActive'); n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).display === 'none') n.style.display = 'block';
                for (let n = document.getElementById('quizzesTableInactive'); n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).display === 'none') n.style.display = 'block';
                const cs = (el, p) => getComputedStyle(el)[p];
                const liveRow = document.querySelector('#quizzesTableActive tbody tr'), pausedRow = document.querySelector('#quizzesTableInactive tbody tr:not([style*="pointer-events"])');
                const t = liveRow.querySelector('.qa-title').getBoundingClientRect(), l2 = liveRow.querySelector('.qa-l2').getBoundingClientRect();
                return {
                    theadA: cs(document.querySelector('#quizzesTableActive thead'), 'display'), theadI: cs(document.querySelector('#quizzesTableInactive thead'), 'display'),
                    titleW: Math.round(t.width), titleRight: Math.round(t.right), docW: document.documentElement.clientWidth,
                    l2H: Math.round(l2.height), shDisplay: cs(liveRow.querySelector('.qa-sh'), 'display'), emDisplay: cs(liveRow.querySelector('.qa-met em'), 'display'),
                    metDisplay: cs(liveRow.querySelector('td.qa-met'), 'display'), liveBg: cs(liveRow, 'backgroundColor'), pausedBg: cs(pausedRow, 'backgroundColor'),
                    rowsLive: document.querySelectorAll('#quizzesTableActive tbody tr').length, rowsPaused: document.querySelectorAll('#quizzesTableInactive tbody tr:not([style*="pointer-events"])').length,
                    clamp: cs(liveRow.querySelector('.qa-title'), 'webkitLineClamp'),
                };
            });
            assert.ok(!r.err, 'renderQuizzesNow threw: ' + r.err);
            assert.equal(r.rowsLive, 1, 'one live row'); assert.equal(r.rowsPaused, 2, 'paused + template rows');
            if (phone) {
                assert.equal(r.theadA, 'none', 'phone: header row hidden (Live)'); assert.equal(r.theadI, 'none', 'phone: header row hidden (Inactive)');
                assert.ok(r.titleW >= 140, 'phone: the title keeps a readable width, not vertical letters: ' + r.titleW);
                assert.ok(r.titleRight <= r.docW, 'phone: the title stays inside the screen: ' + r.titleRight + ' vs ' + r.docW);
                assert.equal(r.clamp, '2', 'phone: title clamps to 2 lines');
                assert.ok(r.l2H < 50, 'phone: chips stay on one line: ' + r.l2H);
                assert.equal(r.shDisplay, 'none', 'phone: short title hidden'); assert.equal(r.emDisplay, 'none', 'phone: "items"/"pts" words hidden'); assert.equal(r.metDisplay, 'block', 'phone: items · pts shown on the card');
                assert.equal(r.liveBg, 'rgb(236, 253, 243)', 'phone: Live row is green-tinted: ' + r.liveBg); assert.notEqual(r.pausedBg, 'rgb(236, 253, 243)', 'phone: paused row is not tinted');
            } else {
                assert.notEqual(r.theadA, 'none', 'desktop: header row still there'); assert.notEqual(r.shDisplay, 'none', 'desktop: short title still shown');
                assert.notEqual(r.emDisplay, 'none', 'desktop: "items"/"pts" words still shown'); assert.notEqual(r.liveBg, 'rgb(236, 253, 243)', 'desktop: no green tint (phone only)');
            }
            await page.close();
        }
        console.log('PASS: Quiz list on a phone — card rows (title ≥140px, 2-line clamp, chips on one line, items · pts + actions below), Live row green-tinted, header rows hidden; desktop 1200px unchanged');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
