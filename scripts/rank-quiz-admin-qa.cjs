// V102.465 — Quiz Editor: author a Rank question (typed answer first, then rank the options). The REAL admin.html with a stubbed Firebase:
// the editor emits {type:'rank', accepted, options, tiers, unsafe, why, correct}, saveQuiz blocks unfinished ones, the admin re-grades a stored answer with rank-quiz.js, a saved question round-trips.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => typeof addQuestionUI === 'function' && typeof getQuizFormData === 'function' && window.RankQuiz && document.readyState === 'complete');
        await page.evaluate(() => { window.triggerAutoSave = () => {}; window.__alerts = []; window.alert = m => window.__alerts.push(String(m)); });

        // ---- build a Rank question through the real editor controls
        await page.evaluate(() => { document.getElementById('quiz-questions-container').innerHTML = ''; addQuestionUI(); });
        await page.evaluate(() => { const h = document.querySelector('.quiz-q-item .q-type'); h.value = 'rank'; toggleQType(h); });
        const built = await page.evaluate(() => {
            const it = document.querySelector('.quiz-q-item');
            return { rows: it.querySelectorAll('.q-opt-row').length, metas: it.querySelectorAll('.rk-meta').length, extra: getComputedStyle(it.querySelector('.q-rank-extra')).display, chips: it.querySelectorAll('.rk-t[aria-pressed="true"]').length };
        });
        assert.equal(built.rows, 4, 'switching to Rank gives 4 option rows'); assert.equal(built.metas, 4, 'each row carries tier chips');
        assert.equal(built.extra, 'block', 'accepted-answers box shown'); assert.equal(built.chips, 0, 'no tier pre-picked');
        const fill = () => page.evaluate(() => {
            const it = document.querySelector('.quiz-q-item');
            const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
            set(it.querySelector('.q-text'), 'ผู้ป่วยหอบกำเริบ ยาตัวแรกที่ควรให้?');
            set(it.querySelector('.q-rk-accepted'), 'salbutamol, albuterol ,, ventolin');
            ['Salbutamol พ่น', 'Ipratropium พ่น', 'Prednisolone กิน', 'Theophylline'].forEach((o, i) => set(it.querySelectorAll('.q-opt')[i], o));
            const metas = it.querySelectorAll('.rk-meta');
            [0, 1, 1, 2].forEach((t, i) => metas[i].querySelector('.rk-t[data-t="' + t + '"]').click());
            metas[3].querySelector('.rk-u').click();
            set(metas[0].querySelector('.rk-why'), 'Fast relief — first line');
        });
        // an unpicked tier is -1 and blocks saving (before anything is typed in the other rows' chips)
        await page.evaluate(() => { const it = document.querySelector('.quiz-q-item'); const set = (el, v) => { el.value = v; }; set(it.querySelector('.q-text'), 'Q'); it.querySelectorAll('.q-opt').forEach((o, i) => { o.value = 'opt ' + i; }); });
        // V102.484: a NEW Rank card has no answer mode picked (no pre-selected default) — Save asks for it first
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.quiz-q-item .rk-md')].map(b => b.dataset.m + ':' + b.getAttribute('aria-pressed'))), ['order:false', 'tier:false'], 'neither mode is pre-selected');
        let q = await page.evaluate(() => getQuizFormData().questions[0]);
        assert.equal(q.mode, '', 'nothing chosen → mode "" (not order, not tier)');
        assert.equal(await page.evaluate(q => window.rankProblem(q), q), 'choose how interns answer — Order or Tier-box');
        await page.evaluate(() => { document.getElementById('quiz-title').value = 'Rank test'; window.__alerts.length = 0; }); await page.evaluate(() => saveQuiz());
        assert.ok(/Q1: choose how interns answer/.test((await page.evaluate(() => window.__alerts)).join('|')), 'saveQuiz blocks a Rank question with no mode chosen');
        await page.evaluate(() => document.querySelector('.quiz-q-item .rk-md[data-m="order"]').click());
        q = await page.evaluate(() => getQuizFormData().questions[0]); assert.ok(!('mode' in q), 'Order = no mode field (the old shape)');
        assert.deepEqual(q.tiers, [-1, -1, -1, -1]);
        assert.equal(await page.evaluate(q => window.rankProblem(q), q), 'pick Best / OK / Avoid for every option');
        await page.evaluate(() => { document.getElementById('quiz-title').value = 'Rank test'; window.__alerts.length = 0; });
        await page.evaluate(() => saveQuiz());
        let al = await page.evaluate(() => window.__alerts);
        assert.ok(al.length === 1 && /Rank question needs fixing/.test(al[0]) && /Q1: pick Best \/ OK \/ Avoid for every option/.test(al[0]), 'saveQuiz blocks an untiered Rank question: ' + al.join('|'));

        await fill();
        q = await page.evaluate(() => getQuizFormData().questions[0]);
        assert.equal(q.type, 'rank'); assert.equal(q.q, 'ผู้ป่วยหอบกำเริบ ยาตัวแรกที่ควรให้?');
        assert.deepEqual(q.options, ['Salbutamol พ่น', 'Ipratropium พ่น', 'Prednisolone กิน', 'Theophylline']);
        assert.deepEqual(q.accepted, ['salbutamol', 'albuterol', 'ventolin'], 'aliases trimmed, blanks dropped');
        assert.deepEqual(q.tiers, [0, 1, 1, 2]); assert.deepEqual(q.unsafe, [0, 0, 0, 1]); assert.deepEqual(q.why, ['Fast relief — first line', '', '', '']);
        assert.deepEqual(q.correct, [0], 'correct = the Best options'); assert.ok('timer' in q && 'explanation' in q && 'tags' in q, 'the common fields are still emitted');
        assert.equal(await page.evaluate(q => window.rankProblem(q) + '|' + window.RankQuiz.valid(q), q), '|true');

        // ---- the invalid shapes
        const prob = (o) => page.evaluate(q => window.rankProblem(q), { ...q, ...o });
        assert.equal(await prob({ tiers: [1, 1, 2, 2] }), 'at least one option must be Best');
        assert.match(await prob({ tiers: [0, 0, 0, 0] }), /at least two different levels/);
        assert.equal(await prob({ options: ['a'], tiers: [0], unsafe: [0], why: [''] }), 'use 2–6 options');
        assert.equal(await prob({ options: Array(7).fill('x'), tiers: [0, 1, 1, 1, 1, 1, 2] }), 'use 2–6 options');
        await page.evaluate(() => { document.querySelectorAll('.quiz-q-item .rk-meta').forEach(m => m.querySelector('.rk-t[data-t="0"]').click()); window.__alerts.length = 0; });
        await page.evaluate(() => saveQuiz());
        al = await page.evaluate(() => window.__alerts);
        assert.ok(al.length === 1 && /Q1: use at least two different levels/.test(al[0]), 'all-Best is blocked: ' + al.join('|'));
        await page.evaluate(() => { const m = document.querySelectorAll('.quiz-q-item .rk-meta'); m[1].querySelector('.rk-t[data-t="1"]').click(); m[2].querySelector('.rk-t[data-t="1"]').click(); m[3].querySelector('.rk-t[data-t="2"]').click(); });
        assert.deepEqual((await page.evaluate(() => getQuizFormData().questions[0])).tiers, [0, 1, 1, 2]);

        // ---- V102.484 Tier-box mode: the chip writes mode:'tier'; a ⚠ option must be Avoid; a saved question reads back as its mode
        await page.evaluate(() => document.querySelector('.quiz-q-item .rk-md[data-m="tier"]').click());
        q = await page.evaluate(() => getQuizFormData().questions[0]); assert.equal(q.mode, 'tier'); assert.deepEqual(q.tiers, [0, 1, 1, 2]);
        assert.equal(await page.evaluate(q => window.rankProblem(q), q), '', 'tier mode with the ⚠ option on Avoid is fine');
        assert.match(await page.evaluate(q => window.rankProblem(q), { ...q, unsafe: [0, 1, 0, 0] }), /⚠ unsafe option must be level Avoid/);
        assert.deepEqual(await page.evaluate(() => [window.rankModeOf({ type: 'rank', mode: 'tier' }), window.rankModeOf({ type: 'rank' }), window.rankModeOf({ type: 'rank', mode: '' }), window.rankModeOf({ type: 'choice' }), window.rankModeOf(undefined)]), ['tier', 'order', '', '', ''], 'a saved Rank question without a mode reads as Order');
        const rvT = await page.evaluate(q => window.rankReviewText({ ...q, mode: "tier" }, ["albuterol", "0,1,1,1"]), q);
        assert.match(rvT.studentText, /Theophylline ⚠ → OK/); assert.match(rvT.studentText, /unsafe option not put in Avoid/); assert.ok(rvT.credit <= 0.6);
        assert.match((await page.evaluate(q => window.rankReviewText({ ...q, mode: 'tier' }, ['x']), q)).studentText, /tiers not finished/);
        await page.evaluate(() => document.querySelector('.quiz-q-item .rk-md[data-m="order"]').click());
        q = await page.evaluate(() => getQuizFormData().questions[0]); assert.ok(!('mode' in q));
        // ---- the option cap and the way back to another type
        await page.evaluate(() => { const b = document.querySelector('.quiz-q-item .q-type-actions button'); addOption(b); addOption(b); addOption(b); });
        assert.equal(await page.evaluate(() => document.querySelectorAll('.quiz-q-item .q-opt-row').length), 6, 'capped at 6 options');
        assert.equal(await page.evaluate(() => document.querySelectorAll('.quiz-q-item .rk-meta').length), 6, 'new rows get tier chips');
        await page.evaluate(() => { document.querySelectorAll('.quiz-q-item .q-opt-row').forEach((r, i) => { if (i > 3) r.remove(); }); const h = document.querySelector('.quiz-q-item .q-type'); h.value = 'choice'; toggleQType(h); });
        assert.deepEqual(await page.evaluate(() => [document.querySelectorAll('.quiz-q-item .rk-meta').length, document.querySelectorAll('.quiz-q-item .rk-row').length, getComputedStyle(document.querySelector('.q-rank-extra')).display]), [0, 0, 'none'], 'back to choice: tier rows and accepted box gone');
        await page.evaluate(() => { const h = document.querySelector('.quiz-q-item .q-type'); h.value = 'rank'; toggleQType(h); });
        assert.equal(await page.evaluate(() => document.querySelectorAll('.quiz-q-item .rk-t[aria-pressed="true"]').length), 0, 'tiers start empty again — never carried over');

        // ---- round trip: a saved Rank question comes back into the editor with its tiers, ⚠ and why
        await page.evaluate(() => { document.getElementById('quiz-questions-container').innerHTML = ''; });
        await page.evaluate(q => addQuestionUI(q), q);
        const rt = await page.evaluate(() => { const it = document.querySelector('.quiz-q-item'); return { q: getQuizFormData().questions[0], type: it.querySelector('.q-type').value, active: it.querySelector('.q-type-toggle .glass-toggle-item.active').dataset.value, accepted: it.querySelector('.q-rk-accepted').value, listShown: getComputedStyle(it.querySelector('.options-container')).display, actions: it.querySelector('.q-type-actions').innerText }; });
        assert.equal(rt.type, 'rank'); assert.equal(rt.active, 'rank'); assert.equal(rt.accepted, 'salbutamol, albuterol, ventolin'); assert.equal(rt.listShown, 'flex'); assert.match(rt.actions, /Option/);
        for (const k of ['type', 'q', 'options', 'accepted', 'tiers', 'unsafe', 'why', 'correct']) assert.deepEqual(rt.q[k], q[k], 'round trip keeps ' + k);

        // ---- re-grading a stored answer: 0.92 for the rank question + 1 for the plain choice question
        const g = await page.evaluate(q => {
            const quiz = { totalPoints: 2, questions: [q, { type: 'choice', q: 'x', options: ['a', 'b'], correct: [0] }] };
            const R = window.RankQuiz;
            const att = { answers: [R.pack('albuterol', [0, 2, 3, 1]), '0'] };
            const a = calculateAttemptScoring(att, quiz);
            const half = calculateAttemptScoring({ answers: [R.pack('albuterol'), '1'] }, quiz);
            const manual = calculateAttemptScoring({ answers: [R.pack('x', [3, 2, 1, 0]), '1'], manualCorrect: { 0: true } }, quiz);
            return { a, half, manual };
        }, q);
        assert.deepEqual(g.a, { correctCount: 1.92, score: 1.92 }, 'rank 0.92 + choice 1');
        assert.deepEqual(g.half, { correctCount: 0, score: 0 }, 'an unfinished rank answer earns nothing');
        assert.deepEqual(g.manual, { correctCount: 1, score: 1 }, 'the manual override still grants full credit');

        // ---- the "Incorrect Questions Review" PDF: a Rank answer reads as stars + typed answer + order, the key by level; under ★4 is "incorrect"
        const pdfSrc = require('node:fs').readFileSync('public/admin.html', 'utf8');
        assert.ok(pdfSrc.includes('window.rankReviewText(q, studentAns)') && pdfSrc.includes('isCorrect = rkv.credit >= 0.8;') && pdfSrc.includes('studentText = rkv.studentText; correctText = rkv.correctText;'), 'exportIncorrectToPDF uses rankReviewText');
        const rv = await page.evaluate(() => {
            const RQ = { type: 'rank', q: 'x', accepted: ['salbutamol', 'albuterol'], options: ['Salbutamol พ่น', 'Ipratropium พ่น', 'Prednisolone กิน', 'Theophylline'], tiers: [0, 1, 1, 2], unsafe: [0, 0, 0, 1] };
            return { good: rankReviewText(RQ, RankQuiz.pack('albuterol', [0, 2, 3, 1])), bad: rankReviewText(RQ, RankQuiz.pack('albuterol', [3, 2, 1, 0])), half: rankReviewText(RQ, 'x'), none: rankReviewText(RQ, undefined) };
        });
        assert.ok(rv.good.credit >= 0.8 && rv.good.credit < 0.95, 'a ★4 answer is not listed as incorrect (credit ' + rv.good.credit + ')');
        assert.equal(rv.good.studentText, '★★★★☆  ·  “albuterol”  ·  Salbutamol พ่น › Prednisolone กิน › Theophylline ⚠ › Ipratropium พ่น');
        assert.equal(rv.good.correctText, 'Best: Salbutamol พ่น  ›  OK: Ipratropium พ่น / Prednisolone กิน  ›  Avoid: Theophylline ⚠');
        assert.ok(rv.bad.credit < 0.8 && rv.bad.studentText.startsWith('★☆☆☆☆  ·  “albuterol”  ·  Theophylline ⚠ ›') && /unsafe option above a best one/.test(rv.bad.studentText), 'a reversed order is incorrect and flags the safety miss');
        assert.equal(rv.half.studentText, '“x” (ranking not finished)'); assert.equal(rv.none.studentText, 'None'); assert.equal(rv.none.credit, 0);

        const mine = errors.filter(e => /rank|Rank|addQuestionUI|toggleQType|getQuizFormData|calculateAttemptScoring|saveQuiz|addOption/.test(e));
        assert.deepEqual(mine, [], 'no errors from the editor code: ' + mine.join(' | '));
        console.log('PASS: Quiz Editor Rank question — 4 untiered rows with no pre-picked tier, getQuizFormData fields (tiers / unsafe / why / accepted / correct), saveQuiz blocks untiered / all-Best, 6-option cap, switching type clears the tier rows, saved question round-trips, admin re-grading (0.92 + manual override)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
