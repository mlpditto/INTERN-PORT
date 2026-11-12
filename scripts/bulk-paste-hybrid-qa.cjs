// V102.635 (owner pick: hybrid C + B + D) — Bulk Paste is ONE screen: paste left, list right, live; one line per question, tap = stem + A B C D chips;
// filter chips ❔ / 🤖 <80 / ♊ / ⚠️ each with one bulk action; ⓘ = rules + "Paste this"; 🏷 one tag for the batch; ➕ Add n + ↶ Undo.
// Real admin.html (file URL, Firebase stubbed): the real parser, render, addQuestionUI and bulkPasteInsert.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const TEXT = [
    '1. Drug of choice for status epilepticus?', '   Phenytoin', '   Lorazepam IV', '   Valproate', '   Levetiracetam', '',
    '2. Antidote for warfarin with bleeding?', '   Protamine', '   Vitamin K + 4F-PCC', '   Naloxone', '',
    '3. Max daily dose of paracetamol', '   4 g', '',
    '4. Drug of choice for status epilepticus?', '   Diazepam', '   Phenobarbital', '   Ketamine'
].join('\n');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => { try { return typeof bulkPasteLive === 'function' && typeof addQuestionUI === 'function' && document.readyState === 'complete'; } catch (_) { return false; } });
        await page.waitForTimeout(300);
        await page.evaluate(() => {
            if (typeof window._qPrimerModelSelect !== 'function') window._qPrimerModelSelect = () => '';
            window.triggerAutoSave = () => {}; window.updateQuizPagination = () => {};
            document.querySelectorAll('body > *').forEach(el => { if (el.id !== 'bulkPasteModal' && el.id !== 'toast') el.style.display = 'none'; });
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = ''; addQuestionUI(null);
            openBulkPasteModal();
        });
        const M = '#bulkPasteModal';
        const lines = () => page.$$eval(M + ' .bp-ln', ls => ls.map(l => l.innerText.replace(/\s+/g, ' ').trim()));
        const chips = () => page.$$eval(M + ' .bp-f', bs => bs.map(b => b.textContent.trim()));

        // 1 · empty: one screen, the tools wait, Add is off
        assert.equal(await page.isVisible(M + ' #bp-textarea'), true);
        assert.equal(await page.$eval(M + ' .bp-head-tools', e => getComputedStyle(e).visibility), 'hidden', 'tools wait for the first question');
        assert.deepEqual([await page.$eval('#bp-add', b => b.disabled), (await page.innerText('#bp-preview-list')).trim()], [true, '👈 paste · ⓘ example']);
        assert.equal(await page.$$eval(M + ' button', bs => bs.filter(b => /Parse/.test(b.textContent)).length), 0, 'no ✂️ Parse button');

        // 2 · live: typing fills the list (no button); the same stem again starts unticked; a 1-option question = ⚠️ with its line
        await page.fill('#bp-textarea', TEXT);
        await page.waitForFunction(() => document.querySelectorAll('#bulkPasteModal .bp-ln').length === 4);
        assert.deepEqual(await lines(), ['1. Drug of choice for status epilepticus? ❔', '2. Antidote for warfarin with bleeding? ❔', '3. Drug of choice for status epilepticus? ♊ 1 ❔', '⚠️ 3. Max daily dose of paracetamol L12']);
        assert.deepEqual(await page.$$eval(M + ' .bp-ln input', cs => cs.map(c => c.checked)), [true, true, false], '♊ starts unticked');
        assert.deepEqual(await chips(), ['All 3', '❔ 2', '♊ 1', '⚠️ 1'], 'chips count once, empty ones hidden');
        assert.equal(await page.$eval('#bp-add', b => b.textContent), '➕ Add 2');
        assert.equal(await page.$eval('#bp-preview-count', e => e.textContent), '2/3');

        // 3 · tap a line → stem + A B C D; tap C = key; edit the text again → the key stays
        await page.click(M + ' .bp-s >> nth=0');
        assert.deepEqual(await page.$$eval(M + ' .bp-o', bs => bs.map(b => b.textContent)), ['A Phenytoin', 'B Lorazepam IV', 'C Valproate', 'D Levetiracetam']);
        await page.click(M + ' .bp-o >> nth=1');
        assert.equal(await page.$eval(M + ' .bp-o.ok', b => b.textContent), 'B Lorazepam IV');
        await page.type('#bp-textarea', '\n\n5. Which is a loop diuretic?\n   Furosemide\n   Spironolactone\n   Hydrochlorothiazide');
        await page.waitForFunction(() => document.querySelectorAll('#bulkPasteModal .bp-ln:not(.warn)').length === 4);
        assert.match((await lines())[0], /^1\. Drug of choice .* B$/, 'the key survives a re-parse');

        // 4 · ✏️ edit the stem in place → kept after a re-parse, and its text lines are not ⚠️
        await page.click(M + ' .bp-s >> nth=1'); await page.click(M + ' .bp-stem');
        await page.fill(M + ' .bp-ed textarea', 'Antidote for warfarin with major bleeding?');
        await page.press(M + ' .bp-ed textarea', 'Tab');
        await page.type('#bp-textarea', ' ');
        await page.waitForTimeout(400);
        assert.match((await lines())[1], /^2\. Antidote for warfarin with major bleeding\? ❔$/);
        assert.deepEqual(await page.$$eval(M + ' .bp-ln.warn', ls => ls.length), 1, 'only the 1-option question is ⚠️');

        // 5 · ❔ → 🎯 n runs E.V.I.E. on the no-key ones only; a low answer → 🤖 <80 → ☐ untick
        await page.evaluate(() => { window.callUniversalAI = () => {}; window.__asked = []; window._aiFindAnswerCore = async (q) => { __asked.push(q); return { picks: [0], conf: /loop/.test(q) ? 62 : 93, rationale: 'because' }; }; });
        await page.click(M + ' .bp-f[data-f="nokey"]');
        assert.equal((await page.innerText('#bp-bulk')).replace(/\s+/g, ' ').trim(), '🎯 E.V.I.E. on these 2 🎯 2');
        await page.click('#bp-bulk button');
        await page.waitForFunction(() => __asked.length === 2 && !document.getElementById('bp-find-btn').disabled);
        assert.deepEqual(await page.evaluate(() => __asked), ['Antidote for warfarin with major bleeding?', 'Which is a loop diuretic?'], 'only ❔, ♊ unticked skipped');
        assert.deepEqual(await chips(), ['All 4', '🤖 <80 1', '♊ 1', '⚠️ 1'], '❔ gone, 🤖 <80 appears; back on All');
        assert.deepEqual(await page.$$eval(M + ' .bp-p.c90, ' + M + ' .bp-p.c0', ps => ps.map(p => p.className.split(' ').pop() + ':' + p.textContent)), ['c90:93', 'c0:62']);
        await page.click(M + ' .bp-f[data-f="low"]'); await page.click('#bp-bulk button');
        assert.equal(await page.$eval('#bp-add', b => b.textContent), '➕ Add 2', 'the 62% one is unticked');

        // 6 · ♊ side by side → keep the second
        await page.click(M + ' .bp-f[data-f="dup"]');
        assert.equal(await page.$$eval(M + ' .bp-cmp > div', d => d.length), 2);
        await page.click(M + ' .bp-cmp > div:nth-child(2) button');
        assert.deepEqual(await page.evaluate(() => _bulkPasteParsed.map(r => r.include)), [false, true, true, false]);

        // 7 · ⚠️ → tap = those lines selected in the text
        await page.click(M + ' .bp-f[data-f="bad"]'); await page.click(M + ' .bp-ln.warn');
        assert.equal(await page.$eval('#bp-textarea', t => t.value.slice(t.selectionStart, t.selectionEnd)), '3. Max daily dose of paracetamol\n   4 g');

        // 8 · ⓘ → rules + "Paste this" adds one example question
        await page.click(M + ' .bp-help');
        assert.equal(await page.isVisible('#bp-howto'), true);
        await page.click('#bp-howto button');
        await page.waitForFunction(() => _bulkPasteParsed.some(r => /heparin/.test(r.q)));
        assert.equal(await page.isVisible('#bp-howto'), false);
        assert.match(await page.$eval('#bp-textarea', t => t.value), /\n6\. Antidote for heparin overdose\?/, 'the example follows the text numbering');
        assert.deepEqual(await page.evaluate(() => _bulkPasteParsed.map(r => [r.q, r.correct.join(), r.include])), [
            ['Drug of choice for status epilepticus?', '1', false], ['Antidote for warfarin with major bleeding?', '0', true], ['Drug of choice for status epilepticus?', '', true],
            ['Which is a loop diuretic?', '0', false], ['Antidote for heparin overdose?', '', true]], 'keys, ticks and edits survive the new question; no "1. 1." stems');
        assert.equal(await page.isVisible('#bp-bulk'), false, 'no empty bulk bar on All');

        // 9 · 📂 JSON rows sit after the text's rows and stay when the text changes
        await page.evaluate(() => bulkPasteSetExternal(bulkPasteRowsFromJson([{ q: 'JSON Q?', options: ['x', 'y'], correct: [1] }])));
        await page.type('#bp-textarea', ' ');
        await page.waitForTimeout(400);
        assert.equal(await page.evaluate(() => _bulkPasteParsed.at(-1).q), 'JSON Q?');

        // 10 · 🏷 one tag + ➕ Add n → the editor; ↶ Undo takes them out and reopens Bulk Paste as it was
        await page.click(M + ' .bp-tag'); await page.fill(M + ' input.bp-tag', 'Antidote'); await page.press(M + ' input.bp-tag', 'Enter');
        assert.equal(await page.$eval(M + ' .bp-tag', b => b.textContent), '🏷 Antidote');
        const n = await page.evaluate(() => _bulkPasteParsed.filter(r => r.include).length);
        assert.equal(await page.$eval('#bp-add', b => b.textContent), '➕ Add ' + n);
        await page.click('#bp-add');
        const ed = await page.evaluate(() => [...document.querySelectorAll('.quiz-q-item')].map(el => [el.querySelector('.q-text').value, (el.querySelector('.q-tags') || {}).value || '']));
        assert.equal(ed.length, n, 'blank starter replaced, ' + n + ' added');
        assert.ok(ed.every(([, t]) => /Antidote/.test(t)), 'every added question carries 🏷 Antidote: ' + JSON.stringify(ed));
        assert.equal(await page.isVisible(M), false);
        assert.match(await page.innerText('#toast'), /✅ Added \d+/);
        await page.click('#toast .toast-undo');
        assert.equal(await page.evaluate(() => document.querySelectorAll('.quiz-q-item').length), 1, 'undo: back to one blank starter');
        assert.equal(await page.isVisible(M), true, 'Bulk Paste open again');
        assert.equal(await page.$eval('#bp-add', b => b.textContent), '➕ Add ' + n, 'with the same picks');

        // 11 · phone 390: one column, nothing wider than the screen
        await page.setViewportSize({ width: 390, height: 844 });
        await page.click(M + ' .bp-f[data-f="all"]');
        const fit = await page.evaluate(() => { const c = document.querySelector('#bulkPasteModal .modal-content').getBoundingClientRect(); const ta = document.getElementById('bp-textarea').getBoundingClientRect(), l = document.getElementById('bp-preview-list').getBoundingClientRect(); return [ta.bottom <= l.top, [...document.querySelectorAll('#bulkPasteModal .bp-ln, #bulkPasteModal .bp-head, #bulkPasteModal .bp-foot')].every(e => e.getBoundingClientRect().right <= c.right + 1)]; });
        assert.deepEqual(fit, [true, true], 'phone: list under the text, everything fits');
        if (process.env.OUTDIR) {
            await page.setViewportSize({ width: 1280, height: 900 });
            await page.click(M + ' .bp-s >> nth=1');
            await page.screenshot({ path: process.env.OUTDIR + '/bp-hybrid-desktop.png' });
            await page.setViewportSize({ width: 390, height: 844 });
            await page.screenshot({ path: process.env.OUTDIR + '/bp-hybrid-phone.png' });
        }
        assert.deepEqual(errors.filter(e => /bulkPaste|_bp\b|bpNorm|bp-/.test(e)), [], 'no Bulk Paste errors (the stubbed page has others)');
        console.log('PASS: Bulk Paste hybrid — live list, ♊ unticked, ⚠️ lines selectable, keys/edits survive re-parse, ❔ 🎯 n, 🤖 <80 untick, ♊ keep, ⓘ Paste this, JSON rows kept, 🏷 batch tag, ➕ Add n + ↶ Undo, phone fit');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
