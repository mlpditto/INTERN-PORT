// V101.243 / V102.502: practice quizzes — admin ticks "🎓 Practice — answer after each question" (quiz.instantAnswer); on each choice
// question with a key the intern presses ✓ Check: the choice locks, the key turns green (✓), a wrong pick red (✗), the explanation shows,
// and the question's own clock stops. Without the flag nothing changes. Scoring is untouched.
// The REAL public/index.html (file://, network blocked, Firebase stubbed), driven through renderQuizStep / handleChoiceChange.
//   node scripts/practice-instant-answer-qa.cjs
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

// admin: the chip, loaded / reset / saved on both write paths
const admin = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(admin.includes('<input type="checkbox" id="quiz-instant-answer"> <span>Practice</span>'), 'admin chip');
assert.ok(admin.includes("ia.checked = q.instantAnswer === true;"), 'admin loads the flag');
assert.ok(admin.includes("ia.checked = false;"), 'a new quiz starts with it off');
assert.ok(/const instantAnswer = document\.getElementById\('quiz-instant-answer'\)\?\.checked \|\| false;/.test(admin) && /partialCredit, instantAnswer, notifyGroup/.test(admin), 'admin reads it into the form data');
assert.ok(admin.includes('instantAnswer: formData.instantAnswer === true,'), 'admin writes it to the quiz doc');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', d => d.dismiss());
        await page.addInitScript(() => {
            window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0, increment: n => n } }) };
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX, { waitUntil: 'load' });

        // open a quiz run directly (runQuiz needs Firestore + dialogs); shuffle off so display order = original order
        const start = (flag) => page.evaluate((flag) => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            currentQuiz = { id: 'qp', title: 'Practice set', instantAnswer: flag, timerMode: 'per_question', questions: [
                { type: 'choice', q: 'Single', options: ['A', 'B', 'C', 'D'], correct: 2, explanation: 'Because C', timer: 60 },
                { type: 'choice', q: 'Multi', options: ['A', 'B', 'C', 'D'], correct: [0, 3], timer: 60 },
                { type: 'choice', q: 'Survey (no key)', options: ['Yes', 'No'], timer: 60 },
                { type: 'flashcard', q: 'Flash', options: ['True', 'False'], correct: 0, timer: 60 }
            ] };
            isPracticeMode = false; currentStep = 0; shuffleMap = []; primerSeen = []; answerChecked = [];
            userAnswers = new Array(4).fill(null); stepTimeRemaining = new Array(4).fill(null); durationsPerQuestion = new Array(4).fill(0); accumulatedTime = 0;
            document.getElementById('quizModal').style.display = 'flex';
            renderQuizStep();
        }, flag);
        const ui = () => page.evaluate(() => {
            const c = document.getElementById('quiz-run-container'), b = document.getElementById('qz-check'), v = c.querySelector('.qz-verdict');
            return {
                check: b ? (b.disabled ? 'disabled' : 'on') : 'none', verdict: v ? v.innerText : '',
                marks: [...c.querySelectorAll('.qt-choice-list label')].map(l => (l.querySelector('.qz-mark') || {}).textContent || '.').join(''),
                locked: [...c.querySelectorAll('.qt-choice-list input')].every(i => i.disabled),
                checkW: b ? b.getBoundingClientRect().width : 0
            };
        });
        const pick = (i, multi = false) => page.evaluate(([i, m]) => handleChoiceChange(currentStep, i, m), [i, multi]);
        const go = (s) => page.evaluate((s) => { currentStep = s; renderQuizStep(); }, s);

        // 1. flag OFF → exactly as before: no Check, no verdict
        await start(false);
        await pick(1);
        assert.deepEqual(await ui(), { check: 'none', verdict: '', marks: '....', locked: false, checkW: 0 }, 'flag off: nothing new');

        // 2. flag ON, single answer: Check waits for a pick, then locks + marks + explanation, the clock stops
        await start(true);
        let s = await ui();
        assert.equal(s.check, 'disabled', 'Check waits for an answer'); assert.ok(s.checkW < 300, 'Check is not stretched full width');
        await pick(1);
        assert.equal((await ui()).check, 'on', 'a pick enables Check');
        await page.click('#qz-check');
        s = await ui();
        assert.equal(s.marks, '.✗✓.', 'wrong pick red ✗, key green ✓'); assert.ok(s.locked, 'the choice locks');
        assert.match(s.verdict, /Not quite · ยังไม่ถูก/); assert.match(s.verdict, /Because C/, 'the explanation shows');
        await pick(2);
        assert.equal(await page.evaluate(() => userAnswers[0]), 1, 'a locked answer cannot change');
        const t0 = await page.evaluate(() => timeLeftForStep); await page.waitForTimeout(2200);
        assert.equal(await page.evaluate(() => timeLeftForStep), t0, 'the per-question clock stops once checked');

        // 3. multi answer, right → ✓ Correct
        await go(1);
        await pick(0, true); await pick(3, true);
        await page.click('#qz-check');
        s = await ui();
        assert.equal(s.marks, '✓..✓'); assert.match(s.verdict, /^✓ Correct · ถูกต้อง/);

        // 4. back to Q1: still locked with its verdict; a question without a key / a flashcard gets no Check
        await go(0);
        s = await ui(); assert.ok(s.locked && /Not quite/.test(s.verdict), 'a checked question stays checked when revisited');
        await go(2); assert.equal((await ui()).check, 'none', 'no key → no Check');
        await go(3); assert.equal(await page.evaluate(() => !!document.getElementById('qz-check')), false, 'flashcard → no Check');

        // 5. scoring is untouched: the run's answers are what submit grades
        assert.deepEqual(await page.evaluate(() => userAnswers.slice(0, 2)), [1, [0, 3]]);
        await page.evaluate(() => { currentStep = 0; renderQuizStep(); });
        await page.locator('#quiz-run-container').screenshot({ path: process.env.QA_SHOT ? process.env.QA_SHOT + '/practice-check.png' : require('os').tmpdir() + '/practice-check.png' });

        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    } finally { await browser.close(); }
    console.log('PASS: practice quiz — ✓ Check after each choice question (flag off = unchanged; waits for a pick; locks; ✓ key / ✗ wrong pick; explanation; per-question clock stops; revisit keeps it; no key / flashcard = no Check; answers untouched); admin chip load / reset / save');
})().catch(e => { console.error(e); process.exit(1); });
