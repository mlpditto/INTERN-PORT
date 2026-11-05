// V102.589 (owner: "A everywhere") — every AI model picker has the vendor-first look: vendor icons, the picked vendor's chips right after
// its icon, on one line. The REAL ai-model-ui.js + text-ai-chips.css + audit-toolbar.css + admin.html providerModelRailHtml /
// browseAuditProvider / Compare B (_compareModelBPickerHtml, cmpBrowseVendor), on a blank page.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public') + '/';
const admin = fs.readFileSync(PUB + 'admin.html', 'utf8');
const grab = name => { const i = admin.indexOf('window.' + name + ' = function'); assert.ok(i > 0, name); const j = admin.indexOf('\n        };', i); return admin.slice(i, j + 11); };
const lib = ['providerModelRailHtml', 'browseAuditProvider', 'cmpBrowseVendor', '_compareModelBPickerHtml'].map(grab).join('\n');
const tmp = PUB + 'zz-one-style-qa.html';
fs.writeFileSync(tmp, `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="text-ai-chips.css"><link rel="stylesheet" href="audit-toolbar.css"></head>
<body style="width:900px"><script src="ai-model-ui.js"></script><script>window.textAIModelInfo = id => [...TEXT_AI_MODELS, ...TEXT_AI_TRIAL_MODELS].find(m => m.id === id); window._compareModelB = () => 'gpt-6-astra';\n${lib}</script></body></html>`);

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(tmp).href);
    const wait = () => page.waitForTimeout(80);
    // geometry of one row: visible buttons in visual order, each with its vendor
    const geo = sel => page.evaluate(sel => {
      const row = document.querySelector(sel);
      const vis = [...row.querySelectorAll('button')].filter(b => b.offsetParent !== null && getComputedStyle(b).display !== 'none');
      const cy = vis.map(b => { const r = b.getBoundingClientRect(); return Math.round(r.top + r.height / 2); });
      const seq = vis.slice().sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
        .map(b => b.matches('.audit-provider, .cmp-vendor, .mr-vendor') ? '[' + b.dataset.provider + (b.getAttribute('aria-pressed') === 'true' ? '*' : '') + ']' : (b.getAttribute('aria-label') || '').split(' ')[0]);
      return { spread: Math.max(...cy) - Math.min(...cy), seq };
    }, sel);
    // after the pressed icon come only its vendor's chips, then the next icon
    const seated = seq => { const i = seq.findIndex(s => s.endsWith('*]')), v = seq[i].slice(1, -2), next = seq.slice(i + 1); const k = next.findIndex(s => s.startsWith('[')); const chips = k < 0 ? next : next.slice(0, k); return chips.length > 0 && chips.every(c => c === v); };

    // 1 · style B (providerModelRailHtml: a tab row + a chip row) → one line, chips right after the picked icon
    await page.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<div id="b" class="audit-toolbar" style="width:900px">' + providerModelRailHtml('bm', 'gpt-6-luna', '') + '</div>'); });
    await wait();
    let g = await geo('#b .audit-model-row');
    assert.ok(g.spread <= 4, 'B: tabs and chips share one line: ' + JSON.stringify(g));
    assert.ok(seated(g.seq) && g.seq.indexOf('[GPT*]') === 1, 'B: GPT chips right after the GPT icon: ' + g.seq.join(' '));
    await page.click('#b .audit-provider[data-provider="Claude"]'); await wait();
    g = await geo('#b .audit-model-row');
    assert.ok(seated(g.seq) && g.seq[g.seq.indexOf('[Claude*]') + 1] === 'Claude', 'B: tapping Claude seats its chips after it: ' + g.seq.join(' '));
    await page.evaluate(() => browseAuditProvider(document.querySelector('#b .audit-provider[data-provider="Qwen"]'))); await wait();
    g = await geo('#b .audit-model-row');
    assert.ok(seated(g.seq) && g.seq.includes('[Qwen*]'), 'B: a programmatic browseAuditProvider re-seats too: ' + g.seq.join(' '));
    assert.equal(await page.locator('#bm').count(), 1, 'B: the hidden input / ids are kept');

    // 2 · style C (textAIChipsHtml: every model on one long rail) → vendor-first
    await page.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<div id="c" style="width:900px">' + textAIChipsHtml('', 'claude-opus-5-5', '', TEXT_AI_TRIAL_MODELS) + '</div>'); });
    await wait();
    g = await geo('#c .text-ai-chips');
    assert.equal(await page.locator('#c .mr-vendor').count(), 9, 'C: 9 vendor icons (7 + Grok + Ollama)');
    assert.equal(await page.locator('#c .mr-vendor[data-provider="Ollama"] .text-ai-logo').count(), 1, 'C: Ollama is a logo, not the word');
    assert.ok(g.spread <= 4 && seated(g.seq) && g.seq.includes('[Claude*]'), 'C: one line, only the picked vendor’s chips after its icon: ' + g.seq.join(' '));
    assert.equal(await page.locator('#c .text-ai-chips > button[data-value]').count(), 21, 'C: every chip still in the DOM');

    // 3 · Compare B (B · its own vendor icons · that vendor's models) → chips after the picked icon
    await page.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<div id="d" style="width:900px">' + _compareModelBPickerHtml() + '</div>'); });
    await wait();
    g = await geo('#d .cmp-b');
    assert.ok(g.spread <= 6 && seated(g.seq) && g.seq.includes('[GPT*]'), 'Compare B: one line, GPT chips after the GPT icon: ' + g.seq.join(' '));
    assert.equal(await page.evaluate(() => { const l = document.querySelector('#d .cmp-b-lbl').getBoundingClientRect().left; return [...document.querySelectorAll('#d .cmp-vendor')].every(v => v.getBoundingClientRect().left > l); }), true, 'Compare B: the B label stays first');
    await page.click('#d .cmp-vendor[data-provider="Kimi"]'); await wait();
    g = await geo('#d .cmp-b');
    assert.ok(seated(g.seq) && g.seq[g.seq.indexOf('[Kimi*]') + 1] === 'Kimi', 'Compare B: tapping Kimi seats Kimi K3.1 Pro after it: ' + g.seq.join(' '));

    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS: model pickers, one style (V102.589) — tab rails (providerModelRailHtml, Compare B) on one line with the picked vendor’s chips right after its icon (click + programmatic), plain rails become vendor-first (9 icons, Ollama logo), ids kept');
  } finally { await browser.close(); fs.unlinkSync(tmp); }
})().catch(e => { console.error(e); process.exit(1); });
