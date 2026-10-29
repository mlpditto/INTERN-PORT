// V102.471 — the Save-time "✨ AI suggests" tag dialog (qtx) names its model and lets the admin pick one: local first (Ollama), remembered; a pick on the
// result / error view runs again with that model. The REAL admin.html, callUniversalAI stubbed (records the model).
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
        await page.waitForFunction(() => typeof confirmQuizEditorTags === 'function' && window.QUIZ_TAG_KIND && window.qtxModel && document.readyState === 'complete');
        const setup = await page.evaluate(() => {
            localStorage.removeItem('quizTagAiModel');
            document.getElementById('quiz-title').value = 'Allergic rhinitis in older adults';
            document.getElementById('quiz-tags').value = ''; const sel = document.getElementById('quiz-system-select'); if (sel) sel.value = '';
            window.__calls = []; window.__fail = {};
            window.callUniversalAI = async (model) => { window.__calls.push(model); if (window.__fail[model]) throw new Error('Ollama is not reachable at http://localhost:11434.'); return { text: JSON.stringify({ results: [{ id: 'editor', system: 'respiratory', topics: ['Allergic Rhinitis'], skill: ['Pharmacotherapy'], population: ['Geriatrics'] }] }) }; };
            return { kinds: ['allergic rhinitis', 'pharmacotherapy', 'geriatrics'].map(t => !!window.QUIZ_TAG_KIND.get(t)) };
        });
        assert.deepEqual(setup.kinds, [true, true, true], 'the fixture tags are in the vocabulary');
        const view = () => page.evaluate(() => { const o = document.getElementById('qtx-overlay'); return { title: (o.querySelector('#qtx-title') || {}).textContent, pressed: [...o.querySelectorAll('[aria-label="AI model"] button')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')), vendors: [...o.querySelectorAll('[aria-label="AI vendor"] button')].map(b => b.getAttribute('aria-label') + (b.getAttribute('aria-pressed') === 'true' ? '*' : '') + (b.title.includes('in use') ? '·' : '')), sub: o.textContent.replace(/\s+/g, ' ') }; });
        const vendor = name => page.evaluate(n => document.querySelector('#qtx-overlay [aria-label="AI vendor"] button[aria-label="' + n + '"]').click(), name);
        const click = txt => page.evaluate(t => [...document.querySelectorAll('#qtx-overlay button')].find(b => b.textContent.trim().startsWith(t)).click(), txt);

        // 1 · opens with the model row, LOCAL FIRST and selected when nothing is remembered
        await page.evaluate(() => { window.__done = null; confirmQuizEditorTags('Save').then(v => { window.__done = v; }); });
        let v = await view();
        assert.match(v.title, /Tags incomplete/); assert.deepEqual(v.vendors, ['Ollama*·', 'Gemini', 'GPT', 'Claude', 'Grok', 'DeepSeek', 'Qwen'], 'vendor first — Ollama (local) leads and is the one in use'); assert.deepEqual(v.pressed, ['Ollama · local*'], 'only the shown vendor models are listed');

        // 2 · a pick on the ask view is remembered and only moves the selection
        await vendor('Gemini');   // browsing a vendor changes nothing but the list
        v = await view(); assert.deepEqual(v.pressed, ['Flash 3.8', 'Lite 3.5', 'Argon 4'], 'Gemini models'); assert.deepEqual(v.vendors.slice(0, 2), ['Ollama·', 'Gemini*'], 'the dot stays on the vendor in use');
        assert.equal(await page.evaluate(() => localStorage.getItem('quizTagAiModel')), null, 'browsing a vendor stores nothing'); assert.equal(await page.evaluate(() => __calls.length), 0);
        await vendor('Claude'); v = await view(); assert.deepEqual(v.pressed, ['Haiku 5.5', 'Sonnet 5.5']); await vendor('Grok'); v = await view(); assert.deepEqual(v.pressed, ['Grok 4.7']);
        await vendor('DeepSeek'); v = await view(); assert.deepEqual(v.pressed, ['Flash V4.1', 'Pro V4']); await vendor('Qwen'); v = await view(); assert.deepEqual(v.pressed, ['Flash 3.8', 'Max 3.8']); await vendor('GPT'); v = await view(); assert.deepEqual(v.pressed, ['Luna 6', 'Terra 5.6']);
        await vendor('Gemini'); await click('Flash 3.8');
        v = await view(); assert.deepEqual(v.pressed, ['Flash 3.8*', 'Lite 3.5', 'Argon 4']); assert.deepEqual(v.vendors.slice(0, 2), ['Ollama', 'Gemini*·'], 'the pick moves the in-use dot'); assert.match(v.title, /Tags incomplete/);
        assert.equal(await page.evaluate(() => localStorage.getItem('quizTagAiModel')), 'gemini-3.8-flash'); assert.equal(await page.evaluate(() => __calls.length), 0, 'no AI call from a mere pick');

        // 3 · Fix with AI runs the picked model; the result names it and keeps the row
        await click('✨ Fix with AI'); await page.waitForFunction(() => /AI suggests/.test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || ''));
        assert.deepEqual(await page.evaluate(() => __calls), ['gemini-3.8-flash']);
        v = await view(); assert.match(v.title, /AI suggests\s*·\s*Gemini Flash 3\.8/); assert.deepEqual(v.pressed, ['Flash 3.8*', 'Lite 3.5', 'Argon 4']);
        assert.ok(/Allergic Rhinitis/.test(v.sub) && /Geriatrics/.test(v.sub), 'the suggestion is shown');

        // 4 · a pick on the result view runs again with that model and replaces the proposal
        await vendor('Ollama'); v = await view(); assert.equal(await page.evaluate(() => __calls.length), 1, 'a vendor tap on the result view does not re-run'); assert.match(v.title, /AI suggests/);
        await click('Ollama · local'); await page.waitForFunction(() => __calls.length === 2 && /AI suggests/.test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || ''));
        assert.deepEqual(await page.evaluate(() => __calls), ['gemini-3.8-flash', 'ol/local']);
        v = await view(); assert.match(v.title, /AI suggests\s*·\s*Ollama · local/); assert.equal(v.pressed[0], 'Ollama · local*');
        // the vendors added for this dialog run with THEIR model ids
        await vendor('Claude'); await click('Sonnet 5.5'); await page.waitForFunction(() => __calls.length === 3 && /AI suggests/.test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || ''));
        assert.equal((await page.evaluate(() => __calls))[2], 'claude-sonnet-5-5'); v = await view(); assert.match(v.title, /Claude Sonnet 5\.5/);
        await vendor('Qwen'); await click('Flash 3.8'); await page.waitForFunction(() => __calls.length === 4 && /AI suggests/.test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || ''));
        assert.equal((await page.evaluate(() => __calls))[3], 'or/qwen/qwen3.8-flash'); v = await view(); assert.match(v.title, /Qwen Flash 3\.8/, 'the same short name under two vendors is told apart in the title');
        await vendor('Grok'); await click('Grok 4.7'); await page.waitForFunction(() => __calls.length === 5 && /AI suggests/.test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || '')); assert.equal((await page.evaluate(() => __calls))[4], 'or/x-ai/grok-4.7');
        await vendor('DeepSeek'); await click('Pro V4'); await page.waitForFunction(() => __calls.length === 6 && /AI suggests/.test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || '')); assert.equal((await page.evaluate(() => __calls))[5], 'or/deepseek/deepseek-v4-pro-0813');
        await vendor('Ollama'); await click('Ollama · local'); await page.waitForFunction(() => __calls.length === 7 && /AI suggests/.test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || ''));

        // 5 · a local failure lands on the error view WITH the model row; picking another model tries again straight away
        await page.evaluate(() => { __fail['ol/local'] = true; });
        await click('Back'); await click('✨ Fix with AI'); await page.waitForFunction(() => /could not suggest/.test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || ''));
        v = await view(); assert.match(v.sub, /Ollama is not reachable/); assert.equal(v.pressed[0], 'Ollama · local*', 'error view shows the model that failed');
        await vendor('Gemini'); await click('Lite 3.5'); await page.waitForFunction(() => /AI suggests/.test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || ''));
        assert.equal((await page.evaluate(() => __calls)).slice(-1)[0], 'as/gemini-3.5-flash-lite'); v = await view(); assert.match(v.title, /Gemini Lite 3\.5/);

        // 6 · the last pick is remembered for the next dialog; Apply still works
        await click('Apply only'); await page.waitForFunction(() => window.__done === false);   // Apply only = write the tags, do not save yet
        assert.match(await page.evaluate(() => document.getElementById('quiz-tags').value), /Allergic Rhinitis/);
        await page.evaluate(() => { document.getElementById('quiz-tags').value = ''; window.__done = null; confirmQuizEditorTags('Save').then(v => { window.__done = v; }); });
        v = await view(); assert.deepEqual(v.pressed, ['Flash 3.8', 'Lite 3.5*', 'Argon 4'], 'remembered across dialogs — and the dialog opens on that vendor'); assert.equal(v.vendors[1], 'Gemini*·'); await click('Cancel');

        // 7 · the editor's ✨ AI Suggest button path is unchanged: no model given → the toolbar model
        const toolbar = await page.evaluate(async () => { __calls.length = 0; await suggestEditorVocabTags(); return [__calls[0], document.getElementById('ai-tagging-model-val').value]; });
        assert.equal(toolbar[0], toolbar[1], 'suggestEditorVocabTags() without a model still uses the toolbar model');

        const mine = errors.filter(e => /qtx|suggestEditorVocabTags|QTX_MODELS|confirmQuizEditorTags/.test(e)); assert.deepEqual(mine, [], mine.join(' | '));
        console.log('PASS: AI suggests tag dialog — vendor first then model (Ollama · Gemini · GPT · Claude · Grok · DeepSeek · Qwen; a vendor tap never re-runs), model row (local first, remembered), result names the model, pick = run again, error view keeps the row, toolbar path unchanged');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
