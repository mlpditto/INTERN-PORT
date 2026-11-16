// V102.648 (owner: "ควรเป็นปุ่มที่บอกชัดว่า อิงจากชุดเก่า"; pick A + lean L1, mockup-curate-old-set): AI Curate offers the last result when it was made
// on an OLDER version of the questions. Never by itself — an amber chip in the tools row (no line of its own): "↩ old set m/n".
// The REAL quiz-curate.js + css + quiz-curate-history.js (real key hashing; load / save in memory) + the shared rail from admin.html:
//  1 a saved run carries one short key per question
//  2 one question deleted + one edited since → nothing is restored; the chip offers "↩ old set 10/11", inline between ✏ and 🕘, no AI call
//  3 tap → verdicts carried over by question content with today's numbers (Remove Q4/Q7/Q9 → Q3/Q6/Q8), the pin follows its question, a
//    comparison follows both questions, a comparison with a deleted question is dropped, the edited question is kept + "not assessed",
//    Keep shows what is kept now, the chip turns "⚠️ old set 10/11"; still no AI call
//  4 tap again → cleared, back to the offer; a fresh Suggest removes the chip
//  5 no chip for a run saved without keys, or one that covers under half of today's questions
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
        require('./curate-step-nav.cjs').install(page);   // V102.657: go to the step a control lives in
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', d => { errors.push('native dialog opened: ' + d.message().slice(0, 60)); d.dismiss(); });
        await page.route('https://curate.test/', r => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.route(/curate\.test\/.+/, r => r.fulfill({ status: 200, body: '', contentType: 'image/svg+xml' }));
        await page.goto('https://curate.test/');
        const html = fs.readFileSync('public/admin.html', 'utf8');
        assert.ok(/href="quiz-curate\.css\?v=V\d+\.\d+"/.test(html) && /src="quiz-curate\.js\?v=V\d+\.\d+"/.test(html));
        await page.setContent('<meta charset="utf-8">' + [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n') + '<input id="edit-quiz-id" value="source-quiz"><input id="ai-analyzer-model-val" value="gpt-6-luna">');
        for (const f of ['quiz-curate.css', 'text-ai-chips.css', 'audit-toolbar.css']) await page.addStyleTag({ path: path.join('public', f) });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        const a = html.indexOf('window.browseAuditProvider = function'), b = html.indexOf('window.auditModelControlsHtml = function');
        assert.ok(a > 0 && b > a, 'provider rail helpers found in admin.html');
        await page.addScriptTag({ content: html.slice(a, b) });
        await page.evaluate(() => {
            window.mkQuestions = n => Array.from({ length: n }, (_, i) => ({ q: 'Constipation question ' + (i + 1), content: '', type: 'choice', options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: [1], timer: 60, tags: '', explanation: 'Explanation ' + (i + 1) }));
            window.fixture = { title: 'Constipation', targetGroup: 'Interns', totalPoints: 1.2, isPoll: false, quizType: 'mcq', caseContent: '', materials: [], blueprint: {}, startTime: '2026-11-01T09:00', deadline: '2026-11-30T09:00', questions: mkQuestions(12) };
            for (let i = 0; i < 14; i++) { const el = document.createElement('div'); el.className = 'quiz-q-item'; el.dataset.id = i + 1; el.hidden = true; document.body.append(el); }
            window.getQuizFormData = () => structuredClone(fixture);
            window.shouldMarkQuestionMissingAnswer = () => false; window.showToast = () => {}; window.safeJsonParse = JSON.parse;
            window.ensureAuthForQuizWrite = async () => true;
            window.calls = []; window.callUniversalAI = (...args) => { calls.push(args[0]); return new Promise(resolve => { window.aiResolve = resolve; }); };
            window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } }; window.auth = { currentUser: { email: 'qa-admin@example.com' } };
            window.db = { collection: () => ({ doc: id => ({ id: id || 'x', get: async () => ({ exists: true, data: () => structuredClone(fixture) }), set: async () => {} }) }) };
        });
        await page.addScriptTag({ path: 'public/quiz-curate-history.js' });
        await page.evaluate(() => { window.store = []; curateHistory.load = async () => structuredClone(store); curateHistory.save = async (id, run) => { store = [structuredClone(run), ...store.filter(r => r.id !== run.id)].slice(0, 5); }; });
        await page.addScriptTag({ path: 'public/quiz-curate.js' });

        const frame = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        const open = async () => { await frame(); await page.evaluate(() => openQuizCurate()); await page.waitForFunction(() => !/Checking saved results/.test(document.getElementById('curate-history-status').textContent)); await frame(); };
        const close = async () => { await page.locator('.curate-close').click(); await page.waitForFunction(() => !document.querySelector('#quiz-curate-dialog').open); await frame(); };
        const rel = (id, other) => ({ id: other, shared: 'Same step', sharedTh: 'ขั้นตอนเดียวกัน', difference: 'Stem', differenceTh: 'โจทย์', preference: 'Keep the other', preferenceTh: 'เก็บอีกข้อ', evidence: [{ id, quote: 'Constipation question ' + id }, { id: other, quote: 'Constipation question ' + other }] });
        const proposal = (count, remove, related = {}) => ({ questions: Array.from({ length: count }, (_, i) => { const id = i + 1, keep = !remove.includes(id), r = related[id] ? [rel(id, related[id])] : []; return { id, keep, priority: keep ? id : count, topic: 'Constipation', reasonType: r.length ? 'overlap' : keep ? 'coverage' : 'quality', related: r,
            reason: (keep ? 'Keep reason ' : 'Remove reason ') + id, reasonTh: 'เหตุผลข้อ ' + id, detail: 'Detail', detailTh: 'รายละเอียด', impact: 'Impact', impactTh: 'ผลกระทบ' }; }) });
        const suggest = async data => { const before = await page.evaluate(() => [calls.length, store.length]); await page.locator('#curate-suggest').click(); await page.waitForFunction(n => calls.length > n, before[0]);
            await page.evaluate(d => aiResolve({ text: JSON.stringify(d) }), data); await page.waitForFunction(() => document.querySelector('#quiz-curate-dialog').getAttribute('aria-busy') === 'false'); await page.waitForFunction(n => store.length > n || store.some(r => Date.now() - r.createdAt < 3000), before[1]); await frame(); };
        const chip = () => page.evaluate(() => { const c = document.getElementById('curate-old'); return c.hidden ? null : { text: c.textContent.trim(), pressed: c.getAttribute('aria-pressed'), on: c.classList.contains('on'), title: c.title, label: c.getAttribute('aria-label'), th: c.dataset.thTitle || '' }; });
        const tab = name => page.evaluate(n => [...document.querySelectorAll('#quiz-curate-dialog [data-view]')].find(b => b.textContent.trim().startsWith(n)).click(), name);
        const rows = () => page.evaluate(() => [...document.querySelectorAll('#curate-rows .curate-question')].map(r => ({ id: r.dataset.questionId, text: r.querySelector('.curate-reason') ? r.querySelector('.curate-reason').textContent.replace(/\s+/g, ' ').trim() : '', na: !!r.querySelector('.curate-na'), pin: r.querySelector('.curate-pin').getAttribute('aria-pressed'), compare: [...r.querySelectorAll('.curate-compare')].map(b => b.textContent.trim()) })));
        const tabs = () => page.evaluate(() => [...document.querySelectorAll('#quiz-curate-dialog [data-view]')].map(b => b.textContent.trim()).join(' | '));

        // 1 · a run of 12 questions: 📌 Q3, Keep 8, remove Q2 Q4 Q7 Q9; Q7 overlaps Q1, Q4 overlaps Q2 — saved with one key per question
        await open();
        assert.equal(await chip(), null, 'no chip when nothing is saved');
        await page.locator('#curate-target').fill('8');
        await page.evaluate(() => document.querySelectorAll('#quiz-curate-dialog .curate-pin')[2].click());
        await suggest(proposal(12, [2, 4, 7, 9], { 7: 1, 4: 2 }));
        const saved = await page.evaluate(() => ({ n: store.length, keys: store[0].qkeys, pins: store[0].pins, target: store[0].target }));
        assert.deepEqual([saved.n, saved.keys.length, saved.keys.every(k => /^[0-9a-f]{16}$/.test(k)), new Set(saved.keys).size, saved.pins, saved.target], [1, 12, true, 12, [3], 8], 'the run keeps one short key per question: ' + JSON.stringify(saved));
        assert.equal(await chip(), null, 'no chip on a fresh result of today\'s questions');
        await close();

        // 2 · old Q2 is deleted and old Q5 is edited → 11 questions; nothing restored, the chip offers the old set
        await page.evaluate(() => { fixture.questions.splice(1, 1); fixture.questions[3].q += ' (edited)'; });
        const n2 = await page.evaluate(() => calls.length);
        await open();
        assert.equal(await tabs(), 'Keep · 11 | Remove · 0', 'nothing is restored by itself');
        let c = await chip();
        assert.deepEqual([c.text, c.pressed, c.on], ['↩ old set 10/11', 'false', false], 'the offer: 10 of today\'s 11 questions were in that run: ' + JSON.stringify(c));
        assert.match(c.title, /^Last result is from an older set — .* · 12 → Keep 8 · .*\. 10 of your 11 questions were in it\. Tap to carry it over \(no AI call\); a changed or new question stays Keep, not assessed\.$/, 'the sentence is the tooltip: ' + c.title);
        assert.equal(c.label, 'Use the last result, from an older set: 10 of 11 questions'); assert.match(c.th, /ชุดคำถามเก่า/, 'Thai rides in data-th-title');
        const lay = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(), o = r('#curate-old'), i = r('.curate-foot .curate-instructions > summary'), h = r('#curate-history > summary'), g = r('#curate-suggest'), foot = r('.curate-card');   // .curate-foot is display:contents — the card is the box
            return { order: i.right <= o.left + 1 && o.right <= h.left + 1 && h.right <= g.left + 1, oneLine: Math.abs((o.top + o.height / 2) - (g.top + g.height / 2)) < 6 && Math.abs((o.top + o.height / 2) - (h.top + h.height / 2)) < 6, inside: o.right <= foot.right + 1, amber: getComputedStyle(document.getElementById('curate-old')).borderTopColor }; });
        assert.deepEqual(lay, { order: true, oneLine: true, inside: true, amber: 'rgb(245, 158, 11)' }, 'lean L1: the chip sits in the tools row between ✏ and 🕘, on the same line as Suggest: ' + JSON.stringify(lay));
        assert.equal(await page.evaluate(() => calls.length), n2, 'offering it calls no AI');

        // 3 · tap → carried over with today's numbers
        await page.locator('#curate-old').click(); await frame();
        c = await chip();
        assert.deepEqual([c.text, c.pressed, c.on], ['⚠️ old set 10/11', 'true', true], 'the chip now says the result is from the old set: ' + JSON.stringify(c));
        assert.match(c.title, /^Based on an older set · 10 carried over · 1 changed or new = not assessed · 2 no longer in the quiz · numbers inside the reasons are the old ones\. Tap to clear\.$/, c.title);
        assert.equal(await tabs(), 'Keep · 8 | Remove · 3');
        assert.deepEqual(await page.evaluate(() => [document.getElementById('curate-target').value, document.getElementById('curate-suggest').hidden, calls.length]), ['8', false, n2], 'Keep shows what is kept now; still no AI call');
        let r = await rows();   // the Remove tab is the one shown
        assert.deepEqual(r.map(x => x.id), ['3', '6', '8'], 'old Q4 / Q7 / Q9 are today\'s Q3 / Q6 / Q8: ' + JSON.stringify(r.map(x => x.id)));
        assert.ok(/Remove reason 4/.test(r[0].text) && /Remove reason 7/.test(r[1].text) && /Remove reason 9/.test(r[2].text), 'each keeps its own reason: ' + JSON.stringify(r.map(x => x.text.slice(0, 30))));
        assert.deepEqual([r[0].compare, r[1].compare], [[], ['Compare Q6 ↔ Q1']], 'a comparison follows both questions (old Q7 ↔ Q1); one with a deleted question (old Q4 ↔ Q2) is dropped');
        await tab('Keep'); await frame(); r = await rows();
        assert.deepEqual(r.map(x => x.id), ['1', '2', '4', '5', '7', '9', '10', '11']);
        const q4 = r.find(x => x.id === '4'), q2 = r.find(x => x.id === '2');
        assert.deepEqual([q4.na, q4.text], [true, 'not assessed · changed since that run'], 'the edited question is kept and says it has no verdict: ' + JSON.stringify(q4));
        assert.equal(r.filter(x => x.na).length, 1, 'only that one');
        assert.deepEqual([q2.pin, r.filter(x => x.pin === 'true').length], ['true', 1], 'the 📌 followed its question (old Q3 → Q2)');
        assert.match(await page.evaluate(() => document.getElementById('curate-coverage').textContent), /^1\/1 topics covered · 1 pinned$/, 'a question with no verdict adds no topic');
        assert.match(await page.evaluate(() => document.getElementById('curate-history-status').textContent), /^Based on an older set · .* · 10 of 11 carried over · No AI call$/);
        // moving the unassessed question does not claim an AI verdict
        await page.evaluate(() => [...document.querySelectorAll('#curate-rows .curate-question')].find(x => x.dataset.questionId === '4').querySelector('.curate-move').click()); await frame();
        await tab('Remove'); await frame(); r = await rows();
        assert.deepEqual([r.find(x => x.id === '4').na, /AI suggested/.test(r.find(x => x.id === '4').text)], [true, false], 'moved by hand: still "not assessed", no "AI suggested …" note');

        // 4 · tap again → cleared, the offer is back; a fresh Suggest removes the chip
        await page.locator('#curate-old').click(); await frame();
        c = await chip();
        assert.deepEqual([c.text, c.on, await tabs()], ['↩ old set 10/11', false, 'Keep · 11 | Remove · 0'], 'cleared: back to the offer and an empty proposal');
        await page.locator('#curate-old').click(); await frame();
        await page.locator('#curate-target').fill('9'); await frame();
        await suggest(proposal(11, [10, 11]));
        assert.deepEqual([await chip(), await tabs()], [null, 'Keep · 9 | Remove · 2'], 'a fresh result of today\'s questions replaces it; no chip');
        await close();

        // 5 · no offer for a run saved without keys, or one that covers under half of today's questions
        await page.evaluate(() => { store = [{ ...store[1], id: 'nokeys', qkeys: undefined }]; fixture.questions[0].q += ' (again)'; });
        await open(); assert.equal(await chip(), null, 'a run saved before this version (no keys) cannot be carried over'); await close();
        await page.evaluate(() => { fixture.questions = mkQuestions(12); });
        await open(); await suggest(proposal(12, [1, 2])); await close();
        await page.evaluate(() => { fixture.questions = [...mkQuestions(5), ...Array.from({ length: 7 }, (_, i) => ({ ...mkQuestions(1)[0], q: 'A new question ' + i }))]; });
        await open(); assert.equal(await chip(), null, '5 of 12 questions in common is under half: no offer'); await close();

        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: AI Curate old set (V102.648) — runs keep a key per question; after questions change the chip "↩ old set m/n" sits in the tools row (no extra line, no AI call); tap carries verdicts over with today\'s numbers (pins + comparisons follow, a changed question is kept + "not assessed"), chip turns "⚠️ old set m/n"; tap again clears; a fresh Suggest removes it; no offer without keys or under half');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
