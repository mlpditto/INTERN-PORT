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

const QUIZ_ANS = [null, ['albuterol', '0,2,3,1'], ['ยาพ่นอะไรสักอย่าง', '0,1,2,3']];
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

        // V101.231 helpers — effective hit area of an element (walk outwards with elementFromPoint), the shared footer, and the Rank action row
        const hit = sel => page.evaluate(sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; const own = (x, y) => { const e = document.elementFromPoint(x, y); return e && (e === el || el.contains(e)); }; let up = 0, dn = 0, lf = 0, rt = 0; while (up < 40 && own(cx, cy - up - 1)) up++; while (dn < 40 && own(cx, cy + dn + 1)) dn++; while (lf < 200 && own(cx - lf - 1, cy)) lf++; while (rt < 200 && own(cx + rt + 1, cy)) rt++; return { w: Math.round(r.width), h: Math.round(r.height), hitW: lf + rt + 1, hitH: up + dn + 1, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }, sel);
        const footerShown = () => page.evaluate(() => getComputedStyle(document.getElementById('quiz-run-footer')).display !== 'none');
        // 1 · type phase: input only, lock waits for text, no options yet
        let s = await st();
        assert.equal(await footerShown(), false, 'V101.231: the shared footer is hidden on a Rank step');
        { const lk = await hit('#rk-lock'), nx = await hit('.rk-next'), pv = await hit('.rk-prev'); assert.ok(lk.h <= 36 && lk.hitW >= 44 && lk.hitH >= 44, 'lock ➤ is small but has a 44px hit area: ' + JSON.stringify(lk)); assert.ok(nx && nx.hitH >= 40 && pv && pv.hitH >= 40, 'Next / ‹ ≥ 40px'); assert.ok(await page.locator('#rk-submit').count() === 0, 'not the last question → Next, not Submit'); assert.equal(await page.locator('#rk-lock').evaluate(el => el.closest('.rk-inw') !== null), true, 'lock sits INSIDE the field'); }
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
        { const g = await hit('.rk-go'), nx = await hit('.rk-next'), rs = await hit('.rk-reset'); assert.ok(g.hitH >= 44 && g.h <= 40 && rs.hitW >= 40 && rs.hitH >= 40 && rs.w <= 36, 'Lock keeps 44px, ↺ 40px of hit area on a lean button: ' + JSON.stringify([g, rs])); assert.ok(nx.left - g.right >= 8, 'Lock and Next are ≥ 8px apart (Lock is irreversible): ' + (nx.left - g.right)); assert.equal(Math.round(g.top / 4), Math.round(nx.top / 4), 'one action row');
          const gs = await page.locator('.rk-go').evaluate(el => { const c = getComputedStyle(el); return [c.backgroundColor, c.boxShadow !== 'none']; }); assert.equal(gs[1], true, 'a disabled Lock is flat grey with an outline'); }
        const tap = t => page.locator('.rk-opt', { hasText: t }).click();
        await tap('Salbutamol'); await tap('Prednisolone'); await tap('Theophylline');
        assert.equal(await page.locator('.rk-go').isDisabled(), true, 'needs every option ranked');
        await tap('Ipratropium');
        s = await st(); assert.deepEqual(s.nums.map(Number), [3, 4, 1, 2], 'numbers follow the tap order (display order Theo, Ipra, Salb, Pred)');
        await tap('Ipratropium'); s = await st(); assert.equal(s.nums.filter(Boolean).length, 3, 'tapping a ranked option un-ranks it');
        await page.click('.rk-reset'); s = await st(); assert.equal(s.nums.filter(Boolean).length, 0, 'Reset clears the taps');
        await tap('Salbutamol'); await tap('Prednisolone'); await tap('Theophylline'); await tap('Ipratropium');
        { const g = await page.locator('.rk-go').evaluate(el => getComputedStyle(el).backgroundColor); assert.equal(g, 'rgb(251, 191, 36)', 'enabled Lock = amber'); const nx = await page.locator('.rk-next').evaluate(el => getComputedStyle(el).backgroundColor); assert.equal(nx, 'rgb(67, 97, 238)', 'Next = house indigo'); }
        await page.click('.rk-go');

        // 3 · reveal: order 0,2,3,1 → 92% → ★4; the key best tier first, "you #n" red where a pair is wrong; stored as the joined parts
        s = await st();
        assert.deepEqual(s.ua, ['albuterol', '0,2,3,1']); assert.deepEqual(s.answered, [false, true, false]); assert.equal(s.saved, 2);
        await page.evaluate(() => { isPracticeMode = true; renderQuizStep(true); clearInterval(quizTimerInterval); });   // the same locked answer, now as PRACTICE shows it: instant reveal
        const rv = await page.evaluate(() => ({ filled: document.querySelector('.rk-star b').firstChild.textContent, all: document.querySelector('.rk-star b').textContent,
            rows: [...document.querySelectorAll('.rk-key')].map(r => r.querySelector('.t').textContent + '|' + r.querySelector('.me').textContent + (r.querySelector('.me.bad') ? '!' : '')),
            pts: document.querySelector('.rk-rew').textContent, chip: (document.querySelector('.rk-chip') || {}).textContent, ask: !!document.querySelector('.rk-ask'), note: document.querySelector('.rk-note').textContent, warn: !!document.querySelector('.rk-warn') }));
        assert.equal(rv.filled, '★★★★'); assert.equal(rv.all, '★★★★★', 'four lit + one dim');
        assert.deepEqual(rv.rows, ['Best|you #1', 'OK|you #4!', 'OK|you #2', 'Avoid|you #3!']);
        assert.match(rv.pts, /Practice — no points/, 'practice mode: instant reveal, no points (a real quiz shows points in the review after Submit)');
        assert.match(rv.chip, /matched the best answer/); assert.equal(rv.ask, false); assert.match(rv.note, /^Typed ✓ · Best ✓ · 4\/5$/, 'V101.231: one short summary line'); assert.equal(rv.warn, false);
        assert.equal(await footerShown(), false); assert.equal(await page.locator('.rk-nav .rk-note').count(), 1, 'the reveal ends with [‹] [summary] [Next ›]');
        if (process.env.QA_SHOT) await page.screenshot({ path: process.env.QA_SHOT + '/rank-runner-reveal.png' });
        // footer logic: a plain step brings the shared footer back, a Rank step hides it again; the primer page keeps its Start button
        await page.evaluate(() => { currentStep = 0; renderQuizStep(false); clearInterval(quizTimerInterval); }); assert.equal(await footerShown(), true, 'a non-Rank step shows the shared footer');
        await page.evaluate(() => { currentQuiz.questions[1].primer = 'Read this first'; primerSeen = []; currentStep = 1; renderQuizStep(false); clearInterval(quizTimerInterval); });
        assert.equal(await footerShown(), true, 'the primer page of a Rank question shows the footer'); assert.equal(await page.locator('#btn-quiz-primer-start').isVisible(), true, 'with its Start button');
        await page.evaluate(() => { startQuizQuestionAfterPrimer(); clearInterval(quizTimerInterval); delete currentQuiz.questions[1].primer; }); assert.equal(await footerShown(), false, 'after Start the Rank step hides it again');

        // V101.231: the LAST question is a Rank question → Submit takes Next's place in the Rank action row
        await page.evaluate(() => { currentStep = 2; renderQuizStep(false); clearInterval(quizTimerInterval); });
        assert.equal(await page.locator('#rk-submit').count(), 1, 'last question → Submit'); assert.equal(await page.locator('.rk-next').count(), 0); assert.equal(await page.evaluate(() => submitQuiz.toString().includes('hasEmptyAnswers')), true);
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

        // 6 · Beri: ★4 = +1, ★5 = +2 once per question (ledger = dedupe), a daily cap, none in practice mode, none for ★3 or less
        await page.evaluate((QUIZ_ANS) => {
            window.__sets = []; window.__ledgerExists = false; window.__daily = {}; window.myRegistered = true;
            firebase = { firestore: { FieldValue: { increment: n => ({ inc: n }), serverTimestamp: () => "TS" } } };
            window.db = { collection: () => ({ doc: id => ({ id }) }), runTransaction: async fn => fn({ get: async ref => (typeof ref === "function" ? { exists: window.__ledgerExists } : { exists: true, data: () => window.__daily }), set: (ref, data) => window.__sets.push([typeof ref === "function" ? "ledger" : ref.id, data]) }) };
            for (const k of Object.keys(rankBeri)) delete rankBeri[k]; isPracticeMode = false;
            userAnswers = QUIZ_ANS.map(x => x); currentStep = 1; renderQuizStep(false); clearInterval(quizTimerInterval);
        }, QUIZ_ANS);
        await page.evaluate(() => rankAwardBeri(1, true)); await page.waitForTimeout(100);
        let sets = await page.evaluate(() => window.__sets);
        assert.equal(sets.length, 3, "★4 on Q2 (matched typed answer) → one daily row, one user row, one ledger row");
        const led = sets.find(x => x[0] === "ledger")[1], usr = sets.find(x => x[0] === "u1")[1];
        assert.deepEqual([led.source, led.amount, led.refId, usr.beri.inc], ["quiz_rank", 1, "QR_u1_1", 1]);
        assert.equal(sets.find(x => /^u1_/.test(x[0]))[1].rankAmount.inc, 1);
        assert.equal(await page.evaluate(() => rankBeri['QR:1'].state), 'ok', 'the credit is recorded');
        await page.evaluate(() => rankAwardBeri(1, true)); assert.equal((await page.evaluate(() => window.__sets)).length, 3, "asking again in the same session pays nothing more");
        // a retake / second device: the ledger row exists → silent "done", nothing written
        await page.evaluate(() => { window.__sets.length = 0; window.__ledgerExists = true; delete rankBeri["QR:1"]; }); await page.evaluate(() => rankAwardBeri(1, true));
        assert.deepEqual([(await page.evaluate(() => window.__sets)).length, await page.evaluate(() => rankBeri["QR:1"].state)], [0, "done"]);
        // cap: 49 earned today + 2 would pass 50 → skipped, chip says so
        await page.evaluate(() => { window.__ledgerExists = false; window.__daily = { rankAmount: 49 }; delete rankBeri["QR:1"]; currentStep = 2; });
        await page.evaluate(() => { userAnswers[2] = ["x", "0,1,2,3", "m:0"]; rankAwardBeri(2, true); }); await page.waitForTimeout(100);
        assert.deepEqual([(await page.evaluate(() => window.__sets)).length, await page.evaluate(() => rankBeri["QR:2"].state)], [0, "cap"], "★5 = +2 does not fit under the cap of 50 → skipped, not trimmed");
        // practice mode, an unsettled ★3 and a ★5 on a different quiz id
        await page.evaluate(() => { for (const k of Object.keys(rankBeri)) delete rankBeri[k]; window.__daily = {}; isPracticeMode = true; rankAwardBeri(2, true); });
        assert.equal((await page.evaluate(() => window.__sets)).length, 0, "practice mode never pays");
        await page.evaluate(() => { isPracticeMode = false; userAnswers[2] = ["x", "3,2,1,0"]; rankAwardBeri(2, true); });
        assert.equal((await page.evaluate(() => window.__sets)).length, 0, "a ★1 pays nothing");
        await page.evaluate(() => { userAnswers[2] = ["x", "0,1,2,3", "m:0"]; rankAwardBeri(2, true); }); await page.waitForTimeout(100);
        sets = await page.evaluate(() => window.__sets); assert.equal(sets.find(x => x[0] === "ledger")[1].amount, 2, "★5 pays +2");

        // 7 · V101.231 REAL quiz: nothing is revealed per question — the lock shows a compact state, Beri / ★ wait for Submit, the self-match is asked once before Submit's confirm
        await page.evaluate(() => { window.__sets.length = 0; for (const k of Object.keys(rankBeri)) delete rankBeri[k]; for (const k of Object.keys(rankPick)) delete rankPick[k]; isPracticeMode = false; userAnswers = [null, ['albuterol'], ['ยาพ่นอะไรสักอย่าง', '0,1,2,3']]; currentStep = 1; renderQuizStep(false); clearInterval(quizTimerInterval); });
        await tap('Salbutamol'); await tap('Prednisolone'); await tap('Theophylline'); await tap('Ipratropium'); await page.click('.rk-go');
        assert.equal(await page.locator('.rk-done').count(), 1); assert.match(await page.locator('.rk-done').textContent(), /✓ Order locked — answers show after you submit/);
        assert.deepEqual(await page.evaluate(() => ['.rk-star', '.rk-key', '.rk-rew', '.rk-chip', '.rk-ask', '.rk-note'].map(s => document.querySelectorAll(s).length)), [0, 0, 0, 0, 0, 0], 'no ★, key, points, chip, self-match or summary before Submit');
        assert.equal(await footerShown(), false); assert.equal(await page.locator('.rk-nav .rk-next').count(), 1, 'Next stays on the same row');
        assert.equal((await page.evaluate(() => window.__sets)).length, 0, 'no Beri is paid (and no toast) while the answers are hidden');
        assert.deepEqual(await page.evaluate(() => userAnswers[1]), ['albuterol', '0,2,3,1']);
        // leave and come back: still the locked state, never the reveal
        await page.evaluate(() => { currentStep = 0; renderQuizStep(false); clearInterval(quizTimerInterval); currentStep = 1; renderQuizStep(false); clearInterval(quizTimerInterval); });
        assert.equal(await page.locator('.rk-done').count(), 1); assert.equal(await page.locator('.rk-star').count(), 0, 'going back shows the locked state, not the reveal');
        // a locked answer that was saved and resumed (joined string) still counts and still scores
        const res = await page.evaluate(() => { const a = 'albuterol\n---\n0,2,3,1'; userAnswers[1] = a; renderQuizStep(false); clearInterval(quizTimerInterval); return [quizStepIsAnswered(1), RankQuiz.score(currentQuiz.questions[1], a).stars, document.querySelectorAll('.rk-done').length]; });
        assert.deepEqual(res, [true, 4, 1], 'a resumed locked answer is answered and scores ★4'); await page.evaluate(() => { userAnswers[1] = ['albuterol', '0,2,3,1']; });
        // typed but never locked → not answered (counts as unanswered at Submit); the sheet only asks about LOCKED questions whose typed answer matched nothing
        const pend = await page.evaluate(() => { userAnswers[1] = ['albuterol']; const a = rankPendingMatches(); userAnswers[1] = ['albuterol', '0,2,3,1']; return [a, rankPendingMatches(), quizStepIsAnswered(1) ]; });
        assert.deepEqual(pend[0], [2], 'only the locked, unmatched Q3 is asked (Q2 typed only → not locked; Q2 locked + auto-matched → no question)'); assert.deepEqual(pend[1], [2]); assert.equal(pend[2], true);
        // the sheet: pick an option → Continue → stored as the third part; an untouched question is stored as "none"
        await page.evaluate(() => { window.__sheet = rankMatchSheet([2]); });
        assert.equal(await page.locator('#rk-match-sheet').count(), 1); assert.equal(await page.locator('#rk-match-sheet .rk').count(), 1, 'the global button reset applies in the sheet');
        await page.locator('#rk-match-sheet .rk-ask button', { hasText: 'Salbutamol' }).click(); assert.equal(await page.locator('#rk-match-sheet .rk-ask button.on').count(), 1);
        await page.click('#rk-match-go'); await page.evaluate(() => window.__sheet);
        assert.deepEqual(await page.evaluate(() => userAnswers[2]), ['ยาพ่นอะไรสักอย่าง', '0,1,2,3', 'm:0']); assert.equal(await page.locator('#rk-match-sheet').count(), 0);
        await page.evaluate(() => { userAnswers[2] = ['ยาพ่นอะไรสักอย่าง', '0,1,2,3']; window.__sheet = rankMatchSheet([2]); }); await page.click('#rk-match-go'); await page.evaluate(() => window.__sheet);
        assert.deepEqual(await page.evaluate(() => userAnswers[2]), ['ยาพ่นอะไรสักอย่าง', '0,1,2,3', 'm:-'], 'Continue without picking = none');
        assert.deepEqual(await page.evaluate(() => rankPendingMatches()), [], 'asked once');
        // Submit asks for the self-match first, and counts a Rank question that was not locked as unanswered
        const ss = await page.evaluate(() => submitQuiz.toString()); assert.ok(ss.indexOf('rankPendingMatches()') > 0 && ss.indexOf('rankPendingMatches()') < ss.indexOf('confirm('), 'the self-match comes before the confirm'); assert.ok(/type === 'rank' && !quizStepIsAnswered\(qi\)/.test(ss), 'an unlocked Rank counts as unanswered');
        // practice mode keeps the instant reveal
        await page.evaluate(() => { isPracticeMode = true; renderQuizStep(false); clearInterval(quizTimerInterval); }); assert.equal(await page.locator('.rk-star').count(), 1, 'practice: instant reveal'); assert.equal(await page.locator('.rk-done').count(), 0);

        const mine = errors.filter(e => /rank|Rank|rk[A-Z]/.test(e)); assert.deepEqual(mine, [], 'no Rank errors: ' + mine.join(' | '));
        console.log('PASS: Rank question in the intern runner — typed answer locks, options shuffled, tap order + reset, ★ reveal with tier key and red misplaced, self-match, answered state, saved parts');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
