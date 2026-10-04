// V102.83: Learning Path "AI Learning Path" strip — one lean row. The REAL markup, CSS, ai-model-ui.js rail, provider-tab renderer
// and lpInitModelRow() cut out of admin.html, run in a browser page at desktop and phone width.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const read = f => fs.readFileSync('public/' + f, 'utf8').replace(/\r\n/g, '\n');
const html = read('admin.html');
const between = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert(i >= 0 && j > i, 'marker ' + a.slice(0, 50)); return html.slice(i, j); };
const strip = between('                <div id="lp-path-strip" class="lp-strip">', '                    <div id="lp-path-detail"') + '</div>';
const railFns = between('        window.browseAuditProvider = function(button) {', '        window.auditModelControlsHtml = function(');
const initFn = between('        window.lpInitModelRow = function() {', "        document.addEventListener('DOMContentLoaded', () => setTimeout(window.lpInitModelRow");
const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n');

// source guards: the three AI calls keep a picked trial model, the buttons are icon-only (their reset text is an icon too)
assert.equal((html.match(/textAIModel\('lp-ai-model'\)/g) || []).length, 0, 'no call normalises the picked model away');
assert.equal((html.match(/resolveTrialTextAIModel\(document\.getElementById\('lp-ai-model'\)\.value\)/g) || []).length, 3, 'path, weekly summary, entry enhance');
assert.ok(!/Generate My Path'; btn\.disabled/.test(html) && html.includes("btn.textContent = '🤖'; btn.disabled = false;") && html.includes("btn.textContent = '⏳'; btn.disabled = true;"), 'generate button text stays an icon');
for (const id of ['lp-gen-btn', 'lp-path-toggle-btn', 'lp-path-subtitle', 'lp-path-detail', 'lp-path-content', 'lp-ai-model']) assert.ok(html.includes('id="' + id + '"'), id + ' still exists');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const errors = []; const ctx = await browser.newContext();
        const open = async width => {
            const p = await ctx.newPage(); await p.setViewportSize({ width, height: 700 });
            p.on('pageerror', e => errors.push(e.message));
            await p.route('http://lp.test/**', r => {
                const u = new URL(r.request().url()).pathname.slice(1);
                r.fulfill(u ? { body: fs.readFileSync('public/' + u), contentType: u.endsWith('.svg') ? 'image/svg+xml' : u.endsWith('.css') ? 'text/css' : 'text/plain' } : { body: '<html><body></body></html>', contentType: 'text/html' });
            });
            await p.goto('http://lp.test/');
            await p.setContent(`<base href="http://lp.test/">${styles}<link rel="stylesheet" href="text-ai-chips.css"><link rel="stylesheet" href="audit-toolbar.css"><style>body{margin:0;padding:10px;background:#f1f5f9;font-family:Inter,system-ui,sans-serif}</style><div id="host">${strip}<div id="lp-path-content"></div></div></div>`);
            await p.addScriptTag({ url: 'http://lp.test/ai-model-ui.js' });
            await p.addScriptTag({ content: `window.TEXT_AI_MODELS = window.TEXT_AI_MODELS; ${railFns}\n${initFn}` });
            await p.evaluate(() => { window.initRegistryModelSelectors(); window.lpInitModelRow(); });
            return p;
        };
        const visibleChips = p => p.evaluate(() => [...document.querySelectorAll('#lp-model-row .text-ai-chips > button')].filter(b => !b.hidden).map(b => b.textContent.trim()));

        // ---- desktop ----
        let p = await open(900);
        assert.deepEqual(await p.locator('#lp-providers .audit-provider').evaluateAll(ns => ns.map(n => n.getAttribute('aria-label'))), ['Gemini', 'GPT', 'Claude', 'Qwen', 'DeepSeek', 'Grok', 'Ollama']);
        assert.equal(await p.locator('#lp-providers .audit-provider[data-provider="Ollama"] .text-ai-logo').evaluate(n => getComputedStyle(n).backgroundImage.includes('ollama-white.svg')), true, 'Ollama tab is a logo');
        assert.equal(await p.locator('#lp-providers .audit-provider[aria-pressed="true"]').getAttribute('data-provider'), 'GPT');
        assert.deepEqual(await visibleChips(p), ['Luna 6', 'Terra 5.6', 'Sol 6', 'Astra 6'], 'only the picked provider\'s chips');
        const box = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { strip: r('#lp-path-strip').height, title: r('.lp-strip-title'), tabs: r('#lp-providers'), act: r('.lp-strip-actions'), gen: r('#lp-gen-btn') }; });
        assert.ok(box.strip < 75, 'one row, strip is ' + box.strip + ' px (was ~140+ with two chip rows)');
        assert.ok(Math.abs((box.title.top + box.title.height / 2) - (box.act.top + box.act.height / 2)) < 12, 'title and actions share the row');
        assert.equal(await p.locator('#lp-gen-btn').textContent(), '🤖'); assert.equal(await p.locator('button[onclick="generateWeeklySummary()"]').textContent(), '📊');
        assert.equal(await p.locator('#lp-gen-btn').getAttribute('aria-label'), 'Generate My Path');
        assert.equal(await p.locator('#lp-path-subtitle').isVisible(), false, 'subtitle is empty until a path is generated');
        await p.evaluate(() => { document.getElementById('lp-path-subtitle').textContent = 'Generated 4/10/2026'; });
        assert.equal(await p.locator('#lp-path-subtitle').isVisible(), true, 'the generated-on date still shows');

        // trial chips: Ollama tab shows only "Ollama local"; picking it sets the model, marks it, and is remembered
        await p.locator('#lp-providers .audit-provider[data-provider="Ollama"]').click();
        assert.deepEqual(await visibleChips(p), ['Ollama']);
        await p.locator('#lp-model-row .text-ai-chips > button:not([hidden])').click();
        assert.equal(await p.locator('#lp-ai-model').inputValue(), 'ol/local');
        assert.equal(await p.locator('#lp-model-row .text-ai-chips [aria-pressed="true"]').count(), 1);
        assert.equal(await p.evaluate(() => localStorage.getItem('ai_lp_trial_model')), 'ol/local');
        assert.equal(await p.evaluate(() => resolveTrialTextAIModel(document.getElementById('lp-ai-model').value)), 'ol/local', 'the AI calls get the trial model, not Luna');
        // a catalogue pick still works and is what the calls use
        await p.locator('#lp-providers .audit-provider[data-provider="Claude"]').click();
        await p.locator('#lp-model-row .text-ai-chips > button:not([hidden])', { hasText: 'Sonnet 5.5' }).click();
        assert.equal(await p.evaluate(() => resolveTrialTextAIModel(document.getElementById('lp-ai-model').value)), await p.evaluate(() => TEXT_AI_MODELS.find(m => /Sonnet 5.5/.test(m.label)).id));
        assert.equal(await p.evaluate(() => document.querySelectorAll('#lp-model-row .text-ai-chips > button').length), 14 + 2, '14 catalogue chips + Grok + Ollama trial chips');
        assert.equal(await p.evaluate(() => localStorage.getItem('ai_lp_trial_model')), null, 'a catalogue pick clears the trial pick');
        await p.locator('#lp-providers .audit-provider[data-provider="Ollama"]').click();
        await p.locator('#lp-model-row .text-ai-chips > button:not([hidden])').click();
        await p.close();

        // ---- reload: the saved trial pick comes back (the registry alone would normalise it away) ----
        p = await open(900);
        assert.equal(await p.locator('#lp-ai-model').inputValue(), 'ol/local');
        assert.equal(await p.locator('#lp-providers .audit-provider[aria-pressed="true"]').getAttribute('data-provider'), 'Ollama');
        assert.deepEqual(await visibleChips(p), ['Ollama']);
        await p.close();

        // ---- phone ----
        
        p = await open(400);
        await p.evaluate(() => localStorage.clear());
        const m = await p.evaluate(() => ({ sw: document.getElementById('host').scrollWidth, cw: document.documentElement.clientWidth, h: document.getElementById('lp-path-strip').getBoundingClientRect().height }));
        assert.ok(m.sw <= m.cw + 1, 'no sideways scroll at 400 px: ' + JSON.stringify(m));
        assert.ok(m.h < 160, 'phone strip is ' + m.h + ' px');
        await p.close();

        assert.deepEqual(errors, []);
        console.log('PASS: learning-path strip — one lean row (title · provider logo tabs incl. Ollama · that provider\'s chips · icon actions), trial chips (Grok, Ollama) work and are remembered across reload, calls keep the picked trial model, generated-on date still shows, ids/handlers kept, no sideways scroll at 400 px');
    } finally {
        await browser.close();
    }
})().catch(e => { console.error(e); process.exit(1); });
