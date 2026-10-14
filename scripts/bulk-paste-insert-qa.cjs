// V102.236 — Bulk Paste ➕ Add selected questions into the Quiz editor: the empty starter question of a fresh editor is REPLACED (it used to stay as Q1, so the pasted questions
// began at Q2 and the admin had to delete the blank one). A question the admin already filled in is never touched.
// Real admin.html: the real addQuestionUI + bulkPasteInsert against the editor container.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => { try { return typeof bulkPasteInsert === 'function' && typeof addQuestionUI === 'function' && document.readyState === 'complete'; } catch (_) { return false; } });
        await page.waitForTimeout(300);

        const run = (existing, pasted) => page.evaluate(([ex, ps]) => {
            if (typeof window._qPrimerModelSelect !== 'function') window._qPrimerModelSelect = () => '';   // defined by the Read-first script that this bare page may not have run
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = '';
            ex.forEach(q => addQuestionUI(q));                     // addQuestionUI(null) = the blank starter a new quiz opens with
            window._bulkPasteParsed = ps.map(q => ({ q, options: ['a', 'b', 'c', 'd'], correct: [], include: true, rationale: '', tags: '' }));
            window.triggerAutoSave = () => {}; window.updateQuizPagination = () => {}; window.showToast = () => {};
            document.getElementById('bulkPasteModal').style.display = 'block';
            bulkPasteInsert();
            return [...document.querySelectorAll('.quiz-q-item')].map(el => (el.querySelector('.q-text') || {}).value || '');
        }, [existing, pasted]);

        // 1 · a fresh editor (one blank starter) → the pasted questions fill Q1.. — no blank Q1 left over
        let got = await run([null], ['P1?', 'P2?', 'P3?']);
        assert.deepEqual(got, ['P1?', 'P2?', 'P3?'], 'fresh editor: the blank starter is replaced, nothing blank at the top: ' + JSON.stringify(got));

        // 2 · a question the admin already filled in stays, the paste goes after it
        got = await run([{ q: 'My own question', type: 'choice', options: ['x', 'y'], correct: [0] }], ['P1?', 'P2?']);
        assert.deepEqual(got, ['My own question', 'P1?', 'P2?'], 'existing content is kept: ' + JSON.stringify(got));

        // 3 · blank starter + a filled question (the admin typed into Q2): nothing is deleted
        got = await run([null, { q: 'Typed later', type: 'choice', options: ['x', 'y'], correct: [0] }], ['P1?']);
        assert.deepEqual(got, ['', 'Typed later', 'P1?'], 'only an editor made of blank questions only is replaced: ' + JSON.stringify(got));

        // 4 · two blank starters → both are replaced; still at least one question afterwards
        got = await run([null, null], ['P1?']);
        assert.deepEqual(got, ['P1?'], 'all-blank editor: replaced: ' + JSON.stringify(got));

        // 5 · the real-world size: 15 pasted into a fresh editor = 15 questions, not 16
        got = await run([null], Array.from({ length: 15 }, (_, i) => 'Q' + (i + 1) + '?'));
        assert.equal(got.length, 15, '15 pasted = 15 in the editor (was 16 with a blank Q1): ' + got.length); assert.equal(got[0], 'Q1?');
        console.log('PASS: Bulk Paste ➕ Add — a fresh editor\'s blank starter question is replaced (15 pasted = 15 questions, Q1 is the first pasted one); filled questions are never removed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
