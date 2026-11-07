// V101.289 ⏸ Break on 📖 Read first (owner picks 2026-11-07: P1 beside ▶, recommended settings, past the deadline = auto-submit).
// The REAL public/index.html + quiz-break.js (file://, network blocked, Firebase stubbed), driven through renderQuizStep / runQuiz /
// submitQuiz; admin.html wiring checked as text.
//   node scripts/quiz-break-qa.cjs
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

// admin: the ⏸ Break chip is loaded, reset, read and saved like 🎓 Practice; the attempt shows its breaks
{
    const a = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
    assert.ok(a.includes('<input type="checkbox" id="quiz-allow-break"> <span>Break</span></label>'), 'chip in the editor');
    assert.ok(a.includes("if (ab) ab.checked = q.allowBreak === true;"), 'load');
    assert.ok(a.includes("if (ab) ab.checked = false; }"), 'reset for a new quiz');
    assert.ok(a.includes("const allowBreak = document.getElementById('quiz-allow-break')?.checked || false;"), 'read');
    assert.ok(a.includes('instantAnswer, allowBreak, notifyGroup'), 'returned by the form');
    assert.ok(a.includes('allowBreak: formData.allowBreak === true,'), 'saved on the quiz');
    assert.ok(a.includes('${oohNote}${retakeNote}${breakNote}'), 'pending row shows ⏸');
    assert.ok(a.includes('att.startTime.toMillis() - _brkMs;'), 'the break time is not part of the duration');
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
        await page.addInitScript(() => {
            window.__sets = [];
            const doc = (col, id) => ({ id, get: () => Promise.resolve({ exists: false, data: () => ({}) }), set: (d, o) => { window.__sets.push({ col, id, d: JSON.parse(JSON.stringify(d)), merge: !!(o && o.merge) }); return Promise.resolve(); }, update: (d) => { window.__sets.push({ col, id, d: JSON.parse(JSON.stringify(d)), update: true }); return Promise.resolve(); }, onSnapshot: () => () => {} });
            const q = (col) => ({ doc: (id) => doc(col, id), where: () => q(col), orderBy: () => q(col), limit: () => q(col), get: () => Promise.resolve({ docs: [], size: 0, empty: true, forEach: () => {} }), onSnapshot: () => () => {}, add: () => Promise.resolve({ id: 'x' }) });
            const fs = () => ({ collection: q, runTransaction: () => Promise.resolve({ status: 'skip' }), batch: () => ({ set() {}, update() {}, commit: () => Promise.resolve() }) });
            window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(fs, { FieldValue: { serverTimestamp: () => 'TS', delete: () => 0, increment: n => n, arrayUnion: (...v) => v } }) };
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX, { waitUntil: 'load' });
        await page.waitForFunction(() => !!window.qzBreak);

        const QUIZ = (o) => Object.assign({ id: 'eye2', title: 'Eye for all-2', quizType: 'standard', timerMode: 'per_question', allowBreak: true, isActive: true,
            
            questions: [
                { type: 'choice', primer: 'POAG lowers IOP.', q: 'Which is most appropriate now?', options: ['Switch to mirabegron', 'Artificial tears', 'Stop oxybutynin and refer'], correct: 2, timer: 60 },
                { type: 'choice', primer: 'Beta-blockers can cause bronchospasm.', q: 'Which drop is a beta-blocker?', options: ['Timolol', 'Latanoprost'], correct: 0, timer: 60 },
                { type: 'choice', primer: 'Allergic conjunctivitis.', q: 'Pick one?', options: ['A', 'B'], correct: 0, timer: 60 }
            ], deadline: { toDate: ((m) => () => new Date(Date.now() + m * 6e4))(o && o.dueMin != null ? o.dueMin : 3 * 1440) } }, o || {});
        const start = (o) => page.evaluate((o) => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            userId = 'U1'; userProfile = { displayName: 'NATT' };
            currentQuiz = window.__mk(o);
            quizzesCache = [currentQuiz]; quizAttemptsCache = { eye2: { quizId: 'eye2', userId: 'U1', status: 'started' } };
            isPracticeMode = !!(o && o.__practice); currentStep = 0; shuffleMap = [[1, 0, 2], [1, 0], null]; primerSeen = []; answerChecked = [];
            userAnswers = new Array(3).fill(null); stepTimeRemaining = new Array(3).fill(null); durationsPerQuestion = new Array(3).fill(0); accumulatedTime = 0;
            document.getElementById('quizModal').style.display = 'flex';
            renderQuizStep();
        }, o || null);
        await page.evaluate((src) => { window.__mk = new Function('o', 'return (' + src + ')(o);'); }, QUIZ.toString());
        const btn = () => page.evaluate(() => { const b = document.getElementById('btn-quiz-break'), s = document.getElementById('btn-quiz-primer-start'); return b ? { shown: !b.hidden && getComputedStyle(b).display !== 'none', text: b.innerText, left: b.getBoundingClientRect().right <= s.getBoundingClientRect().left + 1, row: Math.abs(b.getBoundingClientRect().top - s.getBoundingClientRect().top) < 2, h: b.getBoundingClientRect().height } : { shown: false }; });

        // 1. off by default: a quiz without ⏸ Break shows no button; practice / past the deadline neither
        await start({ allowBreak: false });
        assert.equal((await btn()).shown, false, 'no ⏸ unless the admin turned it on');
        await start({ __practice: true });
        assert.equal((await btn()).shown, false, 'never in practice');
        await page.evaluate(() => { isPracticeMode = false; });
        await start({ dueMin: -1 });
        assert.equal((await btn()).shown, false, 'not after the deadline');

        // 2. on: P1 — ⏸ Break on the left of ▶, same row; it goes away on the question page
        await start();
        let b = await btn();
        assert.ok(b.shown && b.left && b.row, '⏸ beside ▶'); assert.equal(b.text, '⏸ Break', 'in the quiz language'); assert.ok(b.h >= 44, 'thumb-sized');
        await page.evaluate(() => startQuizQuestionAfterPrimer());
        assert.equal((await btn()).shown, false, 'no ⏸ while a question runs (its clock is on)');
        await page.locator('#quiz-run-container .qt-choice-list label').nth(0).click();   // shuffled [1,0,2] → the first shown option is original #1
        const picked = await page.evaluate(() => userAnswers[0]);
        await page.evaluate(() => nextQuizStep());
        assert.equal(await page.evaluate(() => document.getElementById('quiz-q-type-badge').innerText), '📖 2/3');
        assert.equal((await btn()).shown, true, 'back on the next Read first');

        // 3. the sheet: nothing picked; Cancel writes nothing
        await page.click('#btn-quiz-break');
        let sh = await page.evaluate(() => { const s = document.querySelector('#qzb-sheet'); return { head: s.querySelector('b').innerText, pressed: [...s.querySelectorAll('[data-r]')].filter(x => x.getAttribute('aria-pressed') === 'true').length, meta: s.querySelector('.qzb-meta').innerText }; });
        assert.equal(sh.head, '⏸ Break before question 2'); assert.equal(sh.pressed, 0, 'no reason pre-selected');
        assert.match(sh.meta, /⏸ 1 left after this/); assert.match(sh.meta, /The clock is stopped/); assert.match(sh.meta, /📅 Back before/);
        await page.click('#qzb-sheet .qzb-no');
        assert.equal(await page.evaluate(() => !!document.getElementById('qzb-sheet')), false);
        assert.equal(await page.evaluate(() => __sets.filter(s => s.d.pausedAt).length), 0, 'Cancel = no break');

        // 4. take it: 🍱, ⏸ Take a break → saved, the runner closes, the card says where it stopped
        await page.click('#btn-quiz-break');
        await page.click('#qzb-sheet [data-r="meal"]');
        await page.click('#qzb-sheet .qzb-go');
        await page.waitForFunction(() => document.getElementById('quizModal').style.display === 'none');
        let w = await page.evaluate(() => __sets.filter(s => s.col === 'quiz_attempts' && s.d.pausedAt).pop());
        assert.equal(w.id, 'eye2_U1'); assert.ok(w.merge); assert.equal(w.d.pausedAt, 'TS');
        assert.equal(w.d.breaks.length, 1); assert.equal(w.d.breaks[0].reason, 'meal'); assert.equal(w.d.breaks[0].step, 1); assert.equal(w.d.breaks[0].back, null);
        assert.equal(w.d.breakState.step, 1); assert.deepEqual(w.d.breakState.shuffle, ['1,0,2', '1,0', null], 'choice order kept as strings (no nested arrays)');
        assert.equal(w.d.answers[0], picked); assert.equal(w.d.currentStep, 1);
        assert.equal(w.d.status, undefined, 'status stays started (no rule change)');
        const paused = await page.evaluate(() => ({ p: qzBreak.isPaused(quizAttemptsCache.eye2), cur: currentQuiz, info: qzBreak.cardInfo(quizzesCache[0], quizAttemptsCache.eye2) }));
        assert.ok(paused.p); assert.equal(paused.cur, null, 'nothing left to mark abandoned on pagehide');
        assert.equal(paused.info.step, 2); assert.equal(paused.info.total, 3);
        const row = await page.evaluate(() => { try { return qbRowHtml(quizzesCache[0]); } catch (e) { return 'ERR ' + e.message; } });
        assert.match(row, /⏸ On break/, 'Browse says on break');
        const card = await page.evaluate(() => { try { renderAssignments(); } catch (e) { return 'ERR ' + e.message; } const c = [...document.querySelectorAll('.assign-tag')].find(t => /On break/.test(t.innerText)); let box = c; while (box && !/Resume/.test(box.innerText)) box = box.parentElement; return box ? box.innerText : (c ? 'tag only: ' + c.innerText : 'none'); });
        assert.match(card, /⏸ On break/); assert.match(card, /Q 2\/3/); assert.match(card, /Resume/, 'home card: where it stopped + ▶ Resume');
        assert.match(await page.evaluate(() => document.getElementById('toast').innerText), /⏸ Saved — tap ▶ Resume/);

        // 5. ▶ Resume: runQuiz puts the runner back on 📖 Read first of question 2, same answers + choice order; the break gets its end
        const before = await page.evaluate(() => __sets.length);
        await page.evaluate(() => { window.requireRegistered = () => true; quizAttemptsCache.eye2 = Object.assign({}, quizAttemptsCache.eye2, { answers: quizAttemptsCache.eye2.answers }); return runQuiz('eye2'); });
        let r = await page.evaluate(() => ({ step: currentStep, badge: document.getElementById('quiz-q-type-badge').innerText, ans: userAnswers[0], sh: shuffleMap[0], open: document.getElementById('quizModal').style.display, seen0: !!primerSeen[0], seen1: !!primerSeen[1], cache: quizAttemptsCache.eye2 }));
        assert.equal(r.open, 'flex'); assert.equal(r.step, 1); assert.equal(r.badge, '📖 2/3', 'Read first again'); assert.equal(r.ans, picked); assert.deepEqual(r.sh, [1, 0, 2]);
        assert.ok(r.seen0 && !r.seen1);
        assert.ok(!dialogs.some(m => /already started this quiz/.test(m)), 'no 🚫 brick');
        w = await page.evaluate((n) => __sets.slice(n).find(s => s.col === 'quiz_attempts' && 'pausedAt' in s.d), before);
        assert.equal(w.d.pausedAt, null); assert.equal(typeof w.d.breaks[0].back, 'number', 'the break end is stamped');
        assert.equal(r.cache.pausedAt, null);
        assert.equal((await btn()).text, '⏸ Break', 'one break left → still offered');

        // 6. the second break, then back: no third
        await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); });
        await page.click('#btn-quiz-break');
        assert.match(await page.evaluate(() => document.querySelector('#qzb-sheet .qzb-meta').innerText), /⏸ 0 left after this/);
        await page.click('#qzb-sheet .qzb-go');
        await page.waitForFunction(() => document.getElementById('quizModal').style.display === 'none');
        assert.equal(await page.evaluate(() => quizAttemptsCache.eye2.breaks.length), 2);
        await page.evaluate(() => runQuiz('eye2'));
        assert.equal((await btn()).shown, false, 'two breaks used → no ⏸');
        const sum = await page.evaluate(() => qzBreak.summary(quizAttemptsCache.eye2));
        assert.equal(sum.count, 2); assert.equal(sum.icons, '🍱');

        // 7. the deadline passes during a break → what was answered is sent, without asking
        await page.evaluate(() => { document.getElementById('quizModal').style.display = 'none'; currentQuiz = null; });
        const n7 = await page.evaluate(() => __sets.length);
        dialogs.length = 0;
        await page.evaluate(() => {
            quizzesCache = [window.__mk({ dueMin: -1 })];
            quizAttemptsCache = { eye2: { quizId: 'eye2', userId: 'U1', status: 'started', pausedAt: new Date(), answers: [2, null, null], currentStep: 1, breaks: [{ at: Date.now() - 1e6, step: 1, reason: 'work', back: null }], breakState: { step: 1, shuffle: [null, null, null] } } };
            qzBreak.checkDue();
        });
        await page.waitForFunction((n) => __sets.slice(n).some(s => s.d.status === 'pending'), n7);
        const sent = await page.evaluate((n) => __sets.slice(n), n7);
        const mark = sent.find(s => s.d.breakAutoSubmitted), sub = sent.find(s => s.d.status === 'pending');
        assert.ok(mark && mark.d.pausedAt === null, 'marked auto-sent');
        assert.equal(sub.d.correctCount, 1); assert.deepEqual(sub.d.answers, [2, null, null]);
        assert.equal(dialogs.length, 1, 'one notice, no "Submit?" confirm'); assert.match(dialogs[0], /deadline passed during your break — your answers \(1\/3\)/);
        await page.evaluate(() => qzBreak.checkDue());
        assert.equal((await page.evaluate((n) => __sets.slice(n).filter(s => s.d.status === 'pending').length, n7)), 1, 'sent once');

        assert.deepEqual(errors, [], 'no page errors');
        console.log('PASS quiz-break-qa');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
