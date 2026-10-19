// V102.320: two Quiz Editor toolbar handlers. The REAL admin.html in Chromium (network stubbed):
// · 🐑 toolbarCloneQ(btn) used to throw after cloning — it swapped the icon of an <i> the emoji button never had;
// · the toolbar Answer type (toolbarSetQType) used to set only the hidden .q-type — now it redraws the question
//   (toggleQType) and autosaves, like the per-question toggle (selectQTypeToggle); re-picking the same type is a no-op.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof addQuestionUI === 'function' && typeof window.toolbarCloneQ === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });   // the guide popup would take the clicks
        await page.evaluate(() => {
            const m = document.getElementById('quizManageModal');
            m.style.setProperty('display', 'block', 'important');
            for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            window.showToast = () => {};
            window.__saves = 0; window.triggerAutoSave = () => { window.__saves++; };
            for (let i = 0; i < 2; i++) addQuestionUI({ q: 'Question ' + (i + 1), type: 'choice', options: ['A', 'B', 'C', 'D'], correct: [0], timer: 60 });
            quizQPageIndex = 0; updateQuizPagination();
            window.__saves = 0;
        });
        const cur = () => page.evaluate(() => {
            const item = document.querySelectorAll('.quiz-q-item')[quizQPageIndex];
            return { type: item.querySelector('.q-type').value, opts: [...item.querySelectorAll('.q-opt')].map(o => o.value), actions: (item.querySelector('.q-type-actions') || {}).innerText || '', saves: window.__saves };
        });

        // 1 · 🐑 clone: one more question, no error
        await page.click('#quizManageModal button[onclick="toolbarCloneQ(this)"]');
        await page.waitForTimeout(100);
        assert.equal(await page.$$eval('.quiz-q-item', e => e.length), 3, 'clone adds a question');
        assert.deepEqual(errs, [], 'clone does not throw');

        // 2 · Answer type from the toolbar redraws the current question and autosaves
        await page.click('#toolbar-q-type-toggle [data-value="flashcard"]');
        let q = await cur();
        assert.equal(q.type, 'flashcard', 'type set');
        assert.equal(q.opts.length, 2, 'flashcard redrawn with 2 options: ' + JSON.stringify(q.opts));
        assert.match(q.opts[0], /True/, 'True / False options');
        assert.match(q.actions, /Flashcard: True\/False/, 'the type actions follow the type');
        assert.equal(q.saves, 1, 'autosaves once');
        const hiddenToggle = await page.evaluate(() => document.querySelectorAll('.quiz-q-item')[quizQPageIndex].querySelector('.q-type-toggle .active').dataset.value);
        assert.equal(hiddenToggle, 'flashcard', 'per-question toggle in sync');

        await page.click('#toolbar-q-type-toggle [data-value="ordering"]');
        q = await cur();
        assert.equal(q.type, 'ordering'); assert.match(q.actions, /Correct Order is Top to Bottom/, 'ordering actions'); assert.equal(q.saves, 2);
        const before = q.opts;
        await page.click('#toolbar-q-type-toggle [data-value="ordering"]');
        q = await cur();
        assert.deepEqual(q.opts, before, 're-picking the same type keeps the options'); assert.equal(q.saves, 2, 'and does not save again');

        // the other questions are untouched
        const others = await page.$$eval('.quiz-q-item .q-type', e => e.map(x => x.value));
        assert.deepEqual(others, ['ordering', 'choice', 'choice'], 'only the current question changes');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('quiz-editor-toolbar-handlers-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
