// V102.679 (owner pick A, mockup-curate-delete): ✦ AI Curate ② Review runs last → first (Q20 … Q2) and the right pane has
// 🗑 Delete Qn beside Keep. It removes that question from the editor form at once (nothing saved until Save Quiz); the row stays,
// struck, with ↶ Undo, and the next lower question opens. Save as new still works after deletions (they are expected, not "the editor
// changed"); A kept question has no 🗑.
// The REAL quiz-curate.js + css in Chromium; the editor form is read from the .quiz-q-item elements, so a deletion really changes it.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
const REMOVE = [2, 4, 5, 7, 8, 9, 15, 17, 19, 20];

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('https://curate.test/', r => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.route('https://curate.test/assets/**', r => r.fulfill({ status: 404, body: '' }));
        await page.goto('https://curate.test/');
        await page.setContent([...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n') + '<input id="edit-quiz-id" value="source-quiz"><input id="ai-analyzer-model-val" value="claude-fable-5-1"><div id="editor"></div>');
        for (const f of ['quiz-curate.css', 'text-ai-chips.css', 'audit-toolbar.css']) await page.addStyleTag({ path: 'public/' + f });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        const a = html.indexOf('window.browseAuditProvider = function'), b = html.indexOf('window.auditModelControlsHtml = function');
        await page.addScriptTag({ content: html.slice(a, b) });
        await page.evaluate(() => {
            window.fixture = { title: 'Clinical assessment', targetGroup: 'Interns', totalPoints: 2, isPoll: false, quizType: 'mcq', caseContent: '', materials: [], blueprint: {}, startTime: '', deadline: '',
                questions: Array.from({ length: 20 }, (_, i) => ({ q: 'Clinical question ' + (i + 1), content: '', type: 'choice', options: ['Option A', 'Option B'], correct: [1], timer: 60, tags: 'Objective ' + (i % 6), explanation: 'e' })) };
            const editor = document.getElementById('editor');
            for (let i = 0; i < 20; i++) { const el = document.createElement('div'); el.className = 'quiz-q-item'; el.dataset.id = i + 1; editor.append(el); }
            // the form IS the editor's items, like the real getQuizFormData
            window.getQuizFormData = () => ({ ...structuredClone(fixture), questions: [...document.querySelectorAll('.quiz-q-item')].map(el => structuredClone(fixture.questions[el.dataset.id - 1])) });
            window.paginated = 0; window.updateQuizPagination = () => { window.paginated++; }; window.triggerAutoSave = () => {};
            window.shouldMarkQuestionMissingAnswer = () => false; window.showToast = () => {}; window.safeJsonParse = JSON.parse; window.ensureAuthForQuizWrite = async () => true;
            window.callUniversalAI = () => new Promise(resolve => { window.aiResolve = resolve; });
            window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
            window.written = null;
            window.db = { collection: () => ({ doc: id => ({ id: id || 'x', get: async () => ({ exists: true, data: () => structuredClone(fixture) }), set: async d => { window.written = d; } }) }) };
            window.curateHistory = { key: async v => JSON.stringify(v), load: async () => [], save: async () => {} };
        });
        await page.addScriptTag({ path: 'public/quiz-curate.js' });
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.evaluate(() => openQuizCurate());
        await page.locator('#curate-target').fill('10');
        await page.locator('#curate-suggest').click();
        await page.evaluate(REMOVE => aiResolve({ text: JSON.stringify({ questions: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, keep: !REMOVE.includes(i + 1), topic: 'Core ' + (i % 3), reason: 'r', reasonTh: 'r', detail: 'd', detailTh: 'd', impact: 'i', impactTh: 'i', reasonType: 'quality', related: [] })) }) }), REMOVE);
        await page.waitForFunction(() => document.querySelector('#quiz-curate-dialog').getAttribute('aria-busy') === 'false');
        await page.waitForTimeout(200);

        const view = () => page.evaluate(() => {
            const d = document.getElementById('quiz-curate-dialog');
            return { step: d.dataset.step, rows: [...d.querySelectorAll('#curate-rows [data-question-id]')].map(r => +r.dataset.questionId),
                sel: +(d.querySelector('#curate-rows .sel') || {}).dataset?.questionId || null,
                deletedRows: [...d.querySelectorAll('#curate-rows .curate-question.deleted')].map(r => +r.dataset.questionId),
                del: (d.querySelector('.curate-pane-del') || {}).textContent || null, head: (d.querySelector('.curate-pane-head b') || {}).textContent,
                editor: [...document.querySelectorAll('#editor .quiz-q-item')].map(e => +e.dataset.id), feedback: document.getElementById('curate-feedback').textContent,
                stale: !document.getElementById('curate-reload').hidden };
        });
        let v = await view();
        assert.equal(v.step, 'review');
        assert.deepEqual(v.rows, [...REMOVE].reverse(), 'the Remove list runs last → first');
        assert.equal(v.sel, 20, 'the last question opens first'); assert.equal(v.head, 'Q20 → Remove');
        assert.equal(v.del, '🗑 Delete Q20', 'the pane offers 🗑 Delete Q20');

        await page.click('.curate-pane-del'); v = await view();
        assert.equal(v.editor.length, 19, 'Q20 left the editor form'); assert.ok(!v.editor.includes(20));
        assert.deepEqual(v.deletedRows, [20], 'the row stays, marked deleted');
        assert.equal(await page.$eval('#curate-rows [data-question-id="20"] .curate-move', b => b.textContent), '↶ Undo', '↶ Undo in place of Keep');
        assert.equal(await page.$eval('#curate-rows [data-question-id="20"] .curate-pin', b => b.disabled), true, 'no 📌 on a deleted row');
        assert.equal(v.sel, 19, 'the next lower question opens'); assert.match(v.feedback, /Q20 deleted from the form · Save Quiz/);
        assert.equal(await page.$eval('#curate-rows [data-question-id="20"] .curate-stem', e => getComputedStyle(e).textDecorationLine), 'line-through');
        assert.ok(await page.evaluate(() => window.paginated) >= 1, 'the editor pager is refreshed');

        await page.click('.curate-pane-del'); v = await view();   // Q19
        assert.deepEqual(v.editor, Array.from({ length: 18 }, (_, i) => i + 1), 'Q19 and Q20 gone, Q1–Q18 untouched');
        assert.deepEqual(v.deletedRows.sort((x, y) => x - y), [19, 20]); assert.equal(v.sel, 17);

        await page.click('#curate-rows [data-question-id="20"] .curate-move'); v = await view();   // ↶ Undo Q20 from its row
        assert.deepEqual(v.editor, [...Array.from({ length: 18 }, (_, i) => i + 1), 20], 'Q20 is back, in its place after Q18');
        assert.deepEqual(v.deletedRows, [19]); assert.equal(v.sel, 20); assert.equal(v.del, '🗑 Delete Q20');
        await page.click('#curate-rows [data-question-id="19"]'); v = await view();
        assert.equal(v.del, '↶ Undo', 'a deleted question shows ↶ Undo in the pane');
        assert.equal(await page.$eval('.curate-pane-move', b => b.disabled), true, 'Keep is off for a deleted question');

        await page.click('[data-view="keep"]'); v = await view();
        assert.equal(v.rows[0], 1, 'the Keep list keeps its order'); assert.equal(v.del, null, 'a kept question has no 🗑');
        await page.click('[data-view="remove"]');

        // narrow window (no right pane): the opened row carries 🗑 Delete Qn beside Keep
        await page.setViewportSize({ width: 900, height: 1000 }); await page.click('[data-view="remove"]');
        assert.equal(await page.$eval('#quiz-curate-dialog', d => d.classList.contains('two')), false, 'one column at 900 px');
        assert.equal(await page.$$eval('.curate-row-del', b => b.length), 0, 'no 🗑 on folded lines');
        await page.click('#curate-rows [data-question-id="17"] .curate-row-toggle');
        assert.equal(await page.$eval('#curate-rows [data-question-id="17"] .curate-row-del', b => b.textContent), '🗑 Delete Q17', 'the opened row offers 🗑');
        await page.click('#curate-rows [data-question-id="17"] .curate-row-del'); v = await view();
        assert.ok(!v.editor.includes(17) && v.editor.length === 18, 'Q17 left the form (Q19 still deleted): ' + v.editor.join(' '));
        assert.deepEqual(v.deletedRows.sort((x, y) => x - y), [17, 19], 'the row stays, struck');
        assert.equal(await page.$eval('#curate-rows .curate-question.open', r => r.dataset.questionId), '15', 'the next one down (Q15) opens');
        await page.click('#curate-rows [data-question-id="17"] .curate-move'); v = await view();   // ↶ Undo
        assert.ok(v.editor.includes(17) && v.editor.length === 19, 'Q17 is back');
        await page.setViewportSize({ width: 1400, height: 1000 }); await page.click('[data-view="remove"]');

        // Save as new still works: the deletions were made here, so they are not "the editor changed"
        await page.click('[data-curate-step="save"]'); await page.click('button[data-save="new"]');
        assert.equal(await page.$eval('#curate-save', b => b.disabled), false, 'Save is not blocked by the deletion');
        await page.click('#curate-save');
        await page.waitForFunction(() => document.getElementById('curate-save').textContent === 'Saved');
        const written = await page.evaluate(() => window.written);
        assert.deepEqual(written.curation.originalQuestionNumbers, Array.from({ length: 20 }, (_, i) => i + 1).filter(id => !REMOVE.includes(id)).filter(Boolean), 'the new quiz holds the 10 kept questions');
        assert.ok(!(await view()).stale, 'not marked stale');
        assert.deepEqual(errors, []);

        console.log('quiz-curate-delete-qa: PASS');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
