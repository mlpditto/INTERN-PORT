// V102.478 — the AI tools that still treated a Rank question as a choice question are Rank-aware: the tagging prompt, Expand quiz + Regenerate, Curate (prompt, card, copy / backup),
// the quiz_improve accept-rate numbers, the per-question AI tools that would wipe a Rank card, the quiz PDF handout. A quiz with no Rank question keeps its old prompts. The REAL admin.html + quiz-curate.js.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const RANKQ = { type: 'rank', q: 'ผู้ป่วย GERD ตั้งครรภ์ ควรเริ่มยาชนิดใดเป็นลำดับแรก?', accepted: ['calcium carbonate', 'antacid'],
    options: ['Omeprazole 20 mg', 'Calcium carbonate', 'Ranitidine 150 mg', 'Metoclopramide 10 mg'], tiers: [1, 0, 2, 2], unsafe: [0, 0, 0, 1], why: ['PPI second line', 'Safe first line', 'Withdrawn', 'Not for GERD'], correct: [1], timer: 60, explanation: 'x' };
const CH1 = { type: 'choice', q: 'Choice stem one', options: ['a', 'b', 'c'], correct: [1], timer: 60, explanation: '' };
const CH2 = { type: 'choice', q: 'Choice stem two', options: ['d', 'e'], correct: [0], timer: 60, explanation: '' };
const GOODR = { q: 'หญิงตั้งครรภ์ 24 สัปดาห์ แสบร้อนกลางอก ควรเริ่มยาใดก่อน?', type: 'rank', accepted: ['calcium carbonate', 'antacid'], options: ['Omeprazole 20 mg', 'Calcium carbonate', 'Sodium bicarbonate', 'Metoclopramide 10 mg'], tiers: [1, 0, 2, 2], unsafe: [0, 0, 1, 1], why: ['a', 'b', 'c', 'd'] };
const BADCH = { q: 'ผู้ป่วย GERD ตั้งครรภ์ เลือกยาใด?', type: 'choice', options: ['a', 'b', 'c', 'd'], correct: [1], timer: 60 };
const CHFIX = { q: 'Improved choice stem one', type: 'choice', options: ['a', 'b', 'c', 'd'], correct: [1], timer: 60 };

(async () => {
    const browser = await chromium.launch();
    try {
        // ======================= admin.html (real) =======================
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
        await page.waitForFunction(() => typeof addQuestionUI === 'function' && window.RankQuiz && typeof qatBuildPrompt === 'function' && typeof sqmExistingQs === 'function' && typeof analyzeQuizAI === 'function' && document.readyState === 'complete');
        await page.evaluate(() => { window.triggerAutoSave = () => {}; window.__alerts = []; window.alert = m => window.__alerts.push(String(m)); window.confirm = () => true; window.__toasts = []; window.showToast = m => window.__toasts.push(String(m)); });

        // 1 · AI tagging: a Rank question is named as a ranking with its options; a choice-only quiz keeps the bare stems
        const tag = await page.evaluate(({ r, c }) => ({ rank: qatBuildPrompt([{ id: 'r', title: 'GERD', questions: [c, r] }]), plain: qatBuildPrompt([{ id: 'c', title: 'Asthma', questions: [c] }]), t1: qatQuestionText(c) }), { r: RANKQ, c: CH1 });
        assert.ok(tag.rank.includes('Choice stem one'), 'the choice stem is still there');
        assert.ok(tag.rank.includes(RANKQ.q + ' [ranking question — options: Omeprazole 20 mg | Calcium carbonate | Ranitidine 150 mg | Metoclopramide 10 mg]'), 'the Rank stem carries its options');
        assert.match(tag.rank, /Questions marked \[ranking question\] ask the intern to rank the listed options from best to worst/);
        assert.doesNotMatch(tag.plain, /ranking question/, 'a choice-only quiz gets no ranking text'); assert.ok(tag.plain.includes('"questions":["Choice stem one"]'), 'bare stems, as before'); assert.equal(tag.t1, 'Choice stem one');
        assert.ok(tag.plain.endsWith('QUIZZES:\n' + JSON.stringify([{ id: 'c', title: 'Asthma', description: '', currentTags: [], questions: ['Choice stem one'] }])), 'the QUIZZES block is exactly the old shape');

        // 2 · Expand quiz / Regenerate: the existing-questions block names a Rank question; the new questions stay choice questions
        const ex = await page.evaluate(({ r, a, b }) => ({ rank: sqmExistingQs([a, r]), plain: sqmExistingQs([a, b]), noteR: sqmRankNote([a, r]), noteC: sqmRankNote([a, b]) }), { r: RANKQ, a: CH1, b: CH2 });
        assert.equal(ex.plain, 'Q1: Choice stem one\nQ2: Choice stem two', 'a quiz with no Rank question: the exact old lines'); assert.equal(ex.noteC, '');
        assert.equal(ex.rank, 'Q1: Choice stem one\nQ2 [RANKING QUESTION]: ' + RANKQ.q + '\n    options with their level: Omeprazole 20 mg — OK | Calcium carbonate — BEST | Ranitidine 150 mg — AVOID | Metoclopramide 10 mg — AVOID ⚠');
        assert.match(ex.noteR, /Do NOT copy that format/); assert.match(ex.noteR, /"type": "choice"/);
        const run = await page.evaluate(async ({ r, a }) => {
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = ''; addQuestionUI(a); addQuestionUI(r);
            for (const [id, tag, val] of [['suggest-n', 'input', '3'], ['suggest-diff', 'input', 'easy'], ['suggest-focus', 'input', 'new_topics']]) { let e = document.getElementById(id); if (!e) { e = document.createElement(tag); e.id = id; document.body.appendChild(e); } e.value = val; }
            if (!document.getElementById('btn-suggest-start')) { const b = document.createElement('button'); b.id = 'btn-suggest-start'; document.body.appendChild(b); }
            document.getElementById('quiz-title').value = 'GERD in pregnancy';
            window.sqmBusyStart = () => ({ label() {}, end() {}, stopped: false, cancelled: new Promise(() => {}) }); window.showAiSuggestionsPopup = () => 0; window.sqmSummary = () => {};
            window.__prompts = []; window.callUniversalAI = async (m, p) => { window.__prompts.push(p); return { text: JSON.stringify({ questions: [] }), model: 'stub' }; };
            await suggestMoreQuestionsAI(); await regenerateSuggestions('harder');
            const withRank = window.__prompts.slice();
            c.innerHTML = ''; addQuestionUI(a); window.__prompts.length = 0;
            await suggestMoreQuestionsAI(); await regenerateSuggestions('harder');
            return { withRank, plain: window.__prompts.slice() };
        }, { r: RANKQ, a: CH1 });
        for (const p of run.withRank) {
            assert.ok(p.includes('Q2 [RANKING QUESTION]: ' + RANKQ.q + '\n    options with their level: Omeprazole 20 mg — OK | Calcium carbonate — BEST'), 'Expand / Regenerate describe the Rank question');
            assert.match(p, /Do NOT copy that format: write the new questions as ordinary multiple-choice questions/); assert.match(p, /"type": "choice"/, 'the schema is still choice-only');
        }
        assert.equal(run.withRank.length, 2); assert.equal(run.plain.length, 2);
        for (const p of run.plain) { assert.ok(p.includes('Q1: Choice stem one'), 'old line'); assert.doesNotMatch(p, /RANKING QUESTION|Do NOT copy that format/, 'a choice-only quiz gets no ranking text'); }

        // 3 · quiz_improve numbers: a Rank rewrite the guard refused was never offered → not "suggested"; an offered one and an applied one count as before
        const stats = await page.evaluate(async ({ r, a, good, badch, chfix }) => {
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = ''; addQuestionUI(a); addQuestionUI(r);
            window.__eval = []; window.recordAiEval = (...x) => window.__eval.push(x);
            const mk = items => ({ text: JSON.stringify({ suggestedTitles: { full: 'F', short: 'S' }, analysisText: 'ok', items }), model: 'stub' });
            const out = {};
            window.callUniversalAI = async () => mk([{ qNumber: 2, issue: 'i', suggestion: 's', improvedQuestion: good }, { qNumber: 2, issue: 'i2', suggestion: 's2', improvedQuestion: badch }, { qNumber: 1, issue: 'i3', suggestion: 's3', improvedQuestion: chfix }]);
            await analyzeQuizAI(null, { forceNew: true, model: 'stub' }); out.mixed = window.__eval.map(x => x.slice(0, 4)); out.flags = (window._aiAnalysisItems || []).map(it => !!it._shapeInvalid);
            document.getElementById('ai-analysis-popup') && document.getElementById('ai-analysis-popup').remove();
            window.__eval.length = 0;
            window.callUniversalAI = async () => mk([{ qNumber: 2, issue: 'i2', suggestion: 's2', improvedQuestion: badch }]);
            await analyzeQuizAI(null, { forceNew: true, model: 'stub' }); out.refusedOnly = window.__eval.map(x => x.slice(0, 4));
            document.getElementById('ai-analysis-popup') && document.getElementById('ai-analysis-popup').remove();
            window.__eval.length = 0; window._aiAnalysisItems = [{ qNumber: 2, issue: 'x', suggestion: 'y', improvedQuestion: good }];
            out.applied = await applySingleAiFix(1, 0, 0); out.evalApplied = window.__eval.map(x => x.slice(0, 4)); out.type2 = getQuizFormData().questions[1].type;
            return out;
        }, { r: RANKQ, a: CH1, good: GOODR, badch: BADCH, chfix: CHFIX });
        assert.deepEqual(stats.flags, [false, true, false], 'the guard flags only the choice rewrite of the Rank question');
        assert.equal(stats.mixed.length, 1); assert.deepEqual([stats.mixed[0][0], stats.mixed[0][2], stats.mixed[0][3]], ['quiz_improve', 'suggested', 2], '3 proposals, 1 refused Rank rewrite → 2 suggested');
        assert.deepEqual(stats.refusedOnly, [], 'only a refused Rank rewrite → nothing recorded as suggested');
        assert.equal(stats.applied, true); assert.deepEqual(stats.evalApplied.map(x => [x[0], x[2]]), [['quiz_improve', 'applied']], 'an applied Rank rewrite counts as applied'); assert.equal(stats.type2, 'rank', 'and the card is still a Rank question');

        // 4 · the per-question AI tools that edit options / the answer key say no on a Rank card (they would wipe or misalign its levels) and work as before on a choice card
        const tools = await page.evaluate(async ({ r, a }) => {
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = ''; addQuestionUI(a); addQuestionUI(r);
            const [ch, rk] = [...document.querySelectorAll('.quiz-q-item')]; window.__calls = 0; window.__toasts.length = 0;
            window.callUniversalAI = async () => { window.__calls++; return { text: '{}', model: 'stub' }; };
            const chip = it => { const b = document.createElement('button'); it.appendChild(b); return b; };
            const metasBefore = rk.querySelectorAll('.rk-meta').length;
            await aiEnhanceQuestion(chip(rk)); await qImproveAction(chip(rk), 'distractors'); await qImproveAction(chip(rk), 'polish'); await qImproveAction(chip(rk), 'findanswer');
            const out = { calls: window.__calls, toasts: window.__toasts.slice(), metasBefore, metasAfter: rk.querySelectorAll('.rk-meta').length, type: rk.querySelector('.q-type').value, blockedCh: window.rankAiToolBlocked(ch, 'x') };
            await aiEnhanceQuestion(chip(ch)); out.choiceCalls = window.__calls;
            return out;
        }, { r: RANKQ, a: CH1 });
        assert.equal(tools.calls, 0, 'no model call from a Rank card'); assert.equal(tools.toasts.length, 4); assert.ok(tools.toasts.every(t => /^Rank question — /.test(t)), tools.toasts.join(' | '));
        assert.deepEqual([tools.metasBefore, tools.metasAfter, tools.type], [4, 4, 'rank'], 'the Rank card is untouched'); assert.equal(tools.blockedCh, false, 'a choice card is never blocked'); assert.equal(tools.choiceCalls, 1, 'Magic enhance still runs on a choice card');

        // 5 · the quiz PDF handout: no ticks on a Rank question, a levels line in the answers copy; choice questions as before
        const pdf = await page.evaluate(({ r, a }) => ({ ans: buildQuizPdfBlocks({ questions: [r, a] }, 'with_answers'), q: buildQuizPdfBlocks({ questions: [r, a] }, 'questions_only') }), { r: RANKQ, a: CH1 });
        assert.ok(pdf.ans[0].options.every(o => !o.correct), 'no per-option tick on a Rank question'); assert.equal(pdf.ans[0].guideline, 'Ranking key — Best: B · OK: A · Avoid: C, D · ⚠ unsafe: D');
        assert.deepEqual(pdf.ans[1].options.map(o => o.correct), [false, true, false], 'choice ticks unchanged'); assert.equal(pdf.q[0].guideline, ''); assert.equal(pdf.q[0].options.length, 0, 'questions-only prints no options (as for every type)');
        const src = fs.readFileSync('public/admin.html', 'utf8');
        assert.ok(src.includes("(q.type === 'rank' && window.RankQuiz) ? window.RankQuiz.score(q, userAns).credit >= 0.8"), 'the user-history ✅/❌ scores a Rank answer (★4 up)');
        assert.ok(/rank:\s+\{ icon: '🏅', label: 'Rank' \}/.test(src), 'the bulk-export type chip has a Rank label');

        const mine = errors.filter(e => /rank|Rank|qat|sqm|suggestMore|regenerateSuggestions|aiEnhanceQuestion|qImprove|buildQuizPdfBlocks|analyzeQuizAI/.test(e)); assert.deepEqual(mine, [], mine.join(' | '));

        // ======================= Curate (real quiz-curate.js) =======================
        const html = src;
        const railStart = html.indexOf('window.browseAuditProvider = function'), railEnd = html.indexOf('window.auditModelControlsHtml = function');
        assert.ok(railStart > 0 && railEnd > railStart);
        async function curate(questions) {
            const pg = await browser.newPage();
            await pg.route('https://curate.test/', r => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
            await pg.goto('https://curate.test/');
            pg.on('pageerror', e => errors.push('curate: ' + e.message));
            await pg.setContent([...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n') + '<input id="edit-quiz-id" value="source-quiz"><input id="ai-analyzer-model-val" value="gpt-6-luna">');
            await pg.addStyleTag({ path: 'public/quiz-curate.css' }); await pg.addStyleTag({ path: 'public/text-ai-chips.css' });
            await pg.addScriptTag({ path: 'public/ai-model-ui.js' }); await pg.addStyleTag({ path: 'public/audit-toolbar.css' });
            await pg.addScriptTag({ content: html.slice(railStart, railEnd) });
            // the Rank helpers live in admin.html's inline script; the Curate prompt reads window.RANK_PROMPT_NOTE
            const noteStart = html.indexOf("window.RANK_PROMPT_NOTE = "); const noteEnd = html.indexOf('\n', noteStart);
            await pg.addScriptTag({ content: html.slice(noteStart, noteEnd) });
            await pg.evaluate(qs => {
                window.fixture = { title: 'GERD quiz', targetGroup: 'Interns', totalPoints: 1.4, isPoll: false, quizType: 'mcq', caseContent: '', materials: [], blueprint: {}, startTime: '2026-09-01T09:00', deadline: '2026-09-30T09:00', questions: qs };
                for (let i = 0; i < qs.length; i++) { const el = document.createElement('div'); el.className = 'quiz-q-item'; el.dataset.id = i + 1; document.body.append(el); }
                window.getQuizFormData = () => structuredClone(fixture); window.shouldMarkQuestionMissingAnswer = () => false; window.showToast = () => {}; window.safeJsonParse = JSON.parse;
                window.ensureAuthForQuizWrite = async () => true; window.calls = []; window.writes = []; window.docCount = 0;
                window.callUniversalAI = (...args) => { calls.push(args); return new Promise(resolve => { window.aiResolve = resolve; }); };
                window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } } }; window.auth = { currentUser: { email: 'qa@example.com' } };
                window.db = { collection: name => ({ doc: id => { const did = id || 'copy-' + ++docCount; return { id: did, get: async () => ({ exists: true, data: () => structuredClone(fixture) }), set: async data => { writes.push({ id: did, data: structuredClone(data) }); } }; } }) };
                window.curateHistory = { key: async v => JSON.stringify(v), load: async () => [], save: async () => {} };
            }, questions);
            await pg.addScriptTag({ path: 'public/quiz-curate.js' });
            await pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await pg.evaluate(() => openQuizCurate());
            return pg;
        }
        const four = [CH1, RANKQ, CH2, { ...CH2, q: 'Choice stem three' }];
        const pg = await curate(four);
        const cardText = await pg.evaluate(() => document.querySelector('.curate-question:nth-child(2)') ? document.querySelector('.curate-question:nth-child(2)').innerText : '');
        // the cards: the Rank question shows a level chip per option and a note, no "Answer key" tick
        const lv = await pg.evaluate(() => { const rows = [...document.querySelectorAll('.curate-question')]; const r = rows.find(x => /GERD ตั้งครรภ์/.test(x.textContent)); if (!r) return null; r.querySelectorAll('details').forEach(d => { d.open = true; }); return { chips: [...r.querySelectorAll('.curate-lvl')].map(x => x.textContent), keys: r.querySelectorAll('.curate-key').length, note: /Ranking question: levels, no single answer key/.test(r.textContent) }; });
        assert.ok(lv, 'the Rank question card is on screen: ' + cardText.slice(0, 60));
        assert.deepEqual(lv.chips, ['OK', 'Best', 'Avoid', 'Avoid ⚠'], 'a level chip per option'); assert.equal(lv.keys, 0, 'no "Answer key" tick on a Rank question'); assert.equal(lv.note, true);
        // the prompt: says what a Rank question is, levels are the key; keeps the stems / fields in Source
        await pg.locator('#curate-target').fill('3'); await pg.locator('#curate-suggest').click(); await pg.waitForFunction(() => calls.length > 0);
        const prompt = await pg.evaluate(() => calls[0][1]);
        assert.match(prompt, /RANK QUESTIONS \(type "rank"\)/); assert.match(prompt, /"correct" lists only the BEST options and there is no single answer key/);
        const source = JSON.parse(prompt.slice(prompt.indexOf('\nSource: ') + 9)); const rq = source.questions.find(q => q.type === 'rank');
        assert.deepEqual([rq.tiers, rq.unsafe, rq.accepted], [RANKQ.tiers, RANKQ.unsafe, RANKQ.accepted], 'the Source JSON carries the levels');
        // copy (Save as a new quiz): every Rank field survives
        await pg.evaluate(() => aiResolve({ text: JSON.stringify({ questions: [1, 2, 3, 4].map(i => ({ id: i, keep: i <= 3, priority: i, topic: 'GERD', reasonType: 'quality', reason: 'r' + i, reasonTh: 'ร' + i, detail: 'd', detailTh: 'ด', impact: 'i', impactTh: 'ผ', related: [] })) }) }));
        await pg.waitForFunction(() => document.querySelector('#quiz-curate-dialog').getAttribute('aria-busy') === 'false');
        await pg.locator('#curate-save').click(); await pg.waitForFunction(() => window.writes.length >= 1 || document.getElementById('curate-save').textContent === 'Saved');
        const written = await pg.evaluate(() => writes);
        assert.equal(written.length, 1); const kept = written[0].data.questions; assert.equal(kept.length, 3);
        assert.deepEqual(kept.find(q => q.type === 'rank'), RANKQ, 'the copied Rank question is intact (type, options, tiers, unsafe, why, accepted, correct, timer, explanation)');
        await pg.close();
        // no Rank question → the prompt has no ranking text and the line before "Source:" is exactly as before
        const pg2 = await curate([CH1, CH2, { ...CH2, q: 'Choice stem three' }, { ...CH2, q: 'Choice stem four' }]);
        await pg2.locator('#curate-target').fill('3'); await pg2.locator('#curate-suggest').click(); await pg2.waitForFunction(() => calls.length > 0);
        const plainPrompt = await pg2.evaluate(() => calls[0][1]);
        assert.doesNotMatch(plainPrompt, /RANK QUESTIONS|no single answer key/); assert.match(plainPrompt, /no meaningful comparison\.\nSource: \{"title"/, 'unchanged around Source:');
        await pg2.close();
        // the copy text of a Rank question (extracted verbatim, as quiz-curate-copy-check does)
        const js = fs.readFileSync('public/quiz-curate.js', 'utf8').replace(/\r\n/g, '\n'); const a0 = js.indexOf('    function questionPlainText(q, number, missingKey) {'), b0 = js.indexOf('\n    }\n', a0);
        const fn = new Function(js.slice(a0, b0 + '\n    }'.length) + '\nreturn questionPlainText;')();
        assert.equal(fn(RANKQ, 2, false), 'Q2 · ' + RANKQ.q + '\n\n1. Omeprazole 20 mg  [OK]\n2. Calcium carbonate  [Best]\n3. Ranitidine 150 mg  [Avoid]\n4. Metoclopramide 10 mg  [Avoid ⚠]\n(Ranking question: each option has a level, no single answer key)');

        const curateErr = errors.filter(e => /^curate:/.test(e)); assert.deepEqual(curateErr, [], curateErr.join(' | '));
        console.log('PASS: Rank-aware AI tools — tagging prompt, Expand / Regenerate, Curate (prompt, level chips, copy keeps every field, copy text), quiz_improve counts, per-question AI tools blocked on Rank, quiz PDF handout; choice-only quizzes keep their old prompts');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
