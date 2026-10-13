// V101.138 / V102.222 — per-question "Read first" page: the learner reads it on its own page BEFORE the question's timer starts.
// The REAL renderQuizStep / startQuizQuestionAfterPrimer / updateTimerUI / quizStepIsAnswered from public/index.html in Chromium.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = path.resolve(__dirname, '../public');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace(/\r/g, '');
const admin = fs.readFileSync(path.join(dir, 'admin.html'), 'utf8').replace(/\r/g, '');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(html) && /<title>Nika Admin \(V102\.\d+\)<\/title>/.test(admin));
const take = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); return html.slice(i, html.indexOf(b, i + a.length)); };
const fn = name => { const i = html.indexOf(name); assert.ok(i >= 0, name); let d = 0, k = html.indexOf('{', html.indexOf(')', i)); for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) break; } return html.slice(i, k + 1); };
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n') + fs.readFileSync(path.join(dir, 'quiz-user-focus.css'), 'utf8');
const quizModal = take('    <div id="quizModal"', '    <div id="quizResultModal"');

// ---- source guards: admin field + save/load, review block, per-run state
assert.ok(admin.includes('class="q-primer"') && admin.includes('...(qPrimer ? { primer: qPrimer } : {})') && /data && data\.primer/.test(admin), 'admin: textarea, saved only when filled, loaded back');
assert.ok(html.includes('${primerText}') && html.includes('let primerSeen = []'), 'intern: review block + per-run state');
assert.equal((html.match(/primerSeen = \[\];/g) || []).length, 4, 'primerSeen is declared and reset at every place a run starts / resumes');

const setup = `
    let primerSeen = [], stepTimeRemaining = [null, null], accumulatedTime = 0, lastBonusTime = 0, timeLeftForStep = 99, quizTimerInterval = null,
        stepStartTimestamp = 0, userAnswers = [null, null], shuffleMap = {}, durationsPerQuestion = [0, 0], currentStep = 0;
    let currentQuiz = { quizType: 'standard', timerMode: 'per_question', questions: [
        { q: 'Which drug is a LABA?', type: 'choice', options: ['Salmeterol', 'Ipratropium'], correct: [0], timer: 45, primer: '**LABA** = long-acting beta-agonist.\\n\\n- LAMA = long-acting muscarinic antagonist' },
        { q: 'Second question', type: 'choice', options: ['A', 'B'], correct: [0], timer: 30 }] };
    window.renderMd = s => '<div class="md">' + String(s).replace(/\\*\\*(.+?)\\*\\*/g, '<b>$1</b>') + '</div>';
    window.qtGetEffectiveQuestion = i => currentQuiz.questions[i]; window.qtGetEffectiveCaseContent = () => ''; window.qtRenderBar = () => '';
    window.handleChoiceChange = () => {}; window.renderTweetstormItems = () => '';
`;

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.setContent('<style>' + css + '</style>' + quizModal);
        await page.addScriptTag({ content: setup });
        await page.addScriptTag({ content: [fn('function quizStepIsAnswered('), fn('function renderQuizStepBullets('), fn('function updateTimerUI('), fn('function startQuizQuestionAfterPrimer('), fn('function renderQuizStep(')].join('\n') });
        const state = () => page.evaluate(() => ({
            text: document.getElementById('quiz-run-container').innerText, timer: document.getElementById('quiz-q-timer').innerText, badge: document.getElementById('quiz-q-type-badge').innerText,
            prev: getComputedStyle(document.getElementById('btn-quiz-prev')).display, next: getComputedStyle(document.getElementById('btn-quiz-next')).display, submit: getComputedStyle(document.getElementById('btn-quiz-submit')).display,
            radios: document.querySelectorAll('#quiz-run-container input[name="q-opt"]').length, t: timeLeftForStep, seen: primerSeen.slice(), start: stepStartTimestamp,
            ps: getComputedStyle(document.getElementById('btn-quiz-primer-start')).display, psText: document.getElementById('btn-quiz-primer-start').textContent, badgeTitle: document.getElementById('quiz-q-type-badge').getAttribute('title') }));

        // 1) the gate: text + Start, no question, no countdown, no footer buttons
        await page.evaluate(() => { document.getElementById('quizModal').style.display = 'flex'; renderQuizStep(false); });
        let s = await state();
        assert.match(s.text, /LABA = long-acting beta-agonist/); assert.ok(!/Read first/i.test(s.text), 'V101.141: no heading inside the page — the badge says it'); assert.equal(s.psText, '▶ ⏱ 45s', 'the Start button is in the footer slot'); assert.notEqual(s.ps, 'none');
        assert.ok(!/Which drug is a LABA/.test(s.text) && s.radios === 0, 'the question is NOT shown on the Read-first page');
        assert.equal(s.timer, ''); assert.equal(s.badge, '📖 1/2'); assert.match(s.badgeTitle, /Read first/); assert.deepEqual([s.prev, s.next, s.submit], ['none', 'none', 'none'], 'no navigation on the Read-first page');
        await page.waitForTimeout(1300);
        s = await state(); assert.equal(s.t, 99, 'no countdown while reading (timeLeftForStep untouched)'); assert.equal(s.timer, '');
        assert.equal(await page.evaluate(() => stepTimeRemaining[0]), null, 'the step is not started');
        // 2) Start: the question appears, the timer starts NOW (45s, not reduced by the reading time)
        await page.evaluate(() => { stepStartTimestamp = 1; });
        await page.locator('#btn-quiz-primer-start').click();
        s = await state();
        assert.equal(s.ps, 'none', 'the Start slot is gone after Start'); assert.equal(s.badgeTitle, null); assert.match(s.text, /Which drug is a LABA/); assert.equal(s.radios, 2); assert.deepEqual(s.seen, [true]); assert.ok(s.start > 1000, 'reading time is not part of the question duration');
        assert.match(s.timer, /^⏱ 4[45]s/); assert.ok(s.prev === 'none' && s.next !== 'none', 'footer buttons are back (first question: no Prev)');
        await page.waitForTimeout(1200); assert.ok((await state()).t <= 44, 'the timer runs after Start');
        // 3) Q2 has no primer → straight to the question; back to Q1 → no second gate
        await page.evaluate(() => { clearInterval(quizTimerInterval); currentStep = 1; renderQuizStep(false); });
        s = await state(); assert.match(s.text, /Second question/); assert.ok(!/Read first/i.test(s.text));
        await page.evaluate(() => { clearInterval(quizTimerInterval); currentStep = 0; renderQuizStep(false); });
        s = await state(); assert.match(s.text, /Which drug is a LABA/, 'a question whose Read-first page was passed is not gated again');
        // 4) a new run resets it
        await page.evaluate(() => { clearInterval(quizTimerInterval); primerSeen = []; renderQuizStep(false); });
        assert.match((await state()).text, /LABA = long/, 'a new run shows the page again');
        // 5) total-time mode: Start has no per-question seconds, and the quiz clock is paused until Start
        await page.evaluate(() => { currentQuiz.timerMode = 'total_time'; timeLeftForStep = 600; primerSeen = []; renderQuizStep(true); });
        s = await state(); assert.equal(s.psText, '▶'); assert.ok(!/⏱ 45s/.test(s.psText));
        await page.waitForTimeout(1200); assert.equal((await state()).t, 600, 'total-time clock is paused on the Read-first page');
        // 6) phone: nothing overflows
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: Read first — own page before the timer (no question, no countdown, no nav), Start begins the timer once, never gated twice, resets per run, total-time clock paused, admin field saved only when filled');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
