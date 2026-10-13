// V102.219 — AI Curate controls, compact (mockup option #4): ONE row  20 → Keep [− 15 +] │ ⚖ ★ ⇄ │ ✏️ 🕘 03:37 │ ↻ .
//  · the three mode buttons are icons (the words stay for screen readers); Instructions / History are icon buttons in the SAME row (the old foot row is gone);
//  · after a run the History chip is the saved-state: green + the run time when the result was saved, amber + an amber warning line when it could not be saved;
//    the status text is clipped for screen readers unless it is a problem; the run button is just ↻ after a run ("✦ Suggest" before the first run, "Run again" for readers).
// The REAL quiz-curate.js + quiz-curate.css + provider rail from public/admin.html in Chromium.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));

async function open(browser, width, saveMode) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('https://curate.test/', r => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
    await page.route('https://curate.test/assets/**', r => r.fulfill({ status: 404, body: '' }));
    await page.goto('https://curate.test/');
    await page.setContent([...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n') + '<input id="edit-quiz-id" value="source-quiz"><input id="ai-analyzer-model-val" value="claude-fable-5-1">');
    await page.addStyleTag({ path: 'public/quiz-curate.css' }); await page.addStyleTag({ path: 'public/text-ai-chips.css' });
    await page.addScriptTag({ path: 'public/ai-model-ui.js' }); await page.addStyleTag({ path: 'public/audit-toolbar.css' });
    const a = html.indexOf('window.browseAuditProvider = function'), b = html.indexOf('window.auditModelControlsHtml = function');
    await page.addScriptTag({ content: html.slice(a, b) });
    await page.evaluate(saveMode => {
        window.fixture = { title: 'Clinical assessment', targetGroup: 'Interns', totalPoints: 2, isPoll: false, quizType: 'mcq', caseContent: '', materials: [], blueprint: {}, startTime: '2026-09-01T09:00', deadline: '2026-09-30T09:00',
            questions: Array.from({ length: 20 }, (_, i) => ({ q: 'Clinical question ' + (i + 1), content: '', type: 'choice', options: ['Option A', 'Option B'], correct: [1], timer: 60, tags: 'Objective ' + (i % 6), explanation: 'e' })) };
        window.original = structuredClone(fixture);
        for (let i = 0; i < 20; i++) { const el = document.createElement('div'); el.className = 'quiz-q-item'; el.dataset.id = i + 1; document.body.append(el); }
        window.getQuizFormData = () => structuredClone(fixture); window.shouldMarkQuestionMissingAnswer = () => false; window.showToast = () => {}; window.safeJsonParse = JSON.parse; window.ensureAuthForQuizWrite = async () => true;
        window.callUniversalAI = () => new Promise(resolve => { window.aiResolve = resolve; });
        window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
        window.db = { collection: () => ({ doc: id => ({ id: id || 'x', get: async () => ({ exists: true, data: () => structuredClone(fixture) }), set: async () => {} }) }) };
        window.curateHistory = { key: async v => JSON.stringify(v), load: async () => [], save: async () => { if (saveMode === 'fail') throw Error('network'); } };
    }, saveMode);
    await page.addScriptTag({ path: 'public/quiz-curate.js' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.evaluate(() => openQuizCurate());
    await page.locator('#curate-target').fill('15');
    return { ctx, page, errors };
}
const run = async page => {
    await page.locator('#curate-suggest').click();
    await page.evaluate(() => aiResolve({ text: JSON.stringify({ questions: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, keep: i < 15, topic: 'Core', reason: 'r', reasonTh: 'r', detail: 'd', detailTh: 'd', impact: 'i', impactTh: 'i', reasonType: 'quality', related: [] })) }) }));
    await page.waitForFunction(() => document.querySelector('#quiz-curate-dialog').getAttribute('aria-busy') === 'false');
    await page.waitForTimeout(250);
};
const cy = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return Math.round(r.top + r.height / 2); });

(async () => {
    const browser = await chromium.launch();
    try {
        // ---- before the first run (1100 px)
        let { ctx, page, errors } = await open(browser, 1100, 'ok');
        const rowSels = ['.curate-keep', '.curate-modes', '.curate-instructions > summary', '#curate-history > summary', '#curate-suggest'];
        const ys = []; for (const s of rowSels) ys.push(await cy(page, s));
        assert.ok(Math.max(...ys) - Math.min(...ys) <= 8, 'keep · modes · ✏️ · 🕘 · run are ONE row: ' + ys);
        assert.equal(await page.locator('.curate-foot').evaluate(e => getComputedStyle(e).display), 'contents', 'the foot is folded into the controls row');
        assert.equal(await page.locator('#curate-suggest').innerText(), '✦ Suggest', 'before the first run the button still says Suggest');
        const modes = await page.$$eval('.curate-modes button', bs => bs.map(b => ({ text: b.textContent, fs: getComputedStyle(b).fontSize, glyph: getComputedStyle(b, '::before').content, w: Math.round(b.getBoundingClientRect().width) })));
        assert.deepEqual(modes.map(m => m.text), ['Balanced', 'Best quality', 'Less overlap'], 'the words are still in the DOM (screen readers)');
        assert.ok(modes.every(m => m.fs === '0px' && m.w <= 34), 'but not drawn: ' + JSON.stringify(modes));
        assert.deepEqual(modes.map(m => m.glyph.replace(/["'\s/]/g, '')), ['⚖', '★', '⇄'], 'icon glyphs via ::before');
        assert.equal(await page.$eval('.curate-instructions > summary', e => e.getAttribute('aria-label')), 'Instructions'); assert.equal(await page.$eval('#curate-history > summary', e => e.getAttribute('aria-label')), 'History');
        assert.equal(await page.$eval('#curate-history-time', e => e.textContent), '', 'no run time yet'); assert.ok(!(await page.$eval('#curate-history', e => e.className)).includes('saved'));
        // Instructions: the icon opens the textarea on its own full-width line below the row
        await page.click('.curate-instructions > summary');
        const ins = await page.evaluate(() => { const t = document.getElementById('curate-instructions').getBoundingClientRect(), r = document.getElementById('curate-suggest').getBoundingClientRect(); return { below: t.top > r.bottom - 2, wide: t.width > 500 }; });
        assert.deepEqual(ins, { below: true, wide: true }, 'an opened Instructions wraps to its own line');
        await page.click('.curate-instructions > summary');

        // ---- after a saved run
        await run(page);
        const saved = await page.evaluate(() => { const h = document.getElementById('curate-history'), s = document.getElementById('curate-history-status'), b = document.getElementById('curate-suggest'), t = document.getElementById('curate-history-time');
            return { cls: h.className, time: t.textContent, border: getComputedStyle(h.querySelector('summary')).borderTopColor, statusBad: s.classList.contains('bad'), statusW: Math.round(s.getBoundingClientRect().width), statusText: s.innerText, btn: b.innerText, icon: b.classList.contains('icon'), glyph: getComputedStyle(b, '::before').content, bw: Math.round(b.getBoundingClientRect().width) }; });
        assert.ok(/saved/.test(saved.cls) && /^\d{2}:\d{2}$/.test(saved.time), 'History chip: saved + the run time: ' + JSON.stringify(saved));
        assert.equal(saved.border, 'rgb(52, 211, 153)', 'a green ring');
        assert.ok(!saved.statusBad && saved.statusW <= 2 && /Done · \d{2}:\d{2} · Result saved/.test(saved.statusText), 'the status text is clipped (still readable by screen readers) when all is well: ' + JSON.stringify(saved));
        assert.ok(saved.icon && saved.btn === 'Run again' && /↻/.test(saved.glyph) && saved.bw === 44, 'after a run the button is just ↻ (accessible name: Run again)');
        const ys2 = []; for (const s of rowSels) ys2.push(await cy(page, s));
        assert.ok(Math.max(...ys2) - Math.min(...ys2) <= 8, 'still ONE row after a run: ' + ys2);
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        await ctx.close();

        // ---- a run whose history could not be saved
        ({ ctx, page, errors } = await open(browser, 1100, 'fail'));
        await run(page);
        const bad = await page.evaluate(() => { const h = document.getElementById('curate-history'), s = document.getElementById('curate-history-status'); return { cls: h.className, border: getComputedStyle(h.querySelector('summary')).borderTopColor, bad: s.classList.contains('bad'), w: Math.round(s.getBoundingClientRect().width), text: s.innerText }; });
        assert.ok(/warn/.test(bad.cls) && !/saved/.test(bad.cls) && bad.border === 'rgb(245, 158, 11)', 'amber chip when it could not be saved: ' + JSON.stringify(bad));
        assert.ok(bad.bad && bad.w > 300 && /could not be saved/.test(bad.text), 'and the warning line comes back, full width: ' + JSON.stringify(bad));
        await ctx.close();

        // ---- phone: wraps, never sideways
        ({ ctx, page } = await open(browser, 372, 'ok')); await run(page);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'no horizontal scroll at 372 px');
        assert.equal(await page.evaluate(() => { const d = document.getElementById('quiz-curate-dialog'); return d.scrollWidth <= d.clientWidth + 1; }), true, 'the dialog does not scroll sideways');
        await ctx.close();
        console.log('PASS: AI Curate compact controls — one row (⚖ ★ ⇄ icons, ✏️ 🕘 inside it, ↻ after a run), History chip = saved state (green + run time / amber + warning line), status clipped when fine, no overflow on a phone');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
