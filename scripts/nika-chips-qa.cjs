// V101.305 (owner: "chips should follow the user's activity, e.g. quiz questions answered wrong" · "passed quizzes only") — the Nika chips show up to
// three questions the intern got wrong, newest quiz first, only from quizzes with score > 0 (the View Answers rule that opens the key), single-answer
// choice / flashcard only; tapping one asks "stem → right answer". Failed quizzes, practice and polls never show; the samples fill the rest.
// The REAL index.html + nika-ask.js on a 390 px phone, stubbed callable. OUTDIR=… saves a shot.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const SAMPLES = ['Amlodipine: what to monitor?', 'Atorvastatin side effects', 'Agomelatine mechanism'];

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            window.__asked = [];
            window.firebase = { functions: () => ({ httpsCallable: () => d => { window.__asked.push(d); return Promise.resolve({ data: d.peek ? { left: 10 } : { left: 9, answer: 'ok', sources: [] } }); } }), firestore: { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } } };
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX, { waitUntil: 'load' });
        const ch = () => page.evaluate(() => [...document.querySelectorAll('#nika-section-content .nk-chip')].map(b => (b.classList.contains('nk-wrong') ? 'W:' : '') + b.textContent));
        const nika = () => page.evaluate(() => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            let n = document.getElementById('dd-codex-card');
            for (; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).display === 'none') n.style.setProperty('display', 'block', 'important');
            document.getElementById('dd-section-content').style.display = 'block';
            window.ensureFirebaseAuthReady = async () => ({ uid: 'a' });
            document.querySelector('[data-ddtype="nika"]').click();
        }).then(() => page.waitForTimeout(250));

        // 1. no quizzes yet → the three samples
        await nika();
        assert.deepEqual(await ch(), SAMPLES, 'no activity: samples');

        // 2. a passed quiz (2 wrong + 1 right + 1 multi-answer skipped), a newer failed quiz (key still closed), practice + poll
        await page.evaluate(() => {
            const ts = s => ({ toMillis: () => s });
            const Q = (q, options, correct, type) => ({ q, options, correct, type });
            quizzesCache = [
                { id: 'pass', totalPoints: 1, questions: [Q('<p>Amlodipine: the most common side effect?</p>', ['Cough', 'Bradycardia', 'Ankle oedema'], 2), Q('Statin: check?', ['LFT', 'CBC'], 0), Q('Pick two', ['a', 'b', 'c'], [0, 1]), Q('Warfarin antidote?', ['Vitamin K', 'Protamine'], 0, 'flashcard')] },
                { id: 'fail', totalPoints: 1, questions: [Q('Digoxin toxicity sign?', ['Yellow vision', 'Rash'], 0)] },
                { id: 'prac', totalPoints: 1, questions: [Q('Practice only?', ['x', 'y'], 0)] },
                { id: 'poll', totalPoints: 1, isPoll: true, questions: [Q('Poll?', ['x', 'y'], 0)] }];
            quizAttemptsCache = {
                pass: { quizId: 'pass', answers: [0, 0, '0\n---\n2', null], correctCount: 1, totalQuestions: 4, status: 'approved', timestamp: ts(100) },
                fail: { quizId: 'fail', answers: [1], correctCount: 0, totalQuestions: 1, status: 'pending', timestamp: ts(200) },
                prac: { quizId: 'prac', answers: [1], isPractice: true, correctCount: 0, totalQuestions: 1, timestamp: ts(300) },
                poll: { quizId: 'poll', answers: [1], isPoll: true, correctCount: 1, totalQuestions: 1, timestamp: ts(300) } };
        });
        await nika();
        assert.deepEqual(await ch(), ['W:❌ Amlodipine: the most common side effect?', 'W:❌ Warfarin antidote?', SAMPLES[0]],
            'wrong answers from the passed quiz only (HTML stripped, multi-answer skipped), then a sample');
        const fit = await page.evaluate(() => { const b = document.querySelector('.nk-chip.nk-wrong'), r = b.getBoundingClientRect(), box = document.querySelector('.nk-row').getBoundingClientRect();   // V101.308: .nk-chips is display: contents inside .nk-row
            return { title: b.title, oneLine: r.height < 40, inside: r.right <= box.right + 1 }; });
        assert.deepEqual(fit, { title: 'Amlodipine: the most common side effect?', oneLine: true, inside: true }, 'one line, cut inside the row, full stem in the title: ' + JSON.stringify(fit));
        if (process.env.OUTDIR) await page.locator('#dd-codex-card').screenshot({ path: process.env.OUTDIR + '/nika-chips.png' });

        // 3. tap → asks the stem with the right answer
        await page.click('.nk-chip.nk-wrong');
        await page.waitForTimeout(200);
        const last = await page.evaluate(() => window.__asked.filter(d => !d.peek).pop());
        assert.deepEqual(last, { question: 'Amlodipine: the most common side effect? → Ankle oedema' }, 'asks stem → key: ' + JSON.stringify(last));

        // 4. many wrong answers → at most three chips, newest quiz first
        await page.evaluate(() => {
            quizzesCache.push({ id: 'new', totalPoints: 1, questions: [{ q: 'Metformin max dose?', options: ['2550 mg', '500 mg'], correct: 0 }, { q: 'ACEI cough cause?', options: ['Bradykinin', 'Histamine'], correct: 0 }] });
            quizAttemptsCache.new = { quizId: 'new', answers: [1, 1], correctCount: 1, totalQuestions: 2, status: 'approved', timestamp: { toMillis: () => 500 } };
        });
        await nika();
        assert.deepEqual(await ch(), ['W:❌ Metformin max dose?', 'W:❌ ACEI cough cause?', 'W:❌ Amlodipine: the most common side effect?'], 'newest first, three at most');
        assert.deepEqual(errors.filter(e => !/firebase.(firestore|auth) is not a function/.test(e)), [], 'no Nika errors: ' + errors);
        console.log('PASS: Nika chips from activity (V101.305) — wrong answers from passed quizzes only (newest first, ≤3, single-answer), tap asks stem → key, samples fill the rest');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
