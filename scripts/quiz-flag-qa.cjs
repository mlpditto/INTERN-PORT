// V101.288 🚩 flag a sentence for the admin (owner picks: 2 + 3, card V2, tutorial T3). The REAL public/index.html + quiz-flag.js
// (file://, network blocked, Firebase stubbed), driven through renderQuizStep / startQuizQuestionAfterPrimer / submitFeedback / closeFeedbackModal.
//   node scripts/quiz-flag-qa.cjs
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

// admin: the REAL qfpHasFlags / qfpFlagsHtml / qfpIsEmptyFeedback / qfpIsEmptyPraise cut from admin.html, run in Node
{
    const admin = require('node:fs').readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
    const cut = (a, b) => { const i = admin.indexOf(a), j = admin.indexOf(b, i); assert.ok(i > 0 && j > i, 'cut ' + a); return admin.slice(i, j); };
    const code = cut('        function qfpIsEmptyPraise(f) {', '        // ✏️ Qn: the quiz editor') + cut('        function qfpIsEmptyFeedback(f) {', '        // V102.252');
    const qfpNormalizeTopic = s => String(s || '').trim(), qfpEscapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const A = new Function('qfpNormalizeTopic', 'qfpEscapeHtml', code + '\nreturn { qfpHasFlags, qfpFlagsHtml, qfpIsEmptyFeedback, qfpIsEmptyPraise };')(qfpNormalizeTopic, qfpEscapeHtml);
    const only = { rating: null, ratingProvided: false, comment: '', nextTopic: '', flagsOnly: true, flags: [{ part: 'primer', step: 1, opt: null, quote: 'first-line <b>', reason: 'wrong', note: 'PGA' }, { part: 'opt', step: 4, opt: 1, quote: 'Artificial tears', reason: null, note: '' }] };
    assert.equal(A.qfpIsEmptyFeedback(only), false, 'a flags-only entry is not "empty" (the bulk cleanup must not delete it)');
    assert.equal(A.qfpIsEmptyFeedback({ rating: null, comment: '', nextTopic: '' }), true, 'still empty without flags');
    assert.equal(A.qfpIsEmptyPraise(Object.assign({}, only, { rating: 10 })), false, 'a 10/10 with flags stays in the review list');
    const h = A.qfpFlagsHtml(only);
    assert.match(h, /🚩 📖 Read first · Q2 · ❌ Wrong/); assert.match(h, /🚩 Q5 · choice B/); assert.match(h, /qfpOpenFlag\(1\)/); assert.match(h, /qfpOpenFlag\(4\)/);
    assert.match(h, /first-line &lt;b&gt;/, 'quote escaped'); assert.match(h, /✍️ PGA/);
    assert.equal(A.qfpFlagsHtml({ flags: [] }), '');
    assert.ok(admin.includes('${qfpFlagsHtml(f)}\n                        ${quizResultHtml}'), 'the card shows the flags');
    assert.ok(admin.includes("case 'fix':      return fbNeedsFix(f) || (Array.isArray(f.flags) && f.flags.length > 0);") && admin.includes('fix: _qfpFeedbacks.filter(f => fbNeedsFix(f) || (Array.isArray(f.flags) && f.flags.length > 0)).length,'), '🐞 filter + its count include flags');
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', d => d.dismiss());
        await page.addInitScript(() => {
            window.__adds = [];
            const q = () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), set: () => Promise.resolve(), update: () => Promise.resolve(), onSnapshot: () => () => {} }), where: q, orderBy: q, limit: q, get: () => Promise.resolve({ docs: [], size: 0, empty: true }), onSnapshot: () => () => {}, add: (d) => { window.__adds.push(JSON.parse(JSON.stringify(d))); return Promise.resolve({ id: 'x' }); } });
            window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: q }), { FieldValue: { serverTimestamp: () => 'TS', delete: () => 0, increment: n => n } }) };
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX, { waitUntil: 'load' });
        await page.waitForFunction(() => !!window.qzFlag);

        const start = () => page.evaluate(() => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            userId = 'U1'; userProfile = { displayName: 'NATT' };
            currentQuiz = { id: 'eye2', title: 'Eye for all-2', quizType: 'standard', timerMode: 'per_question', questions: [
                { type: 'choice', primer: 'POAG treatment lowers IOP. The first-line choice must weigh efficacy against contraindications. Eye drops can reach the blood.', q: 'A 58-year-old woman on oxybutynin. Which is most appropriate now?', options: ['Switch to mirabegron', 'Artificial tears', 'Stop oxybutynin and refer'], correct: 2, timer: 60 },
                { type: 'choice', primer: 'Beta-blockers can cause bronchospasm.', q: 'Which drop is a beta-blocker?', options: ['Timolol', 'Latanoprost'], correct: 0, timer: 60 },
                { type: 'choice', primer: 'Allergic conjunctivitis.', q: 'Pick one?', options: ['A', 'B'], correct: 0, timer: 60 }
            ] };
            isPracticeMode = false; currentStep = 0; shuffleMap = []; primerSeen = []; answerChecked = [];
            userAnswers = new Array(3).fill(null); stepTimeRemaining = new Array(3).fill(null); durationsPerQuestion = new Array(3).fill(0); accumulatedTime = 0;
            document.getElementById('quizModal').style.display = 'flex';
            renderQuizStep();
        });
        const st = () => page.evaluate(() => Object.assign(qzFlag._state(), { btn: !document.getElementById('qz-flag-btn').hidden, bar: !document.getElementById('qzf-bar').hidden, marks: document.querySelectorAll('#quiz-run-container .qzf-mark').length, card: !!document.querySelector('#quiz-run-container .qzf-card') }));
        // tap a word inside a block, by the word's own box (so the caret lands in that sentence)
        const tapWord = (sel, word) => page.evaluate(([sel, word]) => {
            const el = document.querySelector(sel); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
            while ((n = w.nextNode())) { const i = n.nodeValue.indexOf(word); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + word.length); const b = r.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; } }
            return null;
        }, [sel, word]).then(xy => { assert.ok(xy, 'word on screen: ' + word); return page.mouse.click(xy[0], xy[1]); });

        // 1. Read first: 🚩 shows, the how-to bubble (T3) plays under it
        await start();
        let s = await st();
        assert.ok(s.btn, '🚩 in the header'); assert.ok(s.tut, 'the how-to bubble on Read first'); assert.equal(s.mode, false);
        const tut = await page.evaluate(() => { const t = document.querySelector('.qzf-tut'), b = document.getElementById('qz-flag-btn').getBoundingClientRect(), r = t.getBoundingClientRect(); return { below: r.top >= b.bottom - 2, text: t.innerText, anim: getComputedStyle(t.querySelector('.qzf-mini em')).animationName }; });
        assert.ok(tut.below, 'the bubble sits under 🚩'); assert.match(tut.text, /Tap 🚩 → tap the sentence → pick a reason/); assert.match(tut.text, /Don't show again in this quiz/); assert.equal(tut.anim, 'qzfFinger', 'the finger loop runs');
        // a tap elsewhere closes it for this page
        await page.mouse.click(30, 860);
        assert.equal((await st()).tut, false, 'a tap anywhere closes the bubble');

        // 2. flag mode: tap a sentence → yellow + the V2 card; the quote is that sentence only
        await page.click('#qz-flag-btn');
        s = await st(); assert.ok(s.mode && s.bar, 'flag mode on, the bar shows');
        await tapWord('#quiz-run-container .quiz-primer', 'efficacy');
        s = await st();
        assert.equal(s.flags.length, 1); assert.equal(s.flags[0].quote, 'The first-line choice must weigh efficacy against contraindications.'); assert.equal(s.flags[0].part, 'primer');
        assert.ok(s.marks >= 1, 'yellow mark drawn'); assert.ok(s.card, 'the card opens');
        await page.click('.qzf-card .qzf-chips button[data-r="wrong"]');
        await page.fill('.qzf-card input', 'should be prostaglandin analogues');
        await page.click('.qzf-card .qzf-ok');
        s = await st(); assert.equal(s.flags[0].reason, 'wrong'); assert.equal(s.flags[0].note, 'should be prostaglandin analogues'); assert.equal(s.card, false);
        assert.equal(await page.evaluate(() => document.getElementById('qz-flag-btn').dataset.n), '1', 'the count rides 🚩');
        // tapping the same sentence again opens its card (no duplicate); 🗑 would remove it
        await tapWord('#quiz-run-container .quiz-primer', 'contraindications');
        s = await st(); assert.equal(s.flags.length, 1, 'no duplicate'); assert.ok(s.card);
        assert.equal(await page.locator('.qzf-card .qzf-chips button[data-r="wrong"]').getAttribute('aria-pressed'), 'true', 'the card remembers the reason');
        await page.click('.qzf-card .qzf-ok');

        // 3. Start → the question page: flag mode resets, marks of other pages are not drawn here
        await page.evaluate(() => startQuizQuestionAfterPrimer());
        s = await st(); assert.equal(s.mode, false, 'each page starts with 🚩 off'); assert.equal(s.marks, 0); assert.equal(s.tut, false, 'no bubble on the question page');
        // in flag mode a tap on a choice flags it and does NOT answer
        await page.click('#qz-flag-btn');
        await tapWord('#quiz-run-container .qt-choice-list label:nth-child(2) span', 'Artificial');
        s = await st();
        assert.equal(s.flags.length, 2); assert.deepEqual([s.flags[1].part, s.flags[1].opt, s.flags[1].quote], ['opt', 1, 'Artificial tears']);
        assert.equal(await page.evaluate(() => userAnswers[0]), null, 'flagging a choice does not pick it');
        await page.click('.qzf-card .qzf-ok');
        // 🚩 off → a tap answers as usual
        await page.click('#qzf-bar .qzf-done');
        await page.locator('#quiz-run-container .qt-choice-list label').nth(2).click();
        assert.equal(await page.evaluate(() => userAnswers[0]), 2, 'with 🚩 off the choice is picked');

        // 4. the next Read first: the bubble is back (not ticked) → tick → gone for the rest of this quiz
        await page.evaluate(() => { currentStep = 1; renderQuizStep(); });
        assert.equal((await st()).tut, true, 'unticked → shown again on the next Read first');
        await page.click('.qzf-tut input');   // the bubble goes away at once, so no page.check (it re-reads the box)
        assert.equal((await st()).tut, false);
        await page.evaluate(() => { currentStep = 2; renderQuizStep(); });
        s = await st(); assert.equal(s.tut, false, 'ticked → quiet until this quiz ends'); assert.equal(s.flags.length, 2, 'flags kept across pages');

        // 5. the end: the feedback form lists them; Submit sends them on the doc, then clears
        await page.evaluate(() => { document.getElementById('quizModal').style.display = 'none'; currentQuizIdForFeedback = 'eye2'; currentPointsForFeedback = 1; currentTimeUsedForFeedback = 90; qzFlag.renderFeedback(); document.getElementById('quizFeedbackModal').style.display = 'flex'; });
        const list = await page.evaluate(() => [...document.querySelectorAll('#fb-flags .qzf-item .w')].map(e => e.innerText));
        assert.deepEqual(list, ['📖 Read first · Q 1 · ❌ Wrong', 'Q 1 · choice B'], 'where + reason');
        await page.evaluate(() => submitFeedback());
        await page.waitForFunction(() => __adds.length === 1);
        let doc = await page.evaluate(() => __adds[0]);
        assert.equal(doc.rating, null); assert.equal(doc.flagsOnly, undefined, 'a real feedback doc');
        assert.deepEqual(doc.flags, [
            { part: 'primer', step: 0, opt: null, quote: 'The first-line choice must weigh efficacy against contraindications.', reason: 'wrong', note: 'should be prostaglandin analogues' },
            { part: 'opt', step: 0, opt: 1, quote: 'Artificial tears', reason: null, note: '' }
        ], 'flags ride the doc, even with no stars / comment');
        assert.equal(await page.evaluate(() => qzFlag.count()), 0, 'cleared after the send');

        // 6. a new quiz: the bubble is back; flags, then Skip → a flags-only doc
        await page.evaluate(() => closeFeedbackModal());
        await start();
        assert.equal((await st()).tut, true, 'a new quiz shows the bubble again');
        await page.mouse.click(30, 860);
        await page.click('#qz-flag-btn');
        await tapWord('#quiz-run-container .quiz-primer', 'blood');
        await page.evaluate(() => { currentQuizIdForFeedback = 'eye2'; qzFlag.renderFeedback(); closeFeedbackModal(); });
        await page.waitForFunction(() => __adds.length === 2);
        doc = await page.evaluate(() => __adds[1]);
        assert.deepEqual([doc.flagsOnly, doc.quizId, doc.userId, doc.flags.length, doc.flags[0].quote, doc.comment, doc.ratingProvided], [true, 'eye2', 'U1', 1, 'Eye drops can reach the blood.', '', false], 'Skip still sends the flags, alone');

        // 7. not where the feedback form does not follow: the one-time practice run, a read-only quiz
        await page.evaluate(() => { isPracticeMode = true; currentStep = 0; primerSeen = []; renderQuizStep(); });
        s = await st(); assert.equal(s.btn, false, 'practice run: no 🚩'); assert.equal(s.tut, false);
        await page.evaluate(() => { isPracticeMode = false; });

        // 8. Thai quiz → Thai text (the quiz chip / source language)
        await page.evaluate(() => { currentQuiz = Object.assign({}, currentQuiz, { questions: currentQuiz.questions.map(q => Object.assign({}, q, { q: 'ข้อใดถูก?', primer: 'ยาหยอดตาดูดซึมได้' })) }); currentStep = 0; primerSeen = []; renderQuizStep(); });
        assert.match(await page.locator('.qzf-tut').innerText(), /แตะ 🚩 → แตะประโยค → เลือกเหตุผล[\s\S]*ไม่ต้องสอนอีกจนจบ quiz นี้/);
        await page.locator('#quizModal .modal-content').screenshot({ path: process.env.QA_SHOT ? process.env.QA_SHOT + '/quiz-flag.png' : require('os').tmpdir() + '/quiz-flag.png' });

        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    } finally { await browser.close(); }
    console.log('PASS: 🚩 flag — T3 bubble on every Read first until ticked (per quiz); flag mode; tap = that sentence, yellow mark + V2 card (reason, note); no duplicate; a choice is flagged, not answered; 🚩 off answers; feedback list; Submit carries flags; Skip = flags-only doc; none on a practice run; Thai text');
})().catch(e => { console.error(e); process.exit(1); });
