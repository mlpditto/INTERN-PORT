// V101.242: quiz answer review, B3 — a grid of question numbers (green right / red wrong) over ONE question card at a time; ▤ = the old long list.
// The REAL public/index.html (file://, network blocked, Firebase stubbed) with a 5-question attempt.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const run = async iso => {
            const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
            const page = await ctx.newPage();
            await page.clock.setFixedTime(new Date(iso));
            const errors = [], dialogs = []; page.on('pageerror', e => errors.push(e.message));
            page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
            await page.addInitScript(() => {
                window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0, increment: n => n } }) };
            });
            await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
            await page.goto(INDEX, { waitUntil: 'load' });
            await page.evaluate(() => {
                document.getElementById('main-app').style.setProperty('display', 'block', 'important');
                const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
                document.getElementById('kanban-content').style.display = 'block';
                if (typeof switchMissionTab === 'function') switchMissionTab('reflection');
                // a recording Firestore: adds are kept in window.__writes; a reflective log also lands in the caches, as the listener would
                window.__writes = []; window.__fail = {};
                const now = () => ({ toDate: () => new Date() });
                db.collection = name => ({
                    add: data => {
                        if (window.__fail[name]) return Promise.reject(new Error('offline'));
                        window.__writes.push([name, data]);
                        if (name === 'reflective_logs') { const log = { id: 'today', ...data, timestamp: now() }; reflectiveLogsCache = reflectiveLogsCache.concat([log]); window.myReflectiveLogsCache = (window.myReflectiveLogsCache || []).concat([log]); renderReflectiveLogs(); }
                        return Promise.resolve({ id: name + window.__writes.length });
                    },
                    doc: () => ({ update: () => Promise.resolve(), get: () => Promise.resolve({ exists: false, data: () => ({}) }), set: () => Promise.resolve() }),
                    where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }),
                });
                ensureFirebaseAuthReady = async () => ({ uid: 'auth-u1' });
                requireRegistered = () => true;
                tryDailyCheckin = () => {}; renderDailyCheckinCard = () => {}; awardEngagementBonusIfDue = () => {};
                userId = 'u1'; userProfile = { displayName: 'Intern A', pictureUrl: '' };
                reflectiveLogsCache = []; window.myReflectiveLogsCache = []; window.myLpEntriesCache = [];
                renderReflectiveLogs(); renderDRStatus();
            });
            await page.waitForTimeout(300);
    

            const quiz = n => ({ id: 'qb', title: 'Allergic Rhinitis-1', totalPoints: n, isActive: true, questions: Array.from({ length: n }, (_, i) => ({ type: 'choice', q: 'Question ' + (i + 1), options: ['A', 'B', 'C', 'D'], correct: [2, 1, 0, 0, 1][i], explanation: 'Because ' + (i + 1) })) });
            const open = async (n, answers) => { await page.evaluate(async ([qz, ans]) => { quizzesCache = [qz]; quizAttemptsCache = { qb: { quizId: 'qb', status: 'approved', answers: ans, totalQuestions: ans.length, correctCount: ans.filter((a, i) => a === qz.questions[i].correct).length, score: 3 } }; await viewQuizAnswers('qb'); }, [quiz(n), answers]); };
            const shown = () => page.evaluate(() => [...document.querySelectorAll('#quiz-result-container .qz-rv-card')].map(c => !c.hidden));
            await open(5, [2, 3, 0, 1, 1]);
            await page.locator('#quiz-result-container').screenshot({ path: process.env.QA_SHOT ? process.env.QA_SHOT + '/review-b3.png' : require('os').tmpdir() + '/review-b3.png' });
            const grid = await page.evaluate(() => [...document.querySelectorAll('#quiz-result-container .qz-rv-n')].map(b => b.className.replace('qz-rv-n ', '').trim() + ':' + b.textContent));
            assert.deepEqual(grid, ['ok:1', 'bad cur:2', 'ok:3', 'bad:4', 'ok:5', 'all:▤'], 'grid: green right, red wrong, the first wrong one is open: ' + grid);
            assert.deepEqual(await shown(), [false, true, false, false, false], 'only the first wrong question is shown');
            await page.click('#quiz-result-container .qz-rv-n[data-rv="3"]');
            assert.deepEqual(await shown(), [false, false, false, true, false], 'a number opens that question only');
            assert.match(await page.locator('#quiz-result-container .qz-rv-card:not([hidden])').innerText(), /Question 4[^]*Because 4/, 'the card keeps the question, the options and the explanation');
            assert.equal(await page.locator('.qz-rv-n.cur').getAttribute('data-rv'), '3');
            await page.click('#quiz-result-container .qz-rv-n.all');
            assert.deepEqual(await shown(), [true, true, true, true, true], '▤ = the whole list again');
            await open(5, [2, 1, 0, 0, 1]);
            assert.deepEqual(await shown(), [true, false, false, false, false], 'nothing wrong → starts on question 1');
            await open(2, [2, 3]);
            assert.equal(await page.locator('#quiz-result-container .qz-rv').count(), 0, 'a quiz of two questions keeps the plain list');
            assert.deepEqual(errors, [], 'no page errors');
            await ctx.close();
        };
        await run('2026-10-29T10:00:00+07:00');
        console.log('quiz-review-b3-qa: PASS');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
