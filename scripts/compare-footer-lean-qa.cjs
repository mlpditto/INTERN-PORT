// V102.221 — Quality Improvement Comparison footer: Model B on ONE row (B · vendor icons · that vendor's models) and a single icon action row.
// The REAL _compareModelBPickerHtml + cmpBrowseVendor + text-ai-chips.css in Chromium; the footer markup is checked in the source of previewAiFix.
const fs = require('fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
const cut = (a0, b0) => { const a = html.indexOf(a0), b = html.indexOf(b0, a + a0.length); if (a < 0 || b < 0) throw new Error('slice not found: ' + a0); return html.slice(a, b); };
const modelB = cut('        window._compareModelB = function', '        window.generateAiProposalB =');

// ---- the modal template (V102.237: no footer any more — the AI controls sit in line 2 of the top bar)
const foot = cut('overlay.id = "ai-compare-overlay";', "document.body.appendChild(overlay);");
for (const [label, re] of [['Compare B', /aria-label="Compare B" class="btn cmp-ib">⚖️/], ['Merge', /aria-label="\$\{mergedQV \? 'Re-merge' : 'Merge'\}" class="btn cmp-ib">🧬/], ['Keep Original', /aria-label="Keep Original">↩/], ['Regenerate', /aria-label="Regenerate"[^>]*>🔄<\/button>/]]) assert.ok(re.test(foot), label + ' is a round icon button with an accessible name');
assert.ok(!/>Keep Original<|>🔄 Regenerate<|⚖️ Compare B<|🧬 \$\{/.test(foot), 'no word labels left on the AI actions');
assert.ok(/id="ai-compare-instruction"[^>]*placeholder="\$\{mergedQV \? 'Re-merge instruction' : 'Steer…'\}"/.test(foot), 'Steer… input');
assert.ok(!/border-top:1\.5px solid #edf2f7; display:flex; flex-direction:column; gap:8px/.test(foot), 'no footer bar left');
const at = k => foot.indexOf(k);
assert.ok(at('_compareModelBPickerHtml') < at('generateAiProposalB') && at('generateAiProposalB') < at('mergeAiVersions') && at('mergeAiVersions') < at('aria-label="Regenerate"') && at('aria-label="Regenerate"') < at('Keep Original') && at('Keep Original') < at('${statusHtml}') && at('${statusHtml}') < at('ai-compare-instruction') && at('ai-compare-instruction') < at('showFullQuizPreview'), 'order (V102.255): line 1 Model B · ⚖️ · 🧬 · 🔄 · commit · line 2 chips · steer · tools');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('https://cmpf.test/', r => r.fulfill({ body: '<meta charset="utf-8"><body></body>', contentType: 'text/html' }));
        await page.route('https://cmpf.test/assets/**', r => r.fulfill({ path: 'public' + new URL(r.request().url()).pathname, contentType: 'image/svg+xml' }));
        await page.goto('https://cmpf.test/');
        for (const css of ['public/text-ai-chips.css', 'public/audit-toolbar.css']) await page.addStyleTag({ content: fs.readFileSync(css, 'utf8') });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        await page.addScriptTag({ content: modelB });
        await page.evaluate(() => { localStorage.setItem('ai_default_2model_b', 'gpt-6-astra'); document.body.innerHTML = '<div id="b" style="background:#fff;padding:12px;width:860px">' + window._compareModelBPickerHtml() + '</div>'; });
        const vendors = await page.locator('#b .cmp-vendor').evaluateAll(ns => ns.map(n => [n.getAttribute('aria-label'), n.getAttribute('aria-pressed'), n.querySelector('.text-ai-logo')?.dataset.owner || '']));
        assert.deepEqual(vendors, [['Gemini', 'false', 'gemini'], ['GPT', 'true', 'openai'], ['Claude', 'false', 'claude'], ['Qwen', 'false', 'qwen'], ['DeepSeek', 'false', 'deepseek'], ['Muse', 'false', 'meta'], ['Grok', 'false', 'grok'], ['Ollama', 'false', 'ollama']], 'eight vendor icons, the picked model\'s vendor pressed');
        const shown = () => page.locator('#b .text-ai-chips > button:visible').evaluateAll(bs => bs.map(b => b.getAttribute('aria-label')));
        assert.deepEqual(await shown(), ['GPT 6 Luna', 'GPT 5.6 Terra', 'GPT 6 Sol', 'GPT 6 Astra'], 'only the picked vendor\'s models');
        assert.equal(await page.locator('#b .text-ai-chips > button').count(), 18, 'every chip is still in the DOM (hidden), nothing duplicated');
        const ys = await page.locator('#b .cmp-b-lbl, #b .cmp-vendors, #b .text-ai-chips > button:visible').evaluateAll(ns => ns.map(n => { const r = n.getBoundingClientRect(); return Math.round(r.top + r.height / 2); }));
        assert.ok(Math.max(...ys) - Math.min(...ys) <= 8, 'B · vendors · models are ONE row: ' + ys);
        // pick another vendor → its models; picking a chip keeps ONE pressed chip and saves the choice
        await page.locator('#b .cmp-vendor[data-provider="Claude"]').click();
        assert.deepEqual(await shown(), ['Claude Haiku 4.5', 'Claude Sonnet 5.5', 'Claude Opus 5.5', 'Claude Fable 5.1']);
        assert.equal(await page.locator('#b .cmp-vendor[aria-pressed="true"]').count(), 1);
        await page.locator('#b button[aria-label="Claude Opus 5.5"]').click();
        assert.equal(await page.evaluate(() => localStorage.getItem('ai_default_2model_b')), 'claude-opus-5-5');
        assert.equal(await page.locator('#b .text-ai-chips > button[aria-pressed="true"]').count(), 1);
        await page.locator('#b .cmp-vendor[data-provider="Grok"]').click(); assert.deepEqual(await shown(), ['Grok 4.7'], 'trial models live under their vendor too');
        await page.locator('#b .cmp-vendor[data-provider="Ollama"]').click(); assert.deepEqual(await shown(), ['Ollama local']);
        // a saved trial pick opens on its vendor
        await page.evaluate(() => { localStorage.setItem('ai_default_2model_b', 'or/x-ai/grok-4.7'); document.getElementById('b').innerHTML = window._compareModelBPickerHtml(); });
        assert.deepEqual(await shown(), ['Grok 4.7']); assert.equal(await page.locator('#b .cmp-vendor[aria-pressed="true"]').getAttribute('aria-label'), 'Grok');
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: Compare footer — Model B on one row (B · 7 vendor icons · that vendor\'s models, picked vendor pre-selected, no duplicates, trial models under their vendor), round icon actions with accessible names; the controls live in the 3-line top bar (no footer)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
