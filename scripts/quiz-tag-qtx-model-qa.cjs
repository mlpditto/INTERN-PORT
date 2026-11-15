// V102.471 — the Save-time "✨ AI suggests" tag dialog (qtx) names its model and lets the admin pick one: local first (Ollama), remembered; a pick on the
// result / error view runs again with that model. The REAL admin.html, callUniversalAI stubbed (records the model).
// V102.646 (owner pick A, mockup-tag-dialog-picker): the picker is the app's shared rail (ai-model-ui.js) — vendor icons, the picked vendor's chips
// right after its icon, EVERY catalogue model + the trial ones (so Muse, Kimi, Gemma, Inkling are here without a list of their own); the dialog's
// QTX_MODELS / QTX_VENDORS are gone. Style D's other parts stay: icon title, edited dot, "Replace your edits?", icon-only footer.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => typeof confirmQuizEditorTags === 'function' && window.QUIZ_TAG_KIND && window.qtxModel && typeof window.oneStyleModelPickers === 'function' && document.readyState === 'complete');
        const setup = await page.evaluate(() => {
            localStorage.removeItem('quizTagAiModel');
            document.getElementById('quiz-title').value = 'Allergic rhinitis in older adults';
            document.getElementById('quiz-tags').value = ''; const sel = document.getElementById('quiz-system-select'); if (sel) sel.value = '';
            window.__calls = []; window.__fail = {};
            window.callUniversalAI = async (model) => { window.__calls.push(model); if (window.__fail[model]) throw new Error('Ollama is not reachable at http://localhost:11434.'); return { text: JSON.stringify({ results: [{ id: 'editor', system: 'respiratory', topics: ['Allergic Rhinitis'], skill: ['Pharmacotherapy'], population: ['Geriatrics'] }] }) }; };
            return { kinds: ['allergic rhinitis', 'pharmacotherapy', 'geriatrics'].map(t => !!window.QUIZ_TAG_KIND.get(t)), gone: [typeof window.QTX_MODELS, typeof window.QTX_VENDORS, typeof window.qtxVendor] };
        });
        assert.deepEqual(setup.kinds, [true, true, true], 'the fixture tags are in the vocabulary');
        assert.deepEqual(setup.gone, ['undefined', 'undefined', 'undefined'], 'the dialog keeps no model list of its own');
        // pressed = the chips on screen (the shown vendor's), * = the model in use; vendors = the icons, * = the vendor shown
        const view = () => page.evaluate(() => { const o = document.getElementById('qtx-overlay'), rail = o.querySelector('.qtx-rail'); return { title: (o.querySelector('#qtx-title') || {}).textContent,
            pressed: rail ? [...rail.querySelectorAll(':scope > button[data-value]')].filter(b => !b.hidden).map(b => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')) : [],
            vendors: rail ? [...rail.querySelectorAll('.mr-vendor')].map(b => b.getAttribute('aria-label') + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')) : [], sub: o.textContent.replace(/\s+/g, ' ') }; });
        const vendor = name => page.evaluate(n => document.querySelector('#qtx-overlay .qtx-rail .mr-vendor[data-provider="' + n + '"]').click(), name);
        const click = txt => page.evaluate(t => [...document.querySelectorAll('#qtx-overlay button')].filter(b => !b.hidden).find(b => (b.textContent.trim() || b.getAttribute('aria-label') || '').startsWith(t)).click(), txt);
        const chip = txt => page.evaluate(t => [...document.querySelectorAll('#qtx-overlay .qtx-rail > button[data-value]')].find(b => !b.hidden && b.textContent.trim() === t).click(), txt);   // a model chip on screen, by its exact text (the vendor icon may carry the same name)
        const ready = re => page.waitForFunction(src => new RegExp(src).test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || ''), re.source);

        // 1 · opens with the shared rail, LOCAL selected when nothing is remembered (Ollama sits with the trial vendors, last — DESIGN §6.1)
        await page.evaluate(() => { window.__done = null; confirmQuizEditorTags('Save').then(v => { window.__done = v; }); });
        let v = await view();
        assert.match(v.title, /Tags incomplete/);
        assert.deepEqual(v.vendors, ['Gemini', 'GPT', 'Claude', 'Qwen', 'DeepSeek', 'Muse', 'Kimi', 'Grok', 'Ollama*'], 'the shared rail: one icon per vendor in catalogue order, trials last; the vendor in use is the one shown');
        assert.deepEqual(v.pressed, ['Ollama*', 'Inkling 2 Small'], 'only the shown vendor chips are listed; local is the default');
        const shape = await page.evaluate(() => { const o = document.getElementById('qtx-overlay'), rail = o.querySelector('.qtx-rail'), card = o.firstElementChild; const total = (window.TEXT_AI_MODELS || []).length + (window.TEXT_AI_TRIAL_MODELS || []).length;
            return { shared: rail.classList.contains('text-ai-chips') && rail.dataset.vendorFirst === '1', chips: rail.querySelectorAll(':scope > button[data-value]').length, total, logos: [...rail.querySelectorAll('.mr-vendor')].every(b => b.querySelector('.text-ai-logo')), old: o.querySelectorAll('[aria-label="AI vendor"]').length, inside: rail.getBoundingClientRect().right <= card.getBoundingClientRect().right + 1 && rail.scrollWidth <= rail.clientWidth + 1, focus: (document.activeElement || {}).className || '' }; });
        assert.deepEqual([shape.shared, shape.chips === shape.total, shape.logos, shape.old, shape.inside], [true, true, true, 0, true], 'the app\'s own rail, every catalogue + trial model, logo icons, no second picker, wrapped inside the 440 px dialog: ' + JSON.stringify(shape));
        assert.match(shape.focus, /mr-vendor/, 'focus lands on something visible (the shown vendor)');

        // 2 · browsing a vendor changes nothing but the list; a pick on the ask view is remembered and only moves the selection
        await vendor('Gemini');
        v = await view(); assert.deepEqual(v.pressed, ['Lite 3.5', 'Flash 3.8', 'Argon 4', 'Gemma 4 26B'], 'Gemini models (Gemma via OpenRouter sits with them, as everywhere)'); assert.equal(v.vendors[0], 'Gemini*');
        assert.equal(await page.evaluate(() => localStorage.getItem('quizTagAiModel')), null, 'browsing a vendor stores nothing'); assert.equal(await page.evaluate(() => __calls.length), 0);
        await vendor('Claude'); v = await view(); assert.deepEqual(v.pressed, ['Haiku 5.5', 'Sonnet 5.5', 'Opus 5.5', 'Fable 5.2']); await vendor('Grok'); v = await view(); assert.deepEqual(v.pressed, ['4.7'], 'the icon says Grok, the chip says the version');
        await vendor('DeepSeek'); v = await view(); assert.deepEqual(v.pressed, ['Flash V4.1', 'Pro V4']); await vendor('Qwen'); v = await view(); assert.deepEqual(v.pressed, ['Flash 3.8', 'Omni Flash 3.8', 'Max 3.8']); await vendor('GPT'); v = await view(); assert.deepEqual(v.pressed, ['Luna 6', 'Terra 6.1', 'Sol 6.1', 'Astra 6']);
        await vendor('Muse'); v = await view(); assert.deepEqual(v.pressed, ['Spark Open'], 'V102.646: Muse is offered here now'); await vendor('Kimi'); v = await view(); assert.deepEqual(v.pressed, ['K3.1 Pro'], 'and Kimi');
        await vendor('Gemini'); await chip('Flash 3.8');
        v = await view(); assert.deepEqual(v.pressed, ['Lite 3.5', 'Flash 3.8*', 'Argon 4', 'Gemma 4 26B']); assert.equal(v.vendors[0], 'Gemini*'); assert.match(v.title, /Tags incomplete/);
        assert.equal(await page.evaluate(() => localStorage.getItem('quizTagAiModel')), 'gemini-3.8-flash'); assert.equal(await page.evaluate(() => __calls.length), 0, 'no AI call from a mere pick');

        // 3 · Fix with AI runs the picked model; the result names it and keeps the rail
        await click('Fix with AI'); await ready(/AI suggests/);
        assert.deepEqual(await page.evaluate(() => __calls), ['gemini-3.8-flash']);
        v = await view(); assert.match(v.title, /AI suggests\s*·\s*Gemini 3\.8 Flash/); assert.deepEqual(v.pressed, ['Lite 3.5', 'Flash 3.8*', 'Argon 4', 'Gemma 4 26B']);
        assert.ok(/Allergic Rhinitis/.test(v.sub) && /Geriatrics/.test(v.sub), 'the suggestion is shown');

        // 4 · a pick on the result view runs again with that model and replaces the proposal
        await vendor('Ollama'); v = await view(); assert.equal(await page.evaluate(() => __calls.length), 1, 'a vendor tap on the result view does not re-run'); assert.match(v.title, /AI suggests/);
        await chip('Ollama'); await page.waitForFunction(() => __calls.length === 2); await ready(/AI suggests\s*·\s*Ollama local/);
        assert.deepEqual(await page.evaluate(() => __calls), ['gemini-3.8-flash', 'ol/local']);
        v = await view(); assert.equal(v.pressed[0], 'Ollama*');
        // every vendor runs with ITS model id
        await vendor('Claude'); await chip('Sonnet 5.5'); await page.waitForFunction(() => __calls.length === 3); await ready(/Claude Sonnet 5\.5/);
        assert.equal((await page.evaluate(() => __calls))[2], 'claude-sonnet-5-5');
        await vendor('Qwen'); await chip('Flash 3.8'); await page.waitForFunction(() => __calls.length === 4); await ready(/Qwen 3\.8 Flash/);
        assert.equal((await page.evaluate(() => __calls))[3], 'or/qwen/qwen3.8-flash', 'the same short name under two vendors is told apart: the Qwen one ran, and the title says Qwen');
        await vendor('Grok'); await chip('4.7'); await page.waitForFunction(() => __calls.length === 5); await ready(/Grok 4\.7/); assert.equal((await page.evaluate(() => __calls))[4], 'or/x-ai/grok-4.7');
        await vendor('DeepSeek'); await chip('Pro V4'); await page.waitForFunction(() => __calls.length === 6); await ready(/DeepSeek V4 Pro/); assert.equal((await page.evaluate(() => __calls))[5], 'or/deepseek/deepseek-v4-pro-0813');
        await vendor('Ollama'); await chip('Inkling 2 Small'); await page.waitForFunction(() => __calls.length === 7); await ready(/Inkling 2 Small/); assert.equal((await page.evaluate(() => __calls))[6], 'or/thinkingmachines/inkling-2-small', 'V102.646: a trial model added to the catalogue is here without touching the dialog');
        await vendor('Ollama'); await chip('Ollama'); await page.waitForFunction(() => __calls.length === 8); await ready(/Ollama local/);

        // 5 · a local failure lands on the error view WITH the rail; picking another model tries again straight away
        await page.evaluate(() => { __fail['ol/local'] = true; });
        await click('Back'); await click('Fix with AI'); await ready(/could not suggest/);
        v = await view(); assert.match(v.sub, /Ollama is not reachable/); assert.equal(v.pressed[0], 'Ollama*', 'error view shows the model that failed');
        await vendor('Gemini'); await chip('Lite 3.5'); await ready(/AI suggests\s*·\s*Gemini 3\.5 Flash-Lite/);
        assert.equal((await page.evaluate(() => __calls)).slice(-1)[0], 'as/gemini-3.5-flash-lite');

        // 5b · V102.505: model first — the rail sits right under the title, above the chips; after an edit a model tap asks before replacing (EN only)
        const order = await page.evaluate(() => { const o = document.getElementById('qtx-overlay'), m = o.querySelector('.qtx-model'), t = o.querySelector('#qtx-title'), s = o.querySelector('select'), g = o.querySelector('.qtx-rail'); return [m.contains(t), !!(m.compareDocumentPosition(g) & 4), !!(g.compareDocumentPosition(s) & 4)]; });
        assert.deepEqual(order, [true, true, true], 'title, then the rail, then the tag chips');
        const n0 = await page.evaluate(() => __calls.length);
        await page.evaluate(() => document.querySelector('#qtx-overlay button[aria-label^="Remove"]').click());
        assert.ok(await page.evaluate(() => !!document.querySelector('#qtx-overlay [aria-label="Edited"]')), 'an edit is marked (a dot by the title)');
        await vendor('Claude'); await chip('Haiku 5.5');
        const warn = await page.evaluate(() => (document.querySelector('#qtx-overlay .qtx-warn') || {}).innerText || '');
        assert.equal(warn.trim(), 'Replace your edits?', 'one short English line, the rest are icons'); assert.ok(!/[฀-๿]/.test(warn), 'the warning is English only');
        assert.ok(await page.evaluate(() => !!document.querySelector('#qtx-overlay .qtx-warn button[aria-label="Run again with Claude Haiku 5.5"]') && !!document.querySelector('#qtx-overlay .qtx-warn button[aria-label="Keep my edits"]')), 'icon buttons name the model in their label');
        const pend = await page.evaluate(() => { const b = document.querySelector('#qtx-overlay .qtx-rail > button[data-value="claude-haiku-5-5"]'), cs = getComputedStyle(b); return [b.hidden, b.classList.contains('qtx-pend'), cs.outlineColor, cs.outlineStyle, b.getAttribute('aria-pressed')]; });
        assert.deepEqual(pend, [false, true, 'rgb(217, 119, 6)', 'solid', 'false'], 'the pending model is ringed amber, on screen (its vendor is shown), and is not yet the model in use: ' + JSON.stringify(pend));
        v = await view(); assert.equal(v.vendors[2], 'Claude*', 'the pending model\'s vendor is the one shown');
        assert.equal(await page.evaluate(() => __calls.length), n0, 'an edited proposal is not replaced by a model tap'); assert.equal(await page.evaluate(() => localStorage.getItem('quizTagAiModel')), 'as/gemini-3.5-flash-lite', 'nothing stored before confirming');
        await click('Keep my edits');
        assert.equal(await page.evaluate(() => !!document.querySelector('#qtx-overlay .qtx-warn')), false, 'Keep my edits closes the warning'); assert.equal(await page.evaluate(() => __calls.length), n0, 'and runs nothing');
        assert.ok(await page.evaluate(() => !!document.querySelector('#qtx-overlay [aria-label="Edited"]')), 'the edits are still there');
        assert.deepEqual((await view()).pressed, ['Lite 3.5*', 'Flash 3.8', 'Argon 4', 'Gemma 4 26B'], 'Keep my edits goes back to the vendor in use');
        assert.equal(await page.evaluate(() => document.querySelectorAll('#qtx-overlay .qtx-pend').length), 0, 'no ring left');
        await vendor('Claude'); await chip('Haiku 5.5'); await click('Run again');
        await page.waitForFunction((n) => __calls.length === n + 1, n0); await ready(/Claude Haiku 5\.5/);
        assert.equal((await page.evaluate(() => __calls)).slice(-1)[0], 'claude-haiku-5-5');
        assert.ok(await page.evaluate(() => !document.querySelector('#qtx-overlay [aria-label="Edited"]')), 'a fresh proposal has no edits');
        // style D: icon-only footer, Back · Apply only · Apply & save (main action last), no visible title words
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#qtx-overlay button[aria-label]')].filter(b => b.querySelector('i.fa-solid')).map(b => b.getAttribute('aria-label') + (b.textContent.trim() ? '+text' : ''))), ['Back', 'Apply only (no save yet)', 'Apply & save'], 'footer order, no text on the buttons');
        assert.deepEqual(await page.evaluate(() => { const h = document.querySelector('#qtx-overlay #qtx-title'), sr = h.querySelector('span'); return [h.firstChild.textContent, sr.getBoundingClientRect().width <= 1, h.title]; }), ['✨', true, 'AI suggests · Claude Haiku 5.5'], 'the title is an icon; its words are in the tooltip (and for screen readers)');
        await vendor('Gemini'); await chip('Lite 3.5');   // no edits → runs straight away, as before
        await page.waitForFunction((n) => __calls.length === n + 2, n0); await ready(/Gemini 3\.5 Flash-Lite/);

        // 6 · the last pick is remembered for the next dialog; Apply still works
        await click('Apply only'); await page.waitForFunction(() => window.__done === false);   // Apply only = write the tags, do not save yet
        assert.match(await page.evaluate(() => document.getElementById('quiz-tags').value), /Allergic Rhinitis/);
        await page.evaluate(() => { document.getElementById('quiz-tags').value = ''; window.__done = null; confirmQuizEditorTags('Save').then(v => { window.__done = v; }); });
        v = await view(); assert.deepEqual(v.pressed, ['Lite 3.5*', 'Flash 3.8', 'Argon 4', 'Gemma 4 26B'], 'remembered across dialogs — and the dialog opens on that vendor'); assert.equal(v.vendors[0], 'Gemini*'); await click('Cancel');
        // a remembered id that is no longer a model falls back to local
        assert.equal(await page.evaluate(() => { localStorage.setItem('quizTagAiModel', 'gone-model-1'); return window.qtxModel(); }), 'ol/local', 'an unknown remembered model → local');

        // 7 · the editor's ✨ AI Suggest button path is unchanged: no model given → the toolbar model
        const toolbar = await page.evaluate(async () => { __calls.length = 0; await suggestEditorVocabTags(); return [__calls[0], document.getElementById('ai-tagging-model-val').value]; });
        assert.equal(toolbar[0], toolbar[1], 'suggestEditorVocabTags() without a model still uses the toolbar model');

        const mine = errors.filter(e => /qtx|suggestEditorVocabTags|QTX_MODELS|confirmQuizEditorTags|oneStyleModelPickers/.test(e)); assert.deepEqual(mine, [], mine.join(' | '));
        console.log('PASS: AI suggests tag dialog (V102.646) — the shared model rail with every catalogue + trial model (Gemini · GPT · Claude · Qwen · DeepSeek · Muse · Kimi · Grok · Ollama; a vendor tap never re-runs), local by default, remembered, result names the model, pick = run again, pending model ringed with its vendor shown, error view keeps the rail, toolbar path unchanged');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
