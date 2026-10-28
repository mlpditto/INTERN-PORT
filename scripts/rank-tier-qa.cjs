// V101.231 Rank TIER-BOX mode (question.mode === 'tier'): the intern puts EACH option in Best / OK / Avoid instead of ordering them.
// A · rank-quiz.js scoring (pure, Node) incl. the DDD-1 Q2 worked example · B · the REAL index.html runner on a phone (assign, lock, locked state for a counted quiz, practice reveal, Submit on the last question)
// C · the admin editor / review wiring (source checks — the editor itself is driven by rank-quiz-admin-qa).
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const R = require('../public/rank-quiz.js');

// ---------- A · pure scoring ----------
// DDD-1 Q2 (GERD in pregnancy). Option order = the author's: Ranitidine, Calcium carbonate, Gaviscon, Metoclopramide, Omeprazole  →  tiers 1,0,0,2,1
const Q2 = { type: 'rank', mode: 'tier', q: 'GERD in pregnancy — first drug?', accepted: ['gaviscon', 'calcium carbonate'],
    options: ['Ranitidine 150 mg', 'Calcium carbonate', 'Gaviscon', 'Metoclopramide 10 mg', 'Omeprazole 20 mg'], tiers: [1, 0, 0, 2, 1], unsafe: [0, 0, 0, 0, 0] };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const mine = '1,1,0,2,1';   // Ranitidine OK ✓ · Calcium carbonate OK (key Best → ½) · Gaviscon Best ✓ · Metoclopramide Avoid ✓ · Omeprazole OK ✓
let s = R.score(Q2, R.pack('ANTACID', mine.split(',').map(Number)));
assert.deepEqual([s.phase, s.exact, s.adjacent, s.off, s.n, s.free], ['reveal', 4, 1, 0, 5, 0]);
assert.ok(near(s.rank, 0.9) && near(s.credit, 0.72) && s.stars === 3, 'typed ✗ → 0.8 × 0.9 = 0.72 → ★3');
s = R.score(Q2, R.pack('ANTACID', mine.split(',').map(Number), 2));   // self-match: pointed at Gaviscon (Best) → the typed part is full
assert.ok(near(s.credit, 0.92) && s.stars === 4 && s.matched === 'self', 'typed ✓ (self-match to a Best option) → 0.92 → ★4');
s = R.score(Q2, R.pack('gaviscon', [1, 1, 0, 2, 1]));
assert.ok(near(s.credit, 0.92) && s.matched === 'auto', 'typed ✓ (auto match) → 0.92 → ★4');
assert.deepEqual(R.tierMarks(Q2, [1, 1, 0, 2, 1]), ['ex', 'ad', 'ex', 'ex', 'ex']);
assert.deepEqual(R.tierMarks(Q2, [2, 2, 2, 0, 0]), ['ad', 'no', 'no', 'no', 'ad'], 'Best ↔ Avoid is 0, one level off is ½');
s = R.score(Q2, R.pack('gaviscon', [1, 0, 0, 2, 1])); assert.ok(near(s.credit, 1) && s.stars === 5 && s.exact === 5, 'perfect → ★5');
s = R.score(Q2, R.pack('x', [2, 2, 2, 0, 0])); assert.ok(near(s.credit, 0.8 * (0.5 + 0 + 0 + 0 + 0.5) / 5) && s.stars === 1, 'everything backwards → the worst the sum allows');
// safety: ANY unsafe option not put in Avoid caps the credit at 0.6 (≤ ★3), whatever else is right
const Q3 = { ...Q2, unsafe: [0, 0, 0, 1, 0] };
s = R.score(Q3, R.pack('gaviscon', [1, 0, 0, 1, 1])); assert.ok(s.safetyMiss && near(s.credit, 0.6) && s.stars === 3, 'unsafe Metoclopramide put in OK → capped at 0.6');
assert.ok(!R.score(Q3, R.pack('gaviscon', [1, 0, 0, 2, 1])).safetyMiss, 'unsafe in Avoid → no miss');
// storage round trip + phases (tier answers are 0..2 per option, NOT a permutation)
const a = R.pack('x y', [0, 0, 2, 1, 1], -1);
assert.equal(a, 'x y\n---\n0,0,2,1,1\n---\nm:-');
assert.deepEqual(R.parse(a, 5, 'tier'), { typed: 'x y', locked: true, order: null, match: -1, tiers: [0, 0, 2, 1, 1] });
assert.equal(R.phase(['x'], 5, 'tier'), 'rank'); assert.equal(R.phase(['x', '0,0,2,1,1'], 5, 'tier'), 'reveal'); assert.equal(R.phase(undefined, 5, 'tier'), 'type');
assert.equal(R.phase(['x', '0,0,3,1,1'], 5, 'tier'), 'rank', 'a tier outside 0..2 is not a lock'); assert.equal(R.phase(['x', '0,0,2,1'], 5, 'tier'), 'rank', 'a short answer is not a lock');
assert.equal(R.phase(['x', '0,0,2,1,1'], 5), 'rank', 'the same string read as an ORDER is not a permutation → not locked (old behaviour untouched)');
assert.equal(R.score({ ...Q2, mode: undefined }, ['x', '0,0,2,1,1']).stars, 0, 'without mode the tier string is just an unfinished order');
// gradable
assert.ok(R.valid(Q2) && !R.valid({ ...Q2, tiers: [1, 0, 0, 2] }) && !R.valid({ ...Q2, tiers: [1, 0, 0, 2, 3] }) && !R.valid({ ...Q2, tiers: [1, 1, 1, 1, 1] }) && !R.valid({ ...Q2, tiers: [0, 0, 0, 0, 0] }), 'tier mode needs one explicit tier per option, a Best and two levels');
assert.equal(R.isTier(Q2), true); assert.equal(R.isTier({ ...Q2, mode: '' }), false); assert.equal(R.isTier({ type: 'rank' }), false);
// OLD Rank questions and attempts: exactly as before
const OLD = { type: 'rank', q: 'q', accepted: ['salbutamol'], options: ['Salbutamol', 'Ipratropium', 'Prednisolone', 'Theophylline'], tiers: [0, 1, 1, 2], unsafe: [0, 0, 0, 0] };
s = R.score(OLD, R.pack('salbutamol', [0, 2, 3, 1])); assert.ok(near(s.credit, 0.92) && s.stars === 4 && !('tiers' in s && s.tiers) && s.pairTotal === 5, 'order mode: 0.92 / ★4 as before');
assert.deepEqual(R.parse(R.pack('a', [3, 2, 1, 0], -1), 4), { typed: 'a', locked: true, order: [3, 2, 1, 0], match: -1 }, 'order-mode parse keeps its exact shape');
console.log('rank-tier-qa A: scoring ok');

// ---------- C · admin wiring (source) ----------
const admin = fs.readFileSync('public/admin.html', 'utf8'), idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(admin.includes('class="rk-md"') && admin.includes("rankMode(this,'${m}')") && admin.includes('window.rankModeOf'), 'the editor has the Order | Tier-box chips');
assert.ok(admin.includes("choose how interns answer — Order or Tier-box") && admin.includes('in Tier-box mode a ⚠ unsafe option must be level Avoid'), 'Save asks for a mode, ⚠ must be Avoid in tier mode');
assert.ok(admin.includes("'typed, not ranked'") && admin.includes("'typed, tiers not locked'") && admin.includes('(nothing typed)'), 'the attempt review tells "typed, not ranked" from "nothing typed"');
assert.ok(admin.includes('rankSc.tiers') && admin.includes("'Rank · tiers'"), 'the attempt review lists the learner level vs the key per option');
assert.ok(/rank-quiz\.js\?v=V102\.\d+/.test(admin) && /rank-quiz\.js\?v=V101\.\d+/.test(idx), 'rank-quiz.js cache-busters');
console.log('rank-tier-qa C: admin wiring ok');

// ---------- B · the intern runner ----------
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const CH = { type: 'choice', q: 'Plain choice', options: ['a', 'b'], correct: [0] };
const TQ = { ...Q2, why: ['Usable', 'Safe in pregnancy', 'Reduces reflux', 'Not first line', 'If antacids fail'] };
const QUIZ = { id: 'TQ', title: 'Tier', shortTitle: 'Tier', quizType: 'standard', totalPoints: 3, questions: [CH, TQ, { ...TQ, accepted: ['zzz'] }] };
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
            shuffleMap = qz.questions.map(() => null); shuffleMap[1] = [3, 1, 0, 4, 2]; shuffleMap[2] = [2, 0, 3, 1, 4];
            currentStep = 1; document.getElementById('quizModal').style.display = 'flex'; renderQuizStep(false); clearInterval(quizTimerInterval);
        }, [QUIZ]);
        const hit = sel => page.evaluate(sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; const own = (x, y) => { const e = document.elementFromPoint(x, y); return e && (e === el || el.contains(e)); }; let up = 0, dn = 0; while (up < 40 && own(cx, cy - up - 1)) up++; while (dn < 40 && own(cx, cy + dn + 1)) dn++; return { h: Math.round(r.height), hitH: up + dn + 1, w: Math.round(r.width), left: r.left, right: r.right }; }, sel);
        const footerShown = () => page.evaluate(() => getComputedStyle(document.getElementById('quiz-run-footer')).display !== 'none');
        const rows = () => page.evaluate(() => [...document.querySelectorAll('#quiz-run-container .rk-trow')].map(r => ({ x: r.querySelector('.x').textContent, a: r.dataset.a, on: [...r.querySelectorAll('.rk-seg button.on')].map(b => b.dataset.t) })));

        // 1 · type first (one try), then the tier rows — shuffled, nothing pre-selected, Lock waits for every row
        assert.equal(await page.locator('#rk-typed').count(), 1); assert.equal(await page.locator('.rk-trow').count(), 0, 'no options before the typed answer is locked');
        await page.fill('#rk-typed', 'ANTACID'); await page.click('#rk-lock');
        let r = await rows();
        assert.deepEqual(r.map(x => x.x), ['Metoclopramide 10 mg', 'Calcium carbonate', 'Ranitidine 150 mg', 'Omeprazole 20 mg', 'Gaviscon'], 'display order = shuffleMap');
        assert.ok(r.every(x => x.a === '' && x.on.length === 0), 'no tier is pre-selected'); assert.equal(await page.locator('.rk-go').isDisabled(), true);
        assert.equal(await page.locator('.rk-cnt').textContent(), '0/5'); assert.equal(await page.locator('.rk-mine').textContent(), '🔒 Your answer: ANTACID');
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.rk-seg')].map(x => x.textContent).concat(document.querySelector('.rk-top').textContent.match(/d/g) || [])), Array(5).fill('BestOKAvoid'), 'the chips are only Best / OK / Avoid — no per-tier counts leak before answering');
        const setTier = (name, t) => page.locator('.rk-trow', { hasText: name }).locator('.rk-seg button[data-t="' + t + '"]').click();
        await setTier('Ranitidine', 1); await setTier('Calcium', 1); await setTier('Gaviscon', 0); await setTier('Metoclopramide', 2);
        assert.equal(await page.locator('.rk-go').isDisabled(), true, 'needs every option placed'); assert.equal(await page.locator('.rk-cnt').textContent(), '4/5');
        await setTier('Omeprazole', 1); assert.equal(await page.locator('.rk-go').isDisabled(), false, 'Lock enables once every row has a tier');
        await setTier('Omeprazole', 1); r = await rows(); assert.equal(r[3].a, '', 'tapping the chosen chip again clears it'); assert.equal(await page.locator('.rk-go').isDisabled(), true);
        await page.click('.rk-reset'); assert.ok((await rows()).every(x => x.a === ''), 'Reset clears every row');
        await setTier('Ranitidine', 1); await setTier('Calcium', 1); await setTier('Gaviscon', 0); await setTier('Metoclopramide', 2); await setTier('Omeprazole', 1);
        r = await rows(); assert.deepEqual(r.map(x => x.a), ['2', '1', '1', '1', '0']);
        // tap targets on the lean row: visible chip 32px, ≥ 40px of hit area; Lock vs Next ≥ 8px apart, amber vs indigo
        { const c = await hit('.rk-seg button'), g = await hit('.rk-go'), nx = await hit('.rk-next'); assert.ok(c.h <= 34 && c.hitH >= 40, 'tier chip: ' + JSON.stringify(c)); assert.ok(g.hitH >= 44 && nx.left - g.right >= 8, 'Lock / Next apart: ' + (nx.left - g.right));
            assert.equal(await page.locator('.rk-go').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(251, 191, 36)'); assert.equal(await page.locator('.rk-next').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(67, 97, 238)'); }
        assert.equal(await footerShown(), false);
        const before = await page.evaluate(() => [quizStepIsAnswered(1), window.__saved.length]); assert.deepEqual(before, [false, 1], 'typed only → not answered; the lock saved once');
        await page.click('.rk-go');
        assert.deepEqual(await page.evaluate(() => userAnswers[1]), ['ANTACID', '1,1,0,2,1'], 'stored in the ORIGINAL option order');
        assert.equal(await page.evaluate(() => [quizStepIsAnswered(1), window.__saved.length].join()), 'true,2');

        // 2 · a COUNTED quiz reveals nothing per question — a compact locked state, no ★ / key / points / Beri
        assert.match(await page.locator('.rk-done').textContent(), /✓ Tiers locked — answers show after you submit/);
        assert.deepEqual(await page.evaluate(() => ['.rk-star', '.rk-key', '.rk-rew', '.rk-chip', '.rk-ask', '.rk-note', '.rk-trow'].map(s => document.querySelectorAll(s).length)), [0, 0, 0, 0, 0, 0, 0]);
        await page.evaluate(() => { currentStep = 0; renderQuizStep(false); clearInterval(quizTimerInterval); currentStep = 1; renderQuizStep(false); clearInterval(quizTimerInterval); });
        assert.equal(await page.locator('.rk-done').count(), 1, 'going back shows the locked state again, not the reveal');
        // the unmatched typed answer is asked once, before Submit's confirm (the key stays hidden until then)
        assert.deepEqual(await page.evaluate(() => rankPendingMatches()), [1], 'ANTACID matched no accepted alias → asked');
        await page.evaluate(() => { window.__p = rankMatchSheet([1]); }); await page.locator('#rk-match-sheet .rk-ask button', { hasText: 'Gaviscon' }).click(); await page.click('#rk-match-go'); await page.evaluate(() => window.__p);
        assert.deepEqual(await page.evaluate(() => userAnswers[1]), ['ANTACID', '1,1,0,2,1', 'm:2'], 'the self-match is stored as the third part');
        assert.equal(await page.evaluate(() => RankQuiz.score(currentQuiz.questions[1], userAnswers[1]).stars), 4, 'self-matched typed answer → ★4');

        // 3 · PRACTICE reveals right after the lock: key by tier, "you: X ✓ / ½ / ✗", the one summary line, the ★
        await page.evaluate(() => { isPracticeMode = true; userAnswers[1] = ['ANTACID', '1,1,0,2,1']; renderQuizStep(true); clearInterval(quizTimerInterval); });
        const rv = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.rk-key')].map(k => k.querySelector('.t').textContent + '|' + k.querySelector('.x').firstChild.textContent + '|' + k.querySelector('.me').textContent + '|' + k.querySelector('.me').className.replace('me ', '')), note: document.querySelector('.rk-note').textContent, stars: document.querySelector('.rk-star b').textContent, ask: document.querySelectorAll('.rk-ask').length, warn: document.querySelectorAll('.rk-warn').length }));
        assert.deepEqual(rv.rows.map(x => x.split('|')[0]), ['Best', 'Best', 'OK', 'OK', 'Avoid'], 'key rows best tier first');
        assert.deepEqual(rv.rows.map(x => x.split('|').slice(2).join('|')), ['you: OK ½|ad', 'you: Best ✓|ex', 'you: OK ✓|ex', 'you: OK ✓|ex', 'you: Avoid ✓|ex']);
        assert.equal(rv.note, 'Typed ✗ · tiers 4/5 exact · 1 adjacent'); assert.equal(rv.stars, '★★★★★'); assert.equal(rv.ask, 1, 'unmatched typed answer → the self-match question'); assert.equal(rv.warn, 0);
        assert.equal(await page.locator('.rk-star b').evaluate(el => el.firstChild.textContent), '★★★', '0.72 → ★3');
        assert.equal(await page.locator('.rk-nav .rk-note').count(), 1, 'the summary rides in the action row'); assert.equal(await page.locator('.rk-done').count(), 0);
        await page.locator('.rk-ask button', { hasText: 'Gaviscon' }).click(); assert.equal((await page.evaluate(() => userAnswers[1]))[2], 'm:2'); assert.equal(await page.locator('.rk-star b').evaluate(el => el.firstChild.textContent), '★★★★', 'self-match lifts it to ★4');
        // an unsafe option not put in Avoid → the warning
        await page.evaluate(() => { currentQuiz.questions[1] = { ...currentQuiz.questions[1], unsafe: [0, 0, 0, 1, 0] }; userAnswers[1] = ['gaviscon', '1,0,0,1,1']; renderQuizStep(true); clearInterval(quizTimerInterval); });
        assert.match(await page.locator('.rk-warn').textContent(), /unsafe option was not put in Avoid — ★3 at most/); assert.equal(await page.locator('.rk-star b').evaluate(el => el.firstChild.textContent), '★★★');
        await page.evaluate(() => { currentQuiz.questions[1] = { ...currentQuiz.questions[1], unsafe: [0, 0, 0, 0, 0] }; });

        // 4 · the LAST question: Submit takes Next's place in the action row; an unlocked tier question counts as unanswered
        await page.evaluate(() => { isPracticeMode = false; currentStep = 2; renderQuizStep(false); clearInterval(quizTimerInterval); });
        assert.equal(await page.locator('#rk-submit').count(), 1); assert.equal(await page.locator('.rk-next').count(), 0);
        assert.deepEqual(await page.evaluate(() => [quizStepIsAnswered(2), (() => { userAnswers[2] = ['x']; return quizStepIsAnswered(2); })()]), [false, false]);
        assert.ok((await page.evaluate(() => submitQuiz.toString())).includes("type === 'rank' && !quizStepIsAnswered(qi)"), 'a typed-only Rank counts as unanswered at Submit');
        // the review of a finished attempt lists the learner tier per option and the key rows
        assert.ok(idx.includes("question.mode === 'tier' ? rankTierKeyRows(question") && idx.includes("rk.tiers.map((tt, i) => question.options[i] + ' → '"), 'the result review knows tier mode');

        const bad = errors.filter(e => /rank|Rank|rk[A-Z]|tier/i.test(e)); assert.deepEqual(bad, [], 'no Rank errors: ' + bad.join(' | '));
        console.log('PASS: Rank tier-box mode — scoring (DDD-1 Q2 = 0.72 ★3 / 0.92 ★4), no pre-selected tier, Lock waits for every row, stored in option order, counted quiz = locked state only, self-match before Submit, practice reveal with you: X ✓/½/✗, Submit on the last question');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
