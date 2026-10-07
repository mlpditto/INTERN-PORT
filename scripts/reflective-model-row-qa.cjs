// V102.118: Reflective Review — vendor-first MODEL rows (Model + Writing Analysis): provider logo tabs, then only that
// provider's chips, on one row; trial chips (Grok, Ollama) work and survive a reload; the V101.25 fold toggle is gone.
// The REAL markup, CSS, ai-model-ui.js rail, provider-tab renderer and rrInitModelRow() cut out of admin.html, run in a
// browser page at desktop and phone width.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const read = f => fs.readFileSync('public/' + f, 'utf8').replace(/\r\n/g, '\n');
const html = read('admin.html');
const between = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert(i >= 0 && j > i, 'marker ' + a.slice(0, 50)); return html.slice(i, j); };
const grammarCard = between('                <div id="reflective-grammar-card"', '                    <section class="reflective-review-writing"');
const feedbackRows = between('                <div class="reflective-review-card reflective-review-field reflective-review-feedback">', '                    <div class="rr-editor-shell">') + '</div>';
const railFns = between('        window.browseAuditProvider = function(button) {', '        window.auditModelControlsHtml = function(');
const initFns = between('        window.rrInitModelRow = function(inputId, tabsId) {', "        document.addEventListener('DOMContentLoaded', () => setTimeout(window.rrInitModelRows");
const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n');

// source guards
for (const gone of ['collapseReflectiveModelRail', 'rr-rail-toggle', 'rr-rail-collapsed', 'reflective-model-dd', 'rr-model-label', 'selectReflectiveReviewModel', 'reflective-review-model-chip']) assert.ok(!html.includes(gone), gone + ' is gone');
assert.ok(!read('ai-model-ui.js').includes('reflective-model-dd'), 'ai-model-ui.js no longer looks for the dropdown shell');
assert.ok(/window\.rrInitModelRows\(\);\s*\n\s*\[\['ai-model-review', 'rr-providers'\], \['ai-model-grammar', 'rr-grammar-providers'\]\]\.forEach/.test(html), 'modal open syncs both rows');
assert.ok(html.includes('#reflective-grammar-card:has(.rr-grammar-optout) #rr-grammar-model-row { display:none !important; }'), 'grammar opt-out hides the whole row');
for (const id of ['ai-model-review', 'ai-model-grammar', 'rr-providers', 'rr-grammar-providers', 'rr-model-row', 'rr-grammar-model-row', 'ai-lang-review', 'reflective-grammar-score']) assert.ok(html.includes('id="' + id + '"'), id + ' still exists');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const errors = []; const ctx = await browser.newContext();
        const open = async width => {
            const p = await ctx.newPage(); await p.setViewportSize({ width, height: 700 });
            p.on('pageerror', e => errors.push(e.message));
            await p.route('http://rr.test/**', r => {
                const u = new URL(r.request().url()).pathname.slice(1);
                r.fulfill(u ? { body: fs.readFileSync('public/' + u), contentType: u.endsWith('.svg') ? 'image/svg+xml' : u.endsWith('.css') ? 'text/css' : 'text/plain' } : { body: '<html><body></body></html>', contentType: 'text/html' });
            });
            await p.goto('http://rr.test/');
            await p.setContent(`<base href="http://rr.test/">${styles}<link rel="stylesheet" href="text-ai-chips.css"><link rel="stylesheet" href="audit-toolbar.css"><style>body{margin:0;padding:10px;background:#fff8ea;font-family:Inter,system-ui,sans-serif}</style><div id="reflectiveReviewModal">${feedbackRows}${grammarCard}</div>`);
            // the <link> sheets apply a beat after setContent resolves — wait until text-ai-chips.css paints a probe chip
            await p.waitForFunction(() => { const d = document.createElement('div'); d.className = 'text-ai-chips'; d.innerHTML = '<button class="glass-toggle-item" data-vendor="qwen" aria-pressed="true">x</button>'; document.body.append(d); const ok = getComputedStyle(d.firstChild).color === 'rgb(255, 255, 255)'; d.remove(); return ok; });
            await p.evaluate(() => { document.getElementById('reflective-grammar-card').style.display = ''; });
            await p.addScriptTag({ url: 'http://rr.test/ai-model-ui.js' });
            await p.addScriptTag({ content: `window.syncModelDefault = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; }; window.selectReflectiveFocusPill = window.toggleReflectiveFocusMore = () => {}; ${railFns}\n${initFns}` });
            await p.evaluate(() => { window.initRegistryModelSelectors(); window.rrInitModelRows(); });
            return p;
        };
        const tabs = (p, row) => p.locator(`#${row} .audit-provider`).evaluateAll(ns => ns.map(n => n.getAttribute('aria-label')));
        const openTab = (p, row) => p.locator(`#${row} .audit-provider[aria-pressed="true"]`).getAttribute('data-provider');
        const visibleChips = (p, row) => p.evaluate(r => [...document.querySelectorAll(`#${r} .text-ai-chips > button`)].filter(b => !b.hidden).map(b => b.textContent.trim()), row);

        // ---- desktop ----
        let p = await open(1000);
        for (const row of ['rr-providers', 'rr-grammar-providers']) assert.deepEqual(await tabs(p, row), ['Gemini', 'GPT', 'Claude', 'Qwen', 'DeepSeek', 'Grok', 'Ollama'], row + ' tabs');
        assert.equal(await openTab(p, 'rr-providers'), 'GPT', 'review default is Luna → GPT tab');
        assert.deepEqual(await visibleChips(p, 'rr-model-row'), ['Luna 6', 'Terra 5.6', 'Sol 6', 'Astra 6'], 'only GPT chips, names only');
        // the markup's stale `gemini-3.5-flash` default is not a catalogue id, so the registry normalises it to Luna (pre-existing, V94.18 → V101.64)
        assert.equal(await openTab(p, 'rr-grammar-providers'), 'GPT', 'grammar default normalises to Luna → GPT tab');
        assert.deepEqual(await visibleChips(p, 'rr-grammar-model-row'), ['Luna 6', 'Terra 5.6', 'Sol 6', 'Astra 6']);
        assert.equal(await p.locator('#rr-model-row .text-ai-chips .text-ai-logo').evaluateAll(ns => ns.filter(n => getComputedStyle(n).display !== 'none').length), 0, 'chips carry no logo (the tab does)');
        assert.equal(await p.locator('#rr-providers .audit-provider[data-provider="Ollama"] .text-ai-logo').evaluate(n => getComputedStyle(n).backgroundImage.includes('ollama-white.svg') && getComputedStyle(n).filter.includes('invert')), true, 'Ollama tab is the inverted white mark');
        const geo = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { row: r('#rr-model-row'), label: r('.reflective-review-feedback .rr-row:nth-of-type(2) .rr-mini-label'), tabs: r('#rr-providers'), chips: r('#rr-model-row .text-ai-chips') }; });
        assert.ok(geo.row.height < 40, 'one row: ' + geo.row.height + ' px');
        assert.ok(Math.abs((geo.tabs.top + geo.tabs.height / 2) - (geo.chips.top + geo.chips.height / 2)) < 6, 'tabs and chips share the row');
        assert.ok(geo.label.right <= geo.tabs.left, 'MODEL label sits left of the tabs');
        assert.equal(await p.locator('#reflectiveReviewModal .rr-rail-toggle').count(), 0, 'no fold pill');

        // picking a tab shows that provider's chips; picking a chip sets the select and the registry pref
        await p.locator('#rr-providers .audit-provider[data-provider="Qwen"]').click();
        assert.deepEqual(await visibleChips(p, 'rr-model-row'), ['Qwen Flash 3.8', 'Qwen Max 3.8']);
        await p.locator('#rr-model-row .text-ai-chips > button:not([hidden])', { hasText: 'Qwen Flash 3.8' }).click();
        assert.equal(await p.locator('#ai-model-review').inputValue(), 'or/qwen/qwen3.8-flash');
        assert.equal(await p.locator('#rr-model-row .text-ai-chips [aria-pressed="true"]').count(), 1);
        // .glass-toggle-item transitions `all 0.2s`, so read the colour once it has settled
        await p.waitForFunction(() => getComputedStyle(document.querySelector('#rr-model-row .text-ai-chips [aria-pressed="true"]')).color === 'rgb(255, 255, 255)', null, { timeout: 3000 }).catch(() => assert.fail('picked chip is the solid vendor colour (white name)'));
        assert.equal(await p.evaluate(() => localStorage.getItem('ai_default_review_model')), 'or/qwen/qwen3.8-flash', 'catalogue pick is the review default');

        // trial: Ollama tab → one chip; picking it holds in the <select> (option added), is remembered under its own key, and reaches the AI call unnormalised
        await p.locator('#rr-providers .audit-provider[data-provider="Ollama"]').click();
        assert.deepEqual(await visibleChips(p, 'rr-model-row'), ['Ollama']);
        await p.locator('#rr-model-row .text-ai-chips > button:not([hidden])').click();
        assert.equal(await p.locator('#ai-model-review').inputValue(), 'ol/local', 'select holds the trial id');
        assert.equal(await p.evaluate(() => localStorage.getItem('ai_rr_trial_ai-model-review')), 'ol/local');
        assert.equal(await p.evaluate(() => localStorage.getItem('ai_default_review_model')), 'or/qwen/qwen3.8-flash', 'trial pick never becomes the Settings default');
        await p.locator('#rr-grammar-providers .audit-provider[data-provider="Grok"]').click();
        await p.locator('#rr-grammar-model-row .text-ai-chips > button:not([hidden])').click();
        assert.equal(await p.locator('#ai-model-grammar').inputValue(), 'or/x-ai/grok-4.7');
        await p.close();

        // ---- reload: both trial picks come back (the registry alone would normalise them away) ----
        p = await open(1000);
        assert.equal(await p.locator('#ai-model-review').inputValue(), 'ol/local');
        assert.equal(await openTab(p, 'rr-providers'), 'Ollama');
        assert.equal(await p.locator('#ai-model-grammar').inputValue(), 'or/x-ai/grok-4.7');
        assert.equal(await openTab(p, 'rr-grammar-providers'), 'Grok');
        // a catalogue pick clears the trial key
        await p.locator('#rr-providers .audit-provider[data-provider="Claude"]').click();
        await p.locator('#rr-model-row .text-ai-chips > button:not([hidden])', { hasText: 'Sonnet 5.5' }).click();
        assert.equal(await p.evaluate(() => localStorage.getItem('ai_rr_trial_ai-model-review')), null);
        assert.equal(await p.locator('#ai-model-review').inputValue(), 'claude-sonnet-5-5');
        // rrSyncModelRow (modal open) follows a programmatic value
        await p.evaluate(() => { document.getElementById('ai-model-review').value = 'gemini-3.8-flash'; window.rrSyncModelRow('ai-model-review', 'rr-providers'); });
        assert.equal(await openTab(p, 'rr-providers'), 'Gemini');
        assert.deepEqual(await visibleChips(p, 'rr-model-row'), ['Lite 3.5', 'Flash 3.8']);
        await p.close();

        // ---- phone ----
        p = await open(400);
        const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.getElementById('rr-model-row').getBoundingClientRect().height }));
        assert.ok(m.sw <= m.cw + 1, 'no sideways scroll at 400 px: ' + JSON.stringify(m));
        assert.ok(m.h < 90, 'phone row wraps to at most two lines: ' + m.h + ' px');
        await p.close();

        assert.deepEqual(errors, []);
        console.log('PASS: reflective-review model rows — Model + Writing Analysis are one row each (MODEL label · 7 provider logo tabs · that provider\'s name-only chips), no fold pill, trial chips (Grok, Ollama) hold in the <select>, are remembered across reload and never become the Settings default, grammar opt-out hides the row, no sideways scroll at 400 px');
    } finally {
        await browser.close();
    }
})().catch(e => { console.error(e); process.exit(1); });
