// V102.324: Quiz Engine row 👥 — blue = PEOPLE who did the quiz (repeats once, dismissed attempts not at all), green = those
// of them inside their internship dates right now (hwIsActiveUser, the homework picker's "Active now"). Design A (two badges).
// The REAL admin.html in Chromium (network stubbed); the people map is built by the REAL lines from the quiz_attempts listener.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
const a = html.indexOf('                const people = {};'), b = html.indexOf('window.quizPeople = people;');
assert.ok(a > 0 && b > a, 'the people map is built in the quiz_attempts listener');
const peopleSrc = html.slice(a, b + 'window.quizPeople = people;'.length);
assert.ok(/usersData = s\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \}\)\);\s*renderQuizzes\(\);/.test(html), 'a users snapshot repaints the quiz rows (green badge reads usersData)');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:') || (process.env.QA_SHOT && /font-awesome|webfonts/.test(u))) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof renderQuizzesNow === 'function' && typeof window.hwIsActiveUser === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });

        await page.evaluate(src => {
            const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
            usersData = [
                { id: 'u1', displayName: 'In dates', startDate: d(-30), endDate: d(30) },
                { id: 'u2', displayName: 'Ended', startDate: d(-200), endDate: d(-10) },
                { id: 'u3', displayName: 'Open-ended', notAnInternship: true },
                { id: 'u4', displayName: 'Hidden', isIgnored: true, startDate: d(-30), endDate: d(30) },
                { id: 'u5', displayName: 'Dismissed only', startDate: d(-30), endDate: d(30) },
            ];
            const allAttempts = [
                { quizId: 'QA', userId: 'u1' }, { quizId: 'QA', userId: 'u1' },   // a repeat counts once
                { quizId: 'QA', userId: 'u2' }, { quizId: 'QA', userId: 'u3' }, { quizId: 'QA', userId: 'u4' },
                { quizId: 'QA', userId: 'u5', isDismissed: true },                  // dismissed = not counted
                { quizId: 'QB', userId: 'u2' },
            ];
            new Function('allAttempts', src)(allAttempts);
            const counts = {}; allAttempts.forEach(x => { counts[x.quizId] = (counts[x.quizId] || 0) + 1; }); window.quizCounts = counts;
            const far = { seconds: Math.floor(Date.now() / 1000) + 5 * 86400, toDate() { return new Date(this.seconds * 1000); } };
            quizzesData = [
                { id: 'QA', title: 'Quiz A', isActive: true, targetGroup: 'Public', questions: [], endTime: far },
                { id: 'QB', title: 'Quiz B', isActive: true, targetGroup: 'Public', questions: [], endTime: far },
                { id: 'QC', title: 'Quiz C', isActive: true, targetGroup: 'Public', questions: [], endTime: far },
            ];
            renderQuizzesNow();
        }, peopleSrc);

        const btn = id => `button[onclick*="showQuizParticipants('${id}')"]`;
        const read = id => page.$eval(btn(id), bt => ({ act: [...bt.querySelectorAll('.qa-n-act')].map(e => e.textContent), all: [...bt.querySelectorAll('.qa-n:not(.qa-n-act)')].map(e => e.textContent), title: bt.title, aria: bt.getAttribute('aria-label') }));
        assert.deepEqual(await page.evaluate(() => [window.quizPeople.QA.size, window.quizCounts.QA]), [4, 6], 'QA: 4 people (u1 once, u2, u3, u4; u5 dismissed) out of 6 attempts');
        const A = await read('QA');
        assert.deepEqual([A.act, A.all], [['2'], ['4']], 'QA: green 2 active now (u1 in dates, u3 open-ended), blue 4 people: ' + JSON.stringify(A));
        assert.ok(/4 people did it · 2 active now/.test(A.title) && /ทำแล้ว 4 คน · ยังฝึกอยู่ 2 คน/.test(A.title), 'tooltip EN + TH: ' + A.title);
        assert.equal(A.aria, 'Participants: 4 did it, 2 active now');
        const B = await read('QB');
        assert.deepEqual([B.act, B.all], [[], ['1']], 'QB: only an ended intern did it → blue 1, no green');
        assert.ok(/1 person did it · 0 active now/.test(B.title), 'singular + 0 active in the tooltip');
        const C = await read('QC');
        assert.deepEqual([C.act, C.all, C.aria], [[], [], 'Participants'], 'QC: nobody → no badges');
        // the Quiz Engine tab is hidden on load — show its ancestors, or every rect is 0×0 and the position check passes trivially
        await page.evaluate(() => { for (let a = document.getElementById('quizzesTableActive'); a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important'); });
        assert.ok(await page.$eval(btn('QA'), bt => bt.getBoundingClientRect().width > 20), 'the 👥 button is really on screen');
        const pos = await page.$eval(btn('QA'), bt => { const r = bt.getBoundingClientRect(), g = bt.querySelector('.qa-n-act').getBoundingClientRect(), u = bt.querySelector('.qa-n:not(.qa-n-act)').getBoundingClientRect();
            return { greenLeft: g.left < r.left + 4, blueRight: u.right > r.right - 4, greenBg: getComputedStyle(bt.querySelector('.qa-n-act')).backgroundColor, blueBg: getComputedStyle(bt.querySelector('.qa-n:not(.qa-n-act)')).backgroundColor }; });
        assert.deepEqual(pos, { greenLeft: true, blueRight: true, greenBg: 'rgb(22, 163, 74)', blueBg: 'rgb(67, 97, 238)' }, 'green top-left, blue top-right');
        // an intern whose internship ends drops out of green on the next users snapshot (no attempt change)
        await page.evaluate(() => { usersData = usersData.map(u => u.id === 'u1' ? { ...u, endDate: '2000-01-01' } : u); renderQuizzesNow(); });
        assert.deepEqual((await read('QA')).act, ['1'], 'green follows usersData');
        if (process.env.QA_SHOT) await page.locator('#quizzesTableActive').screenshot({ path: process.env.QA_SHOT + '/qa-row.png' });
        assert.deepEqual(errs, [], 'no page errors');
        console.log('quiz-row-active-done-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
