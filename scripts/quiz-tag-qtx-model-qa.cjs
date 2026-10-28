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
        const view = () => page.evaluate(() => { const o = document.getElementById('qtx-overlay'); return { title: (o.querySelector('#qtx-title') || {}).textContent, pressed: [...o.querySelectorAll('[aria-label="AI model"] button')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')), sub: o.textContent.replace(/\s+/g, ' ') }; });
        const click = txt => page.evaluate(t => [...document.querySelectorAll('#qtx-overlay button')].find(b => b.textContent.trim().startsWith(t)).click(), txt);

        // 1 · opens with the model row, LOCAL FIRST and selected when nothing is remembered
        await page.evaluate(() => { window.__done = null; confirmQuizEditorTags('Save').then(v => { window.__done = v; }); });
        let v = await view();
        assert.match(v.title, /Tags incomplete/); assert.deepEqual(v.pressed, ['Ollama · local*', 'Flash 3.8', 'Flash 3.6', '4o mini'], 'local first, selected by default');

        // 2 · a pick on the ask view is remembered and only moves the selection
        await click('Flash 3.8');
        v = await view(); assert.deepEqual(v.pressed, ['Ollama · local', 'Flash 3.8*', 'Flash 3.6', '4o mini']); assert.match(v.title, /Tags incomplete/);
        assert.equal(await page.evaluate(() => localStorage.getItem('quizTagAiModel')), 'gemini-3.8-flash'); assert.equal(await page.evaluate(() => __calls.length), 0, 'no AI call from a mere pick');

        // 3 · Fix with AI runs the picked model; the result names it and keeps the row
        await click('✨ Fix with AI'); await page.waitForFunction(() => /AI suggests/.test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || ''));
        assert.deepEqual(await page.evaluate(() => __calls), ['gemini-3.8-flash']);
        v = await view(); assert.match(v.title, /AI suggests\s*·\s*Flash 3\.8/); assert.deepEqual(v.pressed, ['Ollama · local', 'Flash 3.8*', 'Flash 3.6', '4o mini']);
        assert.ok(/Allergic Rhinitis/.test(v.sub) && /Geriatrics/.test(v.sub), 'the suggestion is shown');

        // 4 · a pick on the result view runs again with that model and replaces the proposal
        await click('Ollama · local'); await page.waitForFunction(() => __calls.length === 2 && /AI suggests/.test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || ''));
        assert.deepEqual(await page.evaluate(() => __calls), ['gemini-3.8-flash', 'ol/local']);
        v = await view(); assert.match(v.title, /AI suggests\s*·\s*Ollama · local/); assert.equal(v.pressed[0], 'Ollama · local*');

        // 5 · a local failure lands on the error view WITH the model row; picking another model tries again straight away
        await page.evaluate(() => { __fail['ol/local'] = true; });
        await click('Back'); await click('✨ Fix with AI'); await page.waitForFunction(() => /could not suggest/.test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || ''));
        v = await view(); assert.match(v.sub, /Ollama is not reachable/); assert.equal(v.pressed[0], 'Ollama · local*', 'error view shows the model that failed');
        await click('Flash 3.6'); await page.waitForFunction(() => /AI suggests/.test((document.querySelector('#qtx-overlay #qtx-title') || {}).textContent || ''));
        assert.equal((await page.evaluate(() => __calls)).slice(-1)[0], 'gemini-3.6-flash'); v = await view(); assert.match(v.title, /Flash 3\.6/);

        // 6 · the last pick is remembered for the next dialog; Apply still works
        await click('Apply only'); await page.waitForFunction(() => window.__done === false);   // Apply only = write the tags, do not save yet
        assert.match(await page.evaluate(() => document.getElementById('quiz-tags').value), /Allergic Rhinitis/);
        await page.evaluate(() => { document.getElementById('quiz-tags').value = ''; window.__done = null; confirmQuizEditorTags('Save').then(v => { window.__done = v; }); });
        v = await view(); assert.equal(v.pressed[2], 'Flash 3.6*', 'remembered across dialogs'); await click('Cancel');

        // 7 · the editor's ✨ AI Suggest button path is unchanged: no model given → the toolbar model
        const toolbar = await page.evaluate(async () => { __calls.length = 0; await suggestEditorVocabTags(); return [__calls[0], document.getElementById('ai-tagging-model-val').value]; });
        assert.equal(toolbar[0], toolbar[1], 'suggestEditorVocabTags() without a model still uses the toolbar model');

        const mine = errors.filter(e => /qtx|suggestEditorVocabTags|QTX_MODELS|confirmQuizEditorTags/.test(e)); assert.deepEqual(mine, [], mine.join(' | '));
        console.log('PASS: AI suggests tag dialog — model row (local first, remembered), result names the model, pick = run again, error view keeps the row, toolbar path unchanged');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
