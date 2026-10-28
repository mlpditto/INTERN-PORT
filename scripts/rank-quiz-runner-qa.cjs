// V101.222 — the "Rank" question in the REAL public/index.html runner on a phone (file://, network blocked, Firebase stubbed):
// type → lock → options (shuffled) → tap order → lock → ★ reveal with the key, self-match for an unmatched answer, answered-state, saved parts, grading + review wiring.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const src = fs.readFileSync('public/index.html', 'utf8');
assert.ok(/<script defer src="rank-quiz\.js\?v=V101\.\d+"><\/script>/.test(src), 'rank-quiz.js is loaded');
assert.ok(src.includes("qType === 'rank'") && src.includes('window.RankQuiz.valid(q)) correctCount += window.RankQuiz.score(q, mine).credit'), 'submitQuiz grades Rank with the shared scorer, and only when the question is valid');
assert.ok(/\(q\.type \|\| 'choice'\) === 'rank' && q\.options && q\.options\.length > 1\) \{[^}]*full shuffle/.test(src), 'Rank options are always fully shuffled');
assert.ok(src.includes("const isRank = question.type === 'rank'") && src.includes('rankKeyRows(question, question.options'), 'the answer review knows Rank');

const RANK = { type: 'rank', q: 'ผู้ป่วยหอบกำเริบ ยาตัวแรกที่ควรให้?', accepted: ['salbutamol', 'albuterol'], options: ['Salbutamol พ่น', 'Ipratropium พ่น', 'Prednisolone กิน', 'Theophylline'], tiers: [0, 1, 1, 2], unsafe: [0, 0, 0, 0], why: ['Fast relief', 'Add-on', 'Needed, not first', 'Narrow window'] };
const CH = { type: 'choice', q: 'Plain choice', options: ['a', 'b'], correct: [0] };
const QUIZ = { id: 'QR', title: 'Asthma', shortTitle: 'Asthma', quizType: 'standard', totalPoints: 3, questions: [CH, RANK, { ...RANK, accepted: ['zzz'] }] };

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => { const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any }); window.firebase = any; });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX); await page.waitForTimeout(600);
        await page.evaluate(([qz]) => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            qtBackgroundTranslate = () => {}; try { localStorage.removeItem('qt_selected_lang'); } catch (_) {}
            window.__saved = []; saveQuizProgress = p => window.__saved.push(p); userId = 'u1';
            currentQuiz = qz; isPracticeMode = false; userAnswers = qz.questions.map(() => null);
            shuffleMap = qz.questions.map(() => null); shuffleMap[1] = [3, 1, 0, 2]; shuffleMap[2] = [2, 0, 3, 1];
            currentStep = 1; document.getElementById('quizModal').style.display = 'flex'; renderQuizStep(false); clearInterval(quizTimerInterval);
        }, [QUIZ]);
        const st = () => page.evaluate(() => ({ ua: userAnswers[currentStep], badge: document.getElementById('quiz-q-type-badge').textContent, answered: [0, 1, 2].map(quizStepIsAnswered), saved: window.__saved.length,
            opts: [...document.querySelectorAll('#quiz-run-container .rk-opt')].map(b => b.textContent.replace(/^\d*/, '').trim()), nums: [...document.querySelectorAll('#quiz-run-container .rk-opt .n')].map(n => n.textContent) }));

        // 1 · type phase: input only, lock waits for text, no options yet
        let s = await st();
        assert.equal(s.badge, 'RANK'); assert.deepEqual(s.opts, [], 'no options before the typed answer is locked');
        assert.equal(await page.locator('#rk-typed').count(), 1); assert.equal(await page.locator('#rk-lock').isDisabled(), true);
        await page.fill('#rk-typed', 'albuterol'); assert.equal(await page.locator('#rk-lock').isDisabled(), false);
        assert.deepEqual(s.answered, [false, false, false]);
        await page.click('#rk-lock');

        // 2 · rank phase: the typed answer is locked in a chip, the options come in the SHUFFLED order, tapping numbers them
        s = await st();
        assert.deepEqual(s.ua, ['albuterol']); assert.equal(await page.locator('.rk-mine').textContent(), '🔒 Your answer: albuterol');
        assert.deepEqual(s.opts, ['Theophylline', 'Ipratropium พ่น', 'Salbutamol พ่น', 'Prednisolone กิน'], 'display order = shuffleMap, not the author order');
        assert.equal(s.saved, 1, 'locking the typed answer saves progress'); assert.deepEqual(s.answered, [false, false, false], 'not answered until the ranking is locked');
        assert.equal(await page.locator('.rk-go').isDisabled(), true);
        const tap = t => page.locator('.rk-opt', { hasText: t }).click();
        await tap('Salbutamol'); await tap('Prednisolone'); await tap('Theophylline');
        assert.equal(await page.locator('.rk-go').isDisabled(), true, 'needs every option ranked');
        await tap('Ipratropium');
        s = await st(); assert.deepEqual(s.nums.map(Number), [3, 4, 1, 2], 'numbers follow the tap order (display order Theo, Ipra, Salb, Pred)');
        await tap('Ipratropium'); s = await st(); assert.equal(s.nums.filter(Boolean).length, 3, 'tapping a ranked option un-ranks it');
        await page.click('.rk-reset'); s = await st(); assert.equal(s.nums.filter(Boolean).length, 0, 'Reset clears the taps');
        await tap('Salbutamol'); await tap('Prednisolone'); await tap('Theophylline'); await tap('Ipratropium');
        await page.click('.rk-go');

        // 3 · reveal: order 0,2,3,1 → 92% → ★4; the key best tier first, "you #n" red where a pair is wrong; stored as the joined parts
        s = await st();
        assert.deepEqual(s.ua, ['albuterol', '0,2,3,1']); assert.deepEqual(s.answered, [false, true, false]); assert.equal(s.saved, 2);
        const rv = await page.evaluate(() => ({ filled: document.querySelector('.rk-star b').firstChild.textContent, all: document.querySelector('.rk-star b').textContent,
            rows: [...document.querySelectorAll('.rk-key')].map(r => r.querySelector('.t').textContent + '|' + r.querySelector('.me').textContent + (r.querySelector('.me.bad') ? '!' : '')),
            pts: document.querySelector('.rk-rew').textContent, chip: (document.querySelector('.rk-chip') || {}).textContent, ask: !!document.querySelector('.rk-ask'), note: document.querySelector('.rk-note').textContent, warn: !!document.querySelector('.rk-warn') }));
        assert.equal(rv.filled, '★★★★'); assert.equal(rv.all, '★★★★★', 'four lit + one dim');
        assert.deepEqual(rv.rows, ['Best|you #1', 'OK|you #4!', 'OK|you #2', 'Avoid|you #3!']);
        assert.match(rv.pts, /🎯 \+0\.92 pts/, 'credit 0.92 × (3 pts ÷ 3 questions)');
        assert.match(rv.chip, /matched the best answer/); assert.equal(rv.ask, false); assert.match(rv.note, /Typed answer ✓ · Best first ✓ · 4\/5 pairs in order/); assert.equal(rv.warn, false);
        if (process.env.QA_SHOT) await page.screenshot({ path: process.env.QA_SHOT + '/rank-runner-reveal.png' });

        // 4 · the other question: a typed answer that matches nothing → asked which option it meant; the tap changes the result and is stored
        await page.evaluate(() => { currentStep = 2; renderQuizStep(false); clearInterval(quizTimerInterval); });
        await page.fill('#rk-typed', 'ยาพ่นอะไรสักอย่าง'); await page.click('#rk-lock');
        await tap('Salbutamol'); await tap('Ipratropium'); await tap('Prednisolone'); await tap('Theophylline'); await page.click('.rk-go');
        assert.equal(await page.locator('.rk-ask').count(), 1, 'unmatched typed answer → "Did your answer mean one of these?"');
        const before = await page.evaluate(() => document.querySelector('.rk-star b').firstChild.textContent);
        await page.locator('.rk-ask button', { hasText: 'Salbutamol' }).click();
        s = await st(); assert.deepEqual(s.ua, ['ยาพ่นอะไรสักอย่าง', '0,1,2,3', 'm:0'], 'self-match stored as the third part');
        assert.equal(await page.locator('.rk-ask').count(), 0); assert.match(await page.locator('.rk-chip.soft').textContent(), /≈ Salbutamol/);
        const after = await page.evaluate(() => document.querySelector('.rk-star b').firstChild.textContent);
        assert.ok(after.length >= String(before).length, 'the self-match counts toward the typed part'); assert.deepEqual(s.answered, [false, true, true]);

        // 5 · what the attempt stores is what the scorer reads back (the joined string)
        const back = await page.evaluate(() => { const a = userAnswers.map(x => Array.isArray(x) ? x.join('\n---\n') : x); return [RankQuiz.score(currentQuiz.questions[1], a[1]).stars, RankQuiz.score(currentQuiz.questions[2], a[2]).stars]; });
        assert.deepEqual(back, [4, 5], 'joined answers re-score identically (Q2: perfect order + self-matched best answer = ★5)');

        const mine = errors.filter(e => /rank|Rank|rk[A-Z]/.test(e)); assert.deepEqual(mine, [], 'no Rank errors: ' + mine.join(' | '));
        console.log('PASS: Rank question in the intern runner — typed answer locks, options shuffled, tap order + reset, ★ reveal with tier key and red misplaced, self-match, answered state, saved parts');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
