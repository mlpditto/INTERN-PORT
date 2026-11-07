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
        // V101.287 (owner pick C): Check / verdict / Next are the ONE footer button; the content keeps only the explanation
        const ui = () => page.evaluate(() => {
            const c = document.getElementById('quiz-run-container');
            const b = ['btn-quiz-next', 'btn-quiz-submit'].map(id => document.getElementById(id)).find(x => x.style.display !== 'none');
            const ex = c.querySelector('.qz-expl');
            return {
                id: b.id, mode: b.dataset.qzMode || '', text: b.innerText.trim(), bg: b.style.background,   // innerText = what shows (lang-toggle.js hides Thai / Korean outside .lang-no-toggle)
                expl: ex ? ex.innerText.trim() : '', old: !!(document.getElementById('qz-check') || c.querySelector('.qz-verdict')),
                marks: [...c.querySelectorAll('.qt-choice-list label')].map(l => (l.querySelector('.qz-mark') || {}).textContent || '.').join(''),
                locked: [...c.querySelectorAll('.qt-choice-list input')].every(i => i.disabled)
            };
        });
        const pick = (i, multi = false) => page.evaluate(([i, m]) => handleChoiceChange(currentStep, i, m), [i, multi]);
        const go = (s) => page.evaluate((s) => { currentStep = s; renderQuizStep(); }, s);
        const step = () => page.evaluate(() => currentStep);

        // 1. flag OFF → exactly as before: a plain Next, no verdict
        await start(false);
        await pick(1);
        let s = await ui();
        assert.deepEqual([s.mode, s.text, s.expl, s.old, s.marks, s.locked], ['', 'Next', '', false, '....', false], 'flag off: nothing new ' + JSON.stringify(s));

        // 2. flag ON, single answer: nothing picked = plain Next (skip); a pick turns it into ✓ Check; the tap checks and does NOT move on
        await start(true);
        s = await ui(); assert.deepEqual([s.mode, s.text], ['', 'Next'], 'no pick: Next still skips');
        await pick(1);
        s = await ui(); assert.deepEqual([s.mode, s.text], ['check', '✓ Check'], 'a pick: the footer button is Check (one language)');
        await page.click('#btn-quiz-next');
        assert.equal(await step(), 0, 'the Check tap stays on the question');
        s = await ui();
        assert.equal(s.marks, '.✗✓.', 'wrong pick red ✗, key green ✓'); assert.ok(s.locked, 'the choice locks');
        assert.deepEqual([s.mode, s.text], ['wrong', '✗ Not quite · Next →']); assert.match(s.bg, /234, 88, 12|ea580c/, 'orange when wrong');
        assert.equal(s.expl, 'Because C', 'the explanation shows, without a verdict label'); assert.equal(s.old, false, 'no Check row / verdict box in the content');
        await pick(2);
        assert.equal(await page.evaluate(() => userAnswers[0]), 1, 'a locked answer cannot change');
        const t0 = await page.evaluate(() => timeLeftForStep); await page.waitForTimeout(2200);
        assert.equal(await page.evaluate(() => timeLeftForStep), t0, 'the per-question clock stops once checked');
        await page.click('#btn-quiz-next');
        assert.equal(await step(), 1, 'after the verdict the same button moves on');

        // 3. multi answer, right → green ✓ Correct · Next →
        await pick(0, true); await pick(3, true);
        await page.click('#btn-quiz-next');
        s = await ui();
        assert.equal(s.marks, '✓..✓'); assert.deepEqual([s.mode, s.text], ['right', '✓ Correct · Next →']); assert.match(s.bg, /22, 163, 74|16a34a/);

        // 4. the toggle language, one at a time
        for (const [l, t] of [['th', '✗ ยังไม่ถูก · Next →'], ['ko', '✗ 오답 · Next →'], ['ja', '✗ 不正解 · Next →'], ['zh', '✗ 不对 · Next →'], ['en', '✗ Not quite · Next →']]) {
            await page.evaluate(l => localStorage.setItem('quizUiLang', l), l); await go(0);
            assert.equal((await ui()).text, t, 'lang ' + l);
        }
        await page.evaluate(() => localStorage.removeItem('quizUiLang'));

        // 5. revisit keeps it; no key / flashcard = a plain button
        await go(0); s = await ui(); assert.ok(s.locked && s.mode === 'wrong', 'a checked question stays checked when revisited');
        await go(2); await pick(0); assert.equal((await ui()).mode, '', 'no key → plain Next');
        await go(3); s = await ui(); assert.deepEqual([s.id, s.mode, s.text], ['btn-quiz-submit', '', 'Submit Quiz'], 'flashcard on the last step → plain Submit');

        // 6. scoring is untouched: the run's answers are what submit grades
        assert.deepEqual(await page.evaluate(() => userAnswers.slice(0, 2)), [1, [0, 3]]);

        // 7. last step with a key: the Submit button wears the verdict
        await page.evaluate(() => { currentQuiz.questions.length = 2; });
        await go(1); s = await ui(); assert.deepEqual([s.id, s.mode, s.text], ['btn-quiz-submit', 'right', '✓ Correct · Submit']);

        // 8. "คำถาม:" glued to the case text starts its own line
        assert.equal(await page.evaluate(() => quizQBreak('ใช้ยา oxybutynin สำหรับ overactive bladderคำถาม: ข้อใด?')), 'ใช้ยา oxybutynin สำหรับ overactive bladder\nคำถาม: ข้อใด?');
        assert.equal(await page.evaluate(() => quizQBreak('a\nคำถาม: b')), 'a\nคำถาม: b', 'already on its own line: unchanged');
        await page.evaluate(() => { currentQuiz.questions[0].q = 'bladderคำถาม: ข้อใด?'; currentStep = 0; renderQuizStep(); });
        const qHtml = await page.evaluate(() => document.querySelector('#quiz-run-container .md-render').innerHTML);
        assert.ok(/bladder[\s\S]{0,40}<br>[\s\S]{0,60}คำถาม/.test(qHtml), 'rendered with a line break: ' + qHtml);
        // a Thai quiz on "orig" (no chip picked) speaks Thai on the button too
        assert.equal((await ui()).text, '✗ ยังไม่ถูก · Next →', 'Thai source quiz → Thai verdict');
        await page.locator('#quizModal .modal-content').screenshot({ path: process.env.QA_SHOT ? process.env.QA_SHOT + '/practice-check.png' : require('os').tmpdir() + '/practice-check.png' });

        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    } finally { await browser.close(); }
    console.log('PASS: practice quiz — pick C: one footer button Next → ✓ Check → ✓ Correct / ✗ Not quite · Next (orange), one language from the toggle; locks; ✓ key / ✗ wrong pick; explanation only; clock stops; revisit keeps it; no key / flashcard = plain; Submit on the last step; คำถาม: on its own line; admin chip load / reset / save');
})().catch(e => { console.error(e); process.exit(1); });
