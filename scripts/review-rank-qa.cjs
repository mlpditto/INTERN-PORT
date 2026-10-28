// V102.477 — the Review tools are Rank-aware: Specialist rewrite prompt / single-question prompts / Quality Audit describe a Rank question as a ranking (levels, not a key),
// a rewrite must stay a Rank question, the compare cards show level chips (no ✅), Apply writes the rank fields, anything unusable is not offered. The REAL admin.html.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const GOOD = { q: 'หญิง 45 ปี ปวดหัวเรื้อรัง ขอพาราเซตามอล ควรทำอย่างไรก่อน?', type: 'rank', accepted: ['ซักประวัติ', 'ask history', 'history taking'],
    options: ['จ่ายพาราเซตามอลทันที', 'ซักประวัติและอาการเตือนก่อน', 'แนะนำให้ไปพบแพทย์ทันที', 'จ่ายทรามาดอลแทน'], tiers: [1, 0, 2, 2], unsafe: [0, 0, 0, 1], why: ['ได้ แต่ยังไม่ซักประวัติ', 'ปลอดภัยที่สุด', 'เหมาะถ้ามี red flag', 'ต้องใช้ใบสั่งแพทย์'], timer: 60, explanation: 'ซักประวัติก่อนเสมอ' };

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
        await page.addInitScript(() => { try { localStorage.setItem('adminGuideSeen', '1'); } catch (e) {} window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => typeof addQuestionUI === 'function' && window.RankQuiz && typeof buildQuizAnalyzePrompt === 'function' && typeof previewAiFix === 'function' && document.readyState === 'complete');
        await page.evaluate(() => {
            window.triggerAutoSave = () => {}; window.__alerts = []; window.alert = m => window.__alerts.push(String(m)); window.confirm = () => true;
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = '';
            addQuestionUI({ type: 'choice', q: 'First question', options: ['a', 'b'], correct: [0], timer: 30 });
            addQuestionUI({ type: 'rank', q: 'ผู้ป่วยมาซื้อยาแก้ปวด ควรทำอย่างไรก่อน?', accepted: ['ซักประวัติ'], options: ['จ่ายยาทันที', 'ซักประวัติก่อน', 'ส่งต่อแพทย์', 'ให้ยาแรงขึ้น'], tiers: [1, 0, 1, 2], unsafe: [0, 0, 0, 1], why: ['รีบไป', 'ปลอดภัยสุด', 'ถ้ามี red flag', 'เสี่ยง'], timer: 45, tags: 'pain', primer: 'อ่านก่อน: red flags', explanation: 'old' });
        });

        // 1 · Specialist prompt: a Rank question is described as a ranking, a choice question is unchanged
        const p = await page.evaluate(() => buildQuizAnalyzePrompt(getQuizFormData().questions, ['pain'], null));
        assert.match(p, /Q2 \(rank — ranking question\): ผู้ป่วยมาซื้อยาแก้ปวด/); assert.match(p, /accepted answers: ซักประวัติ/);
        assert.match(p, /B\. ซักประวัติก่อน — BEST — why: ปลอดภัยสุด/); assert.match(p, /D\. ให้ยาแรงขึ้น — AVOID ⚠ UNSAFE — why: เสี่ยง/); assert.match(p, /A\. จ่ายยาทันที — OK/);
        assert.doesNotMatch(p, /Q2 \(rank\):/, 'not listed as a plain typed question');
        assert.match(p, /RANK QUESTIONS \(type "rank"\)/); assert.match(p, /never convert it to "choice", never add a "correct" field/); assert.match(p, /"type":"rank"/); assert.match(p, /"tiers":\[/); assert.match(p, /NOT listed best-first/);
        assert.match(p, /Q1 \(choice\): First question\nOptions: a, b/, 'the choice question line is unchanged');
        const pChoice = await page.evaluate(() => buildQuizAnalyzePrompt([{ type: 'choice', q: 'Only', options: ['a', 'b'], correct: [0] }], [], null));
        assert.doesNotMatch(pChoice, /RANK QUESTIONS|rank source|"tiers"/, 'a quiz without a Rank question gets no rank text'); assert.match(pChoice, /Q1 \(choice\): Only\nOptions: a, b/);

        // 2 · single-question + merge prompts
        const sp = await page.evaluate(() => { const q = getQuizFormData().questions; return { rank: _buildSingleQImprovePrompt(q[1], 'issue', 'sug', 'steer!'), choice: _buildSingleQImprovePrompt(q[0], 'issue', 'sug', ''), merge: _buildRankMergePrompt(q[1], { q: 'B' }, 'keep A') }; });
        assert.match(sp.rank, /Keep it a Rank question/); assert.match(sp.rank, /"type":"rank"/); assert.match(sp.rank, /never convert it to "choice"/); assert.match(sp.rank, /<<<steer!>>>/); assert.match(sp.rank, /"tiers":\[/);
        assert.match(sp.choice, /ANSWER KEY: "correct" holds ZERO-BASED INDEXES/); assert.doesNotMatch(sp.choice, /Rank question/, 'a choice question keeps the old single-question prompt');
        assert.match(sp.merge, /SAME ranking question/); assert.match(sp.merge, /keep A/); assert.match(sp.merge, /"tiers":\[/);

        // 3 · validation: a usable Rank rewrite passes; choice / bad levels / mismatched arrays do not
        const v = await page.evaluate(g => { const src = getQuizFormData().questions[1], bad = (o) => _validateAiQuestionShape({ ...g, ...o }, src);
            return { good: _validateAiQuestionShape(g, src), noType: _validateAiQuestionShape({ ...g, type: undefined }, src), asChoice: _validateAiQuestionShape({ q: 'x', type: 'choice', options: ['a', 'b', 'c', 'd'], correct: [1] }, src), allOne: bad({ tiers: [1, 1, 1, 1] }), noBest: bad({ tiers: [1, 2, 1, 2] }), short: bad({ tiers: [0, 1] }), range: bad({ tiers: [0, 1, 5, 2] }), twoOpts: bad({ options: ['a', 'b'], tiers: [0, 1], unsafe: [0, 0], why: ['', ''] }), why: bad({ why: ['x'] }), notRankSrc: _validateAiQuestionShape(g, getQuizFormData().questions[0]), noSrc: _validateAiQuestionShape(g), choiceOk: _validateAiQuestionShape({ q: 'x', options: ['a', 'b', 'c'], correct: [1] }, getQuizFormData().questions[0]) }; }, GOOD);
        assert.equal(v.good.ok, true); assert.equal(v.noType.ok, true, 'no type on a Rank source = Rank');
        for (const k of ['asChoice', 'allOne', 'noBest', 'short', 'range', 'twoOpts', 'why']) { assert.equal(v[k].ok, false, k); assert.ok(v[k].error.startsWith('AI did not return a usable Rank question — kept as is'), k + ': ' + v[k].error); }
        assert.match(v.asChoice.error, /came back as "choice"/); assert.equal(v.notRankSrc.ok, false, 'a choice question is never turned into a Rank question'); assert.equal(v.noSrc.ok, true); assert.equal(v.choiceOk.ok, true, 'a choice rewrite of a choice question is untouched');

        // 4 · the compare cards: level chips + ⚠, accepted answers, no ✅; the badges say Levels changed; Apply is offered
        await page.evaluate(g => { window._aiAnalysisItems = [{ qNumber: 2, issue: 'x', suggestion: 'y', improvedQuestion: g }]; previewAiFix(1, 0); }, GOOD);
        await page.waitForSelector('#ai-compare-overlay');
        const cards = await page.evaluate(() => { const o = document.getElementById('ai-compare-overlay'); return { rows: o.querySelectorAll('.rk-cmp-row').length, lv: [...o.querySelectorAll('.rk-cmp-lv')].map(x => x.textContent), ticks: (o.textContent.match(/✅/g) || []).length, warn: (o.textContent.match(/⚠️/g) || []).length, acc: [...o.querySelectorAll('.rk-cmp-acc')].map(x => x.textContent.trim()), badge: [...o.querySelectorAll('span')].filter(x => x.textContent.trim() === 'rank'), pills: [...o.querySelectorAll('[title]')].map(x => x.getAttribute('title')).filter(t => /Levels changed|Accepted answers|Logical fix|Options balanced|Text reworded/.test(t)), applyEnabled: !!o.querySelector('button.cmp-split:not([disabled])'), status: o.textContent.includes('Malformed') }; });
        assert.equal(cards.rows, 8, 'four option rows on each side'); assert.deepEqual(cards.lv, ['OK', 'Best', 'OK', 'Avoid', 'OK', 'Best', 'Avoid', 'Avoid'], 'level chips on both sides'); assert.equal(cards.ticks, 0, 'no ✅ ticks on a Rank question');
        assert.ok(cards.warn >= 2, 'the ⚠ flag shows on both sides'); assert.equal(cards.acc.length, 2); assert.match(cards.acc[1], /ซักประวัติ/); assert.ok(cards.badge.length >= 2, 'the RANK badge stays on both cards');
        assert.ok(cards.pills.some(t => /Levels changed|Options balanced/.test(t)), 'diff pills: ' + cards.pills.join(' | ')); assert.ok(!cards.pills.some(t => /Logical fix/.test(t)), 'no "Logical Fix" from the answer key'); assert.equal(cards.applyEnabled, true); assert.equal(cards.status, false);
        const dstate = await page.evaluate(g => getAiImprovementDiffState(getQuizFormData().questions[1], g).diffs, GOOD); assert.ok(dstate.includes('Levels changed') && dstate.includes('Options Balanced') && dstate.includes('Accepted answers') && !dstate.includes('Logical Fix') && !dstate.includes('Type Changed'), dstate.join());
        const same = await page.evaluate(() => { const q = getQuizFormData().questions[1]; return getAiImprovementDiffState(q, { ...q }).hasMeaningfulDiff; }); assert.equal(same, false, 'an identical Rank rewrite is "no meaningful difference"');
        await page.evaluate(() => document.getElementById('ai-compare-overlay').remove());

        // 5 · Apply: the rank fields land in the editor card, correct = the Best options, the old card's tags / primer / explanation survive
        const ok = await page.evaluate(() => applySingleAiFix(1, 0, 0));
        assert.equal(ok, true, 'apply went through: ' + (await page.evaluate(() => __alerts.join(' | '))));
        const applied = await page.evaluate(() => { const q = getQuizFormData().questions; return { n: q.length, q: q[1], first: q[0].q, valid: RankQuiz.valid(q[1]), problem: rankProblem(q[1]), type: document.querySelectorAll('.quiz-q-item')[1].querySelector('.q-type').value }; });
        assert.equal(applied.n, 2); assert.equal(applied.first, 'First question', 'the other card is untouched'); assert.equal(applied.type, 'rank');
        assert.deepEqual([applied.q.type, applied.q.options, applied.q.tiers, applied.q.unsafe, applied.q.why, applied.q.accepted, applied.q.correct], ['rank', GOOD.options, GOOD.tiers, GOOD.unsafe, GOOD.why, GOOD.accepted, [1]]);
        assert.equal(applied.valid, true); assert.equal(applied.problem, ''); assert.equal(applied.q.tags, 'pain', 'tags kept'); assert.equal(applied.q.primer, 'อ่านก่อน: red flags', 'primer kept'); assert.equal(applied.q.timer, 60);

        // 6 · a Rank rewrite that came back as choice / with unusable levels is NOT applicable: message shown, Apply disabled, Apply refuses
        const BADCH = { q: 'x', type: 'choice', options: ['a', 'b', 'c', 'd'], correct: [1] }, BADLV = { ...GOOD, tiers: [1, 1, 1, 1] };
        for (const [name, bad] of [['choice', BADCH], ['levels', BADLV]]) {
            await page.evaluate(b => { window._aiAnalysisItems = [{ qNumber: 2, improvedQuestion: b }]; previewAiFix(1, 0); }, bad);
            await page.waitForSelector('#ai-compare-overlay');
            const o = await page.evaluate(() => { const ov = document.getElementById('ai-compare-overlay'); return { text: ov.textContent.replace(/\s+/g, ' '), apply: !!ov.querySelector('button.cmp-split:not([disabled])'), disabled: [...ov.querySelectorAll('button[disabled]')].length }; });
            assert.match(o.text, /AI did not return a usable Rank question — kept as is/, name + ' message shown'); assert.equal(o.apply, false, name + ': no Apply offered'); assert.ok(o.disabled >= 1);
            await page.evaluate(() => document.getElementById('ai-compare-overlay').remove());
            const refused = await page.evaluate(b => { window.__alerts.length = 0; window._aiAnalysisItems = [{ qNumber: 2, improvedQuestion: b }]; return [applySingleAiFix(1, 0, 0), window.__alerts.join(' | '), getQuizFormData().questions[1].type]; }, bad);
            assert.equal(refused[0], false, name + ': apply refuses'); assert.match(refused[1], /usable Rank question/); assert.equal(refused[2], 'rank', 'the card is still a Rank question');
        }

        // 7 · the batch flow: items are flagged at parse time (the list card shows the note, Fix disabled)
        const batch = await page.evaluate(async ({ g, bc }) => {
            window.callUniversalAI = async () => ({ text: JSON.stringify({ suggestedTitles: { full: 'F', short: 'S' }, analysisText: 'ok', items: [{ qNumber: 2, issue: 'i', suggestion: 's', improvedQuestion: g }, { qNumber: 2, issue: 'i2', suggestion: 's2', improvedQuestion: bc }] }), model: 'stub' });
            await analyzeQuizAI(null, { forceNew: true, model: 'stub' });
            const pop = document.getElementById('ai-analysis-popup');
            return { flags: (window._aiAnalysisItems || []).map(it => it._shapeInvalid || null), text: pop ? pop.textContent.replace(/\s+/g, ' ') : '', fix: [0, 1].map(i => { const b = document.getElementById('btn-fix-ai-' + i); return b ? b.disabled : null; }) };
        }, { g: GOOD, bc: BADCH });
        assert.equal(batch.flags[0], null, 'the usable Rank rewrite is flagged OK'); assert.match(batch.flags[1], /^AI did not return a usable Rank question/, 'the choice rewrite of a Rank question is flagged');
        assert.deepEqual(batch.fix, [false, true], 'Fix: enabled for the usable one, disabled for the other'); assert.match(batch.text, /AI did not return a usable Rank question — kept as is/);
        assert.doesNotMatch(batch.text, /Malformed AI output: AI did not return/, 'no double prefix');

        // 8 · Quality Audit: the prompt describes the Rank question as a ranking and says the levels are the key
        const audit = await page.evaluate(async () => {
            let captured = '';
            window.callUniversalAI = async (m, prompt) => { captured = prompt; return { text: JSON.stringify({ overallScore: 3, perQuestionAudit: [{ qNumber: 1, scores: {}, averageScore: 3, rationale: 'r' }] }), model: 'stub' }; };
            try { await auditQuizAI(null, { forceNew: true, model: 'stub' }); } catch (e) { return { err: e.message, captured }; }
            return { captured };
        });
        assert.ok(audit.captured, 'the audit prompt was built: ' + (audit.err || ''));
        assert.match(audit.captured, /Q2 \(rank — ranking question\)/); assert.match(audit.captured, /B\. ซักประวัติ|— BEST/); assert.match(audit.captured, /levels \(BEST \/ OK \/ AVOID|The LEVELS \(BEST \/ OK \/ AVOID/); assert.match(audit.captured, /NOT a single correct option/);
        assert.doesNotMatch(audit.captured.split('Q2 (rank')[1].split('\n\nOUTPUT')[0], /\n  correct: /, 'the Rank question has no single "correct:" key line'); assert.match(audit.captured, /Q1 \(choice\): First question[\s\S]*correct: A/, 'the choice question keeps its key');

        const mine = errors.filter(e => /rank|Rank|analyzeQuizAI|previewAiFix|applySingleAiFix|auditQuizAI|_validateAiQuestionShape/.test(e)); assert.deepEqual(mine, [], mine.join(' | '));
        console.log('PASS: Review is Rank-aware — prompts (specialist, single, merge, audit) describe levels, rewrites must stay Rank, cards show level chips (no ✅), Levels-changed badge, Apply writes the rank fields, unusable rewrites are not offered, batch flags them');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
