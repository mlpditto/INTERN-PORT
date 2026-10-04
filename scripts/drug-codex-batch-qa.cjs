// V102.81: Drug Codex multi-select AI draft — the REAL functions and CSS are cut out of admin.html and run in a browser page with a
// fake AI and a fake Firestore that throws if touched (the batch must never write; only the normal Save does).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const between = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert(i >= 0 && j > i, 'marker ' + a.slice(0, 40)); return html.slice(i, j); };
const batchJs = between('        const dcaBatch = {', '        function dcaAutoDraftToggle() {');
const rowFn = between('        function dcaPublishedRowHtml(drug) {', '        function dcaRenderPublishedList() {');
const css = between('        /* V102.81: multi-select AI draft', '        /* V93.98 Phase 3: AI Auto-Draft button + input row */');
const keys = html.match(/const DCA_FIELD_KEYS = \[[\s\S]*?\];/)[0];
const arrays = html.match(/const DCA_ARRAY_FIELDS = \{[^}]*\};/)[0];
const edu = html.match(/const DCA_EDU_I18N_FIELDS = \[[^\]]*\];/)[0];
const toggleSrc = between('        function dcaAutoDraftToggle() {', '        function dcaAutoDraftCancel() {');
const cancelSrc = between('        function dcaAutoDraftCancel() {', '        function dcaSelectAutoDraftModel(el) {');
const saveHook = "await db.collection('drug_codex').doc(dcaState.editingId).update(payload);\n                    dcaBatchDone(dcaState.editingId);";
assert(html.includes(saveHook), 'save hook calls dcaBatchDone right after the update');
assert(/<div id="dca-batch-bar"/.test(html) && /<div id="dca-batch-hint"/.test(html), 'bar + hint markup present');

const page = `<style>${css}.dca-row{display:grid;grid-template-columns:1fr auto;padding:10px 14px;border:1px solid #ddd}</style>
<div id="dca-ai-input-row" style="display:none;"><div id="dca-ai-chip-rail"><div class="glass-toggle-item active">Sonnet 5.5</div></div><input id="dca-ai-model-val" value="claude-x"><input id="dca-ai-name"><button id="dca-ai-go-btn"></button><div id="dca-ai-error"></div><div id="dca-batch-hint" class="dca-batch-hint"></div></div>
<div id="dca-list" class="dca-list"></div><div id="dca-batch-bar" class="dca-batch-bar" style="display:none;"></div>`;

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const p = await browser.newPage();
        const errors = []; p.on('pageerror', e => errors.push(e.message));
        await p.route('http://batch.test/', r => r.fulfill({ body: '<html><body></body></html>', contentType: 'text/html' }));
        await p.goto('http://batch.test/');
        await p.setContent(page);
        // globals the real functions expect
        await p.addScriptTag({ content: `
            ${keys}
            ${arrays}
            ${edu}
            const DCA_AI_FILL_SKIP = new Set(['genericName']);
            const DCA_AI_FALLBACK_MODEL = 'fallback-model';
            const DCA_AI_LS_KEY = 'x';
            var db = new Proxy({}, { get() { throw new Error('the batch must not touch Firestore'); } });
            var dcaState = { codex: [], sortMode: 'completeness' };
            function dcaSyncAutoDraftChipFromStorage() {}
            function dcaEscapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
            function dcaCompletenessScore(d) { return { pct: d.__pct }; }
            function dcaCompleteChipHtml(d) { return '<span class="dca-row-complete">' + d.__pct + '%</span>'; }
            function dcaListContribChipsHtml() { return ''; }
            function dcaFormatAbsolute() { return ''; }
            function dcaBuildAiFillPrompt(seed, emptyKeys) { return 'FILL ' + seed.genericName + ' :: ' + emptyKeys.join(','); }
            function dcaParseAutoDraftResponse(raw) { try { return JSON.parse(raw); } catch (_) { return null; } }
            var toasts = [], opened = [], filled = [], translated = [];
            function showToast(t) { toasts.push(t); }
            function dcaEdit(id) { opened.push(id); }
            function dcaFillForm(d) { filled.push(d); }
            function dcaTranslateEducationI18n(o) { translated.push(o); return Promise.resolve(); }
            function dcaRenderPublishedList() { document.getElementById('dca-list').innerHTML = dcaState.codex.map(dcaPublishedRowHtml).join(''); }
            ${rowFn}
            ${batchJs}
            ${toggleSrc}
            ${cancelSrc}
            let inflight = 0, maxInflight = 0, calls = [], mode = {};
            window.__stats = () => ({ maxInflight, calls: calls.slice() });
            window.__mode = m => { mode = m; calls = []; maxInflight = 0; };
            window.callUniversalAI = async (model, prompt) => {
                inflight++; maxInflight = Math.max(maxInflight, inflight);
                const name = prompt.split('::')[0].replace('FILL ', '').trim(); calls.push(name + '@' + model);
                await new Promise(r => setTimeout(r, 25));
                inflight--;
                if (mode[name] === 'badjson') return { text: 'not json at all', model: 'm' };
                if (mode[name] === 'blank') return { text: JSON.stringify({}), model: 'm' };
                return { text: JSON.stringify({ indication: 'AI indication', class: 'AI class', patientCounseling: 'AI counsel', references: ['hint 1'], genericName: 'IGNORED' }), model: 'model-from-resp' };
            };
        ` });
        const full = {}; // a drug with every field filled
        await p.evaluate(() => {
            const mk = (i, name, pct, extra) => Object.assign({ _id: 'd' + i, genericName: name, brandNames: [], __pct: pct, updatedAt: null }, extra || {});
            const docs = [mk(0, 'Alpha', 11), mk(1, 'Bravo', 14, { indication: 'HUMAN indication' }), mk(2, 'Charlie', 95), mk(3, 'Delta', 22), mk(4, 'Echo', 29), mk(5, 'Foxtrot', 60)];
            for (let i = 6; i < 30; i++) docs.push(mk(i, 'Drug' + i, 50 + (i % 30)));
            // Charlie: everything filled in
            DCA_FIELD_KEYS.forEach(k => { docs[2][k] = DCA_ARRAY_FIELDS[k] ? ['x'] : 'filled'; });
            docs[2].genericName = 'Charlie';
            dcaState.codex = docs;
            dcaRenderPublishedList();
        });

        // 1. checkboxes exist but only show while the AI panel is open
        const boxDisplay = () => p.evaluate(() => getComputedStyle(document.querySelector('#dca-list .dca-pick')).display);
        assert.equal(await boxDisplay(), 'none', 'hidden while the panel is closed');
        await p.evaluate(() => dcaAutoDraftToggle());
        assert.equal(await boxDisplay(), 'block', 'visible while the AI panel is open');
        assert.match(await p.locator('#dca-batch-hint').textContent(), /All incomplete \(29\)/, 'hint counts the rows below 90 % (30 docs, one at 95 %)');
        assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('dca-batch-hint')).display), 'flex', 'hint visible with the panel');

        // 2. ticking one row → bar; a tick on a second; untick
        await p.locator('#dca-list .dca-row[data-id="d0"] .dca-pick').check();
        await p.locator('#dca-list .dca-row[data-id="d1"] .dca-pick').check();
        assert.equal(await p.locator('#dca-batch-bar').isVisible(), true);
        assert.match(await p.locator('#dca-batch-bar').textContent(), /2 drugs selected/);
        assert.match(await p.locator('#dca-batch-bar').textContent(), /model: Sonnet 5\.5 · 2 AI calls/);
        assert.equal(await p.evaluate(() => document.querySelector('.dca-row[data-id="d0"]').classList.contains('dca-on')), true);
        await p.locator('#dca-list .dca-row[data-id="d1"] .dca-pick').uncheck();
        assert.match(await p.locator('#dca-batch-bar').textContent(), /1 drug selected/);
        await p.evaluate(() => dcaBatchSelect('clear'));
        assert.equal(await p.locator('#dca-batch-bar').isVisible(), false, 'nothing selected, nothing ready → no bar');

        // 3. shortcuts: "below 30 %" = Alpha, Bravo, Delta, Echo; "all incomplete" is capped at 20 and takes the least complete first
        await p.evaluate(() => dcaBatchSelect('low'));
        assert.deepEqual(await p.evaluate(() => Array.from(dcaBatch.sel).sort()), ['d0', 'd1', 'd3', 'd4']);
        await p.evaluate(() => dcaBatchSelect('incomplete'));
        const inc = await p.evaluate(() => Array.from(dcaBatch.sel));
        assert.equal(inc.length, 20, 'capped at 20 per run');
        assert.deepEqual(inc.slice(0, 4), ['d0', 'd1', 'd3', 'd4'], 'least complete first');
        assert.ok(!inc.includes('d2'), '95 % is not incomplete');
        assert.ok((await p.evaluate(() => toasts)).some(t => /20 least complete of/.test(t)), 'tells the admin about the cap');
        await p.evaluate(() => dcaBatchSelect('clear'));

        // 4. run: Alpha (ok), Bravo (only its empty fields asked, human text kept), Charlie (nothing to fill), Delta (bad JSON twice), Echo (model blank)
        await p.evaluate(() => { __mode({ Delta: 'badjson', Echo: 'blank' }); ['d0', 'd1', 'd2', 'd3', 'd4'].forEach(id => { dcaBatch.sel.add(id); }); });
        await p.evaluate(() => dcaBatchRun());
        const st = await p.evaluate(() => ({ status: dcaBatch.status, running: dcaBatch.running, keys: Object.keys(dcaBatch.results), stats: __stats() }));
        assert.equal(st.running, false);
        assert.deepEqual(st.status, { d0: 'ok', d1: 'ok', d2: 'skip', d3: 'bad', d4: 'bad' });
        assert.deepEqual(st.keys.sort(), ['d0', 'd1']);
        assert.ok(st.stats.maxInflight <= 2, 'at most 2 AI calls at once, saw ' + st.stats.maxInflight);
        assert.equal(st.stats.maxInflight, 2, 'but it does run two at a time');
        assert.ok(!st.stats.calls.some(c => c.startsWith('Charlie')), 'a fully filled drug costs no AI call');
        assert.equal(st.stats.calls.filter(c => c.startsWith('Delta')).length, 2, 'invalid JSON is retried once');
        assert.ok(st.stats.calls.every(c => c.endsWith('@claude-x')), 'uses the model picked in the panel');
        const res = await p.evaluate(() => dcaBatch.results);
        assert.deepEqual(Object.keys(res.d1.fill).sort(), ['class', 'patientCounseling', 'references'], 'Bravo: indication was already typed → not asked / not replaced');
        assert.equal(res.d0.fill.genericName, undefined, 'genericName is never taken from the model');
        assert.deepEqual(res.d0.edu, ['patientCounseling']);
        assert.ok((await p.evaluate(() => dcaBatch.err.d3)).includes('invalid JSON'), 'failure reason kept');
        assert.equal(await p.locator('.dca-row[data-id="d0"] .dca-st.ok').count(), 1);
        assert.equal(await p.locator('.dca-row[data-id="d3"] .dca-st.bad').count(), 1);
        assert.match(await p.locator('#dca-batch-bar').textContent(), /2 drafts ready to review/);
        assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('dca_batch_results_v1')).d0.model), 'model-from-resp', 'results survive a reload');

        // 5. review: the normal edit form opens, AI text only in still-empty fields, flagged as AI drafted, nothing saved
        await p.evaluate(() => { opened.length = 0; filled.length = 0; translated.length = 0; dcaState.codex.find(d => d._id === 'd1').class = 'HUMAN class added meanwhile'; dcaBatchReview('d1'); });
        const rv = await p.evaluate(() => ({ opened, filled: filled[0], translated }));
        assert.deepEqual(rv.opened, ['d1']);
        assert.equal(rv.filled.indication, 'HUMAN indication'); assert.equal(rv.filled.class, 'HUMAN class added meanwhile', 'a field typed after the batch ran is not overwritten');
        assert.equal(rv.filled.patientCounseling, 'AI counsel'); assert.equal(rv.filled.aiDrafted, true); assert.equal(rv.filled.aiDraftedModel, 'model-from-resp'); assert.equal(rv.filled._id, 'd1');
        assert.deepEqual(rv.translated, [{ fields: ['patientCounseling'], silent: false }], 'only the freshly filled education field is translated');
        // "Review next" opens the remaining one
        await p.evaluate(() => { opened.length = 0; dcaBatchReviewNext(); });
        assert.deepEqual(await p.evaluate(() => opened), ['d0']);

        // 6. saving the reviewed drug clears its result
        await p.evaluate(() => { dcaBatchDone('d1'); });
        assert.equal(await p.evaluate(() => 'd1' in dcaBatch.results), false);
        assert.deepEqual(await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('dca_batch_results_v1')))), ['d0']);

        // 7. Stop: the run ends after the in-flight calls, the rest go back to "not selected"
        await p.evaluate(() => { __mode({}); ['d6', 'd7', 'd8', 'd9', 'd10', 'd11'].forEach(id => dcaBatch.sel.add(id)); });
        await p.evaluate(() => { const run = dcaBatchRun(); setTimeout(dcaBatchStop, 30); return run; });
        const stopped = await p.evaluate(() => ({ ok: ['d6', 'd7', 'd8', 'd9', 'd10', 'd11'].filter(id => dcaBatch.status[id] === 'ok').length, queued: ['d6', 'd7', 'd8', 'd9', 'd10', 'd11'].filter(id => dcaBatch.status[id] === 'queued').length, running: dcaBatch.running }));
        assert.ok(stopped.ok >= 2 && stopped.ok < 6 && stopped.queued === 0 && stopped.running === false, JSON.stringify(stopped));

        // 8. closing the panel clears the selection and hides the checkboxes again; ready drafts stay
        await p.evaluate(() => { dcaBatch.sel.add('d20'); dcaAutoDraftCancel(); });
        assert.equal(await p.evaluate(() => dcaBatch.sel.size), 0);
        assert.equal(await boxDisplay(), 'none');
        assert.match(await p.locator('#dca-batch-bar').textContent(), /ready to review/, 'drafts that are ready stay reachable after the panel closes');

        assert.deepEqual(errors, []);
        console.log('PASS: drug-codex batch AI draft — checkboxes only with the AI panel, shortcuts (<30 %, all incomplete capped at 20, least complete first), 2 calls at a time, fully filled drug skipped, retry once on bad JSON, only empty fields asked/merged, review opens the normal form (nothing written to Firestore), results persist and clear on save, Stop works');
    } finally {
        await browser.close();
    }
})().catch(e => { console.error(e); process.exit(1); });
