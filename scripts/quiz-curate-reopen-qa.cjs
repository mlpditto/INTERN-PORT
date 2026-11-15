// V102.647 (owner pick A, mockup-curate-reopen): AI Curate opened again comes back on the LAST saved result of the same questions.
// Before, every open reset the settings (Settings model, Keep 10, balanced, no pins, no instructions) and a saved run was restored only on an
// exact match — so a run made with any other setting was never shown again and Suggest had to run (and be paid for) once more.
// The REAL quiz-curate.js + quiz-curate-history.js (real key hashing; load / save kept in memory) + the shared rail from admin.html:
//  1 a Suggest with non-default settings (another model, Keep 8, strategy, a pin, instructions) → close → open: the same settings and the same
//    result are on screen, with NO new AI call; 🕘 is ringed green
//  2 the newest run wins when several match these questions
//  3 after a question is edited the old runs do not come back (their numbers point at the old set): default settings, Suggest asked for
//  4 ↻ Use latest questions keeps the admin's current settings (it does not adopt a saved run)
//  5 a run whose model is no longer in the catalogue is left in 🕘
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', d => { errors.push('native dialog opened: ' + d.message().slice(0, 60)); d.dismiss(); });
        await page.route('https://curate.test/', r => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.route(/curate\.test\/.+/, r => r.fulfill({ status: 200, body: '', contentType: 'image/svg+xml' }));
        await page.goto('https://curate.test/');
        const html = fs.readFileSync('public/admin.html', 'utf8');
        assert.ok(/src="quiz-curate\.js\?v=V\d+\.\d+"/.test(html));
        await page.setContent('<meta charset="utf-8">' + [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n') + '<input id="edit-quiz-id" value="source-quiz"><input id="ai-analyzer-model-val" value="gpt-6-luna">');
        for (const f of ['quiz-curate.css', 'text-ai-chips.css', 'audit-toolbar.css']) await page.addStyleTag({ path: path.join('public', f) });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        const a = html.indexOf('window.browseAuditProvider = function'), b = html.indexOf('window.auditModelControlsHtml = function');
        assert.ok(a > 0 && b > a, 'provider rail helpers found in admin.html');
        await page.addScriptTag({ content: html.slice(a, b) });
        await page.evaluate(() => {
            window.fixture = { title: 'Constipation', targetGroup: 'Interns', totalPoints: 1.2, isPoll: false, quizType: 'mcq', caseContent: '', materials: [], blueprint: {}, startTime: '2026-11-01T09:00', deadline: '2026-11-30T09:00',
                questions: Array.from({ length: 12 }, (_, i) => ({ q: 'Constipation question ' + (i + 1), content: '', type: 'choice', options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: [1], timer: 60, tags: '', explanation: 'Explanation ' + (i + 1) })) };
            for (let i = 0; i < 12; i++) { const el = document.createElement('div'); el.className = 'quiz-q-item'; el.dataset.id = i + 1; el.hidden = true; document.body.append(el); }
            window.getQuizFormData = () => structuredClone(fixture);
            window.shouldMarkQuestionMissingAnswer = () => false; window.showToast = () => {}; window.safeJsonParse = JSON.parse;
            window.ensureAuthForQuizWrite = async () => true;
            window.calls = []; window.callUniversalAI = (...args) => { calls.push(args[0]); return new Promise(resolve => { window.aiResolve = resolve; }); };
            window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } }; window.auth = { currentUser: { email: 'qa-admin@example.com' } };
            window.db = { collection: () => ({ doc: id => ({ id: id || 'x', get: async () => ({ exists: true, data: () => structuredClone(fixture) }), set: async () => {} }) }) };
        });
        await page.addScriptTag({ path: 'public/quiz-curate-history.js' });   // the real key hashing
        await page.evaluate(() => { window.store = []; curateHistory.load = async () => structuredClone(store); curateHistory.save = async (id, run) => { store = [structuredClone(run), ...store.filter(r => r.id !== run.id)].slice(0, 5); }; });
        await page.addScriptTag({ path: 'public/quiz-curate.js' });

        const frame = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        const open = async () => { await frame(); await page.evaluate(() => openQuizCurate()); await page.waitForFunction(() => !/Checking saved results/.test(document.getElementById('curate-history-status').textContent)); await frame(); };
        const close = async () => { await page.locator('.curate-close').click(); await page.waitForFunction(() => !document.querySelector('#quiz-curate-dialog').open); await frame(); };
        const proposal = (remove, extra = {}) => ({ questions: Array.from({ length: 12 }, (_, i) => { const id = i + 1, keep = !remove.includes(id); return { id, keep, priority: keep ? id : 12, topic: 'Constipation', reasonType: keep ? 'coverage' : 'quality', related: [],
            reason: (keep ? 'Keep reason ' : 'Remove reason ') + id + (extra.tag || ''), reasonTh: 'เหตุผลข้อ ' + id, detail: 'Detail', detailTh: 'รายละเอียด', impact: 'Impact', impactTh: 'ผลกระทบ' }; }) });
        const suggest = async data => { const before = await page.evaluate(() => calls.length); await page.locator('#curate-suggest').click(); await page.waitForFunction(n => calls.length > n, before);
            await page.evaluate(d => aiResolve({ text: JSON.stringify(d) }), data); await page.waitForFunction(() => document.querySelector('#quiz-curate-dialog').getAttribute('aria-busy') === 'false'); await page.waitForFunction(n => store.length > n || /could not be saved/.test(document.getElementById('curate-history-status').textContent), await page.evaluate(() => store.length - 0) - 1).catch(() => {}); await frame(); };
        const view = () => page.evaluate(() => { const d = document.getElementById('quiz-curate-dialog'), hist = document.getElementById('curate-history');
            return { model: (d.querySelector('[data-model][aria-pressed="true"]') || {}).dataset?.model || '', target: document.getElementById('curate-target').value, mode: (d.querySelector('[data-mode][aria-pressed="true"]') || {}).dataset?.mode || '',
                pins: [...d.querySelectorAll('.curate-pin[aria-pressed="true"]')].map(b => b.closest('[data-id], .curate-row, li, article, div')?.querySelector('.curate-number')?.textContent || '?'),
                instructions: document.getElementById('curate-instructions').value, tabs: [...d.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => /^(Keep|Remove) · \d+$/.test(t)).join(' | '),
                status: document.getElementById('curate-history-status').textContent, ring: hist.classList.contains('saved'), suggestHidden: document.getElementById('curate-suggest').hidden, reasons: d.textContent.includes('Remove reason 2') };
        });

        // 0 · a first open: nothing saved, the defaults
        await open();
        let v = await view();
        assert.deepEqual([v.model, v.target, v.tabs, v.ring], ['gpt-6-luna', '10', 'Keep · 12 | Remove · 0', false], 'first open = defaults, nothing restored: ' + JSON.stringify(v));
        assert.match(v.status, /No saved result yet/);

        // 1 · a Suggest with non-default settings → close → open: the same settings + result, no AI call
        const modes = await page.evaluate(() => [...document.querySelectorAll('#quiz-curate-dialog [data-mode]')].map(b => b.dataset.mode));
        const otherMode = modes.find(m => m !== 'balanced'); assert.ok(otherMode, 'a second strategy exists: ' + modes);
        await page.evaluate(m => { const d = document.getElementById('quiz-curate-dialog'); d.querySelector('[data-model="gemini-3.8-flash"]').click(); d.querySelector('[data-mode="' + m + '"]').click(); }, otherMode);
        await page.locator('#curate-target').fill('8');
        await page.evaluate(() => { const rows = [...document.querySelectorAll('#quiz-curate-dialog .curate-pin')]; rows[2].click(); });   // 📌 Q3
        await page.evaluate(() => { const t = document.getElementById('curate-instructions'); t.value = 'Prefer paediatric cases'; t.dispatchEvent(new Event('input', { bubbles: true })); });
        await suggest(proposal([2, 4, 7, 9]));
        assert.equal(await page.evaluate(() => store.length), 1, 'the run is saved');
        const saved = await page.evaluate(() => ({ model: store[0].model, target: store[0].target, mode: store[0].mode, pins: store[0].pins, instructions: store[0].instructions }));
        assert.deepEqual(saved, { model: 'gemini-3.8-flash', target: 8, mode: otherMode, pins: [3], instructions: 'Prefer paediatric cases' }, 'saved with its settings: ' + JSON.stringify(saved));
        await close();
        const callsBefore = await page.evaluate(() => calls.length);
        await open();
        v = await view();
        assert.deepEqual([v.model, v.target, v.mode, v.instructions], ['gemini-3.8-flash', '8', otherMode, 'Prefer paediatric cases'], 'reopened on the last run\'s model, Keep, strategy and instructions: ' + JSON.stringify(v));
        assert.match(await page.evaluate(() => document.getElementById('curate-coverage').textContent), /· 1 pinned$/, 'the pin is counted again');
        await page.evaluate(() => [...document.querySelectorAll('#quiz-curate-dialog button')].find(b => /^Keep · \d+$/.test(b.textContent.trim())).click()); await frame();
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#quiz-curate-dialog .curate-pin[aria-pressed="true"]')].map(b => b.closest('.curate-actions').parentElement.querySelector('.curate-number').textContent)), ['Q3'], 'and Q3 is the pinned one (Keep tab)');
        await page.evaluate(() => [...document.querySelectorAll('#quiz-curate-dialog button')].find(b => /^Remove · \d+$/.test(b.textContent.trim())).click()); await frame();
        assert.deepEqual([v.tabs, v.ring, v.reasons], ['Keep · 8 | Remove · 4', true, true], 'and its result is on screen (🕘 ringed green): ' + JSON.stringify(v));
        assert.match(v.status, /^Saved result · gemini-3\.8-flash · .* · No AI call$/, 'the status says where it came from');
        assert.equal(await page.evaluate(() => calls.length), callsBefore, 'no AI call was made to show it');
        assert.equal(await page.evaluate(() => document.getElementById('curate-instructions').closest('details').open), true, 'the instructions box is open because it has text');
        assert.equal(await page.evaluate(() => { const t = document.querySelector('#quiz-curate-dialog .audit-provider[aria-pressed="true"]'); return t && t.dataset.provider; }), 'Gemini', 'the rail shows the adopted model\'s vendor');
        // a changed setting still asks for a new Suggest, as before
        await page.locator('#curate-target').fill('9');
        assert.equal(await page.evaluate(() => document.getElementById('curate-suggest').disabled), false, 'changing Keep makes Suggest available again');
        await close();

        // 2 · the newest matching run wins
        await open(); await page.locator('#curate-target').fill('10'); await suggest(proposal([5, 6], { tag: ' (newer)' })); await close();
        assert.equal(await page.evaluate(() => store.length), 2);
        await open(); v = await view();
        assert.deepEqual([v.target, v.tabs], ['10', 'Keep · 10 | Remove · 2'], 'the newest run of these questions is the one shown: ' + JSON.stringify(v));
        assert.ok(await page.evaluate(() => document.getElementById('quiz-curate-dialog').textContent.includes('Remove reason 5 (newer)')), 'with its own reasons');
        await close();

        // 3 · a question is edited → the saved runs point at the old set: defaults, Suggest asked for, nothing restored
        await page.evaluate(() => { fixture.questions[0].q += ' (edited)'; });
        const n3 = await page.evaluate(() => calls.length);
        await open(); v = await view();
        assert.deepEqual([v.model, v.target, v.mode, v.instructions, v.tabs, v.ring], ['gpt-6-luna', '10', 'balanced', '', 'Keep · 12 | Remove · 0', false], 'edited questions: back to the defaults, nothing restored: ' + JSON.stringify(v));
        assert.match(v.status, /Previous results differ from these questions or settings\. Select Suggest\./);
        assert.equal(await page.evaluate(() => calls.length), n3, 'and no AI call by itself');
        assert.equal(await page.evaluate(() => document.querySelectorAll('#curate-history-list > details').length), 2, 'the old runs are still listed in 🕘');
        await close();
        await page.evaluate(() => { fixture.questions[0].q = fixture.questions[0].q.replace(' (edited)', ''); });

        // 4 · ↻ Use latest questions keeps the admin's current settings — it never adopts a saved run
        await open(); await page.locator('#curate-target').fill('7');
        await page.evaluate(() => { fixture.questions[1].q += ' (changed while open)'; });
        await page.locator('#curate-suggest').click(); await frame();
        await page.waitForFunction(() => !document.getElementById('curate-reload').hidden);
        await page.evaluate(() => { fixture.questions[1].q = fixture.questions[1].q.replace(' (changed while open)', ''); });   // the editor is back to the saved set
        await page.locator('#curate-reload').click();
        await page.waitForFunction(() => !/Checking saved results/.test(document.getElementById('curate-history-status').textContent)); await frame();
        v = await view();
        assert.deepEqual([v.target, v.tabs, v.ring], ['7', 'Keep · 12 | Remove · 0', false], '↻ keeps Keep 7 and adopts nothing: ' + JSON.stringify(v));
        await close();

        // 5 · a run whose model left the catalogue is skipped; the next matching run is used
        await page.evaluate(() => { store[0].model = 'retired-model-x'; });
        await open(); v = await view();
        assert.deepEqual([v.model, v.target, v.tabs], ['gemini-3.8-flash', '8', 'Keep · 8 | Remove · 4'], 'the retired-model run is skipped, the older valid one is shown: ' + JSON.stringify(v));
        await close();

        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: AI Curate reopen (V102.647) — a fresh open adopts the newest saved run of the same questions (model · Keep · strategy · pins · instructions) and shows its result with no AI call; edited questions → defaults + Suggest; ↻ keeps current settings; a retired model\'s run is skipped');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
